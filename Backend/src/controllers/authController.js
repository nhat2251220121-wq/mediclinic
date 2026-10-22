const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../config/jwt');

/**
 * Đăng ký tài khoản Bệnh nhân mới (qua SĐT & Mật khẩu)
 */
const register = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { full_name, phone, email, password, gender, date_of_birth, address } = req.body;
        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
        const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
        if (!cleanName || !cleanPhone || !/^\+?[0-9 ()-]{8,20}$/.test(cleanPhone) || !/^\S+@\S+\.\S+$/.test(cleanEmail) || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập họ tên, số điện thoại hợp lệ, email và mật khẩu tối thiểu 8 ký tự.'
            });
        }
        await connection.beginTransaction();
        const [verification] = await connection.query(
            `SELECT id FROM email_verifications WHERE email = ? AND verified_at IS NOT NULL
             AND consumed_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1 FOR UPDATE`, [cleanEmail]
        );
        if (!verification.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Vui lòng xác thực email trước khi đăng ký.' });
        }

        // Kiểm tra SĐT hoặc Email trùng
        const [existing] = await connection.query(
            'SELECT id FROM users WHERE phone = ? OR email = ?',
            [cleanPhone, cleanEmail]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại hoặc Email này đã được sử dụng.'
            });
        }

        // Hash mật khẩu
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Lưu vào bảng users
        const [result] = await connection.query(
            `INSERT INTO users (full_name, phone, email, password_hash, gender, date_of_birth, address, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PATIENT')`,
            [cleanName, cleanPhone, cleanEmail, password_hash, gender || 'OTHER', date_of_birth || null, address || null]
        );
        await connection.query('UPDATE email_verifications SET consumed_at = NOW() WHERE id = ?', [verification[0].id]);
        await connection.commit();

        const newUserId = result.insertId;
        const token = generateToken({
            id: newUserId,
            phone: cleanPhone,
            email: cleanEmail,
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
                    full_name: cleanName,
                    phone: cleanPhone,
                    email: cleanEmail,
                    role: 'PATIENT'
                }
            }
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
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
            `SELECT u.id, u.full_name, u.phone, u.email, u.password_hash, u.role, u.is_active, d.id AS doctor_id, d.avatar_url
             FROM users u LEFT JOIN doctors d ON d.user_id = u.id
             WHERE u.phone = ? OR u.email = ?`,
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
        const doctorId = user.role === 'DOCTOR' ? user.doctor_id : null;

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
                    avatar_url: user.avatar_url || null,
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
            `SELECT u.id, u.full_name, u.phone, u.email, u.gender, DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth, u.citizen_id, u.insurance_code, u.emergency_contact, u.job, u.address, u.role, u.created_at, d.avatar_url
             FROM users u LEFT JOIN doctors d ON d.user_id = u.id WHERE u.id = ?`,
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

const updateProfile = async (req, res, next) => {
    try {
        const { full_name, phone, gender, date_of_birth, citizen_id, insurance_code, emergency_contact, job, address } = req.body;
        const name = typeof full_name === 'string' ? full_name.trim() : '';
        const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
        if (!name || !/^\+?[0-9 ()-]{8,20}$/.test(cleanPhone) || !['MALE', 'FEMALE', 'OTHER'].includes(gender) || (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth))) {
            return res.status(400).json({ success: false, message: 'Họ tên, số điện thoại hoặc giới tính không hợp lệ.' });
        }
        const [result] = await pool.query(
            `UPDATE users SET full_name = ?, phone = ?, gender = ?, date_of_birth = ?, citizen_id = ?, insurance_code = ?,
             emergency_contact = ?, job = ?, address = ? WHERE id = ? AND is_active = TRUE`,
            [name, cleanPhone, gender, date_of_birth || null, citizen_id || null, insurance_code || null, emergency_contact || null, job || null, address || null, req.user.id]
        );
        const [rows] = await pool.query("SELECT id, full_name, phone, email, gender, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth, citizen_id, insurance_code, emergency_contact, job, address, role FROM users WHERE id = ?", [req.user.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản đang hoạt động.' });
        return res.json({ success: true, message: 'Đã lưu hồ sơ.', data: rows[0] });
    } catch (error) { next(error); }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile
};
