const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { sendOtpEmail, verifyOtpEmail } = require('../controllers/emailOtpController');
const { createPasswordResetController } = require('../controllers/passwordResetController');
const verifyToken = require('../middlewares/verifyToken');
const rateLimit = require('../middlewares/rateLimit');
const passwordResetController = createPasswordResetController();

// Public routes
router.post('/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Thử đăng ký quá nhiều lần. Vui lòng thử lại sau.' }), authController.register);
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' }), authController.login);

// Email OTP routes (for registration)
router.post('/send-otp-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau.' }), sendOtpEmail);
router.post('/verify-otp-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử xác thực quá nhiều lần. Vui lòng thử lại sau.' }), verifyOtpEmail);

// Password reset OTP is stored separately from registration verification codes.
router.post('/password-reset/send-otp', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau 15 phút.' }), passwordResetController.sendOtp);
router.post('/password-reset/verify-otp', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.' }), passwordResetController.verifyOtp);
router.post('/password-reset/reset', rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Bạn đã yêu cầu đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.' }), passwordResetController.resetPassword);

// Protected route
router.get('/profile', verifyToken, authController.getProfile);
router.patch('/profile', verifyToken, authController.updateProfile);

module.exports = router;
