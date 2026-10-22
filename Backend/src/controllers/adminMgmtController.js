const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { stageImage, publishImage, discardImage, deleteStoredImage } = require('../utils/imageStorage');

const updateManagedImage = async (req, res, next, { table, idColumn, id, category }) => {
    let image;
    let connection;
    let committed = false;
    let oldUrl;
    try {
        image = await stageImage(req.file, category);
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const column = category === 'services' ? 'image_url' : 'avatar_url';
        const [rows] = await connection.query(`SELECT ${column} FROM ${table} WHERE ${idColumn} = ? FOR UPDATE`, [id]);
        if (!rows.length) {
            await connection.rollback();
            await discardImage(image);
            return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu cần cập nhật ảnh.' });
        }
        oldUrl = rows[0][column];
        await publishImage(image);
        await connection.query(`UPDATE ${table} SET ${column} = ? WHERE ${idColumn} = ?`, [image.url, id]);
        await connection.commit();
        committed = true;
        await deleteStoredImage(oldUrl, category).catch((error) => console.warn('[Images] Không dọn được ảnh cũ:', error.message));
        return res.json({ success: true, data: { image_url: image.url, avatar_url: image.url } });
    } catch (error) {
        if (connection && !committed) await connection.rollback().catch(() => {});
        await discardImage(image).catch((cleanupError) => console.warn('[Images] Không dọn được ảnh tạm:', cleanupError.message));
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        return next(error);
    } finally {
        connection?.release();
    }
};

const removeManagedImage = async (req, res, next, { table, idColumn, id, category }) => {
    const connection = await pool.getConnection();
    let oldUrl;
    try {
        await connection.beginTransaction();
        const column = category === 'services' ? 'image_url' : 'avatar_url';
        const [rows] = await connection.query(`SELECT ${column} FROM ${table} WHERE ${idColumn} = ? FOR UPDATE`, [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' }); }
        oldUrl = rows[0][column];
        await connection.query(`UPDATE ${table} SET ${column} = NULL WHERE ${idColumn} = ?`, [id]);
        await connection.commit();
        await deleteStoredImage(oldUrl, category).catch((error) => console.warn('[Images] Không dọn được ảnh đã bỏ:', error.message));
        return res.json({ success: true, data: { image_url: null, avatar_url: null } });
    } catch (error) { await connection.rollback().catch(() => {}); next(error); }
    finally { connection.release(); }
};

/**
 * 1. BÁO CÁO THỐNG KÊ DASHBOARD ADMIN
 * GET /api/admin/dashboard-stats
 */
const getDashboardStats = async (req, res, next) => {
    try {
        // 1. Tổng số ca khám
        const [[appCount]] = await pool.query(`SELECT COUNT(*) as total FROM appointments`);

        // 2. Tổng doanh thu (hóa đơn đã thanh toán)
        const [[revCount]] = await pool.query(`SELECT COALESCE(SUM(p.amount),0) as total FROM payments p WHERE p.payment_status = 'PAID' AND p.reconciliation_status <> 'REVIEW'`);

        // 3. Số bác sĩ trực
        const [[docCount]] = await pool.query(`SELECT COUNT(*) as total FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.is_active = TRUE AND u.is_active = TRUE`);

        // 4. Số bệnh nhân
        const [[patientCount]] = await pool.query(`SELECT COUNT(*) as total FROM users WHERE role = 'PATIENT'`);

        // 5. Thống kê theo ngày (14 ngày gần nhất)
        const [dailyStats] = await pool.query(`
            SELECT DATE_FORMAT(appointment_date, '%d/%m') as day, COUNT(*) as count
            FROM appointments
            GROUP BY appointment_date
            ORDER BY appointment_date DESC
            LIMIT 14
        `);

        // 6. Thống kê theo chuyên khoa
        const [specialtyStats] = await pool.query(`
            SELECT s.name, COUNT(a.appointment_id) as count
            FROM specialties s
            LEFT JOIN doctors d ON s.id = d.specialty_id
            LEFT JOIN appointments a ON d.id = a.doctor_id
            GROUP BY s.id, s.name
        `);

        res.status(200).json({
            success: true,
            data: {
                totalAppointments: appCount.total || 0,
                totalRevenue: revCount.total || 0,
                activeDoctors: docCount.total || 0,
                totalPatients: patientCount.total || 0,
                dailyStats: dailyStats.reverse(),
                specialtyStats
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. QUẢN LÝ THUỐC (Drugs / drugs)
 */
const getMedicines = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.drug_id as id, d.name, d.generic_name as activeIngredient,
                   d.packing, d.side_effects as sideEffect, d.price, d.stock_quantity, u.name as unit_name
            FROM drugs d
            LEFT JOIN units u ON d.unit_id = u.unit_id
            ORDER BY d.drug_id DESC
        `);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const createMedicine = async (req, res, next) => {
    try {
        const { name, activeIngredient, packing, sideEffect, price, stock_quantity, unit_id } = req.body;
        if (!name || !Number.isFinite(Number(price ?? 0)) || Number(price ?? 0) < 0 || !Number.isInteger(Number(stock_quantity ?? 0)) || Number(stock_quantity ?? 0) < 0) {
            return res.status(400).json({ success: false, message: 'Tên thuốc không được để trống.' });
        }
        const [result] = await pool.query(
            `INSERT INTO drugs (name, generic_name, unit_id, packing, side_effects, price, stock_quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), activeIngredient || null, unit_id || null, packing || null, sideEffect || null, Number(price ?? 0), Number(stock_quantity ?? 0)]
        );
        res.status(201).json({ success: true, message: 'Thêm thuốc mới thành công!', id: result.insertId });
    } catch (error) {
        next(error);
    }
};

const updateMedicine = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { name, activeIngredient, packing, sideEffect, price, stock_quantity, unit_id } = req.body;
        if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0) || stock_quantity !== undefined && (!Number.isInteger(Number(stock_quantity)) || Number(stock_quantity) < 0)) {
            return res.status(400).json({ success: false, message: 'Giá và tồn kho phải là số không âm hợp lệ.' });
        }
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT * FROM drugs WHERE drug_id = ? FOR UPDATE', [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc.' }); }
        const current = rows[0];
        const nextStock = stock_quantity === undefined ? current.stock_quantity : Number(stock_quantity);
        await connection.query(
            `UPDATE drugs SET name = ?, generic_name = ?, unit_id = ?, packing = ?, side_effects = ?, price = ?, stock_quantity = ? WHERE drug_id = ?`,
            [name ?? current.name, activeIngredient ?? current.generic_name, unit_id === undefined ? current.unit_id : (unit_id || null), packing ?? current.packing, sideEffect ?? current.side_effects, price === undefined ? current.price : Number(price), nextStock, id]
        );
        if (nextStock !== current.stock_quantity) {
            await connection.query(`INSERT INTO stock_movements (drug_id, quantity_delta, reason, performed_by) VALUES (?, ?, 'ADMIN_ADJUSTMENT', ?)`,
                [id, nextStock - current.stock_quantity, req.user.id]);
        }
        await connection.commit();
        res.status(200).json({ success: true, message: 'Cập nhật thông tin thuốc thành công!' });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally { connection.release(); }
};

const deleteMedicine = async (req, res, next) => {
    try {
        const { id } = req.params;
        await pool.query(`UPDATE drugs SET is_active = FALSE WHERE drug_id = ?`, [id]);
        res.status(200).json({ success: true, message: 'Đã ngừng sử dụng thuốc.' });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. QUẢN LÝ CHUYÊN KHOA (specialties)
 */
const getSpecialties = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM specialties ORDER BY id DESC`);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const createSpecialty = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Tên chuyên khoa là bắt buộc.' });

        const [result] = await pool.query(
            `INSERT INTO specialties (name, description) VALUES (?, ?)`,
            [name, description || null]
        );
        res.status(201).json({ success: true, message: 'Thêm chuyên khoa mới thành công!', id: result.insertId });
    } catch (error) {
        next(error);
    }
};

const updateSpecialty = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        await pool.query(`UPDATE specialties SET name = ?, description = ? WHERE id = ?`, [name, description, id]);
        res.status(200).json({ success: true, message: 'Cập nhật chuyên khoa thành công!' });
    } catch (error) {
        next(error);
    }
};

const deleteSpecialty = async (req, res, next) => {
    try {
        const { id } = req.params;
        await pool.query(`UPDATE specialties SET is_active = FALSE WHERE id = ?`, [id]);
        res.status(200).json({ success: true, message: 'Đã ngừng sử dụng chuyên khoa.' });
    } catch (error) {
        next(error);
    }
};

/**
 * 4. QUẢN LÝ PHÒNG KHÁM (rooms)
 */
const getRooms = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM rooms ORDER BY id DESC`);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const createRoom = async (req, res, next) => {
    try {
        const { room_number, name, location } = req.body;
        if (!room_number || !name) return res.status(400).json({ success: false, message: 'Số phòng và tên phòng không được trống.' });

        const [result] = await pool.query(
            `INSERT INTO rooms (room_number, name, location) VALUES (?, ?, ?)`,
            [room_number, name, location || null]
        );
        res.status(201).json({ success: true, message: 'Thêm phòng khám mới thành công!', id: result.insertId });
    } catch (error) {
        next(error);
    }
};

const updateRoom = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { room_number, name, location } = req.body;
        await pool.query(`UPDATE rooms SET room_number = ?, name = ?, location = ? WHERE id = ?`, [room_number, name, location, id]);
        res.status(200).json({ success: true, message: 'Cập nhật phòng khám thành công!' });
    } catch (error) {
        next(error);
    }
};

const deleteRoom = async (req, res, next) => {
    try {
        const { id } = req.params;
        await pool.query(`UPDATE rooms SET is_active = FALSE WHERE id = ?`, [id]);
        res.status(200).json({ success: true, message: 'Đã ngừng sử dụng phòng khám.' });
    } catch (error) {
        next(error);
    }
};

/**
 * 5. QUẢN LÝ GÓI DỊCH VỤ (services)
 */
const getServices = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM services ORDER BY id DESC`);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const createService = async (req, res, next) => {
    try {
        const { name, price, description, specialty_id } = req.body;
        if (typeof name !== 'string' || !name.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ success: false, message: 'Tên dịch vụ và giá không hợp lệ.' });
        const specialtyId = Number(specialty_id);
        if (!Number.isInteger(specialtyId) || specialtyId < 1) return res.status(400).json({ success: false, message: 'Vui lòng chọn chuyên khoa cho dịch vụ.' });
        const [specialties] = await pool.query('SELECT id FROM specialties WHERE id = ? AND is_active = TRUE', [specialtyId]);
        if (!specialties.length) return res.status(400).json({ success: false, message: 'Chuyên khoa không tồn tại hoặc đã ngừng hoạt động.' });

        const [result] = await pool.query(
            `INSERT INTO services (name, price, description, specialty_id, image_url) VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), price, description || null, specialtyId, null]
        );
        const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, message: 'Thêm dịch vụ khám mới thành công!', id: result.insertId, data: rows[0] });
    } catch (error) {
        next(error);
    }
};

const updateService = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, price, description, specialty_id } = req.body;
        if (typeof name !== 'string' || !name.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ success: false, message: 'Tên dịch vụ và giá không hợp lệ.' });
        const specialtyId = Number(specialty_id);
        if (!Number.isInteger(specialtyId) || specialtyId < 1) return res.status(400).json({ success: false, message: 'Vui lòng chọn chuyên khoa cho dịch vụ.' });
        const [specialties] = await pool.query('SELECT id FROM specialties WHERE id = ? AND is_active = TRUE', [specialtyId]);
        if (!specialties.length) return res.status(400).json({ success: false, message: 'Chuyên khoa không tồn tại hoặc đã ngừng hoạt động.' });
        await pool.query(
            `UPDATE services SET name = ?, price = ?, description = ?, specialty_id = ? WHERE id = ?`,
            [name.trim(), price, description || null, specialtyId, id]
        );
        const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ.' });
        res.status(200).json({ success: true, message: 'Cập nhật dịch vụ thành công!', data: rows[0] });
    } catch (error) {
        next(error);
    }
};

const uploadServiceImage = (req, res, next) => updateManagedImage(req, res, next, { table: 'services', idColumn: 'id', id: req.params.id, category: 'services' });
const removeServiceImage = (req, res, next) => removeManagedImage(req, res, next, { table: 'services', idColumn: 'id', id: req.params.id, category: 'services' });
const uploadDoctorAvatar = (req, res, next) => updateManagedImage(req, res, next, { table: 'doctors', idColumn: 'id', id: req.params.id, category: 'doctors' });
const removeDoctorAvatar = (req, res, next) => removeManagedImage(req, res, next, { table: 'doctors', idColumn: 'id', id: req.params.id, category: 'doctors' });

const deleteService = async (req, res, next) => {
    try {
        const { id } = req.params;
        await pool.query(`UPDATE services SET is_active = FALSE WHERE id = ?`, [id]);
        res.status(200).json({ success: true, message: 'Đã ngừng cung cấp dịch vụ.' });
    } catch (error) {
        next(error);
    }
};

/**
 * 6. QUẢN LÝ BỆNH NHÂN (Patients)
 */
const getPatients = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, full_name, phone, email, gender, date_of_birth, citizen_id, insurance_code, address, is_active, created_at
            FROM users
            WHERE role = 'PATIENT'
            ORDER BY id DESC
        `);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const getDoctors = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`SELECT d.id, d.user_id, d.specialty_id, d.room_id, d.bio, d.experience_years, d.avatar_url,
            d.consultation_fee, d.is_active AS doctor_active, u.full_name, u.phone, u.email, u.is_active AS account_active,
            s.name AS specialty_name, r.name AS room_name, r.room_number
            FROM doctors d JOIN users u ON u.id = d.user_id
            LEFT JOIN specialties s ON s.id = d.specialty_id LEFT JOIN rooms r ON r.id = d.room_id
            ORDER BY d.id DESC`);
        res.json({ success: true, data: rows });
    } catch (error) { next(error); }
};

const createDoctor = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { full_name, phone, email, password, specialty_id, room_id, bio, experience_years, consultation_fee } = req.body;
        if (typeof full_name !== 'string' || !full_name.trim() || typeof phone !== 'string' || !/^\+?[0-9 ()-]{8,20}$/.test(phone.trim()) ||
            typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()) || typeof password !== 'string' || password.length < 12 ||
            !Number.isInteger(Number(experience_years ?? 0)) || Number(experience_years ?? 0) < 0 || !Number.isFinite(Number(consultation_fee)) || Number(consultation_fee) < 0) {
            return res.status(400).json({ success: false, message: 'Thông tin bác sĩ chưa hợp lệ. Mật khẩu khởi tạo cần tối thiểu 12 ký tự.' });
        }
        await connection.beginTransaction();
        const hash = await bcrypt.hash(password, 12);
        const [userResult] = await connection.query(`INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, 'DOCTOR')`,
            [full_name.trim(), phone.trim(), email.trim().toLowerCase(), hash]);
        const [doctorResult] = await connection.query(`INSERT INTO doctors (user_id, specialty_id, room_id, bio, experience_years, consultation_fee)
            VALUES (?, ?, ?, ?, ?, ?)`, [userResult.insertId, specialty_id || null, room_id || null, bio || null, Number(experience_years ?? 0), Number(consultation_fee)]);
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Đã tạo tài khoản bác sĩ.', data: { id: doctorResult.insertId } });
    } catch (error) { await connection.rollback(); next(error); }
    finally { connection.release(); }
};

const updateDoctor = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { full_name, phone, email, specialty_id, room_id, bio, experience_years, consultation_fee, is_active } = req.body;
        if (!full_name || !/^\+?[0-9 ()-]{8,20}$/.test(String(phone || '')) || !/^\S+@\S+\.\S+$/.test(String(email || '')) ||
            !Number.isInteger(Number(experience_years ?? 0)) || Number(experience_years ?? 0) < 0 || !Number.isFinite(Number(consultation_fee)) || Number(consultation_fee) < 0) {
            return res.status(400).json({ success: false, message: 'Thông tin bác sĩ chưa hợp lệ.' });
        }
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT user_id FROM doctors WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ.' }); }
        await connection.query('UPDATE users SET full_name = ?, phone = ?, email = ?, is_active = ? WHERE id = ?',
            [full_name.trim(), phone.trim(), email.trim().toLowerCase(), is_active === false ? 0 : 1, rows[0].user_id]);
        await connection.query('UPDATE doctors SET specialty_id = ?, room_id = ?, bio = ?, experience_years = ?, consultation_fee = ?, is_active = ? WHERE id = ?',
            [specialty_id || null, room_id || null, bio || null, Number(experience_years ?? 0), Number(consultation_fee), is_active === false ? 0 : 1, id]);
        await connection.commit();
        return res.json({ success: true, message: 'Đã cập nhật hồ sơ bác sĩ.' });
    } catch (error) { await connection.rollback(); next(error); }
    finally { connection.release(); }
};

const deleteDoctor = async (req, res, next) => {
    try {
        const [result] = await pool.query('UPDATE doctors SET is_active = FALSE WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ.' });
        await pool.query('UPDATE users SET is_active = FALSE WHERE id = (SELECT user_id FROM doctors WHERE id = ?)', [req.params.id]);
        res.json({ success: true, message: 'Đã ngừng hoạt động tài khoản bác sĩ.' });
    } catch (error) { next(error); }
};

const updatePatient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { full_name, phone, email, is_active, address, insurance_code, citizen_id } = req.body;
        await pool.query(
            `UPDATE users
             SET full_name = ?, phone = ?, email = ?, is_active = ?, address = ?, insurance_code = ?, citizen_id = ?
             WHERE id = ? AND role = 'PATIENT'`,
            [full_name, phone, email, is_active !== undefined ? is_active : 1, address, insurance_code, citizen_id, id]
        );
        res.status(200).json({ success: true, message: 'Cập nhật thông tin bệnh nhân thành công!' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboardStats,
    getMedicines, createMedicine, updateMedicine, deleteMedicine,
    getSpecialties, createSpecialty, updateSpecialty, deleteSpecialty,
    getRooms, createRoom, updateRoom, deleteRoom,
    getServices, createService, updateService, deleteService, uploadServiceImage, removeServiceImage, uploadDoctorAvatar, removeDoctorAvatar,
    getPatients, updatePatient
    ,getDoctors, createDoctor, updateDoctor, deleteDoctor
};
