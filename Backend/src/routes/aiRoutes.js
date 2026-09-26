const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
// verifyToken có thể tùy chọn nếu cho phép khách vãng lai thử AI
const verifyToken = require('../middlewares/verifyToken');

// POST /api/ai/classify-symptom
router.post('/classify-symptom', aiController.classifySymptom);

module.exports = router;
