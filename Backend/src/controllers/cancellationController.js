const { pool } = require('../config/db');
const { encryptBankDetails, decryptBankDetails, maskAccountNumber } = require('../utils/refundBankDetails');

const moneyCents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => Number((value / 100).toFixed(2));
const normalizeReason = (value) => typeof value === 'string' ? value.trim() : '';

const minutesUntilStart = (appointmentDate, timeSlot, now = new Date()) => {
  const date = String(appointmentDate).slice(0, 10);
  const match = String(timeSlot || '').match(/(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;
  const [year, month, day] = date.split('-').map(Number);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const validationDate = new Date(Date.UTC(year, month - 1, day));
  if (validationDate.getUTCFullYear() !== year || validationDate.getUTCMonth() !== month - 1 || validationDate.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  // Appointment DATE/TIME values are clinic-local. Convert Asia/Ho_Chi_Minh (+07:00) to UTC explicitly.
  const startsAt = Date.UTC(year, month - 1, day, hour - 7, minute);
  return (startsAt - now.getTime()) / 60000;
};

const lockInvoiceThenAppointment = async (connection, appointmentId) => {
  const [invoiceRows] = await connection.query('SELECT id, patient_id, total_amount, invoice_status FROM invoices WHERE appointment_id = ? FOR UPDATE', [appointmentId]);
  const [appointmentRows] = await connection.query(
    `SELECT appointment_id, patient_id, doctor_id, DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date, time_slot, status, slot_id
     FROM appointments WHERE appointment_id = ? FOR UPDATE`, [appointmentId]
  );
  return { invoice: invoiceRows[0] || null, appointment: appointmentRows[0] || null };
};

const lockRequestContext = async (connection, requestId) => {
  const [[pointer]] = await connection.query('SELECT appointment_id FROM appointment_cancellation_requests WHERE id = ?', [requestId]);
  if (!pointer) return { request: null, invoice: null, appointment: null };
  const { invoice, appointment } = await lockInvoiceThenAppointment(connection, pointer.appointment_id);
  const [[request]] = await connection.query('SELECT * FROM appointment_cancellation_requests WHERE id = ? FOR UPDATE', [requestId]);
  return { request, invoice, appointment };
};

const getPaidRows = async (connection, invoiceId) => {
  if (!invoiceId) return [];
  const [rows] = await connection.query(
    `SELECT payment_id, amount, payment_method FROM payments
     WHERE invoice_id = ? AND payment_status = 'PAID' ORDER BY payment_id FOR UPDATE`, [invoiceId]
  );
  return rows;
};

const getReservedRefunds = async (connection, paymentIds) => {
  if (!paymentIds.length) return new Map();
  const [rows] = await connection.query(
    `SELECT payment_id, amount FROM appointment_refunds
     WHERE payment_id IN (?) AND status IN ('PENDING','COMPLETED') FOR UPDATE`, [paymentIds]
  );
  const reserved = new Map();
  for (const row of rows) reserved.set(Number(row.payment_id), (reserved.get(Number(row.payment_id)) || 0) + moneyCents(row.amount));
  return reserved;
};

const paidTotalCents = (paidRows) => paidRows.reduce((sum, row) => sum + moneyCents(row.amount), 0);

const notifyPatient = async (connection, { patientId, appointmentId, requestId, eventKey, title, message }) => {
  await connection.query(
    `INSERT INTO notifications (recipient_user_id, type, title, message, appointment_id, dedupe_key, status)
     VALUES (?, 'APPOINTMENT_CANCELLATION', ?, ?, ?, ?, 'INFO')
     ON DUPLICATE KEY UPDATE title = VALUES(title), message = VALUES(message), status = 'INFO', is_read = FALSE`,
    [patientId, title, message, appointmentId, `CANCEL:${requestId}:${eventKey}`]
  );
};

const emitCancellationChange = (req, patientId, appointmentId, requestId) => {
  const io = req.app.get('io');
  const event = { appointmentId: Number(appointmentId), requestId: Number(requestId) };
  io?.to(`user:${patientId}`).emit('appointment_cancellation_updated', event);
  io?.to('role:ADMIN').emit('cancellation_requests_updated', event);
  io?.to(`user:${patientId}`).emit('notifications_updated', event);
  io?.to('role:ADMIN').emit('appointments_updated', event);
};

const releaseBookedSlot = async (connection, appointment) => {
  if (appointment.slot_id) {
    await connection.query("UPDATE shift_time_slots SET status = 'AVAILABLE' WHERE id = ? AND status = 'BOOKED'", [appointment.slot_id]);
    await connection.query('UPDATE appointments SET slot_id = NULL WHERE appointment_id = ?', [appointment.appointment_id]);
  }
};

const createRefundRows = async (connection, { requestId, invoiceId, paidRows, amountCents }) => {
  if (amountCents <= 0) return { allocations: [], hasBankTransfer: false };
  const paymentIds = paidRows.map((row) => Number(row.payment_id));
  const reserved = await getReservedRefunds(connection, paymentIds);
  let remaining = amountCents;
  const allocations = [];
  for (const payment of paidRows) {
    if (remaining <= 0) break;
    const paymentId = Number(payment.payment_id);
    const available = Math.max(0, moneyCents(payment.amount) - (reserved.get(paymentId) || 0));
    const allocated = Math.min(available, remaining);
    if (!allocated) continue;
    const method = payment.payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH_COUNTER';
    await connection.query(
      `INSERT INTO appointment_refunds (cancellation_request_id, payment_id, amount, refund_method, status)
       VALUES (?, ?, ?, ?, 'PENDING')`, [requestId, paymentId, fromCents(allocated), method]
    );
    allocations.push({ payment_id: paymentId, amount: fromCents(allocated), refund_method: method });
    remaining -= allocated;
  }
  if (remaining > 0) throw Object.assign(new Error('Số tiền hoàn vượt khoản thu còn có thể hoàn.'), { statusCode: 409 });
  return { allocations, hasBankTransfer: allocations.some((item) => item.refund_method === 'BANK_TRANSFER') };
};

const isCancellable = (appointment) => appointment && ['PENDING', 'CONFIRMED'].includes(appointment.status);

const createPatientRequest = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const appointmentId = Number(req.params.id);
    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    await connection.beginTransaction();
    const [invoiceRows] = await connection.query('SELECT id FROM invoices WHERE appointment_id = ? FOR UPDATE', [appointmentId]);
    const [appointmentRows] = await connection.query(
      `SELECT appointment_id, patient_id, DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date, time_slot, status, slot_id
       FROM appointments WHERE appointment_id = ? FOR UPDATE`, [appointmentId]
    );
    const appointment = appointmentRows[0];
    if (!appointment) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' }); }
    if (Number(appointment.patient_id) !== Number(req.user.id)) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Bạn chỉ có thể yêu cầu hủy lịch của mình.' }); }
    if (!isCancellable(appointment)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Lịch đã khám, đã hủy hoặc không còn ở trạng thái có thể hủy.' }); }
    const [[pending]] = await connection.query("SELECT id FROM appointment_cancellation_requests WHERE appointment_id = ? AND status = 'PENDING' LIMIT 1 FOR UPDATE", [appointmentId]);
    if (pending) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Lịch này đã có yêu cầu hủy đang chờ xử lý.' }); }

    const invoice = invoiceRows[0];
    const paidRows = invoice ? await getPaidRows(connection, invoice.id) : [];
    const paidCents = paidTotalCents(paidRows);
    const mins = minutesUntilStart(appointment.appointment_date, appointment.time_slot);
    if (mins == null) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không xác định được giờ bắt đầu lịch hẹn.' }); }
    const underTwoHours = mins < 120;
    const reason = normalizeReason(req.body.reason);
    if (underTwoHours && reason.length < 3) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Trong vòng 2 giờ trước giờ khám, vui lòng nhập lý do hủy.' }); }
    if (reason.length > 2000) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Lý do hủy không được vượt quá 2.000 ký tự.' }); }

    let bankDetailsEncrypted = null;
    const bankSourceExists = paidRows.some((row) => row.payment_method === 'BANK_TRANSFER');
    const bankDetails = req.body.bankDetails || {};
    if (bankDetails.accountName || bankDetails.bankName || bankDetails.accountNumber) {
      const accountName = typeof bankDetails.accountName === 'string' ? bankDetails.accountName.trim() : '';
      const bankName = typeof bankDetails.bankName === 'string' ? bankDetails.bankName.trim() : '';
      const accountNumber = typeof bankDetails.accountNumber === 'string' ? bankDetails.accountNumber.replace(/\s+/g, '') : '';
      if (!accountName || !bankName || !/^\d{6,24}$/.test(accountNumber)) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Nhập tên chủ tài khoản, ngân hàng và số tài khoản hợp lệ.' }); }
      bankDetailsEncrypted = encryptBankDetails({ accountName, bankName, accountNumber });
    }
    if (paidCents > 0 && bankSourceExists && !bankDetailsEncrypted) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Khoản thu có chuyển khoản. Vui lòng nhập thông tin tài khoản nhận hoàn tiền.' });
    }

    const requiresApproval = paidCents > 0 || underTwoHours;
    const [created] = await connection.query(
      `INSERT INTO appointment_cancellation_requests
       (appointment_id, invoice_id, patient_id, request_source, patient_reason, requested_at, under_2_hours, status, refund_status, bank_details_encrypted)
       VALUES (?, ?, ?, 'PATIENT', ?, NOW(), ?, ?, ?, ?)`,
      [appointmentId, invoice?.id || null, req.user.id, reason || null, underTwoHours, requiresApproval ? 'PENDING' : 'APPROVED', 'NOT_REQUIRED', bankDetailsEncrypted]
    );
    const requestId = created.insertId;
    if (!requiresApproval) {
      await connection.query("UPDATE appointments SET status = 'CANCELLED' WHERE appointment_id = ?", [appointmentId]);
      await releaseBookedSlot(connection, appointment);
      if (invoice) await connection.query("UPDATE invoices SET invoice_status = 'VOID', cash_requested_at = NULL WHERE id = ?", [invoice.id]);
      await connection.query(
        `UPDATE appointment_cancellation_requests SET processed_at = NOW(), decision_note = 'Bệnh nhân tự hủy trước mốc 2 giờ theo chính sách.' WHERE id = ?`, [requestId]
      );
      await notifyPatient(connection, { patientId: req.user.id, appointmentId, requestId, eventKey: 'approved', title: 'Lịch hẹn đã hủy', message: `Lịch hẹn #${appointmentId} đã được hủy theo yêu cầu của bạn.` });
    } else {
      await notifyPatient(connection, { patientId: req.user.id, appointmentId, requestId, eventKey: 'pending', title: 'Đã gửi yêu cầu hủy lịch', message: `Yêu cầu hủy lịch #${appointmentId} đang chờ phòng khám xử lý. Lịch vẫn được giữ cho đến khi có quyết định.` });
    }
    await connection.commit();
    emitCancellationChange(req, req.user.id, appointmentId, requestId);
    return res.status(201).json({ success: true, message: requiresApproval ? 'Đã gửi yêu cầu hủy. Lịch vẫn được giữ trong khi chờ Admin xử lý.' : 'Đã hủy lịch thành công.', data: { requestId, status: requiresApproval ? 'PENDING' : 'APPROVED', refundStatus: 'NOT_REQUIRED' } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

const listMine = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.appointment_id, r.request_source, r.patient_reason, r.clinic_reason, r.requested_at,
       r.under_2_hours, r.status, r.processed_at, r.decision_note, r.approved_refund_amount, r.refund_status,
       r.bank_details_encrypted, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot, a.status AS appointment_status,
       i.invoice_status, i.payment_status
       FROM appointment_cancellation_requests r JOIN appointments a ON a.appointment_id = r.appointment_id
       LEFT JOIN invoices i ON i.id = r.invoice_id
       WHERE r.patient_id = ? ORDER BY r.requested_at DESC`, [req.user.id]
    );
    const ids = rows.map((row) => Number(row.id));
    let refunds = [];
    if (ids.length) [refunds] = await pool.query(
      `SELECT id, cancellation_request_id, amount, refund_method, status, confirmed_at, reference_code, note
       FROM appointment_refunds WHERE cancellation_request_id IN (?) ORDER BY id`, [ids]
    );
    const byRequest = new Map(ids.map((id) => [id, []]));
    for (const refund of refunds) byRequest.get(Number(refund.cancellation_request_id))?.push(refund);
    const data = rows.map((row) => {
      let bankAccountMasked = null;
      if (row.bank_details_encrypted) {
        try { bankAccountMasked = maskAccountNumber(decryptBankDetails(row.bank_details_encrypted)?.accountNumber); }
        catch { bankAccountMasked = '••••'; }
      }
      const { bank_details_encrypted, ...safeRow } = row;
      return { ...safeRow, has_bank_details: Boolean(row.bank_details_encrypted), bank_account_masked: bankAccountMasked, refunds: byRequest.get(Number(row.id)) || [] };
    });
    return res.json({ success: true, data });
  } catch (error) { next(error); }
};

const updateMineBankDetails = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const accountName = typeof req.body.accountName === 'string' ? req.body.accountName.trim() : '';
    const bankName = typeof req.body.bankName === 'string' ? req.body.bankName.trim() : '';
    const accountNumber = typeof req.body.accountNumber === 'string' ? req.body.accountNumber.replace(/\s+/g, '') : '';
    if (!Number.isSafeInteger(requestId) || !accountName || accountName.length > 120 || !bankName || bankName.length > 120 || !/^\d{6,24}$/.test(accountNumber)) {
      return res.status(400).json({ success: false, message: 'Nhập tên chủ tài khoản, ngân hàng và số tài khoản hợp lệ.' });
    }
    const [pointers] = await connection.query('SELECT appointment_id FROM appointment_cancellation_requests WHERE id = ?', [requestId]);
    if (!pointers.length) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hủy.' });
    await connection.beginTransaction();
    const { request } = await lockRequestContext(connection, requestId);
    if (!request) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hủy.' }); }
    if (Number(request.patient_id) !== Number(req.user.id)) { await connection.rollback(); return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa thông tin hoàn tiền của yêu cầu này.' }); }
    if (!['PENDING', 'APPROVED'].includes(request.status) || !['PENDING', 'PARTIAL'].includes(request.refund_status)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Yêu cầu không còn chờ hoàn tiền.' }); }
    const encrypted = encryptBankDetails({ accountName, bankName, accountNumber });
    await connection.query('UPDATE appointment_cancellation_requests SET bank_details_encrypted = ? WHERE id = ?', [encrypted, requestId]);
    await connection.commit();
    emitCancellationChange(req, req.user.id, request.appointment_id, requestId);
    return res.json({ success: true, message: 'Đã cập nhật thông tin nhận hoàn tiền.', data: { bankAccountMasked: maskAccountNumber(accountNumber) } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

const listAdmin = async (req, res, next) => {
  try {
    const allowed = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'REFUND_PENDING'];
    const status = String(req.query.status || 'ALL').toUpperCase();
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Bộ lọc trạng thái không hợp lệ.' });
    const params = [];
    let where = '';
    if (status === 'REFUND_PENDING') where = "WHERE r.status = 'APPROVED' AND r.refund_status IN ('PENDING','PARTIAL')";
    else if (status !== 'ALL') { where = 'WHERE r.status = ?'; params.push(status); }
    const [rows] = await pool.query(
      `SELECT r.id, r.appointment_id, r.invoice_id, r.patient_id, r.request_source, r.patient_reason, r.clinic_reason,
       r.requested_at, r.under_2_hours, r.status, r.processed_by, r.processed_at, r.decision_note,
       r.approved_refund_amount, r.refund_status, r.bank_details_encrypted,
       DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot, a.status AS appointment_status,
       p.full_name AS patient_name, p.phone AS patient_phone, du.full_name AS doctor_name,
       i.total_amount, i.invoice_status,
       COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id AND pay.payment_status = 'PAID'), 0) AS paid_amount,
       COALESCE((SELECT SUM(ref.amount) FROM appointment_refunds ref JOIN payments rp ON rp.payment_id = ref.payment_id
                 WHERE rp.invoice_id = i.id AND ref.status IN ('PENDING','COMPLETED')), 0) AS reserved_refund_amount
       FROM appointment_cancellation_requests r
       JOIN appointments a ON a.appointment_id = r.appointment_id
       JOIN users p ON p.id = r.patient_id
       JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
       LEFT JOIN invoices i ON i.id = r.invoice_id
       ${where} ORDER BY FIELD(r.status, 'PENDING','APPROVED','REJECTED'), r.requested_at DESC`, params
    );
    const ids = rows.map((row) => Number(row.id));
    let refunds = [];
    if (ids.length) [refunds] = await pool.query(
      `SELECT ref.id, ref.cancellation_request_id, ref.payment_id, ref.amount, ref.refund_method, ref.status,
       ref.confirmed_by, ref.confirmed_at, ref.reference_code, ref.note, pay.payment_method AS original_payment_method,
       admin.full_name AS confirmed_by_name
       FROM appointment_refunds ref JOIN payments pay ON pay.payment_id = ref.payment_id
       LEFT JOIN users admin ON admin.id = ref.confirmed_by
       WHERE ref.cancellation_request_id IN (?) ORDER BY ref.id`, [ids]
    );
    const byRequest = new Map(ids.map((id) => [id, []]));
    for (const refund of refunds) byRequest.get(Number(refund.cancellation_request_id))?.push(refund);
    const data = rows.map((row) => {
      let bankDetails = null;
      if (row.bank_details_encrypted) {
        try { bankDetails = decryptBankDetails(row.bank_details_encrypted); } catch { bankDetails = { unavailable: true }; }
      }
      const minutes = minutesUntilStart(row.appointment_date, row.time_slot);
      const { bank_details_encrypted, ...request } = row;
      const paid = moneyCents(row.paid_amount);
      const reserved = moneyCents(row.reserved_refund_amount);
      return { ...request, minutes_until_start: minutes, paid_amount: Number(row.paid_amount || 0), refundable_remaining: fromCents(Math.max(0, paid - reserved)), bank_details: bankDetails, refunds: byRequest.get(Number(row.id)) || [] };
    });
    return res.json({ success: true, data });
  } catch (error) { next(error); }
};

const transitionToCancelled = async (connection, appointment, invoice, patientId, requestId) => {
  if (!isCancellable(appointment)) throw Object.assign(new Error('Lịch không còn ở trạng thái có thể hủy.'), { statusCode: 409 });
  await connection.query("UPDATE appointments SET status = 'CANCELLED' WHERE appointment_id = ?", [appointment.appointment_id]);
  await releaseBookedSlot(connection, appointment);
  if (invoice) {
    await connection.query("UPDATE invoices SET invoice_status = 'VOID', cash_requested_at = NULL WHERE id = ?", [invoice.id]);
    await connection.query("UPDATE payments SET reconciliation_status = 'REVIEW' WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
    const [[paid]] = await connection.query("SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE invoice_id = ? AND payment_status = 'PAID'", [invoice.id]);
    await connection.query(
      `UPDATE notifications SET status = ?, message = ?, is_read = FALSE
       WHERE invoice_id = ? AND type = 'INVOICE_UPDATED' AND status <> 'SUPERSEDED'`,
      [Number(paid.amount) > 0 ? 'REVIEW' : 'SUPERSEDED', Number(paid.amount) > 0
        ? `Hóa đơn #${invoice.id} đã hết hiệu lực cùng lịch đã hủy. Khoản thu đã nhận được giữ trong lịch sử và chờ xử lý hoàn thủ công.`
        : `Hóa đơn #${invoice.id} đã hết hiệu lực do lịch hẹn bị hủy.`, invoice.id]
    );
  }
  await notifyPatient(connection, { patientId, appointmentId: appointment.appointment_id, requestId, eventKey: 'approved', title: 'Yêu cầu hủy lịch đã được duyệt', message: `Lịch hẹn #${appointment.appointment_id} đã được hủy. Khoản thu (nếu có) được giữ nguyên trong lịch sử và xử lý hoàn tiền thủ công.` });
};

const approve = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    if (!Number.isSafeInteger(requestId) || requestId < 1) return res.status(400).json({ success: false, message: 'Mã yêu cầu không hợp lệ.' });
    const pointer = await connection.query('SELECT appointment_id FROM appointment_cancellation_requests WHERE id = ?', [requestId]);
    if (!pointer[0].length) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hủy.' });
    await connection.beginTransaction();
    const { request, invoice, appointment } = await lockRequestContext(connection, requestId);
    if (!request || !appointment) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hoặc lịch hẹn.' }); }
    if (request.status !== 'PENDING') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Yêu cầu này đã được xử lý.' }); }
    if (!isCancellable(appointment)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Lịch đã hoàn tất hoặc không còn có thể hủy.' }); }
    const paidRows = await getPaidRows(connection, invoice?.id);
    const paidCents = paidTotalCents(paidRows);
    const reserved = await getReservedRefunds(connection, paidRows.map((row) => Number(row.payment_id)));
    const reservedCents = [...reserved.values()].reduce((sum, amount) => sum + amount, 0);
    const availableCents = Math.max(0, paidCents - reservedCents);
    const rawRefund = req.body.refundAmount;
    let refundCents = 0;
    if (paidCents > 0) {
      if (request.request_source === 'PATIENT' && !request.under_2_hours) refundCents = availableCents;
      else {
        const value = Number(rawRefund);
        if (rawRefund === undefined || rawRefund === null || rawRefund === '' || !Number.isFinite(value) || value < 0) {
          await connection.rollback(); return res.status(400).json({ success: false, message: 'Nhập số tiền hoàn được duyệt.' });
        }
        refundCents = moneyCents(value);
      }
      if (refundCents > availableCents) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Số tiền hoàn vượt khoản thu còn có thể hoàn.', data: { maximumRefund: fromCents(availableCents) } }); }
    }
    const decisionNote = normalizeReason(req.body.note);
    if (decisionNote.length > 2000) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Ghi chú không được vượt quá 2.000 ký tự.' }); }
    const result = await createRefundRows(connection, { requestId, invoiceId: invoice?.id, paidRows, amountCents: refundCents });
    if (result.hasBankTransfer && !request.bank_details_encrypted) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Cần bệnh nhân cung cấp tài khoản nhận chuyển khoản trước khi duyệt khoản hoàn này.' }); }
    if (result.hasBankTransfer) {
      try { decryptBankDetails(request.bank_details_encrypted); }
      catch { await connection.rollback(); return res.status(503).json({ success: false, message: 'Không giải mã được thông tin tài khoản nhận hoàn. Kiểm tra REFUND_PII_ENCRYPTION_KEY trước khi tiếp tục.' }); }
    }
    await connection.query(
      `UPDATE appointment_cancellation_requests SET status = 'APPROVED', processed_by = ?, processed_at = NOW(),
       decision_note = ?, approved_refund_amount = ?, refund_status = ? WHERE id = ?`,
      [req.user.id, decisionNote || null, fromCents(refundCents), refundCents > 0 ? 'PENDING' : 'NOT_REQUIRED', requestId]
    );
    await transitionToCancelled(connection, appointment, invoice, request.patient_id, requestId);
    await connection.commit();
    emitCancellationChange(req, request.patient_id, request.appointment_id, requestId);
    req.app.get('io')?.to(`user:${request.patient_id}`).emit('payment_updated', { appointmentId: Number(request.appointment_id), status: 'CANCELLED' });
    req.app.get('io')?.to('role:ADMIN').emit('payment_updated', { appointmentId: Number(request.appointment_id), status: 'CANCELLED' });
    return res.json({ success: true, message: refundCents > 0 ? `Đã duyệt hủy. Khoản hoàn ${fromCents(refundCents).toLocaleString('vi-VN')}đ đang chờ xác nhận đã trả.` : 'Đã duyệt và hủy lịch; không có khoản cần hoàn.', data: { refundAmount: fromCents(refundCents), refundStatus: refundCents > 0 ? 'PENDING' : 'NOT_REQUIRED' } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

const reject = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const reason = normalizeReason(req.body.reason);
    if (!Number.isSafeInteger(requestId) || requestId < 1) return res.status(400).json({ success: false, message: 'Mã yêu cầu không hợp lệ.' });
    if (reason.length < 3 || reason.length > 2000) return res.status(400).json({ success: false, message: 'Nhập lý do từ chối từ 3 đến 2.000 ký tự.' });
    const [pointer] = await connection.query('SELECT appointment_id FROM appointment_cancellation_requests WHERE id = ?', [requestId]);
    if (!pointer.length) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hủy.' });
    await connection.beginTransaction();
    const { request, appointment } = await lockRequestContext(connection, requestId);
    if (!request || !appointment) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hoặc lịch hẹn.' }); }
    if (request.status !== 'PENDING') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Yêu cầu này đã được xử lý.' }); }
    await connection.query(
      `UPDATE appointment_cancellation_requests SET status = 'REJECTED', processed_by = ?, processed_at = NOW(), decision_note = ?, refund_status = 'NOT_REQUIRED' WHERE id = ?`,
      [req.user.id, reason, requestId]
    );
    await notifyPatient(connection, { patientId: request.patient_id, appointmentId: request.appointment_id, requestId, eventKey: 'rejected', title: 'Yêu cầu hủy lịch bị từ chối', message: `Yêu cầu hủy lịch #${request.appointment_id} bị từ chối. Lý do: ${reason}` });
    await connection.commit();
    emitCancellationChange(req, request.patient_id, request.appointment_id, requestId);
    return res.json({ success: true, message: 'Đã từ chối yêu cầu hủy.' });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

const clinicCancel = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const appointmentId = Number(req.params.id);
    const reason = normalizeReason(req.body.reason);
    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    if (reason.length < 3 || reason.length > 2000) return res.status(400).json({ success: false, message: 'Nhập lý do hủy từ phía phòng khám.' });
    await connection.beginTransaction();
    const { invoice, appointment } = await lockInvoiceThenAppointment(connection, appointmentId);
    if (!appointment) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' }); }
    if (!isCancellable(appointment)) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Không thể hủy lịch đã khám, đã hủy hoặc đã vắng.' }); }
    const [[pending]] = await connection.query("SELECT id FROM appointment_cancellation_requests WHERE appointment_id = ? AND status = 'PENDING' LIMIT 1 FOR UPDATE", [appointmentId]);
    if (pending) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Lịch đang có yêu cầu hủy của bệnh nhân. Hãy duyệt hoặc từ chối yêu cầu đó trước.' }); }
    const paidRows = await getPaidRows(connection, invoice?.id);
    const paidCents = paidTotalCents(paidRows);
    const [created] = await connection.query(
      `INSERT INTO appointment_cancellation_requests
       (appointment_id, invoice_id, patient_id, request_source, clinic_reason, requested_at, under_2_hours, status, processed_by, processed_at, decision_note, approved_refund_amount, refund_status)
       VALUES (?, ?, ?, 'CLINIC', ?, NOW(), ?, 'APPROVED', ?, NOW(), ?, ?, ?)`,
      [appointmentId, invoice?.id || null, appointment.patient_id, reason, (minutesUntilStart(appointment.appointment_date, appointment.time_slot) ?? 999999) < 120, req.user.id, reason, fromCents(paidCents), paidCents > 0 ? 'PENDING' : 'NOT_REQUIRED']
    );
    const requestId = created.insertId;
    const allocations = await createRefundRows(connection, { requestId, invoiceId: invoice?.id, paidRows, amountCents: paidCents });
    await transitionToCancelled(connection, appointment, invoice, appointment.patient_id, requestId);
    await connection.commit();
    emitCancellationChange(req, appointment.patient_id, appointmentId, requestId);
    req.app.get('io')?.to(`user:${appointment.patient_id}`).emit('payment_updated', { appointmentId, status: 'CANCELLED' });
    req.app.get('io')?.to('role:ADMIN').emit('payment_updated', { appointmentId, status: 'CANCELLED' });
    return res.json({ success: true, message: paidCents ? `Đã hủy lịch. Tạo khoản hoàn thủ công ${fromCents(paidCents).toLocaleString('vi-VN')}đ đang chờ xác nhận.` : 'Đã hủy lịch; không có khoản thanh toán cần hoàn.', data: { requestId, refundStatus: paidCents ? 'PENDING' : 'NOT_REQUIRED', refundMethods: allocations.allocations.map((item) => item.refund_method) } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

const completeRefund = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const refundId = Number(req.params.refundId);
    const referenceCode = normalizeReason(req.body.referenceCode);
    const note = normalizeReason(req.body.note);
    const [[pointer]] = await connection.query(
      `SELECT ref.cancellation_request_id, req.appointment_id FROM appointment_refunds ref JOIN appointment_cancellation_requests req ON req.id = ref.cancellation_request_id WHERE ref.id = ?`, [refundId]
    );
    if (!pointer) return res.status(404).json({ success: false, message: 'Không tìm thấy khoản hoàn.' });
    await connection.beginTransaction();
    const { request } = await lockRequestContext(connection, pointer.cancellation_request_id);
    if (!request) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hoàn tiền.' }); }
    if (request.status !== 'APPROVED') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ xác nhận hoàn tiền sau khi yêu cầu đã được duyệt.' }); }
    const [[refund]] = await connection.query('SELECT * FROM appointment_refunds WHERE id = ? FOR UPDATE', [refundId]);
    if (!refund || refund.status !== 'PENDING') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Khoản hoàn này đã được xác nhận hoặc không còn chờ xử lý.' }); }
    if (refund.refund_method === 'BANK_TRANSFER' && (!referenceCode || referenceCode.length > 150)) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Nhập mã tham chiếu chuyển khoản trước khi xác nhận.' }); }
    if (refund.refund_method === 'BANK_TRANSFER' && !request.bank_details_encrypted) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Bệnh nhân chưa cung cấp thông tin tài khoản nhận hoàn.' }); }
    if (refund.refund_method === 'BANK_TRANSFER') {
      try { decryptBankDetails(request.bank_details_encrypted); }
      catch { await connection.rollback(); return res.status(503).json({ success: false, message: 'Không giải mã được thông tin tài khoản nhận hoàn. Kiểm tra REFUND_PII_ENCRYPTION_KEY.' }); }
    }
    if (refund.refund_method === 'CASH_COUNTER' && note.length < 3) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Ghi chú việc trả tiền tại quầy trước khi xác nhận.' }); }
    await connection.query(
      `UPDATE appointment_refunds SET status = 'COMPLETED', confirmed_by = ?, confirmed_at = NOW(), reference_code = ?, note = ? WHERE id = ?`,
      [req.user.id, referenceCode || null, note || null, refundId]
    );
    const [[totals]] = await connection.query(
      `SELECT COUNT(*) AS total_count, SUM(status = 'COMPLETED') AS completed_count,
       COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0) AS completed_amount
       FROM appointment_refunds WHERE cancellation_request_id = ?`, [request.id]
    );
    const refundStatus = Number(totals.completed_count) >= Number(totals.total_count) ? 'COMPLETED' : Number(totals.completed_count) > 0 ? 'PARTIAL' : 'PENDING';
    await connection.query('UPDATE appointment_cancellation_requests SET refund_status = ? WHERE id = ?', [refundStatus, request.id]);
    await notifyPatient(connection, { patientId: request.patient_id, appointmentId: request.appointment_id, requestId: request.id, eventKey: `refund-${refundId}`, title: 'Đã xác nhận hoàn tiền', message: `Phòng khám đã xác nhận hoàn ${Number(refund.amount).toLocaleString('vi-VN')}đ cho lịch #${request.appointment_id}.` });
    await connection.commit();
    emitCancellationChange(req, request.patient_id, request.appointment_id, request.id);
    return res.json({ success: true, message: 'Đã xác nhận khoản tiền đã được hoàn thực tế.', data: { refundId, refundStatus, completedAmount: Number(totals.completed_amount) } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

const markNoShow = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const appointmentId = Number(req.params.id);
    const confirmedAbsent = req.body.confirmedAbsent === true;
    if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) return res.status(400).json({ success: false, message: 'Mã lịch hẹn không hợp lệ.' });
    if (!confirmedAbsent) return res.status(400).json({ success: false, message: 'Xác nhận đã kiểm tra và bệnh nhân vắng mặt.' });
    await connection.beginTransaction();
    const { invoice, appointment } = await lockInvoiceThenAppointment(connection, appointmentId);
    if (!appointment) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' }); }
    if (appointment.status !== 'CONFIRMED') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ lịch đã xác nhận mới có thể đánh dấu vắng.' }); }
    const minutes = minutesUntilStart(appointment.appointment_date, appointment.time_slot);
    if (minutes == null || minutes > -15) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Chỉ đánh dấu vắng sau ít nhất 15 phút kể từ giờ bắt đầu.' }); }
    const [[pending]] = await connection.query("SELECT id FROM appointment_cancellation_requests WHERE appointment_id = ? AND status = 'PENDING' LIMIT 1 FOR UPDATE", [appointmentId]);
    if (pending) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Hãy xử lý yêu cầu hủy đang chờ trước khi đánh dấu vắng.' }); }
    await connection.query("UPDATE appointments SET status = 'NO_SHOW' WHERE appointment_id = ?", [appointmentId]);
    await notifyPatient(connection, { patientId: appointment.patient_id, appointmentId, requestId: `NOSHOW-${appointmentId}`, eventKey: 'notice', title: 'Cập nhật trạng thái lịch hẹn', message: `Lịch hẹn #${appointmentId} được phòng khám ghi nhận là vắng mặt. Vui lòng liên hệ phòng khám nếu cần đối soát.` });
    await connection.commit();
    emitCancellationChange(req, appointment.patient_id, appointmentId, `NOSHOW-${appointmentId}`);
    req.app.get('io')?.to('role:ADMIN').emit('payment_updated', { appointmentId, status: 'NO_SHOW', invoiceId: invoice?.id });
    return res.json({ success: true, message: 'Đã ghi nhận vắng mặt sau khi Admin xác minh.' });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
};

module.exports = { createPatientRequest, listMine, updateMineBankDetails, listAdmin, approve, reject, clinicCancel, completeRefund, markNoShow, minutesUntilStart };
