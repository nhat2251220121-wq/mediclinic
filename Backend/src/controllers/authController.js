const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../config/jwt');

/**
 * Đăng ký tài khoản Bệnh nhân mới (qua SĐT & Mật khẩu)
 */
const register = async (req, res, next) => {
    try {
        const { full_name, phone, email, password, gender, date_of_birth, address } = req.body;

        if (!full_name || (!phone && !email) || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp Họ tên, Số điện thoại và Mật khẩu.'
            });
        }

        const userPhone = phone ? phone.trim() : null;
        const userEmail = email ? email.trim() : `${userPhone || Date.now()}@mediclinic.com`;

        // Kiểm tra SĐT hoặc Email trùng
        const [existing] = await pool.query(
            'SELECT id FROM Users WHERE phone = ? OR email = ?',
            [userPhone, userEmail]
        );
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại hoặc Email này đã được sử dụng.'
            });
        }

        // Hash mật khẩu
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Lưu vào bảng Users
        const [result] = await pool.query(
            `INSERT INTO Users (full_name, phone, email, password_hash, gender, date_of_birth, address, role) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PATIENT')`,
            [full_name, userPhone, userEmail, password_hash, gender || 'OTHER', date_of_birth || null, address || null]
        );

        const newUserId = result.insertId;
        const token = generateToken({
            id: newUserId,
            phone: userPhone,
            email: userEmail,
            role: 'PATIENT',
            full_name
        });

        res.status(201).json({
            success: true,
            message: 'Đăng ký tài khoản thành công!',
            data: {
                token,
                user: {
                    id: newUserId,
                    full_name,
                    phone: userPhone,
                    email: userEmail,
                    role: 'PATIENT'
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Đăng nhập hệ thống (Hỗ trợ đăng nhập bằng Số điện thoại hoặc Email)
 */
const login = async (req, res, next) => {
    try {
        // Chấp nhận key 'phone', 'email' hoặc 'username'
        const loginIdentifier = req.body.phone || req.body.email || req.body.username || req.body.phoneNumber;
        const { password } = req.body;

        if (!loginIdentifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập Số điện thoại (hoặc Email) và Mật khẩu.'
            });
        }

        const cleanIdentifier = loginIdentifier.trim();

        // Truy vấn user theo phone hoặc email
        const [users] = await pool.query(
            `SELECT id, full_name, phone, email, password_hash, role, is_active 
             FROM Users 
             WHERE phone = ? OR email = ?`,
            [cleanIdentifier, cleanIdentifier]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Số điện thoại hoặc mật khẩu không chính xác.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.'
            });
        }

        // So khớp mật khẩu bcrypt
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Số điện thoại hoặc mật khẩu không chính xác.'
            });
        }

        // Tạo JWT Token
        const token = generateToken({
            id: user.id,
            phone: user.phone,
            email: user.email,
            role: user.role,
            full_name: user.full_name
        });

        // Nếu là Doctor, lấy thêm doctor_id
        let doctorId = null;
        if (user.role === 'DOCTOR') {
            const [doctorData] = await pool.query('SELECT id FROM Doctors WHERE user_id = ?', [user.id]);
            if (doctorData.length > 0) {
                doctorId = doctorData[0].id;
            }
        }

        res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công!',
            data: {
                token,
                user: {
                    id: user.id,
                    doctorId: doctorId,
                    full_name: user.full_name,
                    phone: user.phone,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy thông tin cá nhân của người dùng hiện tại
 */
const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(
            `SELECT id, full_name, phone, email, gender, date_of_birth, citizen_id, insurance_code, address, role, created_at 
             FROM Users WHERE id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin tài khoản.'
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getProfile
};
