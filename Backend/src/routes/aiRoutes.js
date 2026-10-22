const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
// verifyToken có thể tùy chọn nếu cho phép khách vãng lai thử AI
const verifyToken = require('../middlewares/verifyToken');
const rateLimit = require('../middlewares/rateLimit');

// POST /api/ai/classify-symptom
router.post('/classify-symptom', rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Bạn đã gửi quá nhiều yêu cầu tư vấn. Vui lòng thử lại sau.' }), aiController.classifySymptom);

module.exports = router;
