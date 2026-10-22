const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { sendOtpEmail, verifyOtpEmail } = require('../controllers/emailOtpController');
const verifyToken = require('../middlewares/verifyToken');
const rateLimit = require('../middlewares/rateLimit');

// Public routes
router.post('/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Thử đăng ký quá nhiều lần. Vui lòng thử lại sau.' }), authController.register);
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' }), authController.login);

// Email OTP routes (for registration)
router.post('/send-otp-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau.' }), sendOtpEmail);
router.post('/verify-otp-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử xác thực quá nhiều lần. Vui lòng thử lại sau.' }), verifyOtpEmail);

// Protected route
router.get('/profile', verifyToken, authController.getProfile);
router.patch('/profile', verifyToken, authController.updateProfile);

module.exports = router;
