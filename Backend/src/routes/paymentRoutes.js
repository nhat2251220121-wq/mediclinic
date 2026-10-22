const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyToken = require('../middlewares/verifyToken');

// Route Webhook SePay (không cần verifyToken để SePay gọi vào từ internet)
router.post('/sepay-webhook', paymentController.sepayWebhook);

router.use(verifyToken);

// API Tạo mã VietQR
router.post('/create-qr', paymentController.createVietQR);
router.get('/create-qr', paymentController.createVietQR);

// API Lấy trạng thái thanh toán
router.get('/status/:appointmentId', paymentController.getPaymentStatus);

module.exports = router;
