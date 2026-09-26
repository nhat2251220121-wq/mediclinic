const dotenv = require('dotenv');
dotenv.config();

let GoogleGenerativeAI = null;
try {
    const genaiModule = require('@google/generative-ai');
    GoogleGenerativeAI = genaiModule.GoogleGenerativeAI;
} catch (e) {
    // Sẽ được tải khi đã cài đặt dependencies
}

let genAI = null;
if (process.env.GEMINI_API_KEY && GoogleGenerativeAI) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ [AI] Khởi tạo Google Gemini GenerativeAI thành công.');
    } catch (err) {
        console.warn('⚠️ [AI] Khởi tạo Gemini thất bại, sẽ kích hoạt chế độ dự phòng.');
    }
} else {
    console.warn('⚠️ [AI] Chưa cấu hình GEMINI_API_KEY. Hệ thống sẽ tự động dùng bộ dự phòng AI chuyên khoa.');
}

/**
 * Phân tích và phân loại triệu chứng qua AI
 * @param {string} symptoms Chuỗi triệu chứng người bệnh nhập
 * @returns {Promise<Object>} { predicted_specialty, confidence_level, urgency_level, initial_advice, recommended_actions }
 */
const classifySymptomWithAI = async (symptoms) => {
    // 1. Nếu có Gemini API Key và client
    if (genAI && process.env.GEMINI_API_KEY) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = `
Bạn là trợ lý y khoa AI thông minh tại phòng khám đa khoa MediClinic.
Người bệnh mô tả triệu chứng sau: "${symptoms}"

Dựa trên mô tả, hãy phân tích và trả về DUY NHẤT một chuỗi định dạng JSON hợp lệ (không kèm markdown \`\`\`json) với cấu trúc sau:
{
  "predicted_specialty": "Tên chuyên khoa phù hợp nhất (Ví dụ: Nội tổng quát, Tim mạch, Da liễu, Tai Mũi Họng, Nhi khoa, Cơ xương khớp, Thần kinh)",
  "specialty_id_guess": 1, 
  "urgency_level": "LOW hoặc MEDIUM hoặc HIGH hoặc EMERGENCY",
  "urgency_text": "Mức độ khẩn cấp bằng tiếng Việt",
  "initial_advice": "Lời khuyên y khoa sơ bộ, dặn dò chuẩn bị trước khi đến phòng khám",
  "possible_conditions": ["Tên khả năng 1", "Tên khả năng 2"],
  "disclaimer": "Kết quả AI chỉ mang tính chất tham khảo định hướng chuyên khoa, không thay thế cho chẩn đoán của bác sĩ trực tiếp."
}
`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();

            // Làm sạch markdown nếu có
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return parsed;
        } catch (error) {
            console.error('❌ [AI] Lỗi khi gọi Gemini API:', error.message);
            // Fallback xuống cơ chế Rule-based bên dưới
        }
    }

    // 2. Chế độ Rule-based Dự phòng (Đảm bảo đồ án luôn chạy mượt mà ngay cả khi offline hoặc chưa có key)
    const lower = symptoms.toLowerCase();
    let specialty = 'Nội tổng quát';
    let specialtyId = 1;
    let urgency = 'MEDIUM';
    let urgencyText = 'Trung bình';
    let advice = 'Nên nghỉ ngơi, uống đủ nước và theo dõi thân nhiệt. Đặt lịch khám sớm để được chẩn đoán chính xác.';
    let conditions = ['Cảm cúm thông thường', 'Rối loạn tiêu hóa'];

    if (lower.includes('tim') || lower.includes('đau ngực') || lower.includes('khó thở') || lower.includes('huyết áp')) {
        specialty = 'Tim mạch';
        specialtyId = 2;
        urgency = 'HIGH';
        urgencyText = 'Cần chú ý cao';
        advice = 'Tránh vận động mạnh, nghỉ ngơi ở tư thế nửa nằm nửa ngồi. Nếu đau tức ngực dữ dội kèm khó thở, hãy đến ngay cơ sở y tế gần nhất.';
        conditions = ['Đau thắt ngực', 'Tăng huyết áp', 'Rối loạn nhịp tim'];
    } else if (lower.includes('da') || lower.includes('ngứa') || lower.includes('dị ứng') || lower.includes('mẩn đỏ') || lower.includes('mụn')) {
        specialty = 'Da liễu';
        specialtyId = 3;
        urgency = 'LOW';
        urgencyText = 'Bình thường';
        advice = 'Không gãi chà xát mạnh gây trầy xước nhiễm trùng. Tạm ngừng các loại mỹ phẩm hoặc xà phòng có chất tẩy rửa mạnh.';
        conditions = ['Viêm da tiếp xúc', 'Dị ứng thời tiết', 'Mày đay'];
    } else if (lower.includes('tai') || lower.includes('mũi') || lower.includes('họng') || lower.includes('ho') || lower.includes('sổ mũi') || lower.includes('xoang')) {
        specialty = 'Tai Mũi Họng';
        specialtyId = 4;
        urgency = 'LOW';
        urgencyText = 'Bình thường';
        advice = 'Súc miệng nước muối sinh lý ấm mỗi ngày, giữ ấm vùng cổ họng và đeo khẩu trang khi ra ngoài.';
        conditions = ['Viêm họng cấp', 'Viêm xoang', 'Viêm mũi dị ứng'];
    }

    return {
        predicted_specialty: specialty,
        specialty_id_guess: specialtyId,
        urgency_level: urgency,
        urgency_text: urgencyText,
        initial_advice: advice,
        possible_conditions: conditions,
        disclaimer: 'Kết quả AI chỉ mang tính chất tham khảo định hướng chuyên khoa, không thay thế cho chẩn đoán của bác sĩ trực tiếp.'
    };
};

module.exports = {
    classifySymptomWithAI
};
