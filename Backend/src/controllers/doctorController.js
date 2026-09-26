const { pool } = require('../config/db');

/**
 * Lấy danh sách bác sĩ phục vụ đặt lịch và quản trị
 */
const getDoctors = async (req, res, next) => {
    try {
        const { specialty_id } = req.query;
        let query = `
            SELECT 
                d.id, d.user_id, d.bio, d.experience_years, d.consultation_fee,
                u.full_name, u.email, u.phone, u.gender,
                s.id as specialty_id, s.name as specialty_name,
                r.id as room_id, r.room_number, r.name as room_name
            FROM Doctors d
            JOIN Users u ON d.user_id = u.id
            LEFT JOIN Specialties s ON d.specialty_id = s.id
            LEFT JOIN Rooms r ON d.room_id = r.id
            WHERE u.is_active = TRUE
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
        const [specialties] = await pool.query('SELECT * FROM Specialties ORDER BY name ASC');
        res.status(200).json({
            success: true,
            data: specialties
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy chi tiết thông tin 1 bác sĩ
 */
const getDoctorById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [doctors] = await pool.query(
            `SELECT 
                d.id, d.user_id, d.bio, d.experience_years, d.consultation_fee,
                u.full_name, u.email, u.phone, u.gender,
                s.id as specialty_id, s.name as specialty_name,
                r.id as room_id, r.room_number, r.name as room_name
            FROM Doctors d
            JOIN Users u ON d.user_id = u.id
            LEFT JOIN Specialties s ON d.specialty_id = s.id
            LEFT JOIN Rooms r ON d.room_id = r.id
            WHERE d.id = ?`,
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

module.exports = {
    getDoctors,
    getSpecialties,
    getDoctorById
};
