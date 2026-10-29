const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { stageImage, publishImage, discardImage, deleteStoredImage } = require('../utils/imageStorage');

const clinicDateISO = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const validISODate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const deactivateCatalogRecord = async (req, res, next, { table, idColumn, message, alreadyMessage }) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Mã dữ liệu không hợp lệ.' });
    try {
        const [result] = await pool.query(`UPDATE ${table} SET is_active = FALSE WHERE ${idColumn} = ? AND is_active = TRUE`, [id]);
        if (result.affectedRows) return res.json({ success: true, message });
        const [rows] = await pool.query(`SELECT ${idColumn}, is_active FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy mục cần ngừng sử dụng.' });
        return res.json({ success: true, alreadyInactive: true, message: alreadyMessage });
    } catch (error) { return next(error); }
};

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
    let connection;
    let oldUrl;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const column = category === 'services' ? 'image_url' : 'avatar_url';
        const [rows] = await connection.query(`SELECT ${column} FROM ${table} WHERE ${idColumn} = ? FOR UPDATE`, [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' }); }
        oldUrl = rows[0][column];
        await connection.query(`UPDATE ${table} SET ${column} = NULL WHERE ${idColumn} = ?`, [id]);
        await connection.commit();
        let cleanupWarning = null;
        try { await deleteStoredImage(oldUrl, category); }
        catch (error) { console.warn('[Images] Không dọn được ảnh đã bỏ:', error.code || 'unknown error'); cleanupWarning = 'Đã gỡ ảnh khỏi hồ sơ, nhưng tệp cũ chưa dọn được khỏi bộ lưu trữ.'; }
        return res.json({ success: true, message: cleanupWarning || 'Đã bỏ ảnh khỏi hồ sơ.', cleanupWarning, data: { image_url: null, avatar_url: null } });
    } catch (error) { if (connection) await connection.rollback().catch(() => {}); return next(error); }
    finally { connection?.release(); }
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
        const today = clinicDateISO();
        const [rows] = await pool.query(`
            SELECT d.drug_id as id, d.name, d.generic_name as activeIngredient, d.is_active, d.unit_id,
                   d.packing, d.side_effects as sideEffect, d.price, d.stock_quantity,
                   d.low_stock_threshold, u.name as unit_name,
                   COALESCE(b.tracked_quantity, 0) AS tracked_quantity,
                   GREATEST(d.stock_quantity - COALESCE(b.tracked_quantity, 0), 0) AS untracked_quantity,
                   COALESCE(b.usable_quantity, 0) AS usable_quantity,
                   COALESCE(b.expired_quantity, 0) AS expired_quantity,
                   COALESCE(b.expiring_30_quantity, 0) AS expiring_30_quantity,
                   COALESCE(b.expiring_60_quantity, 0) AS expiring_60_quantity,
                   COALESCE(b.expiring_90_quantity, 0) AS expiring_90_quantity,
                   (COALESCE(b.usable_quantity, 0) <= d.low_stock_threshold) AS is_low_stock
            FROM drugs d
            LEFT JOIN units u ON d.unit_id = u.unit_id
            LEFT JOIN (
                SELECT drug_id, SUM(quantity_remaining) AS tracked_quantity,
                       SUM(CASE WHEN expires_on >= ? THEN quantity_remaining ELSE 0 END) AS usable_quantity,
                       SUM(CASE WHEN expires_on < ? THEN quantity_remaining ELSE 0 END) AS expired_quantity,
                       SUM(CASE WHEN expires_on >= ? AND expires_on <= DATE_ADD(?, INTERVAL 30 DAY) THEN quantity_remaining ELSE 0 END) AS expiring_30_quantity,
                       SUM(CASE WHEN expires_on > DATE_ADD(?, INTERVAL 30 DAY) AND expires_on <= DATE_ADD(?, INTERVAL 60 DAY) THEN quantity_remaining ELSE 0 END) AS expiring_60_quantity,
                       SUM(CASE WHEN expires_on > DATE_ADD(?, INTERVAL 60 DAY) AND expires_on <= DATE_ADD(?, INTERVAL 90 DAY) THEN quantity_remaining ELSE 0 END) AS expiring_90_quantity
                FROM drug_batches WHERE quantity_remaining > 0 GROUP BY drug_id
            ) b ON b.drug_id = d.drug_id
            ORDER BY d.drug_id DESC
        `, [today, today, today, today, today, today, today, today]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const getMedicineUnits = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT unit_id, name FROM units WHERE is_active = TRUE ORDER BY name');
        return res.json({ success: true, data: rows });
    } catch (error) { return next(error); }
};

const createMedicine = async (req, res, next) => {
    try {
        const { name, activeIngredient, packing, sideEffect, price, low_stock_threshold, unit_id } = req.body;
        if (Object.prototype.hasOwnProperty.call(req.body, 'stock_quantity')) {
            return res.status(400).json({ success: false, message: 'Không nhập tồn trực tiếp khi tạo thuốc. Hãy tạo thuốc trước rồi nhập lô có hạn sử dụng.' });
        }
        const threshold = Number(low_stock_threshold ?? 10);
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 150 ||
            !Number.isFinite(Number(price)) || Number(price) <= 0 ||
            !Number.isInteger(threshold) || threshold < 0) {
            return res.status(400).json({ success: false, message: 'Tên thuốc, đơn giá lớn hơn 0 và ngưỡng tồn thấp hợp lệ là bắt buộc. Nhập kho theo lô riêng.' });
        }
        if (unit_id) {
            const [[unit]] = await pool.query('SELECT unit_id FROM units WHERE unit_id = ? AND is_active = TRUE', [unit_id]);
            if (!unit) return res.status(400).json({ success: false, message: 'Đơn vị thuốc không hợp lệ hoặc đã ngừng sử dụng.' });
        }
        const [result] = await pool.query(
            `INSERT INTO drugs (name, generic_name, unit_id, packing, side_effects, price, low_stock_threshold)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), activeIngredient || null, unit_id || null, packing || null, sideEffect || null, Number(price), threshold]
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
        const { name, activeIngredient, packing, sideEffect, price, low_stock_threshold, unit_id } = req.body;
        if (Object.prototype.hasOwnProperty.call(req.body, 'stock_quantity')) {
            return res.status(400).json({ success: false, message: 'Không sửa tồn kho trực tiếp. Hãy nhập hoặc điều chỉnh theo lô để lưu lịch sử.' });
        }
        if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) <= 0) ||
            low_stock_threshold !== undefined && (!Number.isInteger(Number(low_stock_threshold)) || Number(low_stock_threshold) < 0)) {
            return res.status(400).json({ success: false, message: 'Đơn giá phải lớn hơn 0 và ngưỡng tồn thấp phải là số nguyên không âm.' });
        }
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT * FROM drugs WHERE drug_id = ? FOR UPDATE', [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc.' }); }
        const current = rows[0];
        if (unit_id) {
            const [units] = await connection.query('SELECT unit_id FROM units WHERE unit_id = ? AND is_active = TRUE FOR UPDATE', [unit_id]);
            if (!units.length) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Đơn vị thuốc không hợp lệ hoặc đã ngừng sử dụng.' }); }
        }
        await connection.query(
            `UPDATE drugs SET name = ?, generic_name = ?, unit_id = ?, packing = ?, side_effects = ?, price = ?, low_stock_threshold = ? WHERE drug_id = ?`,
            [name ?? current.name, activeIngredient ?? current.generic_name, unit_id === undefined ? current.unit_id : (unit_id || null), packing ?? current.packing, sideEffect ?? current.side_effects, price === undefined ? current.price : Number(price), low_stock_threshold === undefined ? current.low_stock_threshold : Number(low_stock_threshold), id]
        );
        await connection.commit();
        res.status(200).json({ success: true, message: 'Cập nhật thông tin thuốc thành công!' });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally { connection.release(); }
};

const deleteMedicine = async (req, res, next) => {
    return deactivateCatalogRecord(req, res, next, { table: 'drugs', idColumn: 'drug_id', message: 'Đã ngừng sử dụng thuốc. Đơn thuốc và lịch sử cấp phát cũ vẫn được giữ.', alreadyMessage: 'Thuốc đã được ngừng sử dụng trước đó.' });
};

const getMedicineLots = async (req, res, next) => {
    try {
        const drugId = Number(req.params.id);
        if (!Number.isSafeInteger(drugId) || drugId < 1) return res.status(400).json({ success: false, message: 'Mã thuốc không hợp lệ.' });
        const today = clinicDateISO();
        const [[drug]] = await pool.query(
            `SELECT d.drug_id, d.name, d.stock_quantity, d.low_stock_threshold,
                    COALESCE(b.usable_quantity, 0) AS usable_quantity,
                    COALESCE(b.expired_quantity, 0) AS expired_quantity,
                    GREATEST(d.stock_quantity - COALESCE(b.tracked_quantity, 0), 0) AS untracked_quantity
             FROM drugs d LEFT JOIN (
               SELECT drug_id, SUM(quantity_remaining) AS tracked_quantity,
                      SUM(CASE WHEN expires_on >= ? THEN quantity_remaining ELSE 0 END) AS usable_quantity,
                      SUM(CASE WHEN expires_on < ? THEN quantity_remaining ELSE 0 END) AS expired_quantity
               FROM drug_batches WHERE quantity_remaining > 0 GROUP BY drug_id
             ) b ON b.drug_id = d.drug_id WHERE d.drug_id = ?`, [today, today, drugId]
        );
        if (!drug) return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc.' });
        const [lots] = await pool.query(
            `SELECT b.batch_id, b.drug_id, b.batch_code, b.quantity_received, b.quantity_remaining,
                    DATE_FORMAT(b.received_on, '%Y-%m-%d') AS received_on,
                    DATE_FORMAT(b.expires_on, '%Y-%m-%d') AS expires_on,
                    u.full_name AS created_by_name, b.created_at,
                    CASE WHEN b.quantity_remaining = 0 THEN 'EMPTY'
                         WHEN b.expires_on < ? THEN 'EXPIRED'
                         WHEN b.expires_on <= DATE_ADD(?, INTERVAL 30 DAY) THEN 'EXPIRING_30'
                         WHEN b.expires_on <= DATE_ADD(?, INTERVAL 60 DAY) THEN 'EXPIRING_60'
                         WHEN b.expires_on <= DATE_ADD(?, INTERVAL 90 DAY) THEN 'EXPIRING_90'
                         ELSE 'VALID' END AS expiry_status
             FROM drug_batches b LEFT JOIN users u ON u.id = b.created_by
             WHERE b.drug_id = ? ORDER BY b.expires_on, b.received_on, b.batch_id`,
            [today, today, today, today, drugId]
        );
        const [movements] = await pool.query(
            `SELECT sm.id, sm.batch_id, sm.quantity_delta, sm.reason, sm.note, sm.reference_type, sm.reference_id,
                    u.full_name AS performed_by_name, sm.created_at
             FROM stock_movements sm LEFT JOIN users u ON u.id = sm.performed_by
             WHERE sm.drug_id = ? ORDER BY sm.created_at DESC, sm.id DESC LIMIT 300`, [drugId]
        );
        return res.json({ success: true, data: { drug, lots, movements, today } });
    } catch (error) { return next(error); }
};

const receiveMedicineBatch = async (req, res, next) => {
    let connection;
    try {
        const drugId = Number(req.params.id);
        const quantity = Number(req.body.quantity);
        const { received_on, expires_on } = req.body;
        const batchCode = typeof req.body.batch_code === 'string' ? req.body.batch_code.trim() : '';
        const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
        if (!Number.isSafeInteger(drugId) || drugId < 1 || !Number.isSafeInteger(quantity) || quantity <= 0 ||
            !validISODate(received_on) || !validISODate(expires_on) || received_on > clinicDateISO() || expires_on <= received_on || batchCode.length > 100 || note.length > 255) {
            return res.status(400).json({ success: false, message: 'Số lượng phải lớn hơn 0; ngày nhập/hết hạn và mã lô cần hợp lệ.' });
        }
        if (expires_on < clinicDateISO()) return res.status(400).json({ success: false, message: 'Không thể nhập lô đã hết hạn.' });
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [drugs] = await connection.query('SELECT drug_id, is_active FROM drugs WHERE drug_id = ? FOR UPDATE', [drugId]);
        if (!drugs.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc.' }); }
        if (!drugs[0].is_active) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không thể nhập kho cho thuốc đã ngừng kinh doanh.' }); }
        const [insert] = await connection.query(
            `INSERT INTO drug_batches (drug_id, batch_code, quantity_received, quantity_remaining, received_on, expires_on, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [drugId, batchCode || null, quantity, quantity, received_on, expires_on, req.user.id]
        );
        await connection.query('UPDATE drugs SET stock_quantity = stock_quantity + ? WHERE drug_id = ?', [quantity, drugId]);
        await connection.query(
            `INSERT INTO stock_movements (drug_id, batch_id, quantity_delta, reason, note, reference_type, reference_id, performed_by)
             VALUES (?, ?, ?, 'STOCK_RECEIPT', ?, 'DRUG_BATCH', ?, ?)`,
            [drugId, insert.insertId, quantity, note || 'Nhập kho theo lô', insert.insertId, req.user.id]
        );
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Đã nhập lô thuốc và ghi lịch sử kho.', data: { batch_id: insert.insertId } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return next(error);
    } finally { connection?.release(); }
};

const classifyLegacyMedicineStock = async (req, res, next) => {
    let connection;
    try {
        const drugId = Number(req.params.id);
        const quantity = Number(req.body.quantity);
        const { received_on, expires_on } = req.body;
        const batchCode = typeof req.body.batch_code === 'string' ? req.body.batch_code.trim() : '';
        const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
        if (!Number.isSafeInteger(drugId) || drugId < 1 || !Number.isSafeInteger(quantity) || quantity <= 0 ||
            !validISODate(received_on) || !validISODate(expires_on) || received_on > clinicDateISO() || expires_on <= received_on ||
            batchCode.length > 100 || !note || note.length > 255) {
            return res.status(400).json({ success: false, message: 'Nhập số lượng, ngày nhập, hạn dùng thực tế và ghi chú hợp lệ.' });
        }
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [drugs] = await connection.query('SELECT drug_id, stock_quantity FROM drugs WHERE drug_id = ? FOR UPDATE', [drugId]);
        if (!drugs.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc.' }); }
        const [[tracked]] = await connection.query('SELECT COALESCE(SUM(quantity_remaining), 0) AS quantity FROM drug_batches WHERE drug_id = ?', [drugId]);
        const untracked = Math.max(0, Number(drugs[0].stock_quantity) - Number(tracked.quantity));
        if (quantity > untracked) { await connection.rollback(); return res.status(409).json({ success: false, message: `Tồn chưa xác định lô chỉ còn ${untracked}; không được phân loại quá số này.` }); }
        const [insert] = await connection.query(
            `INSERT INTO drug_batches (drug_id, batch_code, quantity_received, quantity_remaining, received_on, expires_on, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [drugId, batchCode || null, quantity, quantity, received_on, expires_on, req.user.id]
        );
        await connection.query(
            `INSERT INTO stock_movements (drug_id, batch_id, quantity_delta, reason, note, reference_type, reference_id, performed_by)
             VALUES (?, ?, 0, 'LEGACY_LOT_IDENTIFICATION', ?, 'DRUG_BATCH', ?, ?)`,
            [drugId, insert.insertId, note, insert.insertId, req.user.id]
        );
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Đã gắn thông tin lô đã được kiểm chứng; tổng tồn kho không thay đổi.', data: { batch_id: insert.insertId } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return next(error);
    } finally { connection?.release(); }
};

const changeMedicineBatchStock = async (req, res, next) => {
    let connection;
    try {
        const batchId = Number(req.params.batchId);
        const delta = Number(req.body.quantity_delta);
        const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
        if (!Number.isSafeInteger(batchId) || batchId < 1 || !Number.isSafeInteger(delta) || delta === 0 || !note || note.length > 255) {
            return res.status(400).json({ success: false, message: 'Mã lô, số điều chỉnh khác 0 và lý do tối đa 255 ký tự là bắt buộc.' });
        }
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [[link]] = await connection.query('SELECT drug_id FROM drug_batches WHERE batch_id = ?', [batchId]);
        if (!link) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lô thuốc.' }); }
        const [drugs] = await connection.query('SELECT drug_id, stock_quantity FROM drugs WHERE drug_id = ? FOR UPDATE', [link.drug_id]);
        const [lots] = await connection.query('SELECT quantity_remaining, expires_on FROM drug_batches WHERE batch_id = ? AND drug_id = ? FOR UPDATE', [batchId, link.drug_id]);
        if (!lots.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lô thuốc.' }); }
        const expiryDate = typeof lots[0].expires_on === 'string' ? lots[0].expires_on.slice(0, 10) : new Date(lots[0].expires_on).toISOString().slice(0, 10);
        if (delta > 0 && expiryDate < clinicDateISO()) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không tăng tồn cho lô đã hết hạn; hãy ghi nhận hủy hoặc xử lý riêng.' }); }
        const remaining = Number(lots[0].quantity_remaining) + delta;
        if (remaining < 0 || Number(drugs[0].stock_quantity) + delta < 0) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Điều chỉnh sẽ làm số lượng lô hoặc tồn kho âm.' });
        }
        await connection.query('UPDATE drug_batches SET quantity_remaining = ? WHERE batch_id = ?', [remaining, batchId]);
        await connection.query('UPDATE drugs SET stock_quantity = stock_quantity + ? WHERE drug_id = ? AND stock_quantity + ? >= 0', [delta, link.drug_id, delta]);
        await connection.query(
            `INSERT INTO stock_movements (drug_id, batch_id, quantity_delta, reason, note, reference_type, reference_id, performed_by)
             VALUES (?, ?, ?, 'ADMIN_ADJUSTMENT', ?, 'DRUG_BATCH', ?, ?)`,
            [link.drug_id, batchId, delta, note, batchId, req.user.id]
        );
        await connection.commit();
        return res.json({ success: true, message: 'Đã điều chỉnh số lượng lô và lưu lịch sử kho.' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return next(error);
    } finally { connection?.release(); }
};

const writeOffMedicineBatch = async (req, res, next) => {
    const reasonType = req.body.reason_type;
    const reason = reasonType === 'EXPIRED' ? 'EXPIRED_WRITE_OFF' : reasonType === 'DAMAGED' ? 'DAMAGED_WRITE_OFF' : null;
    const quantity = Number(req.body.quantity);
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (!reason || !Number.isSafeInteger(Number(req.params.batchId)) || Number(req.params.batchId) < 1 || !Number.isSafeInteger(quantity) || quantity <= 0 || !note || note.length > 255) {
        return res.status(400).json({ success: false, message: 'Chọn lý do hết hạn/hư hỏng, số lượng dương và ghi chú bắt buộc.' });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [[link]] = await connection.query('SELECT drug_id FROM drug_batches WHERE batch_id = ?', [req.params.batchId]);
        if (!link) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lô thuốc.' }); }
        const [drugs] = await connection.query('SELECT stock_quantity FROM drugs WHERE drug_id = ? FOR UPDATE', [link.drug_id]);
        const [lots] = await connection.query('SELECT expires_on, quantity_remaining FROM drug_batches WHERE batch_id = ? FOR UPDATE', [req.params.batchId]);
        const expiryDate = lots[0] ? (typeof lots[0].expires_on === 'string' ? lots[0].expires_on.slice(0, 10) : new Date(lots[0].expires_on).toISOString().slice(0, 10)) : '';
        if (reasonType === 'EXPIRED' && lots[0] && expiryDate >= clinicDateISO()) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Lô chưa qua ngày hết hạn; nếu hư hỏng, chọn lý do hư hỏng.' });
        }
        if (!lots.length || quantity > Number(lots[0].quantity_remaining) || quantity > Number(drugs[0].stock_quantity)) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Số lượng hủy vượt quá số còn lại của lô hoặc tồn kho.' });
        }
        await connection.query('UPDATE drug_batches SET quantity_remaining = quantity_remaining - ? WHERE batch_id = ? AND quantity_remaining >= ?', [quantity, req.params.batchId, quantity]);
        await connection.query('UPDATE drugs SET stock_quantity = stock_quantity - ? WHERE drug_id = ? AND stock_quantity >= ?', [quantity, link.drug_id, quantity]);
        await connection.query(
            `INSERT INTO stock_movements (drug_id, batch_id, quantity_delta, reason, note, reference_type, reference_id, performed_by)
             VALUES (?, ?, ?, ?, ?, 'DRUG_BATCH', ?, ?)`,
            [link.drug_id, req.params.batchId, -quantity, reason, note, req.params.batchId, req.user.id]
        );
        await connection.commit();
        return res.json({ success: true, message: 'Đã ghi nhận hủy thuốc theo lô; dữ liệu và lịch sử vẫn được giữ.' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return next(error);
    } finally { connection?.release(); }
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
    return deactivateCatalogRecord(req, res, next, { table: 'meal_relations', idColumn: 'relation_id', message: 'Đã ngừng sử dụng quan hệ bữa ăn. Đơn thuốc cũ vẫn được giữ nguyên.', alreadyMessage: 'Quan hệ bữa ăn đã được ngừng sử dụng trước đó.' });
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
        const { name, description, is_active } = req.body;
        if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, message: 'Tên chuyên khoa là bắt buộc.' });
        let activeValue = null;
        if (is_active !== undefined) {
            if (![true, 1, '1'].includes(is_active)) return res.status(400).json({ success: false, message: 'Chỉ có thể kích hoạt lại qua thao tác này. Hãy dùng chức năng Ngừng hoạt động để kiểm tra dữ liệu liên kết.' });
            activeValue = 1;
        }
        await pool.query(`UPDATE specialties SET name = ?, description = ?, is_active = COALESCE(?, is_active) WHERE id = ?`, [name.trim(), description || null, activeValue, id]);
        res.status(200).json({ success: true, message: activeValue === 1 ? 'Đã kích hoạt lại chuyên khoa.' : 'Cập nhật chuyên khoa thành công!' });
    } catch (error) {
        next(error);
    }
};

const deleteSpecialty = async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Mã chuyên khoa không hợp lệ.' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(`SELECT s.is_active,
            (SELECT COUNT(*) FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.specialty_id = s.id AND d.is_active = TRUE AND u.is_active = TRUE) AS active_doctors,
            (SELECT COUNT(*) FROM services svc WHERE svc.specialty_id = s.id AND svc.is_active = TRUE) AS active_services
            FROM specialties s WHERE s.id = ? LIMIT 1 FOR UPDATE`, [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy chuyên khoa.' }); }
        if (Number(rows[0].active_doctors) || Number(rows[0].active_services)) {
            await connection.rollback();
            return res.status(409).json({
            success: false,
            message: `Chưa thể ngừng chuyên khoa này vì còn ${Number(rows[0].active_doctors)} bác sĩ và ${Number(rows[0].active_services)} dịch vụ đang hoạt động liên kết. Hãy chuyển bác sĩ/dịch vụ sang chuyên khoa khác hoặc ngừng chúng trước; dữ liệu lịch sử được giữ nguyên.`
            });
        }
        if (!rows[0].is_active) { await connection.commit(); return res.json({ success: true, alreadyInactive: true, message: 'Chuyên khoa đã được ngừng sử dụng trước đó.' }); }
        await connection.query('UPDATE specialties SET is_active = FALSE WHERE id = ?', [id]);
        await connection.commit();
        return res.json({ success: true, message: 'Đã ngừng chuyên khoa; dữ liệu và lịch sử liên quan vẫn được giữ.' });
    } catch (error) { if (connection) await connection.rollback().catch(() => {}); return next(error); }
    finally { connection?.release(); }
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
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Mã phòng khám không hợp lệ.' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(`SELECT r.is_active,
            (SELECT COUNT(*) FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.room_id = r.id AND d.is_active = TRUE AND u.is_active = TRUE) AS active_doctors
            FROM rooms r WHERE r.id = ? LIMIT 1 FOR UPDATE`, [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy phòng khám.' }); }
        if (Number(rows[0].active_doctors)) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: `Chưa thể ngừng phòng vì còn ${Number(rows[0].active_doctors)} bác sĩ đang hoạt động được phân công. Hãy chuyển bác sĩ sang phòng khác trước; lịch sử khám vẫn được giữ.` });
        }
        if (!rows[0].is_active) { await connection.commit(); return res.json({ success: true, alreadyInactive: true, message: 'Phòng khám đã được ngừng sử dụng trước đó.' }); }
        await connection.query('UPDATE rooms SET is_active = FALSE WHERE id = ?', [id]);
        await connection.commit();
        return res.json({ success: true, message: 'Đã ngừng phòng khám; lịch và dữ liệu cũ vẫn được giữ.' });
    } catch (error) { if (connection) await connection.rollback().catch(() => {}); return next(error); }
    finally { connection?.release(); }
};

/**
 * 5. QUẢN LÝ GÓI DỊCH VỤ (services)
 */
const getServices = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.*,
                   sp.name AS specialty_name,
                   sp.is_active AS specialty_is_active,
                   (SELECT COUNT(*) FROM appointments a WHERE a.service_id = s.id) AS appointment_count,
                   (SELECT COUNT(*)
                    FROM appointments a
                    INNER JOIN invoices i ON i.appointment_id = a.appointment_id
                    WHERE a.service_id = s.id) AS invoice_count,
                   (SELECT COUNT(DISTINCT d.id)
                    FROM doctors d
                    INNER JOIN users u ON u.id = d.user_id
                    WHERE d.specialty_id = s.specialty_id
                      AND d.is_active = TRUE
                      AND u.is_active = TRUE) AS doctor_count
            FROM services s
            LEFT JOIN specialties sp ON sp.id = s.specialty_id
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
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Mã dịch vụ không hợp lệ.' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [services] = await connection.query('SELECT id, name, is_active, image_url FROM services WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
        if (!services.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ.' });
        }

        // Keep every appointment (including cancelled ones) as a historical reference.
        // createAppointment locks the same service row, so no new booking can race this decision.
        const [references] = await connection.query(`
            SELECT COUNT(DISTINCT a.appointment_id) AS appointment_count,
                   COUNT(DISTINCT i.id) AS invoice_count
            FROM appointments a
            LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
            WHERE a.service_id = ?
        `, [id]);
        const appointmentCount = Number(references[0]?.appointment_count) || 0;
        const invoiceCount = Number(references[0]?.invoice_count) || 0;

        if (appointmentCount || invoiceCount) {
            await connection.query('UPDATE services SET is_active = FALSE WHERE id = ?', [id]);
            await connection.commit();
            return res.json({
                success: true,
                action: 'archived',
                appointment_count: appointmentCount,
                invoice_count: invoiceCount,
                message: `Đã lưu trữ dịch vụ “${services[0].name}” vì có ${appointmentCount} lịch sử khám và ${invoiceCount} hóa đơn tham chiếu. Dữ liệu cũ được giữ nguyên.`
            });
        }

        await connection.query('DELETE FROM services WHERE id = ?', [id]);
        await connection.commit();
        let cleanupWarning = null;
        try { await deleteStoredImage(services[0].image_url, 'services'); }
        catch (cleanupError) {
            console.warn('[Services] Không dọn được ảnh dịch vụ đã xóa:', cleanupError.code || 'unknown error');
            cleanupWarning = ' Dữ liệu dịch vụ đã xóa nhưng ảnh cũ chưa dọn được khỏi bộ lưu trữ.';
        }
        return res.json({ success: true, action: 'deleted', cleanupWarning, message: `Đã xóa hẳn dịch vụ “${services[0].name}”; không có lịch hẹn hoặc hóa đơn tham chiếu.${cleanupWarning || ''}` });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(409).json({ success: false, message: 'Không thể xóa hẳn vì dữ liệu khác đang tham chiếu dịch vụ. Giao dịch đã được hủy, dữ liệu không thay đổi.' });
        }
        return next(error);
    } finally {
        connection?.release();
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
        const hasConsultationFee = consultation_fee !== undefined && consultation_fee !== null && consultation_fee !== '';
        if (typeof full_name !== 'string' || !full_name.trim() || typeof phone !== 'string' || !/^\+?[0-9 ()-]{8,20}$/.test(phone.trim()) ||
            typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()) || typeof password !== 'string' || password.length < 12 ||
            !Number.isInteger(Number(experience_years ?? 0)) || Number(experience_years ?? 0) < 0 ||
            (hasConsultationFee && (!Number.isFinite(Number(consultation_fee)) || Number(consultation_fee) < 0))) {
            return res.status(400).json({ success: false, message: 'Thông tin bác sĩ chưa hợp lệ. Mật khẩu khởi tạo cần tối thiểu 12 ký tự.' });
        }
        await connection.beginTransaction();
        if (specialty_id) {
            const [specialties] = await connection.query('SELECT id FROM specialties WHERE id = ? AND is_active = TRUE FOR UPDATE', [specialty_id]);
            if (!specialties.length) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Chuyên khoa không tồn tại hoặc đã ngừng hoạt động.' }); }
        }
        if (room_id) {
            const [rooms] = await connection.query('SELECT id FROM rooms WHERE id = ? AND is_active = TRUE FOR UPDATE', [room_id]);
            if (!rooms.length) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Phòng khám không tồn tại hoặc đã ngừng hoạt động.' }); }
        }
        const hash = await bcrypt.hash(password, 12);
        const [userResult] = await connection.query(`INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, 'DOCTOR')`,
            [full_name.trim(), phone.trim(), email.trim().toLowerCase(), hash]);
        const doctorInsert = hasConsultationFee
            ? await connection.query(`INSERT INTO doctors (user_id, specialty_id, room_id, bio, experience_years, consultation_fee)
                VALUES (?, ?, ?, ?, ?, ?)`, [userResult.insertId, specialty_id || null, room_id || null, bio || null, Number(experience_years ?? 0), Number(consultation_fee)])
            : await connection.query(`INSERT INTO doctors (user_id, specialty_id, room_id, bio, experience_years)
                VALUES (?, ?, ?, ?, ?)`, [userResult.insertId, specialty_id || null, room_id || null, bio || null, Number(experience_years ?? 0)]);
        const [doctorResult] = doctorInsert;
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
        const hasConsultationFee = consultation_fee !== undefined && consultation_fee !== null && consultation_fee !== '';
        if (!full_name || !/^\+?[0-9 ()-]{8,20}$/.test(String(phone || '')) || !/^\S+@\S+\.\S+$/.test(String(email || '')) ||
            !Number.isInteger(Number(experience_years ?? 0)) || Number(experience_years ?? 0) < 0 ||
            (hasConsultationFee && (!Number.isFinite(Number(consultation_fee)) || Number(consultation_fee) < 0))) {
            return res.status(400).json({ success: false, message: 'Thông tin bác sĩ chưa hợp lệ.' });
        }
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT user_id, consultation_fee FROM doctors WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ.' }); }
        if (specialty_id) {
            const [specialties] = await connection.query('SELECT id FROM specialties WHERE id = ? AND is_active = TRUE FOR UPDATE', [specialty_id]);
            if (!specialties.length) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Chuyên khoa không tồn tại hoặc đã ngừng hoạt động.' }); }
        }
        if (room_id) {
            const [rooms] = await connection.query('SELECT id FROM rooms WHERE id = ? AND is_active = TRUE FOR UPDATE', [room_id]);
            if (!rooms.length) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Phòng khám không tồn tại hoặc đã ngừng hoạt động.' }); }
        }
        await connection.query('UPDATE users SET full_name = ?, phone = ?, email = ?, is_active = ? WHERE id = ?',
            [full_name.trim(), phone.trim(), email.trim().toLowerCase(), is_active === false ? 0 : 1, rows[0].user_id]);
        await connection.query('UPDATE doctors SET specialty_id = ?, room_id = ?, bio = ?, experience_years = ?, consultation_fee = ?, is_active = ? WHERE id = ?',
            [specialty_id || null, room_id || null, bio || null, Number(experience_years ?? 0), hasConsultationFee ? Number(consultation_fee) : rows[0].consultation_fee, is_active === false ? 0 : 1, id]);
        await connection.commit();
        return res.json({ success: true, message: 'Đã cập nhật hồ sơ bác sĩ.' });
    } catch (error) { await connection.rollback(); next(error); }
    finally { connection.release(); }
};

const deleteDoctor = async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Mã bác sĩ không hợp lệ.' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT user_id FROM doctors WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ.' }); }
        await connection.query('UPDATE doctors SET is_active = FALSE WHERE id = ?', [id]);
        await connection.query('UPDATE users SET is_active = FALSE WHERE id = ? AND role = \'DOCTOR\'', [rows[0].user_id]);
        await connection.commit();
        return res.json({ success: true, message: 'Đã ngừng hoạt động tài khoản bác sĩ. Lịch hẹn và hồ sơ y tế vẫn được giữ.' });
    } catch (error) { if (connection) await connection.rollback().catch(() => {}); return next(error); }
    finally { connection?.release(); }
};

const updatePatient = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Mã bệnh nhân không hợp lệ.' });
        const { full_name, phone, email, is_active, address, insurance_code, citizen_id } = req.body;
        const [patients] = await pool.query('SELECT id FROM users WHERE id = ? AND role = \'PATIENT\' LIMIT 1', [id]);
        if (!patients.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản bệnh nhân.' });
        await pool.query(
            `UPDATE users
             SET full_name = ?, phone = ?, email = ?, is_active = ?, address = ?, insurance_code = ?, citizen_id = ?
             WHERE id = ? AND role = 'PATIENT'`,
            [full_name, phone, email, is_active !== undefined ? is_active : 1, address, insurance_code, citizen_id, id]
        );
        res.status(200).json({ success: true, message: 'Cập nhật thông tin bệnh nhân thành công!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Số điện thoại hoặc email đã được tài khoản khác sử dụng.' });
        return next(error);
    }
};

module.exports = {
    getDashboardStats,
    getMedicines, getMedicineUnits, createMedicine, updateMedicine, deleteMedicine,
    getMedicineLots, receiveMedicineBatch, classifyLegacyMedicineStock, changeMedicineBatchStock, writeOffMedicineBatch,
    getMealRelations, createMealRelation, updateMealRelation, deactivateMealRelation,
    getSpecialties, createSpecialty, updateSpecialty, deleteSpecialty,
    getRooms, createRoom, updateRoom, deleteRoom,
    getServices, createService, updateService, deleteService, uploadServiceImage, removeServiceImage, uploadDoctorAvatar, removeDoctorAvatar,
    getPatients, getPatientDetails, getPatientMedicalRecordDetail, updatePatient
    ,getDoctors, createDoctor, updateDoctor, deleteDoctor
};
