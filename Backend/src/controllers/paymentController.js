const crypto = require('crypto');
const { pool } = require('../config/db');
const { syncInvoiceNotification, emitNotificationsUpdated } = require('../utils/invoiceNotifications');

const toMoney = (value) => Math.round(Number(value) * 100) / 100;
const PAYMENT_CODE_PATTERN = /^MEDICLINIC([1-9]\d*)$/i;

const getAppointmentIdFromSePayPayload = (body = {}) => {
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const contentCodes = [...content.matchAll(/MEDICLINIC[1-9]\d*/gi)]
    .filter((match) => {
      const before = content[match.index - 1];
      const after = content[match.index + match[0].length];
      return ![before, after].some((character) => character && /[\p{L}\p{N}]/u.test(character));
    })
    .map((match) => match[0]);
  if (contentCodes.length !== 1) return null;

  const contentCode = contentCodes[0].toUpperCase();
  let paymentCode;
  if (code) {
    const codeMatch = code.match(PAYMENT_CODE_PATTERN);
    if (!codeMatch || codeMatch[0].toUpperCase() !== contentCode) return null;
    paymentCode = codeMatch[0];
  } else {
    // SePay may leave `code` empty when the configured MEDICLINIC prefix is
    // not extractable. Accept only one bounded, exact MEDICLINIC<id> token
    // from original content; bank-added surrounding text is harmless, but
    // ambiguous or embedded lookalike references are rejected above.
    const contentMatch = contentCode.match(PAYMENT_CODE_PATTERN);
    if (!contentMatch) return null;
    paymentCode = contentMatch[0];
  }

  const appointmentId = Number(paymentCode.match(PAYMENT_CODE_PATTERN)?.[1]);
  return Number.isSafeInteger(appointmentId) && appointmentId > 0 ? appointmentId : null;
};

const webhookAccepted = (res) => res.status(200).json({ success: true });
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
    const purpose = req.body.purpose === 'MEDICINE_BALANCE' || req.query.purpose === 'MEDICINE_BALANCE' ? 'MEDICINE_BALANCE' : 'APPOINTMENT';
    if (!Number.isInteger(appointmentId) || appointmentId < 1) return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    const [[invoice]] = await pool.query(
      `SELECT i.id, i.patient_id, i.service_fee, i.medicine_fee, i.total_amount, i.invoice_status, i.payment_method, i.medicine_payment_method, a.status AS appointment_status,
       COALESCE(SUM(CASE WHEN p.payment_status = 'PAID' THEN p.amount ELSE 0 END), 0) AS paid_amount
       FROM invoices i JOIN appointments a ON a.appointment_id = i.appointment_id
       LEFT JOIN payments p ON p.invoice_id = i.id WHERE i.appointment_id = ? GROUP BY i.id, a.status`, [appointmentId]
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Chưa có hóa đơn cho lịch hẹn.' });
    if (!isOwnerOrAdmin(req, invoice.patient_id)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem khoản thanh toán này.' });
    if (invoice.invoice_status !== 'ACTIVE' || ['CANCELLED', 'NO_SHOW'].includes(invoice.appointment_status)) return res.status(409).json({ success: false, message: 'Hóa đơn đã hết hiệu lực do lịch hẹn đã kết thúc hoặc bị hủy.' });
    const medicinePayment = purpose === 'MEDICINE_BALANCE';
    const hasMedicineBalance = invoice.appointment_status === 'COMPLETED'
      && Number(invoice.medicine_fee) > 0
      && Number(invoice.paid_amount) >= Number(invoice.service_fee)
      && Number(invoice.total_amount) > Number(invoice.paid_amount);
    if (medicinePayment) {
      if (invoice.appointment_status !== 'COMPLETED' || Number(invoice.medicine_fee) <= 0) return res.status(409).json({ success: false, message: 'Chỉ có thể tạo QR tiền thuốc sau khi buổi khám hoàn tất.' });
      if (invoice.medicine_payment_method && invoice.medicine_payment_method !== 'BANK_TRANSFER') return res.status(409).json({ success: false, message: 'Khoản tiền thuốc đã chọn tiền mặt tại quầy.' });
      if (req.method === 'GET' && invoice.medicine_payment_method !== 'BANK_TRANSFER') return res.status(409).json({ success: false, message: 'Chưa chọn QR cho khoản tiền thuốc.' });
    } else if (invoice.payment_method !== 'BANK_TRANSFER') {
      return res.status(409).json({ success: false, message: 'Hóa đơn phí khám chưa chọn QR/chuyển khoản. Hãy dùng đúng phương thức đã chọn.' });
    } else if (hasMedicineBalance) {
      return res.status(409).json({ success: false, message: 'Khoản còn thiếu là tiền thuốc. Hãy chọn phương thức riêng cho tiền thuốc trong lịch sử khám.' });
    }
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
        const [locked] = await connection.query('SELECT id, service_fee, medicine_fee, total_amount, invoice_status, payment_method, medicine_payment_method FROM invoices WHERE id = ? FOR UPDATE', [invoice.id]);
        if (!locked.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' }); }
        const lockedInvoice = locked[0];
        if (medicinePayment && lockedInvoice.medicine_payment_method && lockedInvoice.medicine_payment_method !== 'BANK_TRANSFER') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản tiền thuốc đã chọn tiền mặt tại quầy.' }); }
        if (!medicinePayment && lockedInvoice.payment_method !== 'BANK_TRANSFER') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Phương thức thanh toán phí khám đã thay đổi. Hãy tải lại hóa đơn.' }); }
        const [[appointmentState]] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [appointmentId]);
        if (!appointmentState || ['CANCELLED', 'NO_SHOW'].includes(appointmentState.status) || locked[0].invoice_status !== 'ACTIVE') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn đã hết hiệu lực do lịch hẹn đã kết thúc hoặc bị hủy.' }); }
        const [[paidNow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
        const medicineBalanceNow = appointmentState.status === 'COMPLETED'
          && Number(lockedInvoice.medicine_fee) > 0
          && Number(paidNow.paid) >= Number(lockedInvoice.service_fee)
          && Number(lockedInvoice.total_amount) > Number(paidNow.paid);
        if (!medicinePayment && medicineBalanceNow) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản còn thiếu là tiền thuốc. Hãy chọn phương thức riêng cho tiền thuốc trong lịch sử khám.' }); }
        if (medicinePayment && (appointmentState.status !== 'COMPLETED' || Number(paidNow.paid) < Number(lockedInvoice.service_fee) || Number(lockedInvoice.medicine_fee) <= 0)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Cần hoàn tất buổi khám và thanh toán đủ phí khám trước khi tạo QR tiền thuốc.' }); }
        amount = toMoney(Number(locked[0].total_amount) - Number(paidNow.paid));
        if (amount <= 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn đã được thanh toán đủ.' }); }
        if (medicinePayment) {
          await connection.query("UPDATE invoices SET medicine_payment_method = 'BANK_TRANSFER' WHERE id = ?", [invoice.id]);
        } else {
          await connection.query("UPDATE invoices SET payment_method = 'BANK_TRANSFER', cash_requested_at = NULL WHERE id = ?", [invoice.id]);
        }
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
  const appointmentId = getAppointmentIdFromSePayPayload(body);
  if (!externalId || !Number.isSafeInteger(Number(externalId)) || Number(externalId) <= 0 || !appointmentId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Webhook transaction data is invalid.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [invoices] = await connection.query('SELECT id, patient_id, service_fee, medicine_fee, total_amount, invoice_status, payment_method, medicine_payment_method, appointment_id FROM invoices WHERE appointment_id = ? FOR UPDATE', [appointmentId]);
    const invoice = invoices[0];
    if (!invoice) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Invoice not found.' }); }
    const [appointments] = await connection.query('SELECT status FROM appointments WHERE appointment_id = ? FOR UPDATE', [invoice.appointment_id]);
    const [duplicates] = await connection.query("SELECT payment_id FROM payments WHERE provider = 'SEPAY' AND external_transaction_id = ?", [externalId]);
    if (duplicates.length) { await connection.commit(); return webhookAccepted(res); }
    const [[sumRow]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
    const alreadyPaid = Number(sumRow.paid);
    const outstanding = Math.max(0, toMoney(Number(invoice.total_amount) - alreadyPaid));
    const medicinePayment = appointments[0]?.status === 'COMPLETED'
      && Number(invoice.medicine_fee) > 0
      && alreadyPaid >= Number(invoice.service_fee)
      && outstanding > 0;
    if (medicinePayment) {
      if (invoice.medicine_payment_method !== 'BANK_TRANSFER') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản tiền thuốc chưa chọn QR/chuyển khoản; không ghi nhận webhook này.' }); }
    } else if (invoice.payment_method !== 'BANK_TRANSFER') {
      await connection.rollback(); return res.status(409).json({ success: false, message: 'Hóa đơn chưa chọn QR/chuyển khoản; không ghi nhận webhook này.' });
    }
    const lateAfterClosure = invoice.invoice_status !== 'ACTIVE' || ['CANCELLED', 'NO_SHOW'].includes(appointments[0]?.status);
    const reconciliation = lateAfterClosure ? 'REVIEW' : amount > outstanding ? 'OVERPAID' : (amount < outstanding ? 'PARTIAL' : 'MATCHED');
    await connection.query(
      `INSERT INTO payments (invoice_id, provider, external_transaction_id, payment_method, transaction_code, amount, payment_status, reconciliation_status)
       VALUES (?, 'SEPAY', ?, 'BANK_TRANSFER', ?, ?, 'PAID', ?)`,
      [invoice.id, externalId, String(body.referenceCode || externalId), amount, reconciliation]
    );
    const totalPaid = alreadyPaid + amount;
    const paymentStatus = totalPaid >= Number(invoice.total_amount) ? 'PAID' : 'UNPAID';
    if (!lateAfterClosure) {
      if (medicinePayment) {
        await connection.query('UPDATE invoices SET payment_status = ?, paid_at = IF(? = \'PAID\', NOW(), paid_at) WHERE id = ?', [paymentStatus, paymentStatus, invoice.id]);
      } else {
        await connection.query('UPDATE invoices SET payment_status = ?, payment_method = \'BANK_TRANSFER\', cash_requested_at = NULL, paid_at = IF(? = \'PAID\', NOW(), paid_at) WHERE id = ?', [paymentStatus, paymentStatus, invoice.id]);
      }
      if (paymentStatus === 'PAID') {
        await connection.query("UPDATE appointments SET status = 'CONFIRMED' WHERE appointment_id = ? AND status = 'PENDING'", [invoice.appointment_id]);
      }
    }
    const notice = await syncInvoiceNotification(connection, { invoiceId: invoice.id, totalAmount: invoice.total_amount, paidAmount: totalPaid, forceReview: lateAfterClosure });
    await connection.commit();
    emitPayment(req, invoice.patient_id, appointmentId, lateAfterClosure ? 'REVIEW' : paymentStatus, amount);
    if (notice.changed) emitNotificationsUpdated(req, invoice.patient_id, invoice.id);
    return webhookAccepted(res);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return webhookAccepted(res);
    next(error);
  } finally { connection.release(); }
};

const getPaymentStatus = async (req, res, next) => {
  try {
    const appointmentId = Number(req.params.appointmentId);
    const [[invoice]] = await pool.query(
      `SELECT i.id, i.patient_id, i.service_fee, i.medicine_fee, i.total_amount, i.payment_status, i.invoice_status, i.payment_method, i.medicine_payment_method, i.cash_requested_at, i.paid_at,
       COALESCE(SUM(CASE WHEN p.payment_status = 'PAID' THEN p.amount ELSE 0 END), 0) AS paid_amount
       FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id WHERE i.appointment_id = ? GROUP BY i.id`, [appointmentId]
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
    if (!isOwnerOrAdmin(req, invoice.patient_id)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thanh toán này.' });
    return res.json({ success: true, appointmentId, isPaid: Number(invoice.paid_amount) >= Number(invoice.total_amount), paymentStatus: invoice.payment_status, invoice: { ...invoice, outstanding_amount: Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount)) } });
  } catch (error) { next(error); }
};

module.exports = { createVietQR, sepayWebhook, getPaymentStatus, getAppointmentIdFromSePayPayload };
