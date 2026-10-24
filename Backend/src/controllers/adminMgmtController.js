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
        const isISODate = (value) => {
            if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
            const [year, month, day] = value.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
        };
        const clinicToday = () => {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
            }).formatToParts(new Date());
            const get = (type) => parts.find((part) => part.type === type)?.value;
            return `${get('year')}-${get('month')}-${get('day')}`;
        };
        const shiftDate = (value, days) => {
            const date = new Date(`${value}T00:00:00Z`);
            date.setUTCDate(date.getUTCDate() + days);
            return date.toISOString().slice(0, 10);
        };

        const today = clinicToday();
        const startDate = req.query.startDate || shiftDate(today, -29);
        const endDate = req.query.endDate || today;
        if (!isISODate(startDate) || !isISODate(endDate) || startDate > endDate) {
            return res.status(400).json({ success: false, message: 'Khoảng ngày thống kê không hợp lệ.' });
        }
        const dayCount = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
        if (dayCount > 366) {
            return res.status(400).json({ success: false, message: 'Khoảng thống kê tối đa là 366 ngày.' });
        }

        const appointmentFilter = `a.appointment_date BETWEEN ? AND ? AND a.status <> 'CANCELLED'`;
        const [[appointmentStats]] = await pool.query(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN EXISTS (
                        SELECT 1 FROM appointment_records previous_record
                        JOIN follow_up_visits follow_up ON follow_up.record_id = previous_record.record_id
                        WHERE previous_record.patient_id = a.patient_id
                          AND previous_record.doctor_id = a.doctor_id
                          AND previous_record.appointment_id <> a.appointment_id
                          AND follow_up.follow_up_date = a.appointment_date
                    ) THEN 1 ELSE 0 END) AS follow_up_count
             FROM appointments a WHERE ${appointmentFilter}`,
            [startDate, endDate]
        );
        const [[specialtyCount]] = await pool.query(
            'SELECT COUNT(*) AS total FROM specialties WHERE is_active = TRUE'
        );
        const [dailyStats] = await pool.query(
            `SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date, COUNT(*) AS count
             FROM appointments a WHERE ${appointmentFilter}
             GROUP BY appointment_date ORDER BY appointment_date ASC`,
            [startDate, endDate]
        );
        const [specialtyStats] = await pool.query(
            `SELECT COALESCE(s.name, 'Chưa phân chuyên khoa') AS name, COUNT(a.appointment_id) AS count
             FROM appointments a
             LEFT JOIN doctors d ON d.id = a.doctor_id
             LEFT JOIN specialties s ON s.id = d.specialty_id
             WHERE a.appointment_date BETWEEN ? AND ? AND a.status <> 'CANCELLED'
             GROUP BY s.id, s.name ORDER BY count DESC, name ASC`,
            [startDate, endDate]
        );
        const totalAppointments = Number(appointmentStats.total || 0);
        const followUpCount = Number(appointmentStats.follow_up_count || 0);

        res.status(200).json({
            success: true,
            data: {
                startDate,
                endDate,
                totalAppointments,
                followUpCount,
                followUpRate: totalAppointments ? (followUpCount / totalAppointments) * 100 : 0,
                activeSpecialties: Number(specialtyCount.total || 0),
                dailyStats: dailyStats.map((row) => ({ date: row.date, count: Number(row.count) })),
                specialtyStats: specialtyStats.map((row) => ({ name: row.name, count: Number(row.count) }))
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

const validateMealRelation = (name, description) => {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanDescription = description == null ? null : String(description).trim();
    if (!cleanName || cleanName.length > 50 || (cleanDescription && cleanDescription.length > 255)) return null;
    return { name: cleanName, description: cleanDescription || null };
};

const getMealRelations = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            'SELECT relation_id, name, description, is_active FROM meal_relations ORDER BY is_active DESC, name ASC'
        );
        return res.json({ success: true, data: rows });
    } catch (error) { next(error); }
};

const createMealRelation = async (req, res, next) => {
    try {
        const relation = validateMealRelation(req.body.name, req.body.description);
        if (!relation) return res.status(400).json({ success: false, message: 'Tên quan hệ bữa ăn (tối đa 50 ký tự) và mô tả (tối đa 255 ký tự) chưa hợp lệ.' });
        const [result] = await pool.query(
            'INSERT INTO meal_relations (name, description, is_active) VALUES (?, ?, TRUE)',
            [relation.name, relation.description]
        );
        return res.status(201).json({ success: true, message: 'Đã thêm quan hệ bữa ăn.', data: { relation_id: result.insertId } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Quan hệ bữa ăn này đã tồn tại.' });
        return next(error);
    }
};

const updateMealRelation = async (req, res, next) => {
    try {
        const relationId = Number(req.params.id);
        const relation = validateMealRelation(req.body.name, req.body.description);
        if (!Number.isSafeInteger(relationId) || relationId < 1) return res.status(400).json({ success: false, message: 'Mã quan hệ bữa ăn không hợp lệ.' });
        if (!relation) return res.status(400).json({ success: false, message: 'Tên quan hệ bữa ăn (tối đa 50 ký tự) và mô tả (tối đa 255 ký tự) chưa hợp lệ.' });
        const [existing] = await pool.query('SELECT relation_id FROM meal_relations WHERE relation_id = ? LIMIT 1', [relationId]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Không tìm thấy quan hệ bữa ăn.' });
        const isActive = req.body.is_active === undefined ? undefined : req.body.is_active === true || req.body.is_active === 1;
        if (isActive === undefined) {
            await pool.query('UPDATE meal_relations SET name = ?, description = ? WHERE relation_id = ?', [relation.name, relation.description, relationId]);
        } else {
            await pool.query('UPDATE meal_relations SET name = ?, description = ?, is_active = ? WHERE relation_id = ?', [relation.name, relation.description, isActive, relationId]);
        }
        return res.json({ success: true, message: 'Đã cập nhật quan hệ bữa ăn.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Quan hệ bữa ăn này đã tồn tại.' });
        return next(error);
    }
};

const deactivateMealRelation = async (req, res, next) => {
    try {
        const relationId = Number(req.params.id);
        if (!Number.isSafeInteger(relationId) || relationId < 1) return res.status(400).json({ success: false, message: 'Mã quan hệ bữa ăn không hợp lệ.' });
        const [result] = await pool.query('UPDATE meal_relations SET is_active = FALSE WHERE relation_id = ?', [relationId]);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy quan hệ bữa ăn.' });
        return res.json({ success: true, message: 'Đã ngừng sử dụng quan hệ bữa ăn. Đơn thuốc cũ vẫn được giữ nguyên.' });
    } catch (error) { next(error); }
};

/**
 * 3. QUẢN LÝ CHUYÊN KHOA (specialties)
 */
const getSpecialties = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.*,
                   (SELECT COUNT(DISTINCT d.id)
                    FROM doctors d
                    INNER JOIN users u ON u.id = d.user_id
                    WHERE d.specialty_id = s.id
                      AND d.is_active = TRUE
                      AND u.is_active = TRUE) AS doctor_count
            FROM specialties s
            ORDER BY s.id DESC
        `);
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
        const [rows] = await pool.query(`
            SELECT r.*,
                   (SELECT COUNT(DISTINCT d.id)
                    FROM doctors d
                    INNER JOIN users u ON u.id = d.user_id
                    WHERE d.room_id = r.id
                      AND d.is_active = TRUE
                      AND u.is_active = TRUE) AS doctor_count
            FROM rooms r
            ORDER BY r.id DESC
        `);
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
        const [rows] = await pool.query(`
            SELECT s.*,
                   (SELECT COUNT(DISTINCT d.id)
                    FROM doctors d
                    INNER JOIN users u ON u.id = d.user_id
                    WHERE d.specialty_id = s.specialty_id
                      AND d.is_active = TRUE
                      AND u.is_active = TRUE) AS doctor_count
            FROM services s
            ORDER BY s.id DESC
        `);
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

const getPatientDetails = async (req, res, next) => {
    try {
        const patientId = Number(req.params.id);
        if (!Number.isSafeInteger(patientId) || patientId < 1) {
            return res.status(400).json({ success: false, message: 'Mã bệnh nhân không hợp lệ.' });
        }

        const [patients] = await pool.query(
            `SELECT id, full_name, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth,
                gender, insurance_code, phone, emergency_contact, job, address
             FROM users WHERE id = ? AND role = 'PATIENT' LIMIT 1`,
            [patientId]
        );
        if (!patients.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bệnh nhân.' });
        }

        const [visits] = await pool.query(
            `SELECT mr.record_id, mr.appointment_id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot,
                du.full_name AS doctor_name, svc.name AS service_name,
                mr.final_diagnosis, mr.icd10_code, icd.description AS icd10_description
             FROM appointment_records mr
             LEFT JOIN appointments a ON a.appointment_id = mr.appointment_id
             LEFT JOIN doctors d ON d.id = mr.doctor_id
             LEFT JOIN users du ON du.id = d.user_id
             LEFT JOIN services svc ON svc.id = a.service_id
             LEFT JOIN icd10_codes icd ON icd.code = mr.icd10_code
             WHERE mr.patient_id = ?
             ORDER BY a.appointment_date DESC, mr.created_at DESC, mr.record_id DESC`,
            [patientId]
        );

        return res.json({ success: true, data: { patient: patients[0], visits } });
    } catch (error) { next(error); }
};

const getPatientMedicalRecordDetail = async (req, res, next) => {
    try {
        const patientId = Number(req.params.patientId);
        const recordId = Number(req.params.recordId);
        if (!Number.isSafeInteger(patientId) || patientId < 1 || !Number.isSafeInteger(recordId) || recordId < 1) {
            return res.status(400).json({ success: false, message: 'Mã bệnh nhân hoặc bệnh án không hợp lệ.' });
        }

        const [records] = await pool.query(
            `SELECT mr.record_id, mr.appointment_id, mr.patient_id, mr.doctor_id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot,
                du.full_name AS doctor_name, svc.name AS service_name,
                mr.height, mr.weight, mr.blood_pressure, mr.temperature, mr.heart_rate, mr.spo2,
                mr.symptoms, mr.initial_diagnosis, mr.final_diagnosis, mr.icd10_code,
                icd.description AS icd10_description, mr.treatment_plan, mr.notes, mr.advice,
                DATE_FORMAT(fv.follow_up_date, '%Y-%m-%d') AS follow_up_date, fv.instruction AS follow_up_instruction
             FROM appointment_records mr
             LEFT JOIN appointments a ON a.appointment_id = mr.appointment_id
             LEFT JOIN doctors d ON d.id = mr.doctor_id
             LEFT JOIN users du ON du.id = d.user_id
             LEFT JOIN services svc ON svc.id = a.service_id
             LEFT JOIN icd10_codes icd ON icd.code = mr.icd10_code
             LEFT JOIN follow_up_visits fv ON fv.record_id = mr.record_id
             WHERE mr.patient_id = ? AND mr.record_id = ? LIMIT 1`,
            [patientId, recordId]
        );
        if (!records.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lần khám của bệnh nhân này.' });
        }

        const record = records[0];
        const [prescriptions] = await pool.query(
            `SELECT pr.prescription_id, COALESCE(NULLIF(pr.custom_drug_name, ''), d.name) AS medicine_name,
                d.generic_name AS medicine_generic_name, d.packing AS medicine_packing,
                pr.dosage, pr.frequency, pr.quantity, u.name AS unit_name, pr.duration,
                times.dosage_times, mr.name AS meal_name, pr.instructions
             FROM prescriptions pr
             LEFT JOIN drugs d ON d.drug_id = pr.drug_id
             LEFT JOIN units u ON u.unit_id = pr.unit_id
             LEFT JOIN meal_relations mr ON mr.relation_id = pr.meal_relation_id
             LEFT JOIN (
                SELECT pt.prescription_id, GROUP_CONCAT(dt.name ORDER BY dt.time_id SEPARATOR ', ') AS dosage_times
                FROM prescription_times pt JOIN dosage_times dt ON dt.time_id = pt.time_id
                GROUP BY pt.prescription_id
             ) times ON times.prescription_id = pr.prescription_id
             WHERE pr.record_id = ? ORDER BY pr.prescription_id`,
            [recordId]
        );

        return res.json({ success: true, data: { ...record, prescriptions } });
    } catch (error) { next(error); }
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
    getMealRelations, createMealRelation, updateMealRelation, deactivateMealRelation,
    getSpecialties, createSpecialty, updateSpecialty, deleteSpecialty,
    getRooms, createRoom, updateRoom, deleteRoom,
    getServices, createService, updateService, deleteService, uploadServiceImage, removeServiceImage, uploadDoctorAvatar, removeDoctorAvatar,
    getPatients, getPatientDetails, getPatientMedicalRecordDetail, updatePatient
    ,getDoctors, createDoctor, updateDoctor, deleteDoctor
};
