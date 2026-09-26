const { pool } = require('../config/db');

/**
 * Lấy danh sách hóa đơn thanh toán
 */
const getInvoices = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        let query = `
            SELECT 
                i.id, i.appointment_id, i.service_fee, i.medicine_fee, i.total_amount, 
                i.payment_status, i.payment_method, i.paid_at, i.created_at,
                p.id as patient_id, p.full_name as patient_name, p.phone as patient_phone,
                a.appointment_date
            FROM Invoices i
            JOIN Users p ON i.patient_id = p.id
            JOIN Appointments a ON i.appointment_id = a.id
        `;
        const params = [];

        if (role === 'PATIENT') {
            query += ' WHERE i.patient_id = ? ORDER BY i.created_at DESC';
            params.push(userId);
        } else {
            query += ' ORDER BY i.created_at DESC';
        }

        const [invoices] = await pool.query(query, params);

        res.status(200).json({
            success: true,
            total: invoices.length,
            data: invoices
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cập nhật trạng thái thanh toán (Dành cho Thu ngân / Admin)
 */
const updatePaymentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { payment_status, payment_method } = req.body;

        const [result] = await pool.query(
            `UPDATE Invoices 
             SET payment_status = ?, payment_method = ?, paid_at = IF(? = 'PAID', NOW(), NULL)
             WHERE id = ?`,
            [payment_status, payment_method || 'CASH', payment_status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật thanh toán hóa đơn thành công.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getInvoices,
    updatePaymentStatus
};
