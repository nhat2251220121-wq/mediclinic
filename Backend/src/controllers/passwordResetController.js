const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');
const { JWT_SECRET } = require('../config/jwt');

const MAX_OTP_ATTEMPTS = 5;
const MAX_EMAIL_SENDS_PER_15_MINUTES = 3;
const GENERIC_SEND_MESSAGE = 'Nếu email thuộc tài khoản MediClinic, mã xác thực sẽ được gửi. Hãy kiểm tra hộp thư và thử lại sau nếu chưa nhận được.';
const validEmail = (email) => typeof email === 'string' && email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizeEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const otpHash = (email, otp) => crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');

const createMailer = () => nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const createPasswordResetController = ({ database = pool, sendMail = async (message) => createMailer().sendMail({ from: `MediClinic <${process.env.EMAIL_USER}>`, ...message }) } = {}) => {
  const sendOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Vui lòng nhập email hợp lệ.' });
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(503).json({ success: false, message: 'Dịch vụ email chưa được cấu hình. Vui lòng thử lại sau.' });
    }

    let connection;
    let lockAcquired = false;
    let insertedOtpId = null;
    try {
      connection = await database.getConnection();
      const lockName = `pwdreset_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 48)}`;
      const [[lock]] = await connection.query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
      lockAcquired = Number(lock.acquired) === 1;
      if (!lockAcquired) return res.status(429).json({ success: false, message: 'Yêu cầu đang được xử lý. Vui lòng thử lại sau.' });

      const [users] = await connection.query(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND is_active = TRUE LIMIT 1', [email]
      );
      if (!users.length) return res.json({ success: true, message: GENERIC_SEND_MESSAGE });

      const [[limits]] = await connection.query(
        `SELECT COUNT(*) AS recent_count,
         MAX(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) THEN 1 ELSE 0 END) AS in_cooldown
         FROM password_reset_otps WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
        [email]
      );
      if (Number(limits.recent_count) >= MAX_EMAIL_SENDS_PER_15_MINUTES || Number(limits.in_cooldown)) {
        return res.json({ success: true, message: GENERIC_SEND_MESSAGE });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      await connection.beginTransaction();
      await connection.query(
        'UPDATE password_reset_otps SET consumed_at = NOW() WHERE email = ? AND consumed_at IS NULL', [email]
      );
      const [insert] = await connection.query(
        'INSERT INTO password_reset_otps (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
        [email, otpHash(email, otp)]
      );
      insertedOtpId = insert.insertId;
      await connection.commit();
      await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
      lockAcquired = false;
      connection.release();
      connection = null;

      try {
        await sendMail({
          to: email,
          subject: 'MediClinic - Đặt lại mật khẩu',
          text: `Mã OTP đặt lại mật khẩu MediClinic là ${otp}. Mã có hiệu lực trong 5 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.`
        });
      } catch (mailError) {
        await database.query('DELETE FROM password_reset_otps WHERE id = ?', [insertedOtpId]);
        console.error('Unable to deliver password reset email:', mailError.code || 'unknown error');
        // Keep the same response for registered and unregistered addresses.
      }
      return res.json({ success: true, message: GENERIC_SEND_MESSAGE });
    } catch (error) {
      if (connection) { try { await connection.rollback(); } catch { /* preserve original error */ } }
      console.error('Unable to start password reset:', error.code || 'unknown error');
      return res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.' });
    } finally {
      if (connection) {
        if (lockAcquired) {
          const lockName = `pwdreset_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 48)}`;
          try { await connection.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch { /* released when connection closes */ }
        }
        connection.release();
      }
    }
  };

  const verifyOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === 'string' || typeof req.body?.otp === 'number' ? String(req.body.otp).trim() : '';
    if (!validEmail(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Email hoặc mã OTP không hợp lệ.' });
    }

    let connection;
    try {
      connection = await database.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT id, otp_hash, attempts FROM password_reset_otps
         WHERE email = ? AND consumed_at IS NULL AND verified_at IS NULL AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1 FOR UPDATE`, [email]
      );
      const record = rows[0];
      if (!record || Number(record.attempts) >= MAX_OTP_ATTEMPTS) {
        if (connection) await connection.rollback();
        return res.status(400).json({ success: false, message: 'Mã OTP sai, đã hết hạn hoặc đã được dùng. Hãy yêu cầu mã mới.' });
      }
      const actualHash = Buffer.from(otpHash(email, otp));
      const storedHash = Buffer.from(record.otp_hash);
      if (storedHash.length !== actualHash.length || !crypto.timingSafeEqual(storedHash, actualHash)) {
        const nextAttempts = Number(record.attempts) + 1;
        await connection.query(
          'UPDATE password_reset_otps SET attempts = ?, consumed_at = IF(? >= ?, NOW(), consumed_at) WHERE id = ?',
          [nextAttempts, nextAttempts, MAX_OTP_ATTEMPTS, record.id]
        );
        await connection.commit();
        return res.status(400).json({ success: false, message: nextAttempts >= MAX_OTP_ATTEMPTS ? 'Bạn đã nhập sai OTP quá số lần cho phép. Hãy yêu cầu mã mới.' : 'Mã OTP không chính xác.' });
      }
      if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET is not configured.');
      await connection.query('UPDATE password_reset_otps SET verified_at = NOW() WHERE id = ?', [record.id]);
      const resetToken = jwt.sign({ purpose: 'PASSWORD_RESET', otpId: Number(record.id), email }, JWT_SECRET, { expiresIn: '5m' });
      await connection.commit();
      return res.json({ success: true, message: 'Đã xác minh OTP.', data: { resetToken } });
    } catch (error) {
      if (connection) { try { await connection.rollback(); } catch { /* preserve original error */ } }
      console.error('Unable to verify password reset OTP:', error.code || 'unknown error');
      return res.status(500).json({ success: false, message: 'Không thể xác minh OTP lúc này. Vui lòng thử lại sau.' });
    } finally { if (connection) connection.release(); }
  };

  const resetPassword = async (req, res) => {
    const { resetToken, newPassword, confirmPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 8 || !newPassword.trim()) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự và không được chỉ chứa khoảng trắng.' });
    }
    if (typeof confirmPassword !== 'string' || newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu nhập lại không khớp.' });
    }
    if (typeof resetToken !== 'string' || !resetToken) {
      return res.status(400).json({ success: false, message: 'Phiên xác minh OTP không hợp lệ. Hãy xác minh OTP lại.' });
    }

    let proof;
    try {
      if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET is not configured.');
      proof = jwt.verify(resetToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Phiên xác minh OTP đã hết hạn hoặc không hợp lệ. Hãy xác minh OTP lại.' });
    }
    const email = normalizeEmail(proof.email);
    const otpId = Number(proof.otpId);
    if (proof.purpose !== 'PASSWORD_RESET' || !validEmail(email) || !Number.isSafeInteger(otpId) || otpId < 1) {
      return res.status(400).json({ success: false, message: 'Phiên xác minh OTP không hợp lệ. Hãy xác minh OTP lại.' });
    }

    let connection;
    try {
      connection = await database.getConnection();
      await connection.beginTransaction();
      const [otpRows] = await connection.query(
        `SELECT id FROM password_reset_otps WHERE id = ? AND email = ? AND verified_at IS NOT NULL
         AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE`, [otpId, email]
      );
      if (!otpRows.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Mã OTP đã hết hạn hoặc đã được sử dụng. Hãy bắt đầu lại.' });
      }
      const [users] = await connection.query(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND is_active = TRUE LIMIT 1 FOR UPDATE', [email]
      );
      if (!users.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Không thể đặt lại mật khẩu cho tài khoản này. Hãy bắt đầu lại.' });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, users[0].id]);
      await connection.query('UPDATE password_reset_otps SET consumed_at = NOW() WHERE email = ? AND consumed_at IS NULL', [email]);
      await connection.commit();
      return res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' });
    } catch (error) {
      if (connection) { try { await connection.rollback(); } catch { /* preserve original error */ } }
      console.error('Unable to reset password:', error.code || 'unknown error');
      return res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.' });
    } finally { if (connection) connection.release(); }
  };

  return { sendOtp, verifyOtp, resetPassword };
};

module.exports = { createPasswordResetController, GENERIC_SEND_MESSAGE };
