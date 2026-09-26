const { pool } = require('../config/db');

/**
 * Đặt lịch khám mới (Dành cho Patient)
 */
const createAppointment = async (req, res, next) => {
    try {
        const patient_id = req.user.id;
        const { doctor_id, appointment_date, time_slot, initial_symptoms, ai_predicted_specialty, notes } = req.body;

        if (!doctor_id || !appointment_date || !time_slot) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn Bác sĩ, Ngày khám và Khung giờ khám.'
            });
        }

        // Kiểm tra xem khung giờ đó bác sĩ đã có lịch chưa
        const [existing] = await pool.query(
            `SELECT id FROM Appointments 
             WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'CANCELLED'`,
            [doctor_id, appointment_date, time_slot]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Khung giờ này của Bác sĩ đã được đặt. Vui lòng chọn khung giờ khác.'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO Appointments (patient_id, doctor_id, appointment_date, time_slot, initial_symptoms, ai_predicted_specialty, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [patient_id, doctor_id, appointment_date, time_slot, initial_symptoms || null, ai_predicted_specialty || null, notes || null]
        );

        res.status(201).json({
            success: true,
            message: 'Đặt lịch khám thành công! Phòng khám sẽ liên hệ xác nhận sớm nhất.',
            data: {
                id: result.insertId,
                patient_id,
                doctor_id,
                appointment_date,
                time_slot,
                status: 'PENDING'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách lịch hẹn phù hợp theo Role
 */
const getAppointments = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        let query = `
            SELECT 
                a.id, a.appointment_date, a.time_slot, a.status, a.initial_symptoms, a.ai_predicted_specialty, a.notes, a.created_at,
                p.id as patient_id, p.full_name as patient_name, p.phone as patient_phone,
                d.id as doctor_id, du.full_name as doctor_name, s.name as specialty_name, r.room_number, r.name as room_name
            FROM Appointments a
            JOIN Users p ON a.patient_id = p.id
            JOIN Doctors d ON a.doctor_id = d.id
            JOIN Users du ON d.user_id = du.id
            LEFT JOIN Specialties s ON d.specialty_id = s.id
            LEFT JOIN Rooms r ON d.room_id = r.id
        `;
        const params = [];

        if (role === 'PATIENT') {
            query += ` WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.time_slot DESC`;
            params.push(userId);
        } else if (role === 'DOCTOR') {
            query += ` WHERE d.user_id = ? ORDER BY a.appointment_date ASC, a.time_slot ASC`;
            params.push(userId);
        } else {
            // ADMIN: xem toàn bộ
            query += ` ORDER BY a.created_at DESC`;
        }

        const [rows] = await pool.query(query, params);

        res.status(200).json({
            success: true,
            total: rows.length,
            data: rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cập nhật trạng thái lịch hẹn (PENDING, CONFIRMED, COMPLETED, CANCELLED)
 */
const updateAppointmentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}`
            });
        }

        const [result] = await pool.query(
            `UPDATE Appointments SET status = ? WHERE id = ?`,
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn tương ứng.'
            });
        }

        res.status(200).json({
            success: true,
            message: `Cập nhật trạng thái lịch hẹn thành ${status} thành công.`
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createAppointment,
    getAppointments,
    updateAppointmentStatus
};
