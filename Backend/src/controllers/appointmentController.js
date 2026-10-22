const { pool } = require('../config/db');

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

const createAppointment = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const patient_id = req.user.id;
    const { doctor_id, service_id, slot_id, appointment_date, full_name, phone_number, dob, gender, address, insurance_code, citizen_id, initial_symptoms, ai_predicted_specialty, notes } = req.body;
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
    const [doctors] = await connection.query(
      `SELECT d.id, d.specialty_id, d.consultation_fee FROM doctors d JOIN users u ON u.id = d.user_id
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
    let serviceFee = Number(doctors[0].consultation_fee);
    let serviceName = 'Phí khám';
    if (service_id !== undefined && service_id !== null) {
      const [services] = await connection.query('SELECT id, name, price, specialty_id FROM services WHERE id = ? AND is_active = TRUE FOR UPDATE', [service_id]);
      if (!services.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Dịch vụ không còn được cung cấp.' });
      }
      if (!services[0].specialty_id) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Dịch vụ chưa được gán chuyên khoa. Vui lòng liên hệ quản trị viên.' });
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
      serviceFee = Number(services[0].price);
      serviceName = services[0].name;
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
      `INSERT INTO appointments (patient_id, doctor_id, service_id, shift_employee_id, slot_id, appointment_date, time_slot,
       full_name, phone_number, dob, gender, address, insurance_code, citizen_id, initial_symptoms, ai_predicted_specialty, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [patient_id, doctor_id, service_id || null, scheduled[0].shift_employee_id, scheduled[0].slot_id, appointment_date, time_slot,
        full_name || null, phone_number || null, dob || null, gender || null, address || null, insurance_code || null, citizen_id || null,
        initial_symptoms || null, ai_predicted_specialty || null, notes || null]
    );
    const [bookedSlot] = await connection.query("UPDATE shift_time_slots SET status = 'BOOKED' WHERE id = ? AND status = 'AVAILABLE'", [scheduled[0].slot_id]);
    if (bookedSlot.affectedRows !== 1) throw Object.assign(new Error('Khung giờ vừa được đặt. Vui lòng chọn khung giờ khác.'), { statusCode: 409 });
    const [invoice] = await connection.query(
      `INSERT INTO invoices (appointment_id, patient_id, service_fee, medicine_fee, total_amount, payment_status, payment_method)
       VALUES (?, ?, ?, 0, ?, 'UNPAID', 'CASH')`, [result.insertId, patient_id, serviceFee, serviceFee]
    );
    await connection.query(
      `INSERT INTO invoice_items (invoice_id, item_type, item_reference_id, description, quantity, unit_price, line_total)
       VALUES (?, 'SERVICE', ?, ?, 1, ?, ?)`, [invoice.insertId, service_id || null, serviceName, serviceFee, serviceFee]
    );
    await connection.commit();
    return res.status(201).json({
      success: true, message: 'Đặt lịch thành công. Phòng khám sẽ xác nhận lịch hẹn.',
      data: { id: result.insertId, appointment_id: result.insertId, invoice_id: invoice.insertId, patient_id, doctor_id: Number(doctor_id), service_id: service_id || null, appointment_date, time_slot, status: 'PENDING', amount: serviceFee }
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Khung giờ này vừa được đặt. Vui lòng chọn giờ khác.' });
    next(error);
  } finally { connection.release(); }
};

const getAppointments = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    let query = `SELECT a.appointment_id AS id, a.appointment_id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot, a.status,
      COALESCE(i.payment_status, 'UNPAID') AS payment_status, a.initial_symptoms, a.ai_predicted_specialty, a.notes, a.created_at,
      p.id AS patient_id, p.full_name AS patient_name, p.phone AS patient_phone,
      d.id AS doctor_id, du.full_name AS doctor_name, s.name AS specialty_name, r.room_number, r.name AS room_name
      FROM appointments a JOIN users p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id
      JOIN users du ON d.user_id = du.id LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN rooms r ON d.room_id = r.id LEFT JOIN invoices i ON i.appointment_id = a.appointment_id`;
    const params = [];
    if (role === 'PATIENT') { query += ' WHERE a.patient_id = ?'; params.push(userId); }
    if (role === 'DOCTOR') { query += ' WHERE d.user_id = ?'; params.push(userId); }
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
    if (!['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái yêu cầu không hợp lệ.' });
    }
    await connection.beginTransaction();
    // Keep the global payment/cancellation lock order: invoice first, appointment second.
    if (status === 'CANCELLED') await connection.query('SELECT id FROM invoices WHERE appointment_id = ? FOR UPDATE', [id]);
    const [rows] = await connection.query(
      `SELECT a.appointment_id, a.patient_id, a.status, d.user_id AS doctor_user_id
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.appointment_id = ? FOR UPDATE`, [id]
    );
    const app = rows[0];
    if (!app) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' }); }
    let allowed = false;
    if (role === 'PATIENT') allowed = status === 'CANCELLED' && app.patient_id === userId && app.status === 'PENDING';
    if (role === 'ADMIN') allowed = status === 'CONFIRMED' || status === 'CANCELLED';
    if (role === 'DOCTOR' && app.doctor_user_id === userId) {
      allowed = status === 'CANCELLED' && app.status === 'PENDING';
    }
    if (!allowed) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Bạn không có quyền hoặc lịch hẹn không ở trạng thái phù hợp.' }); }
    await connection.query('UPDATE appointments SET status = ? WHERE appointment_id = ?', [status, id]);
    if (status === 'CANCELLED') {
      const [invoices] = await connection.query('SELECT id, patient_id FROM invoices WHERE appointment_id = ?', [id]);
      if (invoices[0]) {
        await connection.query("UPDATE payments SET reconciliation_status = 'REVIEW' WHERE invoice_id = ? AND payment_status = 'PAID'", [invoices[0].id]);
        const [[paidRow]] = await connection.query("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoices[0].id]);
        const hasPayments = Number(paidRow.paid) > 0;
        await connection.query(
          `UPDATE notifications SET status = ?, message = ?
           WHERE invoice_id = ? AND type = 'INVOICE_UPDATED' AND status <> 'SUPERSEDED'`,
          [hasPayments ? 'REVIEW' : 'SUPERSEDED', hasPayments
            ? `Lịch liên quan hóa đơn #${invoices[0].id} đã hủy. Đã nhận ${Number(paidRow.paid).toLocaleString('vi-VN')}đ; khoản tiền cần đối soát/hoàn tiền thủ công.`
            : `Lịch liên quan hóa đơn #${invoices[0].id} đã hủy. Không ghi nhận thanh toán.`, invoices[0].id]
        );
      }
      const [slotRows] = await connection.query('SELECT slot_id FROM appointments WHERE appointment_id = ?', [id]);
      if (slotRows[0]?.slot_id) {
        await connection.query("UPDATE shift_time_slots SET status = 'AVAILABLE' WHERE id = ?", [slotRows[0].slot_id]);
        await connection.query('UPDATE appointments SET slot_id = NULL WHERE appointment_id = ?', [id]);
      } else {
        await connection.query("UPDATE shift_employee SET status = 'AVAILABLE' WHERE id = (SELECT shift_employee_id FROM appointments WHERE appointment_id = ?)", [id]);
      }
    }
    await connection.commit();
    if (status === 'CANCELLED') {
      const io = req.app.get('io');
      io?.to(`user:${app.patient_id}`).emit('notifications_updated', { appointmentId: Number(id) });
      io?.to(`user:${app.patient_id}`).emit('payment_updated', { appointmentId: Number(id), status: 'CANCELLED' });
      io?.to('role:ADMIN').emit('payment_updated', { appointmentId: Number(id), status: 'CANCELLED' });
    }
    const message = status === 'CANCELLED'
      ? 'Đã hủy lịch. Giao dịch đã thu vẫn được giữ nguyên và cần đối soát/hoàn tiền thủ công; hệ thống không tự hoàn tiền.'
      : 'Đã cập nhật trạng thái lịch hẹn.';
    return res.json({ success: true, message });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

module.exports = { createAppointment, getAppointments, getAppointmentDetail, updateAppointmentStatus };
