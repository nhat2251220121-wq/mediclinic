const express = require('express');
const aiController = require('../controllers/aiController');
const aiServiceController = require('../controllers/aiServiceController');
const rateLimit = require('../middlewares/rateLimit');
const optionalVerifyToken = require('../middlewares/optionalVerifyToken');
const verifyToken = require('../middlewares/verifyToken');
const { isPatient } = require('../middlewares/checkRole');
const { patientChatController } = require('../controllers/patientChatController');

const createAIRouter = (controller = aiController, serviceController = aiServiceController, optionalAuth = optionalVerifyToken) => {
  const router = express.Router();
  router.post('/classify-symptom', rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Bạn đã gửi quá nhiều yêu cầu tư vấn. Vui lòng thử lại sau.' }), controller.classifySymptom);
  router.post('/service-advice', rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Bạn đã yêu cầu tra cứu dịch vụ quá nhiều lần. Vui lòng thử lại sau.' }), optionalAuth, serviceController.serviceAdvice);
  router.post('/patient-query', rateLimit({ windowMs: 60 * 1000, max: 20, message: 'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau.' }), verifyToken, isPatient, patientChatController().query);
  return router;
};

module.exports = createAIRouter();
module.exports.createAIRouter = createAIRouter;
