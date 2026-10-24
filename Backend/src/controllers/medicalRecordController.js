const { pool } = require('../config/db');
const { syncInvoiceNotification, createMedicalRecordNotification, emitNotificationsUpdated } = require('../utils/invoiceNotifications');

const createMedicalRecord = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const {
      appointment_id, height, weight, blood_pressure, temperature, heart_rate, spo2,
      symptoms, initial_diagnosis, final_diagnosis, icd10_code, treatment_plan, advice,
      follow_up_date, follow_up_notes, prescriptions = []
    } = req.body;
    if (!Number.isInteger(Number(appointment_id)) || typeof final_diagnosis !== 'string' || !final_diagnosis.trim() || !Array.isArray(prescriptions)) {
      return res.status(400).json({ success: false, message: 'Lịch hẹn, chẩn đoán và danh sách thuốc không hợp lệ.' });
    }
    for (const value of [height, weight, temperature, heart_rate, spo2]) {
      if (value !== undefined && value !== null && value !== '' && (Number(value) < 0 || !Number.isFinite(Number(value)))) {
        return res.status(400).json({ success: false, message: 'Sinh hiệu phải là số không âm hợp lệ.' });
      }
    }
    if (spo2 !== undefined && spo2 !== null && spo2 !== '' && Number(spo2) > 100) {
      return res.status(400).json({ success: false, message: 'SpO₂ phải nằm trong khoảng 0–100%.' });
    }
    await connection.beginTransaction();
    const [lockedInvoices] = await connection.query(
      'SELECT id, service_fee, medicine_fee FROM invoices WHERE appointment_id = ? FOR UPDATE', [appointment_id]
    );
    const [appRows] = await connection.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.service_id, a.status, d.user_id,
       du.full_name AS doctor_name, svc.name AS service_name
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
       LEFT JOIN services svc ON svc.id = a.service_id WHERE a.appointment_id = ? FOR UPDATE`, [appointment_id]
    );
    const appointment = appRows[0];
    if (!appointment) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' }); }
    if (appointment.user_id !== req.user.id) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Lịch hẹn không thuộc bác sĩ đang đăng nhập.' }); }
    if (appointment.status !== 'CONFIRMED') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ có thể khám lịch hẹn đã xác nhận.' }); }

    const [recordResult] = await connection.query(
      `INSERT INTO appointment_records (appointment_id, doctor_id, patient_id, height, weight, blood_pressure,
       temperature, heart_rate, spo2, symptoms, initial_diagnosis, final_diagnosis, icd10_code, treatment_plan, advice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [appointment.appointment_id, appointment.doctor_id, appointment.patient_id,
        height === '' || height == null ? null : Number(height), weight === '' || weight == null ? null : Number(weight), blood_pressure || null,
        temperature === '' || temperature == null ? null : Number(temperature), heart_rate === '' || heart_rate == null ? null : Number(heart_rate), spo2 === '' || spo2 == null ? null : Number(spo2),
        symptoms || null, initial_diagnosis || null, final_diagnosis.trim(), icd10_code || null, treatment_plan || null, advice || null]
    );
    const recordId = recordResult.insertId;

    let followUpNotificationCreated = false;
    if (follow_up_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(follow_up_date)) throw new Error('Ngày tái khám không hợp lệ.');
      const followUp = new Date(`${follow_up_date}T00:00:00Z`);
      const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const todayVietnam = `${todayParts.find((part) => part.type === 'year').value}-${todayParts.find((part) => part.type === 'month').value}-${todayParts.find((part) => part.type === 'day').value}`;
      if (Number.isNaN(followUp.getTime()) || followUp.toISOString().slice(0, 10) !== follow_up_date || follow_up_date <= todayVietnam) {
        throw new Error('Ngày tái khám phải là ngày hợp lệ trong tương lai.');
      }
      await connection.query(
        'INSERT INTO follow_up_visits (record_id, follow_up_date, instruction) VALUES (?, ?, ?)',
        [recordId, follow_up_date, follow_up_notes || null]
      );
      const [dateYear, dateMonth, dateDay] = follow_up_date.split('-');
      const dateLabel = `${dateDay}/${dateMonth}/${dateYear}`;
      const related = [appointment.service_name, appointment.doctor_name ? `BS. ${appointment.doctor_name}` : null].filter(Boolean).join(' · ');
      const message = `Bạn có lịch tái khám dự kiến ngày ${dateLabel}${related ? ` (${related})` : ''}. Vui lòng liên hệ phòng khám để đặt khung giờ nếu chưa có lịch.`;
      await connection.query(
        `INSERT INTO notifications (recipient_user_id, type, title, message, appointment_id, dedupe_key, status)
         VALUES (?, 'FOLLOW_UP', 'Nhắc lịch tái khám', ?, ?, ?, 'INFO')`,
        [appointment.patient_id, message, appointment.appointment_id, `FOLLOW_UP:${recordId}`]
      );
      followUpNotificationCreated = true;
    }

    const medicineLines = [];
    for (const item of prescriptions) {
      const quantity = Number(item.quantity);
      const duration = Number(item.duration_days ?? item.duration ?? 1);
      if (!Number.isInteger(Number(item.medicine_id)) || !Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(duration) || duration < 1 || duration > 365 || !item.dosage) {
        throw new Error('Mỗi thuốc cần mã thuốc, số lượng, liều dùng và số ngày hợp lệ.');
      }
      const [drugs] = await connection.query('SELECT drug_id, name, price, unit_id FROM drugs WHERE drug_id = ? AND is_active = TRUE FOR UPDATE', [item.medicine_id]);
      if (!drugs.length) throw new Error(`Thuốc mã ${item.medicine_id} hiện không hoạt động.`);
      const drug = drugs[0];
      const unitPrice = Number(drug.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`Thuốc ${drug.name} chưa có đơn giá hợp lệ. Vui lòng yêu cầu admin cập nhật giá trước khi kê đơn.`);
      const mealRelationId = item.meal_relation_id === '' || item.meal_relation_id == null ? null : Number(item.meal_relation_id);
      if (mealRelationId !== null) {
        if (!Number.isInteger(mealRelationId) || mealRelationId < 1) throw new Error('Quan hệ bữa ăn không hợp lệ.');
        const [mealRelations] = await connection.query(
          'SELECT relation_id FROM meal_relations WHERE relation_id = ? AND is_active = TRUE FOR UPDATE',
          [mealRelationId]
        );
        if (!mealRelations.length) throw new Error('Quan hệ bữa ăn không hợp lệ hoặc đã ngừng sử dụng.');
      }
      const [prescriptionResult] = await connection.query(
        `INSERT INTO prescriptions (record_id, drug_id, dosage, frequency, duration, quantity, unit_price, billing_status, unit_id, meal_relation_id, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'BILLED', ?, ?, ?)`,
        [recordId, drug.drug_id, String(item.dosage), item.frequency || null, duration, quantity, unitPrice,
          item.unit_id || drug.unit_id || null, mealRelationId, item.usage_instruction || item.instructions || null]
      );
      medicineLines.push({ drugId: drug.drug_id, name: drug.name, quantity, unitPrice, lineTotal: Math.round(quantity * unitPrice * 100) / 100 });
      const timeIds = Array.isArray(item.time_ids) ? item.time_ids : (item.time_id ? [item.time_id] : []);
      for (const timeId of [...new Set(timeIds.map(Number))]) {
        if (!Number.isInteger(timeId) || timeId < 1) throw new Error('Thời điểm uống thuốc không hợp lệ.');
        await connection.query('INSERT INTO prescription_times (prescription_id, time_id) VALUES (?, ?)', [prescriptionResult.insertId, timeId]);
      }
    }

    const [doctorRows] = await connection.query('SELECT consultation_fee FROM doctors WHERE id = ?', [appointment.doctor_id]);
    let serviceFee = Number(lockedInvoices[0]?.service_fee ?? doctorRows[0]?.consultation_fee ?? 0);
    let serviceDescription = 'Phí khám';
    if (appointment.service_id) {
      const [services] = await connection.query('SELECT name, price FROM services WHERE id = ?', [appointment.service_id]);
      if (services[0]) {
        if (!lockedInvoices[0]) serviceFee = Number(services[0].price);
        serviceDescription = services[0].name;
      }
    }
    const medicineFee = Math.round((Number(lockedInvoices[0]?.medicine_fee || 0) + medicineLines.reduce((sum, line) => sum + line.lineTotal, 0)) * 100) / 100;
    const total = Math.round((serviceFee + medicineFee) * 100) / 100;
    let invoiceId;
    if (lockedInvoices[0]) {
      invoiceId = lockedInvoices[0].id;
      const [[payments]] = await connection.query("SELECT COALESCE(SUM(amount), 0) AS paid_amount FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoiceId]);
      const fullyPaid = Number(payments.paid_amount) >= total;
      await connection.query(
        `UPDATE invoices SET service_fee = ?, medicine_fee = ?, total_amount = ?,
         payment_status = ?, paid_at = IF(? = 'PAID', COALESCE(paid_at, NOW()), NULL)
         WHERE id = ?`, [serviceFee, medicineFee, total, fullyPaid ? 'PAID' : 'UNPAID', fullyPaid ? 'PAID' : 'UNPAID', invoiceId]
      );
      if (Number(payments.paid_amount) > total) await connection.query(
        "UPDATE payments SET reconciliation_status = 'OVERPAID' WHERE invoice_id = ? AND payment_status = 'PAID' AND reconciliation_status <> 'REVIEW'", [invoiceId]
      );
    } else {
      const [invoiceResult] = await connection.query(
        `INSERT INTO invoices (appointment_id, patient_id, service_fee, medicine_fee, total_amount, payment_status, payment_method)
         VALUES (?, ?, ?, ?, ?, 'UNPAID', 'CASH')`,
        [appointment.appointment_id, appointment.patient_id, serviceFee, medicineFee, total]
      );
      invoiceId = invoiceResult.insertId;
    }
    const [serviceLines] = await connection.query("SELECT id FROM invoice_items WHERE invoice_id = ? AND item_type = 'SERVICE' LIMIT 1", [invoiceId]);
    if (serviceLines[0]) await connection.query('UPDATE invoice_items SET item_reference_id = ?, description = ?, quantity = 1, unit_price = ?, line_total = ? WHERE id = ?', [appointment.service_id, serviceDescription, serviceFee, serviceFee, serviceLines[0].id]);
    else await connection.query(
      `INSERT INTO invoice_items (invoice_id, item_type, item_reference_id, description, quantity, unit_price, line_total)
       VALUES (?, 'SERVICE', ?, ?, 1, ?, ?)`, [invoiceId, appointment.service_id, serviceDescription, serviceFee, serviceFee]
    );
    for (const line of medicineLines) {
      await connection.query(
        `INSERT INTO invoice_items (invoice_id, item_type, item_reference_id, description, quantity, unit_price, line_total)
         VALUES (?, 'MEDICINE', ?, ?, ?, ?, ?)`,
        [invoiceId, line.drugId, line.name, line.quantity, line.unitPrice, line.lineTotal]
      );
    }
    const [[paidRow]] = await connection.query("SELECT COALESCE(SUM(amount), 0) AS paid_amount FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoiceId]);
    const invoiceNotice = await syncInvoiceNotification(connection, { invoiceId, totalAmount: total, paidAmount: Number(paidRow.paid_amount) });
    await createMedicalRecordNotification(connection, { patientId: appointment.patient_id, appointmentId: appointment.appointment_id, recordId });
    await connection.query("UPDATE appointments SET status = 'COMPLETED' WHERE appointment_id = ?", [appointment.appointment_id]);
    await connection.commit();
    if (followUpNotificationCreated) {
      req.app.get('io')?.to(`user:${appointment.patient_id}`).emit('notifications_updated', { appointmentId: Number(appointment.appointment_id), type: 'FOLLOW_UP' });
    }
    req.app.get('io')?.to(`user:${appointment.patient_id}`).emit('notifications_updated', { appointmentId: Number(appointment.appointment_id), type: 'MEDICAL_RECORD_READY' });
    if (invoiceNotice.changed) emitNotificationsUpdated(req, appointment.patient_id, invoiceId);
    const dueAfterSave = Math.max(0, total - Number(paidRow.paid_amount));
    req.app.get('io')?.to(`user:${appointment.patient_id}`).emit('payment_updated', { appointmentId: Number(appointment.appointment_id), status: dueAfterSave <= 0 ? 'PAID' : 'UNPAID', totalAmount: total, paidAmount: Number(paidRow.paid_amount), amountDue: dueAfterSave });
    req.app.get('io')?.to('role:ADMIN').emit('payment_updated', { appointmentId: Number(appointment.appointment_id), status: dueAfterSave <= 0 ? 'PAID' : 'UNPAID', totalAmount: total, paidAmount: Number(paidRow.paid_amount), amountDue: dueAfterSave });
    return res.status(201).json({ success: true, message: 'Đã lưu bệnh án và hoàn tất khám.', data: { record_id: recordId, invoice_id: invoiceId, total_amount: total } });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Bệnh án cho lịch hẹn này đã được lưu.' });
    if (error.message?.includes('không hợp lệ') || error.message?.includes('không hoạt động') || error.message?.includes('cần mã thuốc') || error.message?.includes('chưa có đơn giá')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  } finally { connection.release(); }
};

const getPatientRecords = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    let query = `SELECT mr.*, mr.record_id AS id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot,
      p.full_name AS patient_name, p.phone AS patient_phone, du.full_name AS doctor_name,
      s.name AS specialty_name, svc.name AS service_name,
      DATE_FORMAT(fv.follow_up_date, '%Y-%m-%d') AS follow_up_date, fv.instruction AS follow_up_notes,
      icd.description AS icd10_description
      FROM appointment_records mr JOIN appointments a ON mr.appointment_id = a.appointment_id
      JOIN users p ON mr.patient_id = p.id JOIN doctors d ON mr.doctor_id = d.id JOIN users du ON d.user_id = du.id
      LEFT JOIN specialties s ON d.specialty_id = s.id LEFT JOIN services svc ON a.service_id = svc.id
      LEFT JOIN follow_up_visits fv ON mr.record_id = fv.record_id
      LEFT JOIN icd10_codes icd ON icd.code = mr.icd10_code`;
    const params = [];
    if (role === 'PATIENT') { query += ' WHERE mr.patient_id = ?'; params.push(userId); }
    else if (role === 'DOCTOR' && req.query.patient_id) {
      query += ` WHERE mr.patient_id = ? AND EXISTS (SELECT 1 FROM appointments assigned_app JOIN doctors assigned_doc ON assigned_doc.id = assigned_app.doctor_id
        WHERE assigned_app.patient_id = mr.patient_id AND assigned_app.status IN ('CONFIRMED','COMPLETED') AND assigned_doc.user_id = ?)`;
      params.push(req.query.patient_id, userId);
    }
    else if (role === 'DOCTOR') { query += ' WHERE d.user_id = ?'; params.push(userId); }
    query += ' ORDER BY mr.created_at DESC';
    const [records] = await pool.query(query, params);
    if (records.length) {
      const recordIds = records.map((record) => record.record_id);
      const [prescriptions] = await pool.query(
        `SELECT pr.record_id, pr.prescription_id, pr.dosage, pr.frequency, pr.duration, pr.quantity,
         pr.unit_price, pr.instructions, d.name AS medicine_name, d.generic_name AS medicine_generic_name,
         u.name AS unit_name, mr.name AS meal_name
         FROM prescriptions pr JOIN drugs d ON d.drug_id = pr.drug_id
         LEFT JOIN units u ON u.unit_id = pr.unit_id LEFT JOIN meal_relations mr ON mr.relation_id = pr.meal_relation_id
         WHERE pr.record_id IN (?) ORDER BY pr.prescription_id`, [recordIds]
      );
      const byRecord = new Map(recordIds.map((id) => [id, []]));
      prescriptions.forEach((item) => byRecord.get(item.record_id)?.push(item));
      records.forEach((record) => { record.prescriptions = byRecord.get(record.record_id) || []; });
    }
    res.json({ success: true, data: records });
  } catch (error) { next(error); }
};

const getRecordDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;
    const [records] = await pool.query(
      `SELECT mr.*, mr.record_id AS id, p.full_name AS patient_name, p.phone AS patient_phone,
       p.date_of_birth, p.gender, du.full_name AS doctor_name, d.user_id AS doctor_user_id, a.appointment_date, a.time_slot,
       DATE_FORMAT(fv.follow_up_date, '%Y-%m-%d') AS follow_up_date, fv.instruction AS follow_up_notes,
       icd.description AS icd10_description
       FROM appointment_records mr JOIN users p ON mr.patient_id = p.id JOIN doctors d ON mr.doctor_id = d.id
       JOIN users du ON d.user_id = du.id JOIN appointments a ON mr.appointment_id = a.appointment_id
       LEFT JOIN follow_up_visits fv ON mr.record_id = fv.record_id
       LEFT JOIN icd10_codes icd ON icd.code = mr.icd10_code WHERE mr.record_id = ?`, [id]
    );
    const record = records[0];
    if (!record) return res.status(404).json({ success: false, message: 'Không tìm thấy bệnh án.' });
    if (role === 'PATIENT' && record.patient_id !== userId) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem bệnh án này.' });
    if (role === 'DOCTOR' && record.doctor_user_id !== userId) {
      const [assigned] = await pool.query(
        `SELECT 1 FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         WHERE a.patient_id = ? AND d.user_id = ? AND a.status IN ('CONFIRMED','COMPLETED') LIMIT 1`,
        [record.patient_id, userId]
      );
      if (!assigned.length) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem bệnh án này.' });
    }
    const [prescriptions] = await pool.query(
      `SELECT p.*, p.prescription_id AS id, d.name AS medicine_name, d.generic_name AS medicine_generic_name,
       d.packing AS medicine_packing, u.name AS unit_name, mr.name AS meal_name,
       (SELECT JSON_ARRAYAGG(JSON_OBJECT('time_id', dt.time_id, 'name', dt.name)) FROM prescription_times pt JOIN dosage_times dt ON dt.time_id = pt.time_id WHERE pt.prescription_id = p.prescription_id) AS dosage_times
       FROM prescriptions p JOIN drugs d ON p.drug_id = d.drug_id LEFT JOIN units u ON p.unit_id = u.unit_id
       LEFT JOIN meal_relations mr ON p.meal_relation_id = mr.relation_id WHERE p.record_id = ?`, [record.record_id]
    );
    return res.json({ success: true, data: { ...record, prescriptions } });
  } catch (error) { next(error); }
};

const getMyFollowUps = async (req, res, next) => {
  try {
    const date = req.query.date;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Ngày lọc không hợp lệ.' });
    }
    if (date) {
      const parsedDate = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        return res.status(400).json({ success: false, message: 'Ngày lọc không hợp lệ.' });
      }
    }
    const params = [req.user.id];
    let dateFilter = '';
    if (date) { dateFilter = ' AND fv.follow_up_date = ?'; params.push(date); }
    const [rows] = await pool.query(
      `SELECT fv.follow_up_id, mr.record_id, mr.patient_id, mr.appointment_id AS source_appointment_id,
       DATE_FORMAT(fv.follow_up_date, '%Y-%m-%d') AS follow_up_date,
       p.full_name AS patient_name, p.phone AS patient_phone, svc.name AS service_name,
       next_app.appointment_id AS follow_up_appointment_id, next_app.time_slot AS follow_up_time_slot,
       next_app.status AS follow_up_appointment_status
       FROM follow_up_visits fv JOIN appointment_records mr ON mr.record_id = fv.record_id
       JOIN doctors d ON d.id = mr.doctor_id JOIN users p ON p.id = mr.patient_id
       LEFT JOIN appointments source_app ON source_app.appointment_id = mr.appointment_id
       LEFT JOIN services svc ON svc.id = source_app.service_id
       LEFT JOIN appointments next_app ON next_app.appointment_id = (
         SELECT a2.appointment_id FROM appointments a2
         WHERE a2.patient_id = mr.patient_id AND a2.doctor_id = mr.doctor_id
           AND a2.appointment_date = fv.follow_up_date AND a2.status <> 'CANCELLED'
         ORDER BY a2.time_slot, a2.appointment_id LIMIT 1
       )
       WHERE d.user_id = ?${dateFilter}
       ORDER BY fv.follow_up_date, p.full_name`, params
    );
    return res.json({ success: true, data: rows });
  } catch (error) { return next(error); }
};

const getClinicalCatalog = async (req, res, next) => {
  try {
    const [drugs, units, dosageTimes, mealRelations, diagnoses] = await Promise.all([
      pool.query('SELECT drug_id, name, generic_name, unit_id, price, stock_quantity FROM drugs WHERE is_active = TRUE AND stock_quantity >= 0 ORDER BY name'),
      pool.query('SELECT unit_id, name FROM units WHERE is_active = TRUE ORDER BY name'),
      pool.query('SELECT time_id, name FROM dosage_times WHERE is_active = TRUE ORDER BY time_id'),
      pool.query('SELECT relation_id, name FROM meal_relations WHERE is_active = TRUE ORDER BY relation_id'),
      pool.query('SELECT code, description FROM icd10_codes ORDER BY code')
    ]);
    return res.json({ success: true, data: { drugs: drugs[0], units: units[0], dosage_times: dosageTimes[0], meal_relations: mealRelations[0], icd10_codes: diagnoses[0] } });
  } catch (error) { next(error); }
};

const dispensePrescriptions = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId) || recordId < 1) return res.status(400).json({ success: false, message: 'Mã bệnh án không hợp lệ.' });
    await connection.beginTransaction();
    const [recordLinks] = await connection.query('SELECT appointment_id, patient_id FROM appointment_records WHERE record_id = ? FOR UPDATE', [recordId]);
    if (!recordLinks.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy bệnh án.' }); }
    const [invoices] = await connection.query(
      'SELECT id, patient_id, appointment_id, service_fee, medicine_fee FROM invoices WHERE appointment_id = ? FOR UPDATE', [recordLinks[0].appointment_id]
    );
    const invoice = invoices[0];
    if (!invoice) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' }); }
    const [appointments] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [invoice.appointment_id]);
    if (!appointments.length || appointments[0].status !== 'COMPLETED') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ cấp thuốc cho lịch đã hoàn tất khám.' }); }
    const [prescriptions] = await connection.query(
      `SELECT prescription_id, drug_id, quantity, unit_price, billing_status FROM prescriptions
       WHERE record_id = ? AND dispensing_status = 'PRESCRIBED' ORDER BY drug_id, prescription_id FOR UPDATE`, [recordId]
    );
    if (!prescriptions.length) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không còn thuốc nào chờ xử lý.' }); }

    // Legacy pending prescriptions have no invoice line yet. Bill from the
    // immutable price snapshot, once, before allowing any stock movement.
    const legacyToBill = prescriptions.filter((item) => item.billing_status === 'UNBILLED');
    let legacyMedicineFee = 0;
    for (const item of legacyToBill) {
      const unitPrice = Number(item.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: `Đơn thuốc cũ #${item.prescription_id} chưa có đơn giá hợp lệ. Admin cần kiểm tra giá trước khi lập hóa đơn hoặc giao thuốc.` });
      }
      const [[drug]] = await connection.query('SELECT name FROM drugs WHERE drug_id = ?', [item.drug_id]);
      const lineTotal = Math.round(unitPrice * Number(item.quantity) * 100) / 100;
      await connection.query(
        `INSERT INTO invoice_items (invoice_id, item_type, item_reference_id, description, quantity, unit_price, line_total)
         VALUES (?, 'MEDICINE', ?, ?, ?, ?, ?)`, [invoice.id, item.drug_id, drug?.name || `Thuốc #${item.drug_id}`, item.quantity, unitPrice, lineTotal]
      );
      await connection.query("UPDATE prescriptions SET billing_status = 'BILLED' WHERE prescription_id = ? AND billing_status = 'UNBILLED'", [item.prescription_id]);
      legacyMedicineFee += lineTotal;
    }
    let paidAmount = 0;
    let invoiceNotice = { changed: false };
    let newTotal = Number(invoice.service_fee) + Number(invoice.medicine_fee) + legacyMedicineFee;
    if (legacyToBill.length) {
      const [[paid]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS amount_paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
      paidAmount = Number(paid.amount_paid);
      const newMedicineFee = Number(invoice.medicine_fee) + legacyMedicineFee;
      newTotal = Number(invoice.service_fee) + newMedicineFee;
      const status = paidAmount >= newTotal ? 'PAID' : 'UNPAID';
      await connection.query('UPDATE invoices SET medicine_fee = ?, total_amount = ?, payment_status = ?, paid_at = IF(? = \'PAID\', COALESCE(paid_at, NOW()), NULL) WHERE id = ?', [newMedicineFee, newTotal, status, status, invoice.id]);
      invoiceNotice = await syncInvoiceNotification(connection, { invoiceId: invoice.id, totalAmount: newTotal, paidAmount });
    }
    if (paidAmount === 0 || !legacyToBill.length) {
      const [[paid]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS amount_paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
      paidAmount = Number(paid.amount_paid);
    }
    const amountDue = Math.max(0, Math.round((newTotal - paidAmount) * 100) / 100);
    if (amountDue > 0) {
      await connection.commit();
      if (legacyToBill.length) {
        const event = { appointmentId: invoice.appointment_id, status: 'UNPAID', totalAmount: newTotal, paidAmount, amountDue };
        req.app.get('io')?.to(`user:${invoice.patient_id}`).emit('payment_updated', event);
        req.app.get('io')?.to('role:ADMIN').emit('payment_updated', event);
        if (invoiceNotice.changed) emitNotificationsUpdated(req, invoice.patient_id, invoice.id);
      }
      return res.json({ success: true, code: 'PAYMENT_REQUIRED', message: 'Đã lập các dòng thuốc còn thiếu cho hóa đơn. Chưa giao/trừ kho; cần thanh toán đủ rồi xác nhận giao thuốc.', data: { record_id: recordId, total_amount: newTotal, amount_paid: paidAmount, amount_due: amountDue, dispensed_lines: 0 } });
    }

    const outcomes = Array.isArray(req.body.outcomes) ? req.body.outcomes : [];
    const outcomeById = new Map();
    for (const outcome of outcomes) {
      const id = Number(outcome.prescription_id);
      if (!Number.isInteger(id) || !['DISPENSE', 'EXTERNAL'].includes(outcome.action) || outcomeById.has(id)) {
        await connection.rollback(); return res.status(400).json({ success: false, message: 'Kết quả cấp thuốc không hợp lệ.' });
      }
      outcomeById.set(id, outcome.action);
    }
    if (outcomeById.size !== prescriptions.length || prescriptions.some((item) => !outcomeById.has(item.prescription_id))) {
      await connection.rollback(); return res.status(400).json({ success: false, message: 'Hãy chọn cấp tại phòng khám hoặc mua ngoài cho từng thuốc.' });
    }

    const dispensing = prescriptions.filter((item) => outcomeById.get(item.prescription_id) === 'DISPENSE');
    const drugIds = [...new Set(dispensing.map((item) => item.drug_id))].sort((a, b) => a - b);
    const [drugs] = drugIds.length ? await connection.query(
      'SELECT drug_id, name, stock_quantity FROM drugs WHERE drug_id IN (?) ORDER BY drug_id FOR UPDATE', [drugIds]
    ) : [[]];
    const drugById = new Map(drugs.map((drug) => [drug.drug_id, drug]));
    for (const item of dispensing) {
      const drug = drugById.get(item.drug_id);
      if (!drug || Number(drug.stock_quantity) < Number(item.quantity)) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: `Không đủ tồn kho ${drug?.name || 'thuốc'}. Cần ${item.quantity}, hiện có ${drug?.stock_quantity ?? 0}.` });
      }
    }

    for (const item of prescriptions) {
      if (outcomeById.get(item.prescription_id) === 'EXTERNAL') {
        await connection.query("UPDATE prescriptions SET dispensing_status = 'NOT_DISPENSED', dispensed_quantity = 0, dispensed_unit_price = NULL, dispensed_at = NOW() WHERE prescription_id = ? AND dispensing_status = 'PRESCRIBED'", [item.prescription_id]);
        continue;
      }
      const drug = drugById.get(item.drug_id);
      const [stockUpdate] = await connection.query('UPDATE drugs SET stock_quantity = stock_quantity - ? WHERE drug_id = ? AND stock_quantity >= ?', [item.quantity, item.drug_id, item.quantity]);
      if (stockUpdate.affectedRows !== 1) throw Object.assign(new Error(`Tồn kho ${drug.name} vừa thay đổi; tải lại danh sách trước khi cấp.`), { status: 409 });
      await connection.query(
        `INSERT INTO stock_movements (drug_id, quantity_delta, reason, reference_type, reference_id, performed_by)
         VALUES (?, ?, 'PRESCRIPTION_DISPENSE', 'PRESCRIPTION', ?, ?)`, [-Number(item.quantity), item.drug_id, item.prescription_id, req.user.id]
      );
      await connection.query("UPDATE prescriptions SET dispensing_status = 'DISPENSED', dispensed_quantity = quantity, dispensed_unit_price = unit_price, dispensed_at = NOW() WHERE prescription_id = ? AND dispensing_status = 'PRESCRIBED'", [item.prescription_id]);
    }

    await connection.commit();
    req.app.get('io')?.to('role:ADMIN').emit('prescriptions_updated', { recordId });
    return res.json({ success: true, message: 'Đã xác nhận giao thuốc. Phí thuốc đã được tính khi bác sĩ lưu đơn; bước này chỉ xử lý tồn kho.', data: { record_id: recordId, dispensed_lines: dispensing.length, external_lines: prescriptions.length - dispensing.length, medicine_fee: 0, total_amount: newTotal, amount_paid: paidAmount, amount_due: 0 } });
  } catch (error) {
    await connection.rollback();
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  } finally { connection.release(); }
};

const getPendingDispensing = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT mr.record_id, mr.patient_id, mr.appointment_id, a.appointment_date, a.time_slot,
       p.full_name AS patient_name, p.phone AS patient_phone, du.full_name AS doctor_name,
       pr.prescription_id, pr.drug_id, d.name AS medicine_name, pr.quantity AS prescribed_quantity,
       pr.unit_price AS invoice_unit_price, pr.billing_status, d.stock_quantity, u.name AS unit_name,
       pr.dosage, pr.frequency, pr.duration, pr.instructions
       FROM appointment_records mr JOIN appointments a ON a.appointment_id = mr.appointment_id
       JOIN invoices i ON i.appointment_id = a.appointment_id
       JOIN users p ON p.id = mr.patient_id JOIN doctors doc ON doc.id = mr.doctor_id JOIN users du ON du.id = doc.user_id
       JOIN prescriptions pr ON pr.record_id = mr.record_id JOIN drugs d ON d.drug_id = pr.drug_id
       LEFT JOIN units u ON u.unit_id = pr.unit_id
       WHERE a.status = 'COMPLETED' AND pr.dispensing_status = 'PRESCRIBED'
       ORDER BY a.appointment_date, mr.record_id, pr.prescription_id`
    );
    return res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

module.exports = { createMedicalRecord, getPatientRecords, getRecordDetail, getMyFollowUps, getClinicalCatalog, getPendingDispensing, dispensePrescriptions };
