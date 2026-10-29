const { pool } = require('../config/db');
const { stageImage, publishImage, discardImage, deleteStoredImage } = require('../utils/imageStorage');

const clinicDateParts = (date = new Date()) => Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(date).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value])
);
const clinicToday = () => { const { year, month, day } = clinicDateParts(); return `${year}-${month}-${day}`; };
const isRealISODate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const clinicTime = () => Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value])
);
const getBookingSlotMinutes = () => {
    const configured = Number(process.env.BOOKING_SLOT_MINUTES || 30);
    return Number.isInteger(configured) && configured >= 10 && configured <= 120 ? configured : 30;
};
const timeToMinutes = (value) => {
    const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
};
const timeFromMinutes = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00`;
const ensureShiftSlots = async (connection, shiftEmployeeId, shift, preserveOff = false) => {
    const [existingSlots] = await connection.query('SELECT id, status FROM shift_time_slots WHERE shift_employee_id = ? FOR UPDATE', [shiftEmployeeId]);
    if (existingSlots.length) {
        if (!preserveOff) await connection.query("UPDATE shift_time_slots SET status = 'AVAILABLE' WHERE shift_employee_id = ? AND status = 'OFF'", [shiftEmployeeId]);
        return;
    }
    const [activeAppointments] = await connection.query("SELECT appointment_id FROM appointments WHERE shift_employee_id = ? AND status <> 'CANCELLED'", [shiftEmployeeId]);
    if (activeAppointments.length) return; // A pre-slot full-shift booking remains untouched and unavailable.
    const slotMinutes = getBookingSlotMinutes();
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    if (end <= start || (end - start) % slotMinutes !== 0) throw new Error(`Ca ${shift.start_time}-${shift.end_time} không chia hết cho BOOKING_SLOT_MINUTES=${slotMinutes}.`);
    for (let minute = start; minute < end; minute += slotMinutes) {
        await connection.query(
            "INSERT INTO shift_time_slots (shift_employee_id, start_time, end_time, status) VALUES (?, ?, ?, 'AVAILABLE')",
            [shiftEmployeeId, timeFromMinutes(minute), timeFromMinutes(minute + slotMinutes)]
        );
    }
};

/**
 * Lấy danh sách bác sĩ phục vụ đặt lịch và quản trị
 */
const getDoctors = async (req, res, next) => {
    try {
        const { specialty_id } = req.query;
        let query = `
            SELECT 
                d.id, d.bio, d.experience_years, d.consultation_fee, d.avatar_url,
                u.full_name,
                s.id as specialty_id, s.name as specialty_name,
                r.id as room_id, r.room_number, r.name as room_name
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN specialties s ON d.specialty_id = s.id
            LEFT JOIN rooms r ON d.room_id = r.id
            WHERE u.is_active = TRUE AND d.is_active = TRUE AND s.is_active = TRUE
        `;
        const params = [];

        if (specialty_id) {
            query += ' AND d.specialty_id = ?';
            params.push(specialty_id);
        }

        query += ' ORDER BY d.id ASC';

        const [doctors] = await pool.query(query, params);
        res.status(200).json({
            success: true,
            total: doctors.length,
            data: doctors
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách các chuyên khoa
 */
const getSpecialties = async (req, res, next) => {
    try {
        const [specialties] = await pool.query('SELECT * FROM specialties WHERE is_active = TRUE ORDER BY name ASC');
        res.status(200).json({
            success: true,
            data: specialties
        });
    } catch (error) {
        next(error);
    }
};

const getServices = async (req, res, next) => {
    try {
        const [services] = await pool.query(`SELECT svc.id, svc.name, svc.price, svc.description, svc.image_url,
            svc.specialty_id, sp.name AS specialty_name
            FROM services svc JOIN specialties sp ON sp.id = svc.specialty_id AND sp.is_active = TRUE
            WHERE svc.is_active = TRUE ORDER BY svc.name ASC`);
        res.json({ success: true, data: services });
    } catch (error) { next(error); }
};

const getAvailableSlots = async (req, res, next) => {
    try {
        const doctorId = Number(req.query.doctor_id);
        const date = String(req.query.date || '');
        if (!Number.isInteger(doctorId) || !isRealISODate(date)) return res.status(400).json({ success: false, message: 'Bác sĩ hoặc ngày không hợp lệ.' });
        if (date < clinicToday()) return res.json({ success: true, data: [] });
        const [rows] = await pool.query(
            `SELECT st.id AS slot_id, se.id AS shift_employee_id, sh.shift_id, sh.name AS shift_name,
             TIME_FORMAT(st.start_time, '%H:%i') AS start_time, TIME_FORMAT(st.end_time, '%H:%i') AS end_time,
             CONCAT(TIME_FORMAT(st.start_time, '%H:%i'), ' - ', TIME_FORMAT(st.end_time, '%H:%i')) AS time_slot
             FROM shift_day_employee sd JOIN shift_employee se ON se.shift_day_employee_id = sd.id
             JOIN shift_time_slots st ON st.shift_employee_id = se.id AND st.status = 'AVAILABLE'
             JOIN shifts sh ON sh.shift_id = se.shift_id JOIN doctors d ON d.id = sd.doctor_id JOIN users u ON u.id = d.user_id
             WHERE sd.doctor_id = ? AND sd.work_date = ? AND se.status = 'AVAILABLE'
             AND d.is_active = TRUE AND u.is_active = TRUE
             AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = st.id AND a.status <> 'CANCELLED')
             ORDER BY st.start_time`, [doctorId, date]
        );
        const today = clinicToday();
        const { hour, minute } = clinicTime();
        const currentTime = `${hour}:${minute}`;
        const result = rows.filter((row) => date !== today || row.start_time > currentTime);
        return res.json({ success: true, data: result });
    } catch (error) { next(error); }
};

const getShifts = async (req, res, next) => {
    try {
        const [rows] = await pool.query("SELECT shift_id, name, TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time FROM shifts ORDER BY start_time");
        res.json({ success: true, data: rows });
    } catch (error) { next(error); }
};

const getMySchedule = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT sd.work_date, se.id AS slot_id, se.status, sh.shift_id, sh.name AS shift_name,
             TIME_FORMAT(sh.start_time, '%H:%i') AS start_time, TIME_FORMAT(sh.end_time, '%H:%i') AS end_time
             FROM doctors d JOIN shift_day_employee sd ON sd.doctor_id = d.id
             JOIN shift_employee se ON se.shift_day_employee_id = sd.id JOIN shifts sh ON sh.shift_id = se.shift_id
             WHERE d.user_id = ? ORDER BY sd.work_date DESC, sh.start_time`, [req.user.id]
        );
        return res.json({ success: true, data: rows });
    } catch (error) { next(error); }
};

const saveMySchedule = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const submittedDays = Array.isArray(req.body.days)
            ? req.body.days
            : (req.body.work_date ? [{ work_date: req.body.work_date, shift_ids: req.body.shift_ids }] : null);
        if (!submittedDays || !submittedDays.length || submittedDays.length > 7) {
            return res.status(400).json({ success: false, message: 'Gửi từ 1 đến 7 ngày làm việc trong một lần lưu.' });
        }
        const today = clinicToday();
        const validationErrors = [];
        const normalizedDays = [];
        const seenDates = new Set();
        for (const item of submittedDays) {
            const date = String(item?.work_date || '');
            const rawShiftIds = item?.shift_ids;
            if (!isRealISODate(date) || date < today || seenDates.has(date) || !Array.isArray(rawShiftIds)) {
                validationErrors.push({ work_date: date || null, shift_id: null, message: !isRealISODate(date) ? 'Ngày không hợp lệ.' : date < today ? 'Không thể đăng ký ngày trong quá khứ.' : seenDates.has(date) ? 'Ngày bị gửi lặp.' : 'Danh sách ca làm không hợp lệ.' });
                continue;
            }
            seenDates.add(date);
            const shiftIds = rawShiftIds.map(Number);
            if (shiftIds.some((id) => !Number.isInteger(id) || id < 1) || new Set(shiftIds).size !== shiftIds.length) {
                validationErrors.push({ work_date: date, shift_id: null, message: 'Ngày có mã ca không hợp lệ hoặc bị lặp.' });
                continue;
            }
            normalizedDays.push({ work_date: date, shift_ids: shiftIds });
        }
        if (validationErrors.length) return res.status(400).json({ success: false, message: 'Có dữ liệu ngày/ca chưa hợp lệ.', data: { errors: validationErrors } });

        await connection.beginTransaction();
        const [doctorRows] = await connection.query('SELECT id FROM doctors WHERE user_id = ? AND is_active = TRUE FOR UPDATE', [req.user.id]);
        if (!doctorRows.length) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Tài khoản chưa được phân công hồ sơ bác sĩ hoạt động.' }); }
        const doctorId = doctorRows[0].id;
        const allShiftIds = [...new Set(normalizedDays.flatMap((day) => day.shift_ids))];
        const [shifts] = await connection.query('SELECT shift_id, TIME_FORMAT(start_time, \'%H:%i\') AS start_time, TIME_FORMAT(end_time, \'%H:%i\') AS end_time FROM shifts WHERE shift_id IN (?)', [allShiftIds.length ? allShiftIds : [-1]]);
        const shiftById = new Map(shifts.map((shift) => [Number(shift.shift_id), shift]));
        for (const day of normalizedDays) {
            for (const shiftId of day.shift_ids) {
                if (!shiftById.has(shiftId)) validationErrors.push({ work_date: day.work_date, shift_id: shiftId, message: 'Ca làm không tồn tại.' });
            }
        }
        if (validationErrors.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Có ca làm không tồn tại.', data: { errors: validationErrors } });
        }

        const dayPlans = [];
        const conflicts = [];
        for (const day of normalizedDays.sort((a, b) => a.work_date.localeCompare(b.work_date))) {
            let [dayRows] = await connection.query('SELECT id FROM shift_day_employee WHERE doctor_id = ? AND work_date = ? FOR UPDATE', [doctorId, day.work_date]);
            if (!dayRows.length && !day.shift_ids.length) continue;
            if (!dayRows.length) {
                await connection.query('INSERT INTO shift_day_employee (doctor_id, work_date) VALUES (?, ?)', [doctorId, day.work_date]);
                [dayRows] = await connection.query('SELECT id FROM shift_day_employee WHERE doctor_id = ? AND work_date = ? FOR UPDATE', [doctorId, day.work_date]);
            }
            const dayId = dayRows[0].id;
            const [existing] = await connection.query(
                `SELECT se.id, se.shift_id, se.status, TIME_FORMAT(sh.start_time, '%H:%i') AS start_time,
                 TIME_FORMAT(sh.end_time, '%H:%i') AS end_time
                 FROM shift_employee se JOIN shifts sh ON sh.shift_id = se.shift_id
                 WHERE se.shift_day_employee_id = ? FOR UPDATE`, [dayId]
            );
            const [appointments] = await connection.query(
                "SELECT appointment_id, shift_employee_id, slot_id, time_slot FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status <> 'CANCELLED'",
                [doctorId, day.work_date]
            );
            const desired = new Set(day.shift_ids);
            for (const row of existing) {
                const appointment = appointments.find((item) => Number(item.shift_employee_id) === Number(row.id));
                if (!desired.has(Number(row.shift_id)) && appointment) {
                    conflicts.push({ work_date: day.work_date, shift_id: Number(row.shift_id), appointment_id: appointment.appointment_id, message: 'Ca có lịch hẹn chưa được hủy/hoàn tất nên không thể gỡ.' });
                }
            }
            dayPlans.push({ ...day, day_id: dayId, existing, appointments });
        }
        if (conflicts.length) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Không lưu được vì một số ca đã có bệnh nhân đặt. Không có thay đổi nào được lưu.', data: { errors: conflicts } });
        }

        const { hour, minute } = clinicTime();
        const currentTime = `${hour}:${minute}`;
        for (const day of dayPlans) {
            const existingByShift = new Map(day.existing.map((row) => [Number(row.shift_id), row]));
            const desired = new Set(day.shift_ids);
            for (const row of day.existing) {
                if (!desired.has(Number(row.shift_id))) {
                    await connection.query("UPDATE shift_employee SET status = 'OFF' WHERE id = ?", [row.id]);
                    await connection.query("UPDATE shift_time_slots SET status = 'OFF' WHERE shift_employee_id = ? AND status <> 'BOOKED'", [row.id]);
                }
            }
            for (const shiftId of day.shift_ids) {
                const shift = shiftById.get(shiftId);
                const existing = existingByShift.get(shiftId);
                const isPastShift = day.work_date === today && shift.start_time <= currentTime;
                if (isPastShift && (!existing || existing.status === 'OFF')) {
                    validationErrors.push({ work_date: day.work_date, shift_id: shiftId, message: `Ca ${shift.start_time}-${shift.end_time} đã bắt đầu theo giờ Asia/Ho_Chi_Minh.` });
                    continue;
                }
                let shiftEmployeeId = existing?.id;
                if (!shiftEmployeeId) {
                    const [inserted] = await connection.query("INSERT INTO shift_employee (shift_day_employee_id, shift_id, status) VALUES (?, ?, 'AVAILABLE')", [day.day_id, shiftId]);
                    shiftEmployeeId = inserted.insertId;
                }
                const legacyBooking = day.appointments.some((item) => Number(item.shift_employee_id) === Number(shiftEmployeeId) && !item.slot_id);
                if (legacyBooking) {
                    await connection.query("UPDATE shift_employee SET status = 'FULL' WHERE id = ?", [shiftEmployeeId]);
                    continue;
                }
                await ensureShiftSlots(connection, shiftEmployeeId, shift);
                await connection.query("UPDATE shift_employee SET status = 'AVAILABLE' WHERE id = ?", [shiftEmployeeId]);
            }
        }
        if (validationErrors.length) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Một số ca trong hôm nay đã bắt đầu. Không có thay đổi nào được lưu.', data: { errors: validationErrors } });
        }
        await connection.commit();
        return res.json({ success: true, message: `Đã lưu ${normalizedDays.length} ngày làm việc.`, data: { days: normalizedDays } });
    } catch (error) { await connection.rollback(); next(error); }
    finally { connection.release(); }
};

/**
 * Lấy chi tiết thông tin 1 bác sĩ
 */
const getDoctorById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [doctors] = await pool.query(
            `SELECT 
                d.id, d.bio, d.experience_years, d.consultation_fee, d.avatar_url,
                u.full_name,
                s.id as specialty_id, s.name as specialty_name,
                r.id as room_id, r.room_number, r.name as room_name
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN specialties s ON d.specialty_id = s.id
            LEFT JOIN rooms r ON d.room_id = r.id
            WHERE d.id = ? AND d.is_active = TRUE AND u.is_active = TRUE`,
            [id]
        );

        if (doctors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin Bác sĩ.'
            });
        }

        res.status(200).json({
            success: true,
            data: doctors[0]
        });
    } catch (error) {
        next(error);
    }
};

const getMyProfile = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT d.id, d.bio, d.experience_years, d.consultation_fee, d.avatar_url,
                    d.specialty_id, d.room_id, d.is_active AS doctor_active,
                    u.full_name, u.phone, u.email, u.is_active AS account_active,
                    s.name AS specialty_name, r.name AS room_name, r.room_number
             FROM doctors d JOIN users u ON u.id = d.user_id
             LEFT JOIN specialties s ON s.id = d.specialty_id
             LEFT JOIN rooms r ON r.id = d.room_id
             WHERE d.user_id = ?`, [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ bác sĩ.' });
        return res.json({ success: true, data: rows[0] });
    } catch (error) { next(error); }
};

const updateMyProfile = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT id, bio FROM doctors WHERE user_id = ? FOR UPDATE', [req.user.id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ bác sĩ.' }); }
        const [users] = await connection.query('SELECT phone, email FROM users WHERE id = ? AND role = \'DOCTOR\' AND is_active = TRUE FOR UPDATE', [req.user.id]);
        if (!users.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Tài khoản bác sĩ không hoạt động.' }); }
        const phone = req.body.phone === undefined ? users[0].phone : String(req.body.phone).trim();
        const email = req.body.email === undefined ? users[0].email : String(req.body.email).trim().toLowerCase();
        const bio = req.body.bio === undefined ? rows[0].bio : (typeof req.body.bio === 'string' ? req.body.bio.trim() : null);
        if (!/^\+?[0-9 ()-]{8,20}$/.test(phone) || !/^\S+@\S+\.\S+$/.test(email) || (req.body.bio !== undefined && bio === null)) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Số điện thoại, email hoặc giới thiệu không hợp lệ.' });
        }
        await connection.query('UPDATE users SET phone = ?, email = ? WHERE id = ? AND role = \'DOCTOR\'', [phone, email, req.user.id]);
        await connection.query('UPDATE doctors SET bio = ? WHERE id = ?', [bio || null, rows[0].id]);
        await connection.commit();
        return getMyProfile(req, res, next);
    } catch (error) { await connection.rollback().catch(() => {}); next(error); }
    finally { connection.release(); }
};

const uploadMyAvatar = async (req, res, next) => {
    let image;
    let connection;
    let committed = false;
    let oldUrl;
    try {
        image = await stageImage(req.file, 'doctors');
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT id, avatar_url FROM doctors WHERE user_id = ? FOR UPDATE', [req.user.id]);
        if (!rows.length) { await connection.rollback(); await discardImage(image); return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ bác sĩ.' }); }
        oldUrl = rows[0].avatar_url;
        await publishImage(image);
        await connection.query('UPDATE doctors SET avatar_url = ? WHERE id = ?', [image.url, rows[0].id]);
        await connection.commit();
        committed = true;
        await deleteStoredImage(oldUrl, 'doctors').catch((error) => console.warn('[Images] Không dọn được ảnh cũ:', error.message));
        return res.json({ success: true, data: { avatar_url: image.url } });
    } catch (error) {
        if (connection && !committed) await connection.rollback().catch(() => {});
        await discardImage(image).catch((cleanupError) => console.warn('[Images] Không dọn được ảnh tạm:', cleanupError.message));
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        return next(error);
    } finally { connection?.release(); }
};

const removeMyAvatar = async (req, res, next) => {
    const connection = await pool.getConnection();
    let oldUrl;
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT id, avatar_url FROM doctors WHERE user_id = ? FOR UPDATE', [req.user.id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ bác sĩ.' }); }
        oldUrl = rows[0].avatar_url;
        await connection.query('UPDATE doctors SET avatar_url = NULL WHERE id = ?', [rows[0].id]);
        await connection.commit();
        await deleteStoredImage(oldUrl, 'doctors').catch((error) => console.warn('[Images] Không dọn được ảnh đã bỏ:', error.message));
        return res.json({ success: true, data: { avatar_url: null } });
    } catch (error) { await connection.rollback().catch(() => {}); next(error); }
    finally { connection.release(); }
};

module.exports = {
    getDoctors,
    getSpecialties,
    getServices,
    getAvailableSlots,
    getShifts,
    getMySchedule,
    saveMySchedule,
    getDoctorById,
    getMyProfile,
    updateMyProfile,
    uploadMyAvatar,
    removeMyAvatar
};
