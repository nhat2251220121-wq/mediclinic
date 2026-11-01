// Explicitly isolated password reset tests. This script refuses every DB except the disposable test DB.
require('dotenv').config();
const TEST_DB = 'mediclinic_cancel_test_20261031_a1';
process.env.DB_NAME = TEST_DB;
process.env.JWT_SECRET = 'local-password-reset-test-jwt-secret-32-chars-minimum';
process.env.EMAIL_USER = 'test-only@example.test';
process.env.EMAIL_PASS = 'test-only-not-a-real-secret';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const { pool } = require('../src/config/db');
const { createPasswordResetController, GENERIC_SEND_MESSAGE } = require('../src/controllers/passwordResetController');

const hashOtp = (email, otp) => crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');

const main = async () => {
  const [[database]] = await pool.query('SELECT DATABASE() AS name');
  if (database.name !== TEST_DB || database.name === 'mediclinic_db') throw new Error('Refusing to run outside the dedicated password reset test database.');
  const [[table]] = await pool.query(`SELECT COUNT(*) AS found FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_otps'`);
  if (Number(table.found) !== 1) throw new Error('Migration 014 has not been applied to the isolated test database.');

  const suffix = `${Date.now()}-${crypto.randomInt(1000, 9999)}`;
  const email = `password-reset-${suffix}@example.test`;
  const originalPassword = 'OriginalPassword123';
  const [user] = await pool.query(
    'INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    ['Password Reset Test', `09${String(Date.now()).slice(-8)}${crypto.randomInt(10, 99)}`, email, await bcrypt.hash(originalPassword, 10), 'PATIENT']
  );
  const outbox = [];
  const controller = createPasswordResetController({
    database: pool,
    sendMail: async (message) => { outbox.push(message); return { messageId: `fake-${outbox.length}` }; }
  });
  const app = express();
  app.use(express.json());
  app.post('/send-otp', controller.sendOtp);
  app.post('/verify-otp', controller.verifyOtp);
  app.post('/reset', controller.resetPassword);
  const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const checks = [];
  try {
    const unknownEmail = `unknown-${suffix}@example.test`;
    const unknownResponse = await request('/send-otp', { email: unknownEmail });
    assert.equal(unknownResponse.status, 200);
    assert.equal(unknownResponse.body.message, GENERIC_SEND_MESSAGE);
    assert.equal(outbox.length, 0);

    const sendResponse = await request('/send-otp', { email: ` ${email.toUpperCase()} ` });
    assert.equal(sendResponse.status, 200);
    assert.equal(sendResponse.body.message, unknownResponse.body.message);
    assert.equal(outbox.length, 1);
    const otp = outbox[0].text.match(/\b(\d{6})\b/)?.[1];
    assert.match(otp || '', /^\d{6}$/);
    checks.push('unknown email has the same response as an existing account and no email is sent');

    for (let i = 0; i < 4; i += 1) {
      const resend = await request('/send-otp', { email });
      assert.equal(resend.status, 200);
      assert.equal(resend.body.message, GENERIC_SEND_MESSAGE);
    }
    assert.equal(outbox.length, 1);
    checks.push('per-email resend cooldown prevents repeated email delivery');

    const wrongOtp = otp === '000000' ? '000001' : '000000';
    assert.equal((await request('/verify-otp', { email, otp: wrongOtp })).status, 400);
    const verified = await request('/verify-otp', { email, otp });
    assert.equal(verified.status, 200);
    const resetToken = verified.body.data.resetToken;
    assert.ok(resetToken);
    assert.equal((await request('/reset', { resetToken, newPassword: 'NewPassword123', confirmPassword: 'DifferentPassword123' })).status, 400);
    const reset = await request('/reset', { resetToken, newPassword: 'NewPassword123', confirmPassword: 'NewPassword123' });
    assert.equal(reset.status, 200);
    assert.equal((await request('/verify-otp', { email, otp })).status, 400);
    assert.equal((await request('/reset', { resetToken, newPassword: 'OtherPassword123', confirmPassword: 'OtherPassword123' })).status, 400);
    const [[updatedUser]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [user.insertId]);
    assert.equal(await bcrypt.compare('NewPassword123', updatedUser.password_hash), true);
    assert.equal(await bcrypt.compare(originalPassword, updatedUser.password_hash), false);
    const registrationOtp = '445566';
    await pool.query(
      'INSERT INTO email_verifications (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
      [email, hashOtp(email, registrationOtp)]
    );
    assert.equal((await request('/verify-otp', { email, otp: registrationOtp })).status, 400);
    checks.push('wrong/registration OTPs are rejected; matching passwords reset bcrypt hash once; reset OTP and token cannot be reused');

    const expiredCode = '654321';
    await pool.query(
      'INSERT INTO password_reset_otps (email, otp_hash, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 MINUTE))',
      [unknownEmail, hashOtp(unknownEmail, expiredCode)]
    );
    assert.equal((await request('/verify-otp', { email: unknownEmail, otp: expiredCode })).status, 400);
    checks.push('expired OTP is rejected');

    const lockoutCode = '112233';
    await pool.query(
      'INSERT INTO password_reset_otps (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
      [email, hashOtp(email, lockoutCode)]
    );
    for (let i = 0; i < 5; i += 1) assert.equal((await request('/verify-otp', { email, otp: wrongOtp })).status, 400);
    assert.equal((await request('/verify-otp', { email, otp: lockoutCode })).status, 400);
    checks.push('five invalid OTP attempts consume the code and prevent a subsequent correct attempt');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.query('DELETE FROM password_reset_otps WHERE email IN (?, ?)', [email, `unknown-${suffix}@example.test`]);
    await pool.query('DELETE FROM email_verifications WHERE email = ?', [email]);
    await pool.query('DELETE FROM users WHERE id = ?', [user.insertId]);
    await pool.end();
  }
  console.log(`Password reset database checks passed on ${TEST_DB}:\n- ${checks.join('\n- ')}`);
};

main().catch(async (error) => {
  console.error('Password reset integration test failed:', error.stack || error.message);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
