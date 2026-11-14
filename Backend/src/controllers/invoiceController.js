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
                i.payment_status, i.invoice_status, i.payment_method, i.medicine_payment_method, i.cash_requested_at, i.paid_at, i.created_at, a.status AS appointment_status,
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
            const [[payments], [items]] = await Promise.all([
                pool.query(
                `SELECT pay.payment_id, pay.invoice_id, pay.provider, pay.payment_method, pay.transaction_code,
                 pay.amount, pay.payment_status, pay.reconciliation_status, pay.created_at,
                 cashier.full_name AS received_by_name
                 FROM payments pay LEFT JOIN users cashier ON cashier.id = pay.received_by
                 WHERE pay.invoice_id IN (?) ORDER BY pay.created_at, pay.payment_id`, [invoiceIds]),
                pool.query(
                    `SELECT id, invoice_id, item_type, item_reference_id, description, quantity, unit_price, line_total
                     FROM invoice_items WHERE invoice_id IN (?) ORDER BY invoice_id, id`, [invoiceIds])
            ]);
            const byInvoice = new Map(invoiceIds.map((id) => [id, []]));
            const itemsByInvoice = new Map(invoiceIds.map((id) => [id, []]));
            for (const payment of payments) byInvoice.get(payment.invoice_id)?.push(payment);
            for (const item of items) itemsByInvoice.get(item.invoice_id)?.push(item);
            for (const invoice of invoices) {
                invoice.payments = byInvoice.get(invoice.id) || [];
                invoice.items = itemsByInvoice.get(invoice.id) || [];
            }
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
        const purpose = req.body.purpose === 'MEDICINE_BALANCE' ? 'MEDICINE_BALANCE' : 'APPOINTMENT';
        const expectedAmount = Number(req.body.expectedAmount);
        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận khoản tiền mặt đã thu tại quầy.' });
        }
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT id, patient_id, appointment_id, service_fee, medicine_fee, total_amount, invoice_status, payment_method, medicine_payment_method, cash_requested_at FROM invoices WHERE id = ? FOR UPDATE', [id]);
        const invoice = rows[0];
        if (!invoice) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' }); }
        const [appointments] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [invoice.appointment_id]);
        if (!appointments.length || ['CANCELLED', 'NO_SHOW'].includes(appointments[0].status) || invoice.invoice_status !== 'ACTIVE') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không thể ghi nhận thanh toán cho lịch đã hủy hoặc hóa đơn hết hiệu lực.' }); }
        const medicinePayment = purpose === 'MEDICINE_BALANCE';
        if (medicinePayment && (appointments[0].status !== 'COMPLETED' || Number(invoice.medicine_fee) <= 0)) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ có thể xác nhận tiền thuốc sau khi buổi khám hoàn tất.' });
        }
        if (medicinePayment && (invoice.medicine_payment_method !== 'CASH' || !invoice.cash_requested_at)) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản tiền thuốc chưa được bệnh nhân chọn tiền mặt tại quầy. QR chỉ được xác nhận qua webhook SePay.' });
        }
        if (!medicinePayment && invoice.payment_method !== 'CASH') {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn phí khám không được chọn tiền mặt. Chỉ webhook SePay hợp lệ mới xác nhận khoản QR/chuyển khoản.' });
        }
        const [[sumRow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [id]);
        const medicineBalance = appointments[0].status === 'COMPLETED'
            && Number(invoice.medicine_fee) > 0
            && Number(sumRow.paid) >= Number(invoice.service_fee)
            && Number(invoice.total_amount) > Number(sumRow.paid);
        if (medicineBalance && !medicinePayment) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản còn thiếu là tiền thuốc; cần xử lý theo phương thức tiền thuốc đã chọn.' });
        }
        if (!medicineBalance && medicinePayment) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn hiện không có khoản tiền thuốc đủ điều kiện thu riêng.' });
        }
        if (medicinePayment && Number(sumRow.paid) < Number(invoice.service_fee)) {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Cần thanh toán đủ phí khám trước khi thu tiền thuốc.' });
        }
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
        if (medicinePayment) {
            await connection.query("UPDATE invoices SET payment_status = IF(? >= total_amount, 'PAID', 'UNPAID'), cash_requested_at = NULL, paid_at = IF(? >= total_amount, NOW(), paid_at) WHERE id = ?", [Number(sumRow.paid) + due, Number(sumRow.paid) + due, id]);
        } else {
            await connection.query("UPDATE invoices SET payment_status = 'PAID', payment_method = 'CASH', cash_requested_at = NULL, paid_at = NOW() WHERE id = ?", [id]);
        }
        await connection.query("UPDATE appointments SET status = 'CONFIRMED' WHERE appointment_id = ? AND status = 'PENDING'", [invoice.appointment_id]);
        const [[totalPaidRow]] = await connection.query("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [id]);
        const notice = await syncInvoiceNotification(connection, { invoiceId: Number(id), totalAmount: invoice.total_amount, paidAmount: Number(totalPaidRow.paid) });
        await connection.commit();
        const totalReceived = Number(sumRow.paid) + due;
        const nowPaid = totalReceived >= Number(invoice.total_amount);
        const event = { appointmentId: invoice.appointment_id, status: nowPaid ? 'PAID' : 'UNPAID', appointmentStatus: appointments[0].status, amount: due, purpose };
        req.app.get('io')?.to(`user:${invoice.patient_id}`).emit('payment_updated', event);
        req.app.get('io')?.to('role:ADMIN').emit('payment_updated', event);
        if (notice.changed) emitNotificationsUpdated(req, invoice.patient_id, Number(id));
        return res.json({ success: true, message: medicinePayment ? 'Đã ghi nhận khoản thu tiền thuốc mặt tại quầy.' : 'Đã ghi nhận khoản thu tiền mặt.', data: { amount: due, transactionCode } });
    } catch (error) {
        await connection.rollback(); next(error);
    } finally { connection.release(); }
};

const requestCashPayment = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const purpose = req.body.purpose === 'MEDICINE_BALANCE' ? 'MEDICINE_BALANCE' : 'APPOINTMENT';
        const medicinePayment = purpose === 'MEDICINE_BALANCE';
        const [rows] = await connection.query('SELECT id, patient_id, appointment_id, service_fee, medicine_fee, total_amount, invoice_status, payment_method, medicine_payment_method FROM invoices WHERE id = ? FOR UPDATE', [req.params.id]);
        const invoice = rows[0];
        if (!invoice) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' }); }
        if (invoice.patient_id !== req.user.id) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Bạn không có quyền yêu cầu thanh toán hóa đơn này.' }); }
        const [appointments] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [invoice.appointment_id]);
        if (!appointments.length || appointments[0].status === 'CANCELLED' || appointments[0].status === 'NO_SHOW' || invoice.invoice_status !== 'ACTIVE') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn đã hết hiệu lực do lịch hẹn đã kết thúc hoặc bị hủy.' }); }
        if (medicinePayment) {
            if (appointments[0].status !== 'COMPLETED' || Number(invoice.medicine_fee) <= 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ có thể yêu cầu thanh toán tiền thuốc sau khi buổi khám hoàn tất.' }); }
            if (invoice.medicine_payment_method && invoice.medicine_payment_method !== 'CASH') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản tiền thuốc đã chọn QR/chuyển khoản. Chỉ webhook SePay hợp lệ mới xác nhận khoản này.' }); }
        } else if (invoice.payment_method !== 'CASH') {
            await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn phí khám đã chọn QR/chuyển khoản. Chỉ webhook SePay hợp lệ mới xác nhận khoản này.' });
        }
        const [[paidRow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
        const medicineBalance = appointments[0].status === 'COMPLETED'
            && Number(invoice.medicine_fee) > 0
            && Number(paidRow.paid) >= Number(invoice.service_fee)
            && Number(invoice.total_amount) > Number(paidRow.paid);
        if (medicineBalance && !medicinePayment) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản còn thiếu là tiền thuốc; cần chọn phương thức riêng cho tiền thuốc.' }); }
        if (!medicineBalance && medicinePayment) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn hiện không có khoản tiền thuốc đủ điều kiện thu riêng.' }); }
        if (medicinePayment && Number(paidRow.paid) < Number(invoice.service_fee)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Cần thanh toán đủ phí khám trước khi chọn cách thanh toán tiền thuốc.' }); }
        const due = Math.max(0, Math.round((Number(invoice.total_amount) - Number(paidRow.paid)) * 100) / 100);
        if (due <= 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn đã thanh toán đủ.' }); }
        if (medicinePayment) {
            await connection.query("UPDATE invoices SET medicine_payment_method = 'CASH', cash_requested_at = COALESCE(cash_requested_at, NOW()) WHERE id = ?", [invoice.id]);
        } else {
            await connection.query("UPDATE invoices SET cash_requested_at = COALESCE(cash_requested_at, NOW()) WHERE id = ?", [invoice.id]);
        }
        await connection.commit();
        const event = { appointmentId: invoice.appointment_id, status: 'CASH_PENDING', amountDue: due, purpose };
        req.app.get('io')?.to(`user:${req.user.id}`).emit('payment_updated', event);
        req.app.get('io')?.to('role:ADMIN').emit('payment_updated', event);
        return res.json({ success: true, message: medicinePayment ? 'Đã ghi nhận chọn tiền mặt cho khoản thuốc. Vui lòng thanh toán tại quầy; hóa đơn chưa được đánh dấu đã trả.' : 'Đã ghi nhận yêu cầu thanh toán tiền mặt. Vui lòng thanh toán tại quầy; hóa đơn chưa được đánh dấu đã trả.', data: { invoice_id: invoice.id, payment_method: 'CASH', payment_status: 'UNPAID', amount_due: due, purpose } });
    } catch (error) { await connection.rollback(); next(error); }
    finally { connection.release(); }
};

module.exports = {
    getInvoices,
    updatePaymentStatus,
    requestCashPayment
};
