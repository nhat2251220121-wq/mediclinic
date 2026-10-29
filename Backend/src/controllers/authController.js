const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../config/jwt');

/**
 * Đăng ký tài khoản Bệnh nhân mới (qua SĐT & Mật khẩu)
 */
const register = async (req, res, next) => {
    const { full_name, phone, email, password, gender, date_of_birth, address, citizen_id, emergency_contact, job } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof full_name === 'string' ? full_name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const optionalText = (value) => typeof value === 'string' ? value.trim() : '';
    const cleanCitizenId = optionalText(citizen_id);
    const cleanEmergencyContact = optionalText(emergency_contact);
    const cleanAddress = optionalText(address);
    const cleanJob = optionalText(job);
    const fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 150) fieldErrors.email = 'Email không hợp lệ hoặc vượt quá 150 ký tự.';
    if (typeof password !== 'string' || password.length < 8 || !password.trim()) fieldErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự và không được chỉ chứa khoảng trắng.';
    if (!cleanName) fieldErrors.full_name = 'Vui lòng nhập họ và tên.';
    const validPhone = (value) => /^\+?[0-9 ()-]{8,20}$/.test(value) && (value.match(/\d/g) || []).length >= 8 && (value.match(/\d/g) || []).length <= 15;
    if (!validPhone(cleanPhone)) fieldErrors.phone = 'Nhập số điện thoại có từ 8 đến 15 chữ số.';
    if (typeof date_of_birth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
        fieldErrors.date_of_birth = 'Vui lòng nhập ngày sinh hợp lệ.';
    } else {
        const [year, month, day] = date_of_birth.split('-').map(Number);
        const parsedDate = new Date(Date.UTC(year, month - 1, day));
        const isRealDate = parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day;
        const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
        const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
        if (!isRealDate || date_of_birth > today) fieldErrors.date_of_birth = 'Ngày sinh không hợp lệ hoặc nằm trong tương lai.';
    }
    if (!['MALE', 'FEMALE', 'OTHER'].includes(gender)) fieldErrors.gender = 'Vui lòng chọn giới tính.';
    if (!validPhone(cleanEmergencyContact)) fieldErrors.emergency_contact = 'Nhập số liên hệ khẩn cấp có từ 8 đến 15 chữ số.';
    if (!/^\d{9}$|^\d{12}$/.test(cleanCitizenId)) fieldErrors.citizen_id = 'Nhập CMND gồm 9 số hoặc CCCD gồm 12 số.';
    if (!cleanAddress) fieldErrors.address = 'Vui lòng nhập địa chỉ.';
    if (cleanName.length > 150) fieldErrors.full_name = 'Họ và tên không được vượt quá 150 ký tự.';
    if (cleanCitizenId.length > 50) fieldErrors.citizen_id = 'CCCD/CMND không được vượt quá 50 ký tự.';
    if (cleanAddress.length > 255) fieldErrors.address = 'Địa chỉ không được vượt quá 255 ký tự.';
    if (cleanJob.length > 100) fieldErrors.job = 'Nghề nghiệp không được vượt quá 100 ký tự.';
    if (Object.keys(fieldErrors).length) {
        return res.status(400).json({ success: false, message: 'Vui lòng kiểm tra lại các trường được đánh dấu.', fieldErrors });
    }

    const connection = await pool.getConnection();
    let transactionStarted = false;
    try {
        await connection.beginTransaction();
        transactionStarted = true;
        const [verification] = await connection.query(
            `SELECT id FROM email_verifications WHERE email = ? AND verified_at IS NOT NULL
             AND consumed_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1 FOR UPDATE`, [cleanEmail]
        );
        if (!verification.length) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({ success: false, message: 'Vui lòng xác thực email trước khi đăng ký.', fieldErrors: { email: 'Email chưa được xác thực hoặc mã xác thực đã hết hạn.' } });
        }

        // Kiểm tra SĐT hoặc Email trùng
        const [existing] = await connection.query(
            'SELECT id, phone, email FROM users WHERE phone = ? OR LOWER(TRIM(email)) = ? FOR UPDATE',
            [cleanPhone, cleanEmail]
        );
        if (existing.length > 0) {
            await connection.rollback();
            transactionStarted = false;
            const emailUsed = existing.some((row) => row.email && row.email.trim().toLowerCase() === cleanEmail);
            const phoneUsed = existing.some((row) => row.phone === cleanPhone);
            return res.status(400).json({
                success: false,
                message: emailUsed ? 'Email này đã được sử dụng. Hãy đăng nhập; nếu quên mật khẩu, liên hệ quản trị viên để được hỗ trợ khôi phục hoặc dùng email khác.' : 'Số điện thoại này đã được sử dụng.',
                fieldErrors: { ...(emailUsed ? { email: 'Email này đã được sử dụng.' } : {}), ...(phoneUsed ? { phone: 'Số điện thoại này đã được sử dụng.' } : {}) }
            });
        }

        // Hash mật khẩu
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Lưu vào bảng users
        const [result] = await connection.query(
            `INSERT INTO users (full_name, phone, email, password_hash, gender, date_of_birth, citizen_id, emergency_contact, job, address, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PATIENT')`,
            [cleanName, cleanPhone, cleanEmail, password_hash, gender, date_of_birth, cleanCitizenId || null, cleanEmergencyContact || null, cleanJob || null, cleanAddress || null]
        );
        await connection.query('UPDATE email_verifications SET consumed_at = NOW() WHERE id = ?', [verification[0].id]);
        await connection.commit();
        transactionStarted = false;

        const newUserId = result.insertId;
        const token = generateToken({
            id: newUserId,
            phone: cleanPhone,
            email: cleanEmail,
            role: 'PATIENT',
            full_name: cleanName
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
        if (transactionStarted) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            const emailUsed = String(error.sqlMessage || '').toLowerCase().includes('email');
            return res.status(409).json({
                success: false,
                message: emailUsed ? 'Email này đã được sử dụng. Hãy đăng nhập; nếu quên mật khẩu, liên hệ quản trị viên để được hỗ trợ khôi phục hoặc dùng email khác.' : 'Số điện thoại này đã được sử dụng.',
                fieldErrors: emailUsed ? { email: 'Email này đã được sử dụng.' } : { phone: 'Số điện thoại này đã được sử dụng.' }
            });
        }
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
        const cleanCitizenId = typeof citizen_id === 'string' ? citizen_id.trim() : '';
        const cleanEmergency = typeof emergency_contact === 'string' ? emergency_contact.trim() : '';
        const cleanInsurance = typeof insurance_code === 'string' ? insurance_code.trim() : '';
        const cleanJob = typeof job === 'string' ? job.trim() : '';
        const cleanAddress = typeof address === 'string' ? address.trim() : '';
        const fieldErrors = {};
        const validPhone = (value) => /^\+?[0-9 ()-]{8,20}$/.test(value) && (value.match(/\d/g) || []).length >= 8 && (value.match(/\d/g) || []).length <= 15;
        if (!name) fieldErrors.full_name = 'Vui lòng nhập họ và tên.';
        else if (name.length > 150) fieldErrors.full_name = 'Họ và tên không được vượt quá 150 ký tự.';
        if (!validPhone(cleanPhone)) fieldErrors.phone = 'Nhập số điện thoại hợp lệ có từ 8 đến 15 chữ số.';
        if (!['MALE', 'FEMALE', 'OTHER'].includes(gender)) fieldErrors.gender = 'Vui lòng chọn giới tính.';
        if (date_of_birth) {
            let validDate = false;
            if (typeof date_of_birth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
                const [year, month, day] = date_of_birth.split('-').map(Number);
                const date = new Date(Date.UTC(year, month - 1, day));
                const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
                    .formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
                const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
                validDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date_of_birth <= today;
            }
            if (!validDate) fieldErrors.date_of_birth = 'Ngày sinh không hợp lệ hoặc nằm trong tương lai.';
        }
        if (cleanCitizenId && !/^\d{9}$|^\d{12}$/.test(cleanCitizenId)) fieldErrors.citizen_id = 'Nhập CMND gồm 9 số hoặc CCCD gồm 12 số.';
        if (cleanEmergency && !validPhone(cleanEmergency)) fieldErrors.emergency_contact = 'Nhập số liên hệ khẩn cấp hợp lệ.';
        if (cleanInsurance.length > 50) fieldErrors.insurance_code = 'Mã BHYT không được vượt quá 50 ký tự.';
        if (cleanJob.length > 100) fieldErrors.job = 'Nghề nghiệp không được vượt quá 100 ký tự.';
        if (cleanAddress.length > 255) fieldErrors.address = 'Địa chỉ không được vượt quá 255 ký tự.';
        if (Object.keys(fieldErrors).length) return res.status(400).json({ success: false, message: 'Vui lòng kiểm tra lại thông tin hồ sơ.', fieldErrors });
        const [result] = await pool.query(
            `UPDATE users SET full_name = ?, phone = ?, gender = ?, date_of_birth = ?, citizen_id = ?, insurance_code = ?,
             emergency_contact = ?, job = ?, address = ? WHERE id = ? AND is_active = TRUE`,
            [name, cleanPhone, gender, date_of_birth || null, cleanCitizenId || null, cleanInsurance || null, cleanEmergency || null, cleanJob || null, cleanAddress || null, req.user.id]
        );
        const [rows] = await pool.query("SELECT id, full_name, phone, email, gender, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth, citizen_id, insurance_code, emergency_contact, job, address, role FROM users WHERE id = ?", [req.user.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản đang hoạt động.' });
        return res.json({ success: true, message: 'Đã lưu hồ sơ.', data: rows[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Số điện thoại này đã được tài khoản khác sử dụng.', fieldErrors: { phone: 'Số điện thoại này đã được sử dụng.' } });
        next(error);
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile
};
