const DEFAULT_MODEL = 'gpt-5.4-mini';
const MAX_SYMPTOM_LENGTH = 2000;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    predicted_specialty: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    specialty_id: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    recommendation_source: { type: 'string', enum: ['AI', 'RULE_BASED'] },
    urgency_level: { type: 'string', enum: ['ROUTINE', 'URGENT', 'EMERGENCY'] },
    urgency_text: { type: 'string' },
    initial_advice: { type: 'string' },
    follow_up_questions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    booking_allowed: { type: 'boolean' },
    disclaimer: { type: 'string' }
  },
  required: [
    'predicted_specialty', 'specialty_id', 'recommendation_source', 'urgency_level',
    'urgency_text', 'initial_advice', 'follow_up_questions', 'booking_allowed', 'disclaimer'
  ]
};

const DISCLAIMER = 'Thông tin này chỉ hỗ trợ định hướng nơi khám, không phải chẩn đoán hay đơn thuốc. Nếu triệu chứng nặng lên hoặc thấy nguy hiểm, hãy liên hệ cấp cứu.';
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');

const findSpecialtyByTerms = (specialties, terms) => specialties.find((specialty) =>
  terms.some((term) => normalize(specialty.name).includes(term))
) || null;
const matchesRuleKeyword = (text, keyword) => {
  if (keyword.includes(' ')) return text.includes(keyword.trim());
  return new RegExp(`(?:^|\\s)${keyword}(?:\\s|$)`).test(text);
};

const EMERGENCY_PATTERNS = [
  /dau nguc.{0,35}(du doi|dữ dội|rat du doi)/,
  /((kho tho|tho kho).{0,35}(nang|du doi|nghiem trong)|khong (tho duoc|the tho)|ngat tho)/,
  /(tim|moi|da).{0,25}(tai|xanh|tim tai)/,
  /(co giat|dong kinh dang co giat)/,
  /(bat tinh|hon me|mat y thuc|khong tinh|ngat xiu)/,
  /(dot quy|yeu liet dot ngot|liet nua nguoi|yeu mot ben|meo mieng|noi kho dot ngot|noi ngo ngu|liem luoi)/,
  /(chay mau).{0,35}(khong cam|khong ngung|nhieu|du doi|khong dung|o at|at at)/
];

const isEmergency = (symptoms) => {
  const text = normalize(symptoms);
  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(text));
};

const emergencyResult = () => ({
  predicted_specialty: null,
  specialty_id: null,
  recommendation_source: 'RULE_BASED',
  urgency_level: 'EMERGENCY',
  urgency_text: 'Dấu hiệu có thể cần cấp cứu. Hãy gọi 115 hoặc đến cơ sở cấp cứu gần nhất ngay.',
  initial_advice: 'Không chờ tư vấn trực tuyến và không tiếp tục đặt lịch thông thường. Gọi 115 hoặc nhờ người đưa đến cơ sở cấp cứu gần nhất ngay.',
  follow_up_questions: [],
  booking_allowed: false,
  disclaimer: DISCLAIMER
});

// Fallback groups and their order are defined by the project SRS/HLD.
const RULE_GROUPS = [
  { keys: ['tim', 'nguc', 'kho tho', 'huyet ap', 'hoi hop'], terms: ['tim mach', 'tim'] },
  { keys: ['da', 'ngua', 'di ung', 'man do', 'mun'], terms: ['da lieu', 'da'] },
  { keys: ['tai', 'mui', 'hong', 'xoang', 'so mui'], terms: ['tai mui hong', 'tai mui'] },
  { keys: ['mat', 'thi luc', 'nhin mo'], terms: ['mat', 'nhan khoa'] },
  { keys: ['xuong', 'khop', 'lung', 'co bap'], terms: ['co xuong khop', 'xuong khop'] },
  { keys: ['tre em', 'be ', 'nhi'], terms: ['nhi khoa', 'nhi'] }
];

const classifyByRules = (symptoms, specialties) => {
  const text = normalize(symptoms);
  let selected = null;
  for (const group of RULE_GROUPS) {
    if (!group.keys.some((key) => matchesRuleKeyword(text, key))) continue;
    selected = findSpecialtyByTerms(specialties, group.terms);
    if (selected) break;
  }
  if (!selected) selected = findSpecialtyByTerms(specialties, ['noi tong quat']);

  return {
    predicted_specialty: selected?.name || null,
    specialty_id: selected ? Number(selected.id) : null,
    recommendation_source: 'RULE_BASED',
    urgency_level: 'ROUTINE',
    urgency_text: selected
      ? 'Chỉ là gợi ý nơi khám theo từ khóa; nhân viên y tế sẽ đánh giá trực tiếp.'
      : 'Chưa thể gợi ý chuyên khoa từ danh mục đang hoạt động; bạn có thể tự chọn dịch vụ.',
    initial_advice: selected
      ? 'Bạn có thể xem dịch vụ thuộc chuyên khoa được gợi ý và chọn lịch phù hợp.'
      : 'Hệ thống chưa xác định được chuyên khoa phù hợp. Bạn có thể tự chọn dịch vụ trên trang đặt lịch.',
    follow_up_questions: [],
    booking_allowed: true,
    disclaimer: DISCLAIMER
  };
};

const isValidContract = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = RESPONSE_SCHEMA.required.slice().sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return false;
  return (typeof value.predicted_specialty === 'string' || value.predicted_specialty === null)
    && (Number.isInteger(value.specialty_id) || value.specialty_id === null)
    && ['AI', 'RULE_BASED'].includes(value.recommendation_source)
    && ['ROUTINE', 'URGENT', 'EMERGENCY'].includes(value.urgency_level)
    && ['urgency_text', 'initial_advice', 'disclaimer'].every((key) => typeof value[key] === 'string')
    && Array.isArray(value.follow_up_questions)
    && value.follow_up_questions.length <= 3
    && value.follow_up_questions.every((item) => typeof item === 'string')
    && typeof value.booking_allowed === 'boolean';
};

const extractResponseText = (body) => {
  if (typeof body?.output_text === 'string') return body.output_text;
  const parts = [];
  for (const item of body?.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('');
};

const requestOpenAI = async ({ symptoms, specialties, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || DEFAULT_MODEL, timeoutMs = 12000 }) => {
  if (!apiKey || typeof fetchImpl !== 'function') throw new Error('OPENAI_UNAVAILABLE');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: 'Bạn chỉ định hướng chuyên khoa và mức độ cần được đánh giá, không chẩn đoán, không nêu bệnh có thể mắc, không kê đơn/đưa hướng dẫn điều trị. Chỉ chọn specialty từ danh sách đang hoạt động được cung cấp; điền đúng ID tương ứng. Không yêu cầu tuổi, giới tính hay thông tin định danh. Nếu thiếu thông tin, đặt tối đa 3 câu hỏi làm rõ, không yêu cầu dữ liệu định danh. Khi không phù hợp danh sách, specialty và ID phải là null. Trả tiếng Việt. EMERGENCY chỉ dùng cho dấu hiệu cấp cứu; ROUTINE hoặc URGENT cho trường hợp khác. booking_allowed phải false khi EMERGENCY, true nếu khác.'
          },
          {
            role: 'user',
            content: JSON.stringify({ symptoms, active_specialties: specialties.map(({ id, name }) => ({ id: Number(id), name })) })
          }
        ],
        text: { format: { type: 'json_schema', name: 'symptom_triage', strict: true, schema: RESPONSE_SCHEMA } },
        max_output_tokens: 900
      })
    });
    if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
    const body = await response.json();
    const raw = extractResponseText(body);
    if (!raw) throw new Error('OPENAI_EMPTY_RESPONSE');
    return JSON.parse(raw);
  } finally {
    clearTimeout(timeout);
  }
};

const validateAndNormalizeAIResult = (candidate, specialties) => {
  if (!isValidContract(candidate)) return null;
  const name = candidate.predicted_specialty?.trim() || null;
  if (name === null && candidate.specialty_id !== null) return null;
  if (name === null) return null;

  const active = specialties.find((item) => normalize(item.name) === normalize(name));
  if (!active || !Number.isInteger(Number(active.id)) || candidate.specialty_id !== Number(active.id)) return null;
  return {
    ...candidate,
    predicted_specialty: active.name,
    specialty_id: Number(active.id),
    recommendation_source: 'AI',
    booking_allowed: candidate.urgency_level !== 'EMERGENCY',
    urgency_text: candidate.urgency_level === 'EMERGENCY'
      ? emergencyResult().urgency_text
      : candidate.urgency_text.slice(0, 300),
    initial_advice: candidate.urgency_level === 'EMERGENCY'
      ? emergencyResult().initial_advice
      : candidate.initial_advice.slice(0, 1000),
    follow_up_questions: candidate.follow_up_questions.map((question) => question.slice(0, 240)),
    disclaimer: DISCLAIMER
  };
};

const createSymptomClassifier = ({ provider = requestOpenAI, logger = console } = {}) => async (symptoms, specialties) => {
  const text = String(symptoms || '').trim();
  if (!text || text.length > MAX_SYMPTOM_LENGTH) throw new Error('INVALID_SYMPTOMS');
  if (isEmergency(text)) return emergencyResult();
  if (!Array.isArray(specialties) || specialties.length === 0) return classifyByRules(text, []);

  try {
    const candidate = await provider({ symptoms: text, specialties });
    const normalized = validateAndNormalizeAIResult(candidate, specialties);
    return normalized || classifyByRules(text, specialties);
  } catch (error) {
    // Do not log symptoms, provider response bodies, credentials, or other patient data.
    logger.warn?.('[AI] Provider unavailable or response invalid; using rule-based fallback.');
    return classifyByRules(text, specialties);
  }
};

const classifySymptomWithAI = createSymptomClassifier();

module.exports = {
  DEFAULT_MODEL,
  MAX_SYMPTOM_LENGTH,
  RESPONSE_SCHEMA,
  classifyByRules,
  createSymptomClassifier,
  classifySymptomWithAI,
  isEmergency,
  emergencyResult,
  isValidContract,
  requestOpenAI
};
