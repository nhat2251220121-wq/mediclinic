const { pool } = require('../config/db');

const clinicToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const clinicClock = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('hour')}:${value('minute')}:${value('second')}`;
};

const isDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const parseFilters = (query) => {
  const startDate = query.startDate || query.date || clinicToday();
  const endDate = query.endDate || query.date || startDate;
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) return { error: 'Ngày bắt đầu hoặc kết thúc không hợp lệ.' };
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
  if (days > 366) return { error: 'Khoảng lọc tối đa là 366 ngày.' };
  const doctorId = query.doctor_id ? Number(query.doctor_id) : null;
  const specialtyId = query.specialty_id ? Number(query.specialty_id) : null;
  if (doctorId !== null && (!Number.isSafeInteger(doctorId) || doctorId < 1)) return { error: 'Mã bác sĩ không hợp lệ.' };
  if (specialtyId !== null && (!Number.isSafeInteger(specialtyId) || specialtyId < 1)) return { error: 'Mã chuyên khoa không hợp lệ.' };
  const status = query.status || null;
  if (status && !['AVAILABLE', 'BOOKED', 'OFF', 'PAST_EMPTY'].includes(status)) return { error: 'Trạng thái khung giờ không hợp lệ.' };
  return { startDate, endDate, doctorId, specialtyId, status, today: clinicToday(), now: clinicClock() };
};

const getWorkSlots = async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    if (filters.error) return res.status(400).json({ success: false, message: filters.error });
    const { startDate, endDate, doctorId, specialtyId, status, today, now } = filters;
    const params = [startDate, endDate];
    let where = 'sd.work_date BETWEEN ? AND ?';
    if (doctorId) { where += ' AND d.id = ?'; params.push(doctorId); }
    if (specialtyId) { where += ' AND d.specialty_id = ?'; params.push(specialtyId); }
    const futureSlotCondition = '(sd.work_date > ? OR (sd.work_date = ? AND st.start_time > ?))';
    if (status === 'AVAILABLE') {
      where += ` AND ${futureSlotCondition} AND st.status = 'AVAILABLE' AND se.status = 'AVAILABLE' AND a.appointment_id IS NULL`;
      params.push(today, today, now);
    }
    if (status === 'BOOKED') where += " AND (a.appointment_id IS NOT NULL OR st.status = 'BOOKED')";
    if (status === 'OFF') {
      where += ` AND ${futureSlotCondition} AND st.status <> 'BOOKED' AND a.appointment_id IS NULL AND (st.status = 'OFF' OR se.status IN ('OFF', 'FULL'))`;
      params.push(today, today, now);
    }
    if (status === 'PAST_EMPTY') {
      where += " AND (sd.work_date < ? OR (sd.work_date = ? AND st.start_time <= ?)) AND a.appointment_id IS NULL AND st.status <> 'BOOKED'";
      params.push(today, today, now);
    }

    const [slots] = await pool.query(
      `SELECT st.id AS slot_id, sd.work_date, d.id AS doctor_id, du.full_name AS doctor_name,
          d.specialty_id, COALESCE(sp.name, 'Chưa phân chuyên khoa') AS specialty_name,
          sh.name AS shift_name,
          TIME_FORMAT(st.start_time, '%H:%i') AS start_time,
          TIME_FORMAT(st.end_time, '%H:%i') AS end_time,
          CASE
            WHEN a.appointment_id IS NOT NULL OR st.status = 'BOOKED' THEN 'BOOKED'
            WHEN st.status = 'OFF' OR se.status IN ('OFF', 'FULL') THEN 'OFF'
            ELSE 'AVAILABLE'
          END AS slot_status,
          a.appointment_id, a.status AS appointment_status, p.full_name AS patient_name
       FROM shift_day_employee sd
       JOIN shift_employee se ON se.shift_day_employee_id = sd.id
       JOIN shifts sh ON sh.shift_id = se.shift_id
       JOIN doctors d ON d.id = sd.doctor_id
       JOIN users du ON du.id = d.user_id
       LEFT JOIN specialties sp ON sp.id = d.specialty_id
       JOIN shift_time_slots st ON st.shift_employee_id = se.id
       LEFT JOIN appointments a ON a.slot_id = st.id AND a.status <> 'CANCELLED'
       LEFT JOIN users p ON p.id = a.patient_id
       WHERE ${where}
       ORDER BY sd.work_date ASC, du.full_name ASC, st.start_time ASC, st.id ASC`, params
    );

    const missingParams = [startDate, endDate];
    let missingWhere = 'sd.work_date BETWEEN ? AND ?';
    if (doctorId) { missingWhere += ' AND d.id = ?'; missingParams.push(doctorId); }
    if (specialtyId) { missingWhere += ' AND d.specialty_id = ?'; missingParams.push(specialtyId); }
    const [shiftsWithoutSlots] = await pool.query(
      `SELECT sd.work_date, d.id AS doctor_id, du.full_name AS doctor_name,
          COALESCE(sp.name, 'Chưa phân chuyên khoa') AS specialty_name, sh.name AS shift_name,
          TIME_FORMAT(sh.start_time, '%H:%i') AS start_time, TIME_FORMAT(sh.end_time, '%H:%i') AS end_time,
          se.status AS shift_status,
          COUNT(st.id) AS saved_slot_count,
          COUNT(a.appointment_id) AS active_appointment_count
       FROM shift_day_employee sd
       JOIN shift_employee se ON se.shift_day_employee_id = sd.id
       JOIN shifts sh ON sh.shift_id = se.shift_id
       JOIN doctors d ON d.id = sd.doctor_id
       JOIN users du ON du.id = d.user_id
       LEFT JOIN specialties sp ON sp.id = d.specialty_id
       LEFT JOIN shift_time_slots st ON st.shift_employee_id = se.id
       LEFT JOIN appointments a ON a.shift_employee_id = se.id AND a.status <> 'CANCELLED'
       WHERE ${missingWhere}
       GROUP BY sd.id, sd.work_date, d.id, du.full_name, sp.name, sh.name, sh.start_time, sh.end_time, se.status
       HAVING COUNT(st.id) = 0
       ORDER BY sd.work_date ASC, du.full_name ASC, sh.start_time ASC`, missingParams
    );

    return res.json({ success: true, data: { slots, shiftsWithoutSlots, filters: { startDate, endDate, doctor_id: doctorId, specialty_id: specialtyId, status } } });
  } catch (error) { return next(error); }
};

const setWorkSlotStatus = async (req, res, next) => {
  const slotId = Number(req.params.slotId);
  const requestedStatus = req.body.status;
  if (!Number.isSafeInteger(slotId) || slotId < 1) return res.status(400).json({ success: false, message: 'Mã khung giờ không hợp lệ.' });
  if (!['AVAILABLE', 'OFF'].includes(requestedStatus)) return res.status(400).json({ success: false, message: 'Chỉ có thể mở hoặc ngừng nhận một khung giờ.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [appointments] = await connection.query(
      "SELECT appointment_id FROM appointments WHERE slot_id = ? AND status <> 'CANCELLED' LIMIT 1 FOR UPDATE", [slotId]
    );
    const [rows] = await connection.query(
      `SELECT st.id, st.status AS slot_status, st.shift_employee_id, sd.work_date,
          TIME_FORMAT(st.start_time, '%H:%i:%s') AS start_time
       FROM shift_time_slots st
       JOIN shift_employee se ON se.id = st.shift_employee_id
       JOIN shift_day_employee sd ON sd.id = se.shift_day_employee_id
       WHERE st.id = ? FOR UPDATE`, [slotId]
    );
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy khung giờ đã lưu.' }); }
    const slot = rows[0];
    const today = clinicToday();
    const now = clinicClock();
    const workDate = String(slot.work_date).slice(0, 10);
    if (workDate < today || (workDate === today && slot.start_time <= now)) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Không thể thay đổi trạng thái của khung giờ đã qua theo giờ Việt Nam.' });
    }
    if (slot.slot_status === 'BOOKED' || appointments.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Khung giờ đã có lịch hẹn; không thể ngừng hoặc mở lại từ đây.' });
    }
    if (requestedStatus === 'AVAILABLE') {
      const [legacyAppointments] = await connection.query(
        "SELECT appointment_id FROM appointments WHERE shift_employee_id = ? AND slot_id IS NULL AND status <> 'CANCELLED' LIMIT 1 FOR UPDATE",
        [slot.shift_employee_id]
      );
      if (legacyAppointments.length) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Ca làm có lịch hẹn dữ liệu cũ chưa gắn với khung 30 phút; cần đối chiếu trước khi mở khung.' });
      }
      await connection.query("UPDATE shift_employee SET status = 'AVAILABLE' WHERE id = ?", [slot.shift_employee_id]);
    }
    await connection.query('UPDATE shift_time_slots SET status = ? WHERE id = ?', [requestedStatus, slotId]);
    await connection.commit();
    return res.json({ success: true, message: requestedStatus === 'OFF' ? 'Đã ngừng nhận đặt lịch cho khung giờ.' : 'Đã mở lại khung giờ.', data: { slot_id: slotId, status: requestedStatus } });
  } catch (error) {
    await connection.rollback().catch(() => {});
    return next(error);
  } finally { connection.release(); }
};

module.exports = { getWorkSlots, setWorkSlotStatus };
