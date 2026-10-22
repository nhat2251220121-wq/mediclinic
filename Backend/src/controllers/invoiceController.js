const { pool } = require('../config/db');
const { syncInvoiceNotification, emitNotificationsUpdated } = require('../utils/invoiceNotifications');

/**
 * Lấy danh sách hóa đơn thanh toán
 */
const getInvoices = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        let query = `
            SELECT 
                i.id, i.appointment_id, i.service_fee, i.medicine_fee, i.total_amount,
                i.payment_status, i.payment_method, i.paid_at, i.created_at, a.status AS appointment_status,
                COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount ELSE 0 END), 0) AS amount_paid,
                GREATEST(i.total_amount - COALESCE(SUM(CASE WHEN pay.payment_status = 'PAID' THEN pay.amount ELSE 0 END), 0), 0) AS amount_due,
                GROUP_CONCAT(DISTINCT pay.reconciliation_status) AS reconciliation_statuses,
                p.id as patient_id, p.full_name as patient_name, p.phone as patient_phone,
                a.appointment_date
            FROM invoices i
            JOIN users p ON i.patient_id = p.id
            JOIN appointments a ON i.appointment_id = a.appointment_id
            LEFT JOIN payments pay ON pay.invoice_id = i.id
            LEFT JOIN doctors d ON d.id = a.doctor_id
        `;
        const params = [];

        if (role === 'PATIENT') {
            query += ' WHERE i.patient_id = ? GROUP BY i.id ORDER BY i.created_at DESC';
            params.push(userId);
        } else if (role === 'DOCTOR') {
            query += ' WHERE d.user_id = ? GROUP BY i.id ORDER BY i.created_at DESC';
            params.push(userId);
        } else {
            query += ' GROUP BY i.id ORDER BY i.created_at DESC';
        }

        const [invoices] = await pool.query(query, params);
        if (invoices.length) {
            const invoiceIds = invoices.map((invoice) => invoice.id);
            const [payments] = await pool.query(
                `SELECT pay.payment_id, pay.invoice_id, pay.provider, pay.payment_method, pay.transaction_code,
                 pay.amount, pay.payment_status, pay.reconciliation_status, pay.created_at,
                 cashier.full_name AS received_by_name
                 FROM payments pay LEFT JOIN users cashier ON cashier.id = pay.received_by
                 WHERE pay.invoice_id IN (?) ORDER BY pay.created_at, pay.payment_id`, [invoiceIds]
            );
            const byInvoice = new Map(invoiceIds.map((id) => [id, []]));
            for (const payment of payments) byInvoice.get(payment.invoice_id)?.push(payment);
            for (const invoice of invoices) invoice.payments = byInvoice.get(invoice.id) || [];
        }

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
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const expectedAmount = Number(req.body.expectedAmount);
        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận khoản tiền mặt đã thu tại quầy.' });
        }
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT id, patient_id, appointment_id, total_amount FROM invoices WHERE id = ? FOR UPDATE', [id]);
        const invoice = rows[0];
        if (!invoice) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' }); }
        const [appointments] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [invoice.appointment_id]);
        if (!appointments.length || appointments[0].status === 'CANCELLED') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không thể ghi nhận tiền mặt cho lịch đã hủy.' }); }
        const [[sumRow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [id]);
        const due = Math.max(0, Math.round((Number(invoice.total_amount) - Number(sumRow.paid)) * 100) / 100);
        if (due <= 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn đã thanh toán đủ.' }); }
        if (Math.abs(due - expectedAmount) > 0.009) {
            await connection.rollback();
            return res.status(409).json({ success: false, code: 'AMOUNT_CHANGED', message: 'Số còn thiếu đã thay đổi. Hãy kiểm tra hóa đơn và xác nhận lại.', data: { latestAmountDue: due } });
        }
        const transactionCode = `CASH-${require('crypto').randomUUID()}`;
        await connection.query(
            `INSERT INTO payments (invoice_id, provider, external_transaction_id, payment_method, transaction_code, amount, payment_status, received_by)
             VALUES (?, 'INTERNAL', ?, 'CASH', ?, ?, 'PAID', ?)`, [id, transactionCode, transactionCode, due, req.user.id]
        );
        await connection.query("UPDATE invoices SET payment_status = 'PAID', payment_method = 'CASH', paid_at = NOW() WHERE id = ?", [id]);
        const [[totalPaidRow]] = await connection.query("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [id]);
        const notice = await syncInvoiceNotification(connection, { invoiceId: Number(id), totalAmount: invoice.total_amount, paidAmount: Number(totalPaidRow.paid) });
        await connection.commit();
        const event = { appointmentId: invoice.appointment_id, status: 'PAID', amount: due };
        req.app.get('io')?.to(`user:${invoice.patient_id}`).emit('payment_updated', event);
        req.app.get('io')?.to('role:ADMIN').emit('payment_updated', event);
        if (notice.changed) emitNotificationsUpdated(req, invoice.patient_id, Number(id));
        return res.json({ success: true, message: 'Đã ghi nhận khoản thu tiền mặt.', data: { amount: due, transactionCode } });
    } catch (error) {
        await connection.rollback(); next(error);
    } finally { connection.release(); }
};

module.exports = {
    getInvoices,
    updatePaymentStatus
};
