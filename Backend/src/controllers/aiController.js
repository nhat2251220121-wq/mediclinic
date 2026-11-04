const { classifySymptomWithAI, MAX_SYMPTOM_LENGTH, isEmergency, emergencyResult } = require('../config/ai');
const { pool } = require('../config/db');

const createAIController = ({ db = pool, classify = classifySymptomWithAI } = {}) => ({
  classifySymptom: async (req, res, next) => {
    try {
      const symptoms = req.body?.symptoms;
      const requestKeys = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? Object.keys(req.body) : [];
      if (requestKeys.length !== 1 || requestKeys[0] !== 'symptoms'
        || typeof symptoms !== 'string' || !/[\p{L}\p{N}]/u.test(symptoms.trim()) || symptoms.length > MAX_SYMPTOM_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Vui lòng nhập mô tả triệu chứng có chữ hoặc số (tối đa ${MAX_SYMPTOM_LENGTH} ký tự).`
        });
      }

      if (isEmergency(symptoms.trim())) {
        return res.status(200).json({
          success: true,
          message: 'Dấu hiệu cần được xử lý cấp cứu ngay.',
          data: emergencyResult()
        });
      }

      const [specialties] = await db.query('SELECT id, name FROM specialties WHERE is_active = TRUE ORDER BY name');
      const result = await classify(symptoms.trim(), specialties);

      // The model cannot widen access to inactive/unknown database specialties.
      if (result.specialty_id !== null) {
        const active = specialties.find((specialty) => Number(specialty.id) === Number(result.specialty_id));
        if (!active || active.name !== result.predicted_specialty) {
          return res.status(200).json({
            success: true,
          message: 'Chưa tìm được chuyên khoa phù hợp. Bạn có thể mô tả rõ hơn.',
            data: {
              ...result,
              predicted_specialty: null,
              specialty_id: null,
              recommendation_source: 'RULE_BASED',
              urgency_level: result.urgency_level === 'EMERGENCY' ? 'EMERGENCY' : 'ROUTINE',
              urgency_text: result.urgency_level === 'EMERGENCY'
                ? result.urgency_text
                : 'Chưa thể gợi ý chuyên khoa phù hợp từ danh mục đang hoạt động.',
              initial_advice: result.urgency_level === 'EMERGENCY'
                ? result.initial_advice
                : 'Bạn có thể mô tả rõ hơn các biểu hiện và thời điểm bắt đầu.',
              follow_up_questions: result.urgency_level === 'EMERGENCY' ? [] : ['Bạn đang gặp biểu hiện gì cụ thể và ở vị trí nào?', 'Tình trạng bắt đầu từ khi nào?'],
              booking_allowed: false
            }
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: result.predicted_specialty
          ? 'Đã có thông tin định hướng chuyên khoa.'
          : 'Chưa đủ thông tin để gợi ý chuyên khoa chắc chắn.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
});

module.exports = { ...createAIController(), createAIController };
