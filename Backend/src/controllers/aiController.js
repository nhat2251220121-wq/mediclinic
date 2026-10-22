const { classifySymptomWithAI } = require('../config/ai');
const { pool } = require('../config/db');

/**
 * Controller tiếp nhận mô tả triệu chứng và phân loại bằng AI
 * Route: POST /api/ai/classify-symptom
 */
const classifySymptom = async (req, res, next) => {
    try {
        const { symptoms } = req.body;

        if (typeof symptoms !== 'string' || symptoms.trim() === '' || symptoms.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mô tả triệu chứng bệnh.'
            });
        }

        const [specialties] = await pool.query('SELECT id, name FROM specialties WHERE is_active = TRUE ORDER BY name');
        const aiResult = await classifySymptomWithAI(symptoms.trim(), specialties);

        return res.status(200).json({
            success: true,
            message: aiResult.recommendation_source === 'AI' ? 'Đã tạo gợi ý bằng AI.' : 'Đang dùng chế độ quy tắc dự phòng.',
            data: aiResult
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    classifySymptom
};
