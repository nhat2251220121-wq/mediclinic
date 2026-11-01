const express = require('express');
const aiController = require('../controllers/aiController');
const rateLimit = require('../middlewares/rateLimit');

const createAIRouter = (controller = aiController) => {
  const router = express.Router();
  router.post('/classify-symptom', rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Bạn đã gửi quá nhiều yêu cầu tư vấn. Vui lòng thử lại sau.' }), controller.classifySymptom);
  return router;
};

module.exports = createAIRouter();
module.exports.createAIRouter = createAIRouter;
