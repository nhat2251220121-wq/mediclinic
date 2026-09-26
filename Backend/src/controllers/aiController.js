const { classifySymptomWithAI } = require('../config/ai');

/**
 * Controller tiếp nhận mô tả triệu chứng và phân loại bằng AI
 * Route: POST /api/ai/classify-symptom
 */
const classifySymptom = async (req, res, next) => {
    try {
        const { symptoms } = req.body;

        if (!symptoms || symptoms.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mô tả triệu chứng bệnh.'
            });
        }

        const aiResult = await classifySymptomWithAI(symptoms);

        return res.status(200).json({
            success: true,
            message: 'Phân tích triệu chứng bằng AI hoàn tất.',
            data: aiResult
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    classifySymptom
};
