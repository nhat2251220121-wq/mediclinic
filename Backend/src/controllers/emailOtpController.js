const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

const hashOtp = (email, otp) => crypto.createHash('sha256').update(`${email}:${otp}`).digest('hex');
const validEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const createTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const sendOtpEmail = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email hợp lệ.' });
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(503).json({ success: false, message: 'Dịch vụ xác thực email chưa được cấu hình.' });
  }
  try {
    const [[recent]] = await pool.query(
      'SELECT id FROM email_verifications WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY id DESC LIMIT 1', [email]
    );
    if (recent) return res.status(429).json({ success: false, message: 'Vui lòng chờ 60 giây trước khi yêu cầu mã mới.' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const [insert] = await pool.query(
      'INSERT INTO email_verifications (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
      [email, hashOtp(email, otp)]
    );
    try {
      await createTransporter().sendMail({
        from: `MediClinic <${process.env.EMAIL_USER}>`, to: email,
        subject: 'MediClinic - Mã xác thực đăng ký',
        text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`
      });
    } catch (mailError) {
      await pool.query('DELETE FROM email_verifications WHERE id = ?', [insert.insertId]);
      throw mailError;
    }
    return res.json({ success: true, message: 'Mã xác thực đã được gửi. Mã có hiệu lực trong 5 phút.' });
  } catch (error) {
    console.error('Unable to send registration OTP:', error.message);
    return res.status(503).json({ success: false, message: 'Không thể gửi email lúc này. Vui lòng thử lại sau.' });
  }
};

const verifyOtpEmail = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body.otp === 'string' || typeof req.body.otp === 'number' ? String(req.body.otp).trim() : '';
  if (!validEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: 'Email hoặc mã xác thực không hợp lệ.' });
  }
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        'SELECT id, otp_hash, attempts FROM email_verifications WHERE email = ? AND consumed_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1 FOR UPDATE', [email]
      );
      const record = rows[0];
      if (!record || record.attempts >= 5) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Mã đã hết hạn hoặc vượt số lần thử. Hãy yêu cầu mã mới.' });
      }
      if (!crypto.timingSafeEqual(Buffer.from(record.otp_hash), Buffer.from(hashOtp(email, otp)))) {
        await connection.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
        await connection.commit();
        return res.status(400).json({ success: false, message: 'Mã xác thực không chính xác.' });
      }
      await connection.query('UPDATE email_verifications SET verified_at = NOW() WHERE id = ?', [record.id]);
      await connection.commit();
      return res.json({ success: true, message: 'Email đã được xác thực.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) {
    console.error('Unable to verify registration OTP:', error.message);
    return res.status(500).json({ success: false, message: 'Không thể xác thực email lúc này.' });
  }
};

module.exports = { sendOtpEmail, verifyOtpEmail };
