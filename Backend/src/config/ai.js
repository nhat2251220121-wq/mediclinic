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

const DISCLAIMER = 'Trợ lý chỉ định hướng nơi khám, không chẩn đoán hoặc kê đơn.';
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

const isMedicationRequest = (symptoms) => {
  const text = normalize(symptoms);
  return /\b(thuoc nao|uống gi|uong gi|nen uong|lieu thuoc|ke don|ke thuoc|cho xin thuoc|thuoc tri|thuoc ha sot)\b/.test(text)
    || (text.includes('thuoc') && /\b(het sot|giam sot|chua sot|tri sot)\b/.test(text));
};

const isVagueSkinConcern = (symptoms) => {
  const text = normalize(symptoms);
  return /\b(da mat|da cua toi|mat cua toi)\b/.test(text)
    && /\b(xau|khong dep|khong on|co van de)\b/.test(text)
    && !/\b(ngua|mun|noi ban|phat ban|do|sung|dau|rat|bong|kho|loet|mun trung ca)\b/.test(text);
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

const noSpecialtyResult = ({ initialAdvice, questions = [], urgencyText = 'Chưa đủ thông tin để gợi ý chuyên khoa phù hợp.' } = {}) => ({
  predicted_specialty: null,
  specialty_id: null,
  recommendation_source: 'RULE_BASED',
  urgency_level: 'ROUTINE',
  urgency_text: urgencyText,
  initial_advice: initialAdvice || 'Bạn có thể mô tả rõ vị trí, biểu hiện và thời điểm bắt đầu để tôi giúp định hướng phù hợp hơn.',
  follow_up_questions: questions.slice(0, 3),
  booking_allowed: false,
  disclaimer: DISCLAIMER
});

// Fallback groups and their order are defined by the project SRS/HLD.
const RULE_GROUPS = [
  { keys: ['rang', 'nhuc rang', 'rang e buot'], terms: ['rang ham mat', 'nha khoa'] },
  { keys: ['tim', 'nguc', 'kho tho', 'huyet ap', 'hoi hop'], terms: ['tim mach', 'tim'] },
  { keys: ['da', 'ngua', 'di ung', 'man do', 'mun'], terms: ['da lieu', 'da'] },
  { keys: ['tai', 'mui', 'hong', 'xoang', 'so mui'], terms: ['tai mui hong', 'tai mui'] },
  { keys: ['mat', 'thi luc', 'nhin mo'], terms: ['mat', 'nhan khoa'] },
  { keys: ['xuong', 'khop', 'lung', 'co bap'], terms: ['co xuong khop', 'xuong khop'] },
  { keys: ['tre em', 'be ', 'nhi'], terms: ['nhi khoa', 'nhi'] }
];

const classifyByRules = (symptoms, specialties) => {
  const text = normalize(symptoms);
  if (isMedicationRequest(text)) {
    return noSpecialtyResult({
      urgencyText: 'Trợ lý không kê thuốc hoặc liều dùng.',
      initialAdvice: 'Tôi không thể đề xuất thuốc hạ sốt. Bạn có thể mô tả thêm các triệu chứng để được định hướng nơi khám, hoặc hỏi nhân viên y tế.',
      questions: ['Bạn đang gặp thêm dấu hiệu nào ngoài sốt?', 'Tình trạng bắt đầu từ khi nào?']
    });
  }
  if (isVagueSkinConcern(text)) {
    return noSpecialtyResult({
      urgencyText: 'Mô tả hiện chưa đủ cụ thể để chọn chuyên khoa.',
      initialAdvice: 'Bạn đang lo về dấu hiệu nào ở da mặt? Mô tả cụ thể hơn sẽ giúp định hướng phù hợp.',
      questions: ['Bạn thấy biểu hiện gì cụ thể, chẳng hạn ngứa, nổi mụn hay đỏ da?', 'Biểu hiện bắt đầu từ khi nào?']
    });
  }
  let selected = null;
  for (const group of RULE_GROUPS) {
    if (!group.keys.some((key) => matchesRuleKeyword(text, key))) continue;
    selected = findSpecialtyByTerms(specialties, group.terms);
    if (selected) break;
  }
  if (!selected) {
    return noSpecialtyResult({
      initialAdvice: 'Chưa tìm được chuyên khoa phù hợp từ mô tả này. Bạn có thể bổ sung triệu chứng cụ thể hoặc liên hệ nhân viên y tế.',
      questions: ['Bạn đang gặp biểu hiện gì cụ thể và ở vị trí nào?', 'Tình trạng bắt đầu từ khi nào?']
    });
  }
  return {
    predicted_specialty: selected?.name || null,
    specialty_id: selected ? Number(selected.id) : null,
    recommendation_source: 'RULE_BASED',
    urgency_level: 'ROUTINE',
    urgency_text: 'Có thể trao đổi với chuyên khoa này; nhân viên y tế sẽ đánh giá trực tiếp.',
    initial_advice: `Mô tả của bạn có thể phù hợp để được tư vấn tại chuyên khoa ${selected.name}.`,
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

const requestOpenAI = async ({ symptoms, specialties, fetchImpl = globalThis.fetch, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL, baseUrl = process.env.OPENAI_BASE_URL, timeoutMs = 12000 }) => {
  if (!apiKey || !model || !baseUrl || typeof fetchImpl !== 'function') throw new Error('OPENAI_UNAVAILABLE');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${String(baseUrl).replace(/\/+$/, '')}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: 'Bạn chỉ hỗ trợ định hướng chuyên khoa dựa trên triệu chứng/lý do khám. Nếu người dùng hỏi việc ngoài phạm vi, lịch khám, lịch trống, hóa đơn hoặc thanh toán, không giả vờ tra cứu; trả specialty và ID là null, hỏi người dùng mô tả triệu chứng hoặc hướng họ đến trang chức năng phù hợp nếu được chỉ dẫn. Không chẩn đoán, không nêu bệnh có thể mắc, không kê đơn hoặc liều thuốc. Chỉ chọn specialty đang hoạt động trong danh sách; điền đúng ID. Không yêu cầu tuổi, giới tính hay thông tin định danh. Nếu thiếu thông tin, đặt tối đa 3 câu hỏi làm rõ. Khi không phù hợp danh sách, specialty và ID phải là null. Trả lời ngắn gọn, lịch sự bằng tiếng Việt. EMERGENCY chỉ dùng cho dấu hiệu cấp cứu; booking_allowed chỉ true khi có chuyên khoa đang hoạt động được xác định và trường hợp không khẩn cấp.'
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
  if (candidate.urgency_level === 'EMERGENCY') return emergencyResult();
  const name = candidate.predicted_specialty?.trim() || null;
  if (name === null) {
    if (candidate.specialty_id !== null) return null;
    const questions = candidate.follow_up_questions.map((question) => question.trim()).filter(Boolean).slice(0, 3);
    return {
      ...candidate,
      predicted_specialty: null,
      specialty_id: null,
      recommendation_source: 'AI',
      booking_allowed: false,
      urgency_text: candidate.urgency_text.slice(0, 300) || 'Chưa đủ thông tin để gợi ý chuyên khoa phù hợp.',
      initial_advice: candidate.initial_advice.slice(0, 1000) || 'Bạn có thể mô tả rõ hơn để được định hướng phù hợp.',
      follow_up_questions: questions.length ? questions : ['Bạn đang gặp biểu hiện gì cụ thể và ở vị trí nào?'],
      disclaimer: DISCLAIMER
    };
  }

  const active = specialties.find((item) => normalize(item.name) === normalize(name));
  if (!active || !Number.isInteger(Number(active.id)) || candidate.specialty_id !== Number(active.id)) return null;
  return {
    ...candidate,
    predicted_specialty: active.name,
    specialty_id: Number(active.id),
    recommendation_source: 'AI',
    booking_allowed: candidate.booking_allowed,
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

const getFallbackReason = (error) => {
  if (error?.name === 'AbortError') return 'timeout';
  if (error?.message === 'OPENAI_UNAVAILABLE') return 'configuration_missing';
  if (error instanceof SyntaxError) return 'invalid_json';
  const status = String(error?.message || '').match(/^OPENAI_HTTP_(\d{3})$/)?.[1];
  if (status) return `provider_http_${status}`;
  return 'provider_error';
};

const createSymptomClassifier = ({ provider = requestOpenAI, logger = console } = {}) => async (symptoms, specialties) => {
  const text = String(symptoms || '').trim();
  if (!text || text.length > MAX_SYMPTOM_LENGTH) throw new Error('INVALID_SYMPTOMS');
  if (isEmergency(text)) return emergencyResult();
  if (isMedicationRequest(text) || isVagueSkinConcern(text)) return classifyByRules(text, Array.isArray(specialties) ? specialties : []);
  if (!Array.isArray(specialties) || specialties.length === 0) return classifyByRules(text, []);

  try {
    const candidate = await provider({ symptoms: text, specialties });
    const normalized = validateAndNormalizeAIResult(candidate, specialties);
    if (normalized) return normalized;
    logger.warn?.('[AI] Rule guidance used: invalid_contract.');
    return classifyByRules(text, specialties);
  } catch (error) {
    // Only log a fixed reason code. Never log the symptom, provider body, credentials, or raw error.
    logger.warn?.(`[AI] Rule guidance used: ${getFallbackReason(error)}.`);
    return classifyByRules(text, specialties);
  }
};

const classifySymptomWithAI = createSymptomClassifier();

module.exports = {
  MAX_SYMPTOM_LENGTH,
  RESPONSE_SCHEMA,
  classifyByRules,
  createSymptomClassifier,
  classifySymptomWithAI,
  isEmergency,
  isMedicationRequest,
  isVagueSkinConcern,
  emergencyResult,
  isValidContract,
  requestOpenAI
};
