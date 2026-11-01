// Explicitly isolated integration suite. It refuses every DB name except this test DB.
require('dotenv').config();
const TEST_DB = 'mediclinic_cancel_test_20261031_a1';
process.env.DB_NAME = TEST_DB;
process.env.JWT_SECRET = 'local-cancellation-test-jwt-secret-32-chars-minimum';
process.env.REFUND_PII_ENCRYPTION_KEY = 'local-cancellation-test-refund-key-32-chars-minimum';
process.env.SEPAY_API_KEY = 'local-cancellation-sepay-test-key';
process.env.BANK_ACCOUNT = 'TEST-RECEIVING';
process.env.BANK_NAME = 'Test Bank';
process.env.ACCOUNT_NAME = 'Test Clinic';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const appointmentRoutes = require('../src/routes/appointmentRoutes');
const paymentRoutes = require('../src/routes/paymentRoutes');
const invoiceRoutes = require('../src/routes/invoiceRoutes');

const clinicParts = (date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
}).formatToParts(date).filter((item) => item.type !== 'literal').map(({ type, value }) => [type, value]));

const main = async () => {
  const [[database]] = await pool.query('SELECT DATABASE() AS name');
  if (database.name !== TEST_DB || database.name === 'mediclinic_db') throw new Error('Refusing to run outside the dedicated cancellation test database.');
  const [[tables]] = await pool.query(`SELECT COUNT(*) AS count FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('appointment_cancellation_requests','appointment_refunds')`);
  if (Number(tables.count) !== 2) throw new Error('Migration 013 has not been applied to the isolated test database.');

  const connection = await pool.getConnection();
  const suffix = `${Date.now()}${crypto.randomInt(100, 999)}`;
  const createUser = async (name, role, n) => {
    const [result] = await connection.query(
      'INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, `09${String(Date.now()).slice(-8)}${String(n).slice(-2)}`, `cancellation-${suffix}-${n}@example.test`, 'test-only-hash', role]
    );
    return result.insertId;
  };
  const ids = {};
  try {
    await connection.beginTransaction();
    ids.patient = await createUser('Test Patient', 'PATIENT', 101);
    ids.otherPatient = await createUser('Other Test Patient', 'PATIENT', 102);
    ids.doctorUser = await createUser('Test Doctor', 'DOCTOR', 103);
    ids.admin = await createUser('Test Admin', 'ADMIN', 104);
    const [specialty] = await connection.query('INSERT INTO specialties (name) VALUES (?)', [`Cancellation test ${suffix}`]);
    const [room] = await connection.query('INSERT INTO rooms (room_number, name) VALUES (?, ?)', [`CT-${suffix}`, 'Cancellation Test Room']);
    const [doctor] = await connection.query('INSERT INTO doctors (user_id, specialty_id, room_id) VALUES (?, ?, ?)', [ids.doctorUser, specialty.insertId, room.insertId]);
    ids.doctor = doctor.insertId;
    const [shift] = await connection.query('INSERT INTO shifts (name, start_time, end_time) VALUES (?, ?, ?)', [`Cancellation test ${suffix}`, '00:00:00', '23:59:59']);
    ids.shift = shift.insertId;
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }

  const dayRows = new Map();
  let appointmentSequence = 0;
  const createAppointment = async ({ offsetMinutes, status = 'PENDING', paid = 0, paymentMethod = 'CASH' }) => {
    appointmentSequence += 1;
    const moment = new Date(Date.now() + offsetMinutes * 60000 + appointmentSequence * 7000);
    const parts = clinicParts(moment);
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    let schedule = dayRows.get(date);
    if (!schedule) {
      const [day] = await pool.query('INSERT INTO shift_day_employee (doctor_id, work_date) VALUES (?, ?)', [ids.doctor, date]);
      const [employee] = await pool.query("INSERT INTO shift_employee (shift_day_employee_id, shift_id, status) VALUES (?, ?, 'AVAILABLE')", [day.insertId, ids.shift]);
      schedule = employee.insertId;
      dayRows.set(date, schedule);
    }
    const start = `${parts.hour}:${parts.minute}:${parts.second}`;
    const endParts = clinicParts(new Date(moment.getTime() + 30 * 60000));
    const end = `${endParts.hour}:${endParts.minute}:${endParts.second}`;
    const [slot] = await pool.query("INSERT INTO shift_time_slots (shift_employee_id, start_time, end_time, status) VALUES (?, ?, ?, 'BOOKED')", [schedule, start, end]);
    const timeSlot = `${parts.hour}:${parts.minute} - ${endParts.hour}:${endParts.minute}`;
    const [appointment] = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, shift_employee_id, slot_id, appointment_date, time_slot, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [ids.patient, ids.doctor, schedule, slot.insertId, date, timeSlot, status]
    );
    const total = 200000;
    const [invoice] = await pool.query(
      `INSERT INTO invoices (appointment_id, patient_id, service_fee, total_amount, payment_status, invoice_status, payment_method)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`, [appointment.insertId, ids.patient, total, total, paid >= total ? 'PAID' : 'UNPAID', paymentMethod]
    );
    let paymentId = null;
    if (paid > 0) {
      const transactionCode = `CANCEL-TEST-${suffix}-${appointment.insertId}`;
      const [payment] = await pool.query(
        `INSERT INTO payments (invoice_id, provider, external_transaction_id, payment_method, transaction_code, amount, payment_status)
         VALUES (?, 'INTERNAL', ?, ?, ?, ?, 'PAID')`, [invoice.insertId, transactionCode, paymentMethod, transactionCode, paid]
      );
      paymentId = payment.insertId;
    }
    return { id: appointment.insertId, slotId: slot.insertId, invoiceId: invoice.insertId, paymentId, paid, date, timeSlot };
  };

  const serverApp = express();
  serverApp.use(express.json());
  serverApp.set('io', { to: () => ({ emit: () => {} }) });
  serverApp.use('/api/appointments', appointmentRoutes);
  serverApp.use('/api/payments', paymentRoutes);
  serverApp.use('/api/invoices', invoiceRoutes);
  const server = await new Promise((resolve) => { const listener = serverApp.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/appointments`;
  const paymentsBase = `http://127.0.0.1:${server.address().port}/api/payments`;
  const invoicesBase = `http://127.0.0.1:${server.address().port}/api/invoices`;
  const tokens = {
    patient: jwt.sign({ id: ids.patient }, process.env.JWT_SECRET),
    otherPatient: jwt.sign({ id: ids.otherPatient }, process.env.JWT_SECRET),
    doctor: jwt.sign({ id: ids.doctorUser }, process.env.JWT_SECRET),
    admin: jwt.sign({ id: ids.admin }, process.env.JWT_SECRET)
  };
  const call = async (token, method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { response: raw.slice(0, 500) }; }
    return { status: response.status, body: parsed };
  };
  const callLocalWebhook = async (body) => {
    const response = await fetch(`${paymentsBase}/sepay-webhook`, {
      method: 'POST', headers: { Authorization: `Apikey ${process.env.SEPAY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { response: raw.slice(0, 500) }; }
    return { status: response.status, body: parsed };
  };
  const callPaymentApi = async (token, method, path, body) => {
    const response = await fetch(`${paymentsBase}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { response: raw.slice(0, 500) }; }
    return { status: response.status, body: parsed };
  };
  const callInvoiceApi = async (token, method, path, body) => {
    const response = await fetch(`${invoicesBase}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { response: raw.slice(0, 500) }; }
    return { status: response.status, body: parsed };
  };
  const checks = [];
  try {
    const missingMethod = await call(tokens.patient, 'POST', '/', { service_id: 1, initial_symptoms: 'Khám định kỳ' });
    assert.equal(missingMethod.status, 400);
    checks.push('appointment creation rejects requests without a selected payment method before writing data');

    const selfCancel = await createAppointment({ offsetMinutes: 240 });
    const notOwner = await call(tokens.otherPatient, 'POST', `/${selfCancel.id}/cancellation-requests`, {});
    assert.equal(notOwner.status, 403);
    const selfCancelResult = await call(tokens.patient, 'POST', `/${selfCancel.id}/cancellation-requests`, {});
    assert.equal(selfCancelResult.status, 201);
    const [[selfRows]] = await pool.query(
      `SELECT a.status, i.invoice_status, st.status AS slot_status
       FROM appointments a JOIN invoices i ON i.appointment_id = a.appointment_id
       JOIN shift_time_slots st ON st.id = ? WHERE a.appointment_id = ?`, [selfCancel.slotId, selfCancel.id]
    );
    assert.equal(selfRows.status, 'CANCELLED'); assert.equal(selfRows.invoice_status, 'VOID'); assert.equal(selfRows.slot_status, 'AVAILABLE');
    checks.push('unpaid >= 2h self-cancel voids invoice and releases slot');

    const qr = await createAppointment({ offsetMinutes: 240, status: 'CONFIRMED', paid: 80000, paymentMethod: 'BANK_TRANSFER' });
    const qrRequest = await call(tokens.patient, 'POST', `/${qr.id}/cancellation-requests`, { bankDetails: { accountName: 'Test Recipient', bankName: 'Test Bank', accountNumber: '123456789012' } });
    assert.equal(qrRequest.status, 201); assert.equal(qrRequest.body.data.status, 'PENDING');
    const duplicatePending = await call(tokens.patient, 'POST', `/${qr.id}/cancellation-requests`, {});
    assert.equal(duplicatePending.status, 409);
    const [[qrState]] = await pool.query('SELECT a.status, st.status AS slot_status FROM appointments a JOIN shift_time_slots st ON st.id = ? WHERE a.appointment_id = ?', [qr.slotId, qr.id]);
    assert.equal(qrState.status, 'CONFIRMED'); assert.equal(qrState.slot_status, 'BOOKED');
    const patientList = await call(tokens.patient, 'GET', '/cancellation-requests/mine');
    const masked = patientList.body.data.find((item) => Number(item.appointment_id) === qr.id);
    assert.equal(masked.bank_account_masked, '•••• 9012'); assert.equal(masked.bank_details_encrypted, undefined);
    const adminList = await call(tokens.admin, 'GET', '/admin/cancellation-requests?status=PENDING');
    const visibleToAdmin = adminList.body.data.find((item) => Number(item.appointment_id) === qr.id);
    assert.equal(visibleToAdmin.bank_details.accountNumber, '123456789012');
    const approveUrl = `/admin/cancellation-requests/${qrRequest.body.data.requestId}/approve`;
    const approveResults = await Promise.all([call(tokens.admin, 'POST', approveUrl, {}), call(tokens.admin, 'POST', approveUrl, {})]);
    assert.deepEqual(approveResults.map((item) => item.status).sort(), [200, 409]);
    const [[qrOriginalPayment]] = await pool.query('SELECT payment_status, reconciliation_status FROM payments WHERE payment_id = ?', [qr.paymentId]);
    const [[qrInvoice]] = await pool.query('SELECT invoice_status FROM invoices WHERE id = ?', [qr.invoiceId]);
    assert.equal(qrOriginalPayment.payment_status, 'PAID'); assert.equal(qrInvoice.invoice_status, 'VOID');
    const [[qrRefund]] = await pool.query('SELECT id, amount, refund_method, status FROM appointment_refunds WHERE cancellation_request_id = ?', [qrRequest.body.data.requestId]);
    assert.equal(Number(qrRefund.amount), qr.paid); assert.equal(qrRefund.refund_method, 'BANK_TRANSFER'); assert.equal(qrRefund.status, 'PENDING');
    const completeUrl = `/admin/cancellation-requests/${qrRequest.body.data.requestId}/refunds/${qrRefund.id}/complete`;
    const completeResults = await Promise.all([call(tokens.admin, 'POST', completeUrl, { referenceCode: 'TEST-REF-1' }), call(tokens.admin, 'POST', completeUrl, { referenceCode: 'TEST-REF-1' })]);
    assert.deepEqual(completeResults.map((item) => item.status).sort(), [200, 409]);
    checks.push('QR request retains paid source, serializes approval and records manual bank refund once');

    const partial = await createAppointment({ offsetMinutes: 60, status: 'CONFIRMED', paid: 100000, paymentMethod: 'CASH' });
    const partialRequest = await call(tokens.patient, 'POST', `/${partial.id}/cancellation-requests`, { reason: 'Không thể đến khám' });
    assert.equal(partialRequest.status, 201);
    const partialUrl = `/admin/cancellation-requests/${partialRequest.body.data.requestId}/approve`;
    assert.equal((await call(tokens.admin, 'POST', partialUrl, { refundAmount: 250000 })).status, 409);
    assert.equal((await call(tokens.admin, 'POST', partialUrl, { refundAmount: 35000 })).status, 200);
    const [[partialRefund]] = await pool.query('SELECT amount, refund_method, status FROM appointment_refunds WHERE cancellation_request_id = ?', [partialRequest.body.data.requestId]);
    assert.equal(Number(partialRefund.amount), 35000); assert.equal(partialRefund.refund_method, 'CASH_COUNTER');
    checks.push('under-2h partial cash refund is capped by actual amount paid');

    const rejection = await createAppointment({ offsetMinutes: 60 });
    const rejectionRequest = await call(tokens.patient, 'POST', `/${rejection.id}/cancellation-requests`, { reason: 'Không thể đến khám' });
    assert.equal((await call(tokens.admin, 'POST', `/admin/cancellation-requests/${rejectionRequest.body.data.requestId}/reject`, {})).status, 400);
    assert.equal((await call(tokens.admin, 'POST', `/admin/cancellation-requests/${rejectionRequest.body.data.requestId}/reject`, { reason: 'Khung giờ cần được giữ theo quy trình.' })).status, 200);
    const [[rejectedState]] = await pool.query('SELECT a.status, st.status AS slot_status FROM appointments a JOIN shift_time_slots st ON st.id = ? WHERE a.appointment_id = ?', [rejection.slotId, rejection.id]);
    assert.equal(rejectedState.status, 'PENDING'); assert.equal(rejectedState.slot_status, 'BOOKED');
    const patientHistory = await call(tokens.patient, 'GET', '/cancellation-requests/mine');
    assert.equal(patientHistory.body.data.find((item) => Number(item.appointment_id) === rejection.id).decision_note, 'Khung giờ cần được giữ theo quy trình.');
    checks.push('Admin rejection requires a reason and leaves appointment/slot unchanged');

    const clinic = await createAppointment({ offsetMinutes: 300, status: 'CONFIRMED', paid: 125000, paymentMethod: 'CASH' });
    assert.equal((await call(tokens.patient, 'GET', '/admin/cancellation-requests')).status, 403);
    const clinicResult = await call(tokens.admin, 'POST', `/admin/${clinic.id}/cancel`, { reason: 'Phòng khám không thể tiếp nhận do đóng cửa.' });
    assert.equal(clinicResult.status, 200);
    const [[clinicRefund]] = await pool.query('SELECT amount, refund_method, status FROM appointment_refunds WHERE cancellation_request_id = ?', [clinicResult.body.data.requestId]);
    assert.equal(Number(clinicRefund.amount), clinic.paid); assert.equal(clinicRefund.refund_method, 'CASH_COUNTER'); assert.equal(clinicRefund.status, 'PENDING');
    checks.push('clinic cancellation creates a pending full cash refund and patient cannot access Admin API');

    const lateTransferAppointment = await createAppointment({ offsetMinutes: 360, status: 'CONFIRMED', paymentMethod: 'BANK_TRANSFER' });
    const clinicCancel = await call(tokens.admin, 'POST', `/admin/${lateTransferAppointment.id}/cancel`, { reason: 'Kiểm thử webhook đến sau khi đóng lịch.' });
    assert.equal(clinicCancel.status, 200);
    const externalId = String(Date.now());
    const lateTransfer = {
      id: externalId, transferType: 'in', accountNumber: process.env.BANK_ACCOUNT,
      transferAmount: 25000, content: `MEDICLINIC${lateTransferAppointment.id}`
    };
    const lateWebhook = await callLocalWebhook(lateTransfer);
    assert.equal(lateWebhook.status, 200); assert.equal(lateWebhook.body.paymentStatus, 'REVIEW');
    const duplicateWebhook = await callLocalWebhook(lateTransfer);
    assert.equal(duplicateWebhook.status, 200); assert.equal(duplicateWebhook.body.duplicate, true);
    const [[lateState]] = await pool.query(
      `SELECT a.status, i.invoice_status, i.payment_status, p.payment_status AS transaction_status,
       p.reconciliation_status FROM appointments a JOIN invoices i ON i.appointment_id = a.appointment_id
       JOIN payments p ON p.invoice_id = i.id WHERE a.appointment_id = ? AND p.external_transaction_id = ?`,
      [lateTransferAppointment.id, externalId]
    );
    assert.equal(lateState.status, 'CANCELLED'); assert.equal(lateState.invoice_status, 'VOID');
    assert.equal(lateState.payment_status, 'UNPAID'); assert.equal(lateState.transaction_status, 'PAID');
    assert.equal(lateState.reconciliation_status, 'REVIEW');
    checks.push('late/repeated local SePay webhook is recorded once for reconciliation without reopening cancelled invoice or appointment');

    const qrPayment = await createAppointment({ offsetMinutes: 420, paymentMethod: 'BANK_TRANSFER' });
    assert.equal((await callPaymentApi(tokens.admin, 'POST', '/create-qr', { appointmentId: qrPayment.id })).status, 200);
    assert.equal((await callInvoiceApi(tokens.admin, 'PATCH', `/${qrPayment.invoiceId}/pay`, { expectedAmount: 200000 })).status, 409);
    assert.equal((await call(tokens.admin, 'PATCH', `/${qrPayment.id}/status`, { status: 'CONFIRMED' })).status, 409);
    const halfTransfer = await callLocalWebhook({ id: String(Date.now() + 1), transferType: 'in', accountNumber: process.env.BANK_ACCOUNT, transferAmount: 80000, content: `MEDICLINIC${qrPayment.id}` });
    assert.equal(halfTransfer.status, 200); assert.equal(halfTransfer.body.paymentStatus, 'UNPAID');
    let [[qrPartialState]] = await pool.query('SELECT a.status, i.payment_status, i.payment_method FROM appointments a JOIN invoices i ON i.appointment_id = a.appointment_id WHERE a.appointment_id = ?', [qrPayment.id]);
    assert.equal(qrPartialState.status, 'PENDING'); assert.equal(qrPartialState.payment_status, 'UNPAID'); assert.equal(qrPartialState.payment_method, 'BANK_TRANSFER');
    assert.equal((await call(tokens.admin, 'PATCH', `/${qrPayment.id}/status`, { status: 'CONFIRMED' })).status, 409);
    const remainingTransferBody = { id: String(Date.now() + 2), transferType: 'in', accountNumber: process.env.BANK_ACCOUNT, transferAmount: 120000, content: `MEDICLINIC${qrPayment.id}` };
    const completedTransfer = await callLocalWebhook(remainingTransferBody);
    assert.equal(completedTransfer.status, 200); assert.equal(completedTransfer.body.paymentStatus, 'PAID');
    assert.equal((await callLocalWebhook(remainingTransferBody)).body.duplicate, true);
    let [[qrPaidState]] = await pool.query('SELECT a.status, i.payment_status, i.payment_method, (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id AND p.payment_status = \'PAID\') AS paid_count FROM appointments a JOIN invoices i ON i.appointment_id = a.appointment_id WHERE a.appointment_id = ?', [qrPayment.id]);
    assert.equal(qrPaidState.status, 'CONFIRMED'); assert.equal(qrPaidState.payment_status, 'PAID'); assert.equal(qrPaidState.payment_method, 'BANK_TRANSFER'); assert.equal(Number(qrPaidState.paid_count), 2);
    assert.equal((await callPaymentApi(tokens.admin, 'POST', '/create-qr', { appointmentId: clinic.id })).status, 409);
    checks.push('QR payments reject cash collection, keep partial payments pending, auto-confirm only at full receipt, and ignore duplicate webhook');

    const cashPayment = await createAppointment({ offsetMinutes: 480, paymentMethod: 'CASH' });
    assert.equal((await callPaymentApi(tokens.admin, 'POST', '/create-qr', { appointmentId: cashPayment.id })).status, 409);
    assert.equal((await call(tokens.admin, 'PATCH', `/${cashPayment.id}/status`, { status: 'CONFIRMED' })).status, 409);
    const cashCollection = await callInvoiceApi(tokens.admin, 'PATCH', `/${cashPayment.invoiceId}/pay`, { expectedAmount: 200000 });
    assert.equal(cashCollection.status, 200);
    const [[cashPaidState]] = await pool.query('SELECT a.status, i.payment_status, i.payment_method, (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id AND p.payment_status = \'PAID\') AS paid_count FROM appointments a JOIN invoices i ON i.appointment_id = a.appointment_id WHERE a.appointment_id = ?', [cashPayment.id]);
    assert.equal(cashPaidState.status, 'CONFIRMED'); assert.equal(cashPaidState.payment_status, 'PAID'); assert.equal(cashPaidState.payment_method, 'CASH'); assert.equal(Number(cashPaidState.paid_count), 1);
    checks.push('cash collection rejects QR creation and auto-confirms only after Admin records the full outstanding amount');

    const unselectedPayment = await createAppointment({ offsetMinutes: 540, paymentMethod: null });
    assert.equal((await callPaymentApi(tokens.admin, 'POST', '/create-qr', { appointmentId: unselectedPayment.id })).status, 409);
    assert.equal((await callInvoiceApi(tokens.admin, 'PATCH', `/${unselectedPayment.invoiceId}/pay`, { expectedAmount: 200000 })).status, 409);
    checks.push('invoice with no selected method exposes neither QR nor cash collection API');

    const tooEarlyNoShow = await createAppointment({ offsetMinutes: -10, status: 'CONFIRMED' });
    assert.equal((await call(tokens.admin, 'POST', `/admin/${tooEarlyNoShow.id}/no-show`, { confirmedAbsent: true })).status, 409);
    const pendingNoShow = await createAppointment({ offsetMinutes: -25, status: 'CONFIRMED' });
    const noShowRequest = await call(tokens.patient, 'POST', `/${pendingNoShow.id}/cancellation-requests`, { reason: 'Đến muộn, xin hủy' });
    assert.equal(noShowRequest.status, 201);
    assert.equal((await call(tokens.admin, 'POST', `/admin/${pendingNoShow.id}/no-show`, { confirmedAbsent: true })).status, 409);
    await call(tokens.admin, 'POST', `/admin/cancellation-requests/${noShowRequest.body.data.requestId}/reject`, { reason: 'Đã xác minh bệnh nhân vẫn đang liên hệ.' });
    assert.equal((await call(tokens.admin, 'POST', `/admin/${pendingNoShow.id}/no-show`, { confirmedAbsent: true })).status, 200);
    const [[noShowState]] = await pool.query('SELECT status FROM appointments WHERE appointment_id = ?', [pendingNoShow.id]);
    assert.equal(noShowState.status, 'NO_SHOW');
    checks.push('NO_SHOW is blocked before 15 minutes and while a request is pending, then allowed after verification');

    const genericCancel = await call(tokens.doctor, 'PATCH', `/${partial.id}/status`, { status: 'CANCELLED' });
    assert.equal(genericCancel.status, 400);
    checks.push('generic status API no longer permits Doctor cancellation');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    connection.release();
    await pool.end();
  }
  console.log(`Database integration checks passed on ${TEST_DB}:\n- ${checks.join('\n- ')}`);
};

main().catch(async (error) => {
  console.error('Cancellation DB integration test failed:', error.stack || error.message);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
