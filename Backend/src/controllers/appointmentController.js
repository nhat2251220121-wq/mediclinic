const { pool } = require('../config/db');
const { validateFollowUpBooking } = require('../utils/followUps');

const clinicDateParts = (date = new Date()) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value])
);
const clinicToday = () => { const { year, month, day } = clinicDateParts(); return `${year}-${month}-${day}`; };
const clinicTime = () => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value])
);
const isRealISODate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const APPOINTMENT_STATUSES = new Set(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);
const parseAdminAppointmentFilters = (query = {}) => {
  const filters = {};
  if (query.doctor_id !== undefined && query.doctor_id !== '') {
    if (typeof query.doctor_id !== 'string' || !/^\d+$/.test(query.doctor_id)) return { error: 'Mã bác sĩ không hợp lệ.' };
    const doctorId = Number(query.doctor_id);
    if (!Number.isSafeInteger(doctorId) || doctorId < 1) return { error: 'Mã bác sĩ không hợp lệ.' };
    filters.doctorId = doctorId;
  }

  const startDate = query.startDate || query.endDate;
  const endDate = query.endDate || query.startDate;
  if (startDate || endDate) {
    if (!isRealISODate(startDate) || !isRealISODate(endDate) || startDate > endDate) {
      return { error: 'Ngày bắt đầu hoặc kết thúc không hợp lệ.' };
    }
    const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
    if (days > 366) return { error: 'Khoảng ngày lọc tối đa là 366 ngày.' };
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  if (query.status && query.status !== 'ALL') {
    if (typeof query.status !== 'string' || !APPOINTMENT_STATUSES.has(query.status)) return { error: 'Trạng thái lịch hẹn không hợp lệ.' };
    filters.status = query.status;
  }
  return { filters };
};

const createAppointment = async (req, res, next) => {
  const { initial_symptoms, service_id, payment_method } = req.body;
  const cleanSymptoms = typeof initial_symptoms === 'string' ? initial_symptoms.trim() : '';
  if (!/[\p{L}\p{N}]/u.test(cleanSymptoms)) {
    return res.status(400).json({ success: false, message: 'Vui lòng mô tả triệu chứng hoặc lý do khám bằng chữ hoặc số.' });
  }
  const serviceId = Number(service_id);
  if (!Number.isSafeInteger(serviceId) || serviceId < 1) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn dịch vụ khám để xác định đúng chi phí.' });
  }
  if (!['CASH', 'BANK_TRANSFER'].includes(payment_method)) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn phương thức thanh toán tiền mặt hoặc QR/chuyển khoản.' });
  }
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const patient_id = req.user.id;
    const { doctor_id, slot_id, appointment_date, full_name, phone_number, dob, gender, address, insurance_code, citizen_id, initial_symptoms, ai_predicted_specialty, notes } = req.body;
    if (!Number.isInteger(Number(doctor_id)) || !Number.isInteger(Number(slot_id)) || !appointment_date) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn bác sĩ, ngày và khung giờ có sẵn.' });
    }
    if (!isRealISODate(appointment_date)) {
      return res.status(400).json({ success: false, message: 'Ngày khám không hợp lệ.' });
    }
    if (appointment_date < clinicToday()) {
      return res.status(400).json({ success: false, message: 'Không thể đặt lịch trong quá khứ.' });
    }

    await connection.beginTransaction();
    transactionStarted = true;
    let followUpId = null;
    let followUpContext = null;
    let linkedFollowUpAppointments = [];
    if (req.body.follow_up_id !== undefined && req.body.follow_up_id !== null && req.body.follow_up_id !== '') {
      followUpId = Number(req.body.follow_up_id);
      if (!Number.isSafeInteger(followUpId) || followUpId < 1) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Lời hẹn tái khám không hợp lệ.' });
      }
      const [followUps] = await connection.query(
        `SELECT fv.follow_up_id, fv.follow_up_date, mr.patient_id, mr.appointment_id AS source_appointment_id,
         source_app.service_id AS source_service_id, COALESCE(source_service.specialty_id, source_doctor.specialty_id) AS source_specialty_id
         FROM follow_up_visits fv JOIN appointment_records mr ON mr.record_id = fv.record_id
         JOIN appointments source_app ON source_app.appointment_id = mr.appointment_id
         JOIN doctors source_doctor ON source_doctor.id = source_app.doctor_id
         LEFT JOIN services source_service ON source_service.id = source_app.service_id
         WHERE fv.follow_up_id = ? FOR UPDATE`, [followUpId]
      );
      followUpContext = followUps[0] || null;
      const [linkedAppointments] = await connection.query(
        `SELECT a.appointment_id, a.status,
         EXISTS(SELECT 1 FROM appointment_records ar WHERE ar.appointment_id = a.appointment_id) AS has_medical_record
         FROM appointments a WHERE a.follow_up_id = ? ORDER BY a.appointment_id DESC FOR UPDATE`, [followUpId]
      );
      linkedFollowUpAppointments = linkedAppointments;
      const error = validateFollowUpBooking({ followUp: followUpContext, linkedAppointments, patientId: patient_id });
      if (error) { await connection.rollback(); return res.status(error.status).json({ success: false, message: error.message }); }
    }
    const [doctors] = await connection.query(
      `SELECT d.id, d.specialty_id FROM doctors d JOIN users u ON u.id = d.user_id
       WHERE d.id = ? AND d.is_active = TRUE AND u.is_active = TRUE FOR UPDATE`, [doctor_id]
    );
    if (!doctors.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Bác sĩ hiện không nhận đặt lịch.' });
    }
    const [scheduled] = await connection.query(
      `SELECT se.id AS shift_employee_id, st.id AS slot_id,
       CONCAT(TIME_FORMAT(st.start_time, '%H:%i'), ' - ', TIME_FORMAT(st.end_time, '%H:%i')) AS time_slot,
       TIME_FORMAT(st.start_time, '%H:%i') AS start_time FROM shift_day_employee sd JOIN shift_employee se ON se.shift_day_employee_id = sd.id
       JOIN shift_time_slots st ON st.shift_employee_id = se.id AND st.status = 'AVAILABLE'
       JOIN shifts sh ON sh.shift_id = se.shift_id
       WHERE st.id = ? AND sd.doctor_id = ? AND sd.work_date = ? AND se.status = 'AVAILABLE' FOR UPDATE`,
      [slot_id, doctor_id, appointment_date]
    );
    const time_slot = scheduled[0]?.time_slot;
    if (!scheduled.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Khung giờ này không nằm trong lịch làm việc đang mở.' });
    }
    if (appointment_date === clinicToday()) {
      const { hour, minute } = clinicTime();
      const currentTime = `${hour}:${minute}`;
      if (scheduled[0].start_time <= currentTime) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Không thể đặt khung giờ đã qua.' }); }
    }
    const [services] = await connection.query('SELECT id, name, price, specialty_id FROM services WHERE id = ? AND is_active = TRUE FOR UPDATE', [serviceId]);
    if (!services.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Dịch vụ không còn được cung cấp.' });
    }
    if (!services[0].specialty_id) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Dịch vụ chưa được gán chuyên khoa. Vui lòng liên hệ quản trị viên.' });
    }
    if (followUpId) {
      const error = validateFollowUpBooking({
        followUp: followUpContext,
        linkedAppointments: linkedFollowUpAppointments,
        patientId: patient_id,
        selectedServiceSpecialtyId: services[0].specialty_id
      });
      if (error) { await connection.rollback(); return res.status(error.status).json({ success: false, message: error.message }); }
    }
    const serviceFee = Number(services[0].price);
    if (!Number.isFinite(serviceFee) || serviceFee < 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Dịch vụ chưa có giá hợp lệ. Vui lòng liên hệ quản trị viên.' });
    }
    const [activeSpecialties] = await connection.query(
      'SELECT id FROM specialties WHERE id = ? AND is_active = TRUE FOR UPDATE', [services[0].specialty_id]
    );
    if (!activeSpecialties.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Chuyên khoa của dịch vụ hiện không hoạt động. Vui lòng liên hệ quản trị viên.' });
    }
    if (Number(services[0].specialty_id) !== Number(doctors[0].specialty_id)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Bác sĩ đã chọn không thuộc chuyên khoa của dịch vụ này.' });
    }
    const [existing] = await connection.query(
      `SELECT appointment_id FROM appointments WHERE slot_id = ? AND status <> 'CANCELLED' LIMIT 1`,
      [scheduled[0].slot_id]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Khung giờ này đã được đặt. Vui lòng chọn khung giờ khác.' });
    }
    const [result] = await connection.query(
      `INSERT INTO appointments (patient_id, doctor_id, service_id, shift_employee_id, slot_id, follow_up_id, appointment_date, time_slot,
       full_name, phone_number, dob, gender, address, insurance_code, citizen_id, initial_symptoms, ai_predicted_specialty, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [patient_id, doctor_id, serviceId, scheduled[0].shift_employee_id, scheduled[0].slot_id, followUpId, appointment_date, time_slot,
        full_name || null, phone_number || null, dob || null, gender || null, address || null, insurance_code || null, citizen_id || null,
        cleanSymptoms, ai_predicted_specialty || null, notes || null]
    );
    const [bookedSlot] = await connection.query("UPDATE shift_time_slots SET status = 'BOOKED' WHERE id = ? AND status = 'AVAILABLE'", [scheduled[0].slot_id]);
    if (bookedSlot.affectedRows !== 1) throw Object.assign(new Error('Khung giờ vừa được đặt. Vui lòng chọn khung giờ khác.'), { statusCode: 409 });
    const [invoice] = await connection.query(
      `INSERT INTO invoices (appointment_id, patient_id, service_fee, medicine_fee, total_amount, payment_status, payment_method)
       VALUES (?, ?, ?, 0, ?, 'UNPAID', ?)`, [result.insertId, patient_id, serviceFee, serviceFee, payment_method]
    );
    await connection.query(
      `INSERT INTO invoice_items (invoice_id, item_type, item_reference_id, description, quantity, unit_price, line_total)
       VALUES (?, 'SERVICE', ?, ?, 1, ?, ?)`, [invoice.insertId, serviceId, services[0].name, serviceFee, serviceFee]
    );
    await connection.commit();
    return res.status(201).json({
      success: true, message: 'Đặt lịch thành công. Phòng khám sẽ xác nhận lịch hẹn.',
      data: { id: result.insertId, appointment_id: result.insertId, invoice_id: invoice.insertId, patient_id, doctor_id: Number(doctor_id), service_id: serviceId, follow_up_id: followUpId, appointment_date, time_slot, status: 'PENDING', amount: serviceFee, payment_method }
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      const followUpConflict = String(error.message || '').includes('uq_appointments_active_follow_up_id');
      return res.status(409).json({ success: false, message: followUpConflict ? 'Lời hẹn tái khám vừa được đặt ở một thiết bị khác. Tải lại lịch để xem trạng thái.' : 'Khung giờ này vừa được đặt. Vui lòng chọn giờ khác.' });
    }
    if (followUpId && ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) {
      return res.status(409).json({ success: false, message: 'Lời hẹn đang được xử lý đồng thời. Vui lòng tải lại và thử lại.' });
    }
    next(error);
  } finally { connection.release(); }
};

const getAppointments = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const adminFilters = role === 'ADMIN' ? parseAdminAppointmentFilters(req.query) : { filters: {} };
    if (adminFilters.error) return res.status(400).json({ success: false, message: adminFilters.error });
    let query = `SELECT a.appointment_id AS id, a.appointment_id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot, a.status,
      COALESCE(i.payment_status, 'UNPAID') AS payment_status, i.payment_method, i.invoice_status,
      i.total_amount AS invoice_total_amount,
      COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id AND pay.payment_status = 'PAID'), 0) AS amount_paid,
      GREATEST(COALESCE(i.total_amount, 0) - COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id AND pay.payment_status = 'PAID'), 0), 0) AS amount_due,
      (SELECT cr.id FROM appointment_cancellation_requests cr WHERE cr.appointment_id = a.appointment_id ORDER BY cr.requested_at DESC, cr.id DESC LIMIT 1) AS cancellation_request_id,
      (SELECT cr.status FROM appointment_cancellation_requests cr WHERE cr.appointment_id = a.appointment_id ORDER BY cr.requested_at DESC, cr.id DESC LIMIT 1) AS cancellation_request_status,
      (SELECT cr.refund_status FROM appointment_cancellation_requests cr WHERE cr.appointment_id = a.appointment_id ORDER BY cr.requested_at DESC, cr.id DESC LIMIT 1) AS refund_status,
      (SELECT cr.decision_note FROM appointment_cancellation_requests cr WHERE cr.appointment_id = a.appointment_id ORDER BY cr.requested_at DESC, cr.id DESC LIMIT 1) AS cancellation_decision_note,
      a.initial_symptoms, a.ai_predicted_specialty, a.notes, a.created_at,
      p.id AS patient_id, p.full_name AS patient_name, p.phone AS patient_phone,
      d.id AS doctor_id, du.full_name AS doctor_name, s.name AS specialty_name, svc.name AS service_name, r.room_number, r.name AS room_name
      FROM appointments a JOIN users p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id
      JOIN users du ON d.user_id = du.id LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN services svc ON svc.id = a.service_id
      LEFT JOIN rooms r ON d.room_id = r.id LEFT JOIN invoices i ON i.appointment_id = a.appointment_id`;
    const params = [];
    const conditions = [];
    if (role === 'PATIENT') { conditions.push('a.patient_id = ?'); params.push(userId); }
    if (role === 'DOCTOR') { conditions.push('d.user_id = ?'); params.push(userId); }
    if (role === 'ADMIN') {
      const { doctorId, startDate, endDate, status } = adminFilters.filters;
      if (doctorId) { conditions.push('a.doctor_id = ?'); params.push(doctorId); }
      if (startDate) { conditions.push('a.appointment_date BETWEEN ? AND ?'); params.push(startDate, endDate); }
      if (status) { conditions.push('a.status = ?'); params.push(status); }
    }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += role === 'DOCTOR' ? ' ORDER BY a.appointment_date ASC, a.time_slot ASC' : ' ORDER BY a.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (error) { next(error); }
};

const getAppointmentDetail = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const [rows] = await pool.query(
      `SELECT a.*, a.appointment_id AS id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
       p.full_name AS current_patient_name, p.phone AS current_patient_phone,
       p.date_of_birth AS current_date_of_birth, p.gender AS current_gender, p.address AS current_address,
       p.insurance_code AS current_insurance_code, p.job AS patient_job, p.emergency_contact AS patient_emergency_contact,
       d.user_id AS doctor_user_id, du.full_name AS doctor_name, s.name AS service_name, r.name AS room_name, r.room_number
       FROM appointments a JOIN users p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id LEFT JOIN services s ON s.id = a.service_id LEFT JOIN rooms r ON r.id = d.room_id
       WHERE a.appointment_id = ?`, [req.params.id]
    );
    const appointment = rows[0];
    if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });
    if (role === 'PATIENT' && appointment.patient_id !== userId) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch này.' });
    if (role === 'DOCTOR' && appointment.doctor_user_id !== userId) return res.status(403).json({ success: false, message: 'Lịch hẹn không được phân công cho bạn.' });
    return res.json({ success: true, data: {
      ...appointment,
      patient_name: appointment.full_name || appointment.current_patient_name,
      patient_phone: appointment.phone_number || appointment.current_patient_phone,
      patient_date_of_birth: appointment.dob || appointment.current_date_of_birth,
      patient_gender: appointment.gender || appointment.current_gender,
      patient_address: appointment.address || appointment.current_address,
      patient_insurance_code: appointment.insurance_code || appointment.current_insurance_code
    } });
  } catch (error) { next(error); }
};

const updateAppointmentStatus = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { role, id: userId } = req.user;
    if (status === 'CONFIRMED') {
      return res.status(409).json({ success: false, message: 'Lịch chỉ được tự xác nhận khi backend ghi nhận hóa đơn đã thanh toán đủ.' });
    }
    if (status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Hủy lịch và đánh dấu vắng phải dùng API Admin chuyên biệt.' });
    }
    await connection.beginTransaction();
    // Match payment/cancellation lock order: invoice first, appointment second.
    await connection.query('SELECT id FROM invoices WHERE appointment_id = ? FOR UPDATE', [id]);
    const [rows] = await connection.query(
      `SELECT a.appointment_id, a.patient_id, a.status, a.follow_up_id, d.user_id AS doctor_user_id
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.appointment_id = ? FOR UPDATE`, [id]
    );
    const app = rows[0];
    if (!app) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' }); }
    let allowed = false;
    if (role === 'ADMIN') allowed = status === 'COMPLETED' && app.status === 'CONFIRMED';
    if (role === 'DOCTOR' && app.doctor_user_id === userId) allowed = status === 'COMPLETED' && app.status === 'CONFIRMED';
    if (!allowed) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Bạn không có quyền hoặc lịch hẹn không ở trạng thái phù hợp.' }); }
    if (app.follow_up_id) {
      const [[record]] = await connection.query('SELECT record_id FROM appointment_records WHERE appointment_id = ? LIMIT 1 FOR UPDATE', [id]);
      if (!record) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Không thể hoàn tất lịch tái khám khi chưa có bệnh án.' });
      }
    }
    await connection.query('UPDATE appointments SET status = ? WHERE appointment_id = ?', [status, id]);
    await connection.commit();
    return res.json({ success: true, message: 'Đã cập nhật trạng thái khám.' });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

module.exports = { createAppointment, getAppointments, getAppointmentDetail, updateAppointmentStatus, parseAdminAppointmentFilters };
