const dotenv = require('dotenv');
dotenv.config();

let GoogleGenerativeAI = null;
try {
  ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch {
  // The rule-based recommendation remains available when the optional SDK is absent.
}

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const matchSpecialty = (name, specialties) => {
  const normalized = normalize(name);
  return specialties.find((specialty) => normalize(specialty.name) === normalized) || null;
};

const classifyByRules = (symptoms, specialties) => {
  const text = normalize(symptoms);
  const groups = [
    { keys: ['tim', 'nguc', 'kho tho', 'huyet ap', 'hoi hop'], terms: ['tim mach', 'tim'] },
    { keys: ['da', 'ngua', 'di ung', 'man do', 'mun'], terms: ['da lieu', 'da'] },
    { keys: ['tai', 'mui', 'hong', 'xoang', 'so mui'], terms: ['tai mui hong', 'tai mui'] },
    { keys: ['mat', 'thi luc', 'nhin mo'], terms: ['mat', 'nhan khoa'] },
    { keys: ['xuong', 'khop', 'lung', 'co bap'], terms: ['co xuong khop', 'xuong khop'] },
    { keys: ['tre em', 'be ', 'nhi'], terms: ['nhi khoa', 'nhi'] }
  ];
  let selected = null;
  for (const group of groups) {
    if (!group.keys.some((key) => text.includes(key))) continue;
    selected = specialties.find((specialty) => group.terms.some((term) => normalize(specialty.name).includes(term))) || null;
    if (selected) break;
  }
  if (!selected) selected = specialties.find((specialty) => normalize(specialty.name).includes('noi tong quat')) || null;

  const urgent = ['dau nguc du doi', 'kho tho nang', 'bat tinh', 'dot quy', 'chay mau khong cam'].some((term) => text.includes(term));
  return {
    predicted_specialty: selected?.name || null,
    specialty_id: selected?.id || null,
    recommendation_source: 'RULE_BASED',
    urgency_level: urgent ? 'EMERGENCY' : 'MEDIUM',
    urgency_text: urgent ? 'Cần liên hệ cấp cứu hoặc đến cơ sở y tế gần nhất ngay' : 'Cần được nhân viên y tế đánh giá',
    initial_advice: urgent
      ? 'Không chờ tư vấn trực tuyến. Hãy gọi cấp cứu hoặc đến cơ sở y tế gần nhất ngay.'
      : 'Thông tin này chỉ hỗ trợ chọn nơi khám. Hãy đặt lịch để được nhân viên y tế đánh giá trực tiếp.',
    possible_conditions: [],
    disclaimer: 'Đây không phải chẩn đoán y khoa. Nếu triệu chứng nặng lên hoặc thấy nguy hiểm, hãy liên hệ cấp cứu.'
  };
};

const classifySymptomWithAI = async (symptoms, specialties) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !GoogleGenerativeAI || !specialties.length) return classifyByRules(symptoms, specialties);

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' });
    const allowedSpecialties = specialties.map((specialty) => specialty.name);
    const prompt = `Bạn là công cụ định hướng nơi khám, không chẩn đoán hoặc kê đơn. Chỉ chọn chuyên khoa trong danh sách sau: ${JSON.stringify(allowedSpecialties)}. Nếu không phù hợp, trả predicted_specialty là null. Nội dung người dùng: ${JSON.stringify(symptoms)}. Trả duy nhất JSON với các trường predicted_specialty, urgency_level (LOW, MEDIUM, HIGH, EMERGENCY), urgency_text, initial_advice, disclaimer. Không suy diễn mã hoặc ID chuyên khoa.`;
    const result = await model.generateContent(prompt);
    const raw = (await result.response).text().trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    const specialty = matchSpecialty(parsed.predicted_specialty, specialties);
    if (parsed.predicted_specialty && !specialty) return classifyByRules(symptoms, specialties);
    return {
      predicted_specialty: specialty?.name || null,
      specialty_id: specialty?.id || null,
      recommendation_source: 'AI',
      urgency_level: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(parsed.urgency_level) ? parsed.urgency_level : 'MEDIUM',
      urgency_text: String(parsed.urgency_text || 'Cần được nhân viên y tế đánh giá').slice(0, 300),
      initial_advice: String(parsed.initial_advice || 'Hãy trao đổi với nhân viên y tế.').slice(0, 1000),
      possible_conditions: [],
      disclaimer: 'Gợi ý do AI tạo, không phải chẩn đoán y khoa và không thay thế thăm khám trực tiếp.'
    };
  } catch (error) {
    console.error('[AI] Classification request failed; using rule-based recommendation:', error.message);
    return classifyByRules(symptoms, specialties);
  }
};

module.exports = { classifySymptomWithAI };
