const crypto = require('crypto');
const { pool } = require('../config/db');
const { syncInvoiceNotification, emitNotificationsUpdated } = require('../utils/invoiceNotifications');

const toMoney = (value) => Math.round(Number(value) * 100) / 100;
const isOwnerOrAdmin = (req, patientId) => req.user.role === 'ADMIN' || (req.user.role === 'PATIENT' && req.user.id === patientId);
const emitPayment = (req, patientId, appointmentId, status, amount) => {
  const io = req.app.get('io');
  const event = { appointmentId, status, amount };
  io?.to(`user:${patientId}`).emit('payment_updated', event);
  io?.to('role:ADMIN').emit('payment_updated', event);
};

const createVietQR = async (req, res, next) => {
  try {
    const appointmentId = Number(req.body.appointmentId || req.query.appointmentId);
    if (!Number.isInteger(appointmentId) || appointmentId < 1) return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    const [[invoice]] = await pool.query(
      `SELECT i.id, i.patient_id, i.total_amount, a.status AS appointment_status,
       COALESCE(SUM(CASE WHEN p.payment_status = 'PAID' THEN p.amount ELSE 0 END), 0) AS paid_amount
       FROM invoices i JOIN appointments a ON a.appointment_id = i.appointment_id
       LEFT JOIN payments p ON p.invoice_id = i.id WHERE i.appointment_id = ? GROUP BY i.id, a.status`, [appointmentId]
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Chưa có hóa đơn cho lịch hẹn.' });
    if (!isOwnerOrAdmin(req, invoice.patient_id)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem khoản thanh toán này.' });
    if (invoice.appointment_status === 'CANCELLED') return res.status(409).json({ success: false, message: 'Lịch đã hủy; vui lòng liên hệ phòng khám để đối soát khoản thu.' });
    let amount = toMoney(Number(invoice.total_amount) - Number(invoice.paid_amount));
    if (amount <= 0) return res.status(409).json({ success: false, message: 'Hóa đơn đã được thanh toán đủ.' });
    const bankName = process.env.BANK_NAME;
    const bankAccount = process.env.BANK_ACCOUNT;
    const accountName = process.env.ACCOUNT_NAME;
    if (!bankName || !bankAccount || !accountName) return res.status(503).json({ success: false, message: 'Thông tin tài khoản nhận thanh toán chưa được cấu hình.' });
    if (req.method === 'POST') {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [locked] = await connection.query('SELECT id, total_amount FROM invoices WHERE id = ? FOR UPDATE', [invoice.id]);
        if (!locked.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' }); }
        const [[appointmentState]] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [appointmentId]);
        if (!appointmentState || appointmentState.status === 'CANCELLED') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Lịch đã hủy; vui lòng liên hệ phòng khám để đối soát.' }); }
        const [[paidNow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
        amount = toMoney(Number(locked[0].total_amount) - Number(paidNow.paid));
        if (amount <= 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn đã được thanh toán đủ.' }); }
        await connection.query("UPDATE invoices SET payment_method = 'BANK_TRANSFER', cash_requested_at = NULL WHERE id = ?", [invoice.id]);
        await connection.commit();
        invoice.total_amount = locked[0].total_amount;
        invoice.paid_amount = paidNow.paid;
        emitPayment(req, invoice.patient_id, appointmentId, 'QR_PENDING', amount);
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    }
    const transferContent = `MEDICLINIC${appointmentId}`;
    const qrUrl = `https://qr.sepay.vn/img?bank=${encodeURIComponent(bankName)}&acc=${encodeURIComponent(bankAccount)}&template=compact&amount=${amount}&des=${encodeURIComponent(transferContent)}`;
    return res.json({ success: true, data: { appointmentId, invoiceId: invoice.id, totalAmount: Number(invoice.total_amount), paidAmount: Number(invoice.paid_amount), amount, bankName, accountNumber: bankAccount, accountName, transferContent, qrUrl } });
  } catch (error) { next(error); }
};

const sepayWebhook = async (req, res, next) => {
  const configuredKey = process.env.SEPAY_API_KEY;
  const authorization = req.headers.authorization || '';
  const providedKey = authorization.startsWith('Apikey ') ? authorization.slice(7) : '';
  const providedBytes = Buffer.from(providedKey);
  const configuredBytes = Buffer.from(configuredKey || '');
  if (!configuredKey || !providedKey || providedBytes.length !== configuredBytes.length || !crypto.timingSafeEqual(providedBytes, configuredBytes)) {
    return res.status(401).json({ success: false, message: 'Webhook authentication failed.' });
  }
  if (!process.env.BANK_ACCOUNT) return res.status(503).json({ success: false, message: 'Receiving bank account is not configured.' });
  const body = req.body || {};
  if (String(body.transferType || '').toLowerCase() !== 'in') return res.status(400).json({ success: false, message: 'Only incoming transfers are accepted.' });
  if (String(body.accountNumber || '') !== String(process.env.BANK_ACCOUNT)) {
    return res.status(400).json({ success: false, message: 'Receiving account does not match.' });
  }
  const externalId = String(body.id || '').trim();
  const amount = toMoney(body.transferAmount);
  const match = `${body.code || ''} ${body.content || ''} ${body.description || ''}`.match(/MEDICLINIC(\d+)/i);
  if (!externalId || !Number.isSafeInteger(Number(externalId)) || Number(externalId) <= 0 || !match || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Webhook transaction data is invalid.' });
  }
  const appointmentId = Number(match[1]);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [invoices] = await connection.query('SELECT id, patient_id, total_amount, appointment_id FROM invoices WHERE appointment_id = ? FOR UPDATE', [appointmentId]);
    const invoice = invoices[0];
    if (!invoice) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found.' }); }
    const [appointments] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [invoice.appointment_id]);
    const [duplicates] = await connection.query("SELECT payment_id FROM payments WHERE provider = 'SEPAY' AND external_transaction_id = ?", [externalId]);
    if (duplicates.length) { await connection.commit(); return res.status(200).json({ success: true, duplicate: true }); }
    const [[sumRow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
    const alreadyPaid = Number(sumRow.paid);
    const outstanding = Math.max(0, toMoney(Number(invoice.total_amount) - alreadyPaid));
    const reconciliation = appointments[0]?.status === 'CANCELLED' ? 'REVIEW' : amount > outstanding ? 'OVERPAID' : (amount < outstanding ? 'PARTIAL' : 'MATCHED');
    await connection.query(
      `INSERT INTO payments (invoice_id, provider, external_transaction_id, payment_method, transaction_code, amount, payment_status, reconciliation_status)
       VALUES (?, 'SEPAY', ?, 'BANK_TRANSFER', ?, ?, 'PAID', ?)`,
      [invoice.id, externalId, String(body.referenceCode || externalId), amount, reconciliation]
    );
    const totalPaid = alreadyPaid + amount;
    const paymentStatus = totalPaid >= Number(invoice.total_amount) ? 'PAID' : 'UNPAID';
    await connection.query('UPDATE invoices SET payment_status = ?, payment_method = \'BANK_TRANSFER\', cash_requested_at = NULL, paid_at = IF(? = \'PAID\', NOW(), paid_at) WHERE id = ?', [paymentStatus, paymentStatus, invoice.id]);
    const notice = await syncInvoiceNotification(connection, { invoiceId: invoice.id, totalAmount: invoice.total_amount, paidAmount: totalPaid, forceReview: appointments[0]?.status === 'CANCELLED' });
    await connection.commit();
    emitPayment(req, invoice.patient_id, appointmentId, paymentStatus, amount);
    if (notice.changed) emitNotificationsUpdated(req, invoice.patient_id, invoice.id);
    return res.status(200).json({ success: true, appointmentId, paymentStatus, reconciliationStatus: reconciliation });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(200).json({ success: true, duplicate: true });
    next(error);
  } finally { connection.release(); }
};

const getPaymentStatus = async (req, res, next) => {
  try {
    const appointmentId = Number(req.params.appointmentId);
    const [[invoice]] = await pool.query(
      `SELECT i.id, i.patient_id, i.total_amount, i.payment_status, i.payment_method, i.cash_requested_at, i.paid_at,
       COALESCE(SUM(CASE WHEN p.payment_status = 'PAID' THEN p.amount ELSE 0 END), 0) AS paid_amount
       FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id WHERE i.appointment_id = ? GROUP BY i.id`, [appointmentId]
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
    if (!isOwnerOrAdmin(req, invoice.patient_id)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thanh toán này.' });
    return res.json({ success: true, appointmentId, isPaid: Number(invoice.paid_amount) >= Number(invoice.total_amount), paymentStatus: invoice.payment_status, invoice: { ...invoice, outstanding_amount: Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount)) } });
  } catch (error) { next(error); }
};

module.exports = { createVietQR, sepayWebhook, getPaymentStatus };
