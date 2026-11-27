const MAX_SYMPTOM_LENGTH = 2000

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    predicted_specialty: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    specialty_id: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    recommendation_source: { type: 'string', enum: ['AI', 'RULE_BASED'] },
    urgency_level: {
      anyOf: [
        { type: 'string', enum: ['ROUTINE', 'URGENT', 'EMERGENCY'] },
        { type: 'null' }
      ]
    },
    urgency_text: { type: 'string' },
    initial_advice: { type: 'string' },
    follow_up_questions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3
    },
    booking_allowed: { type: 'boolean' },
    disclaimer: { type: 'string' }
  },
  required: [
    'predicted_specialty',
    'specialty_id',
    'recommendation_source',
    'urgency_level',
    'urgency_text',
    'initial_advice',
    'follow_up_questions',
    'booking_allowed',
    'disclaimer'
  ]
}

const DISCLAIMER =
  'Trợ lý chỉ định hướng nơi khám, không chẩn đoán hoặc kê đơn.'
const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const findSpecialtyByTerms = (specialties, terms) =>
  specialties.find((specialty) =>
    terms.some((term) => normalize(specialty.name).includes(normalize(term)))
  ) || null
const matchesRuleKeyword = (text, keyword) => {
  if (keyword.includes(' ')) return text.includes(keyword.trim())
  return new RegExp(`(?:^|\\s)${keyword}(?:\\s|$)`).test(text)
}

const EMERGENCY_PATTERNS = [
  { pattern: /\bdau nguc\b.{0,35}\b(?:du doi|rat du doi)\b/ },
  { pattern: /\b(?:kho tho|tho kho)\b.{0,35}\b(?:nang|du doi|nghiem trong)\b/ },
  { pattern: /\b(?:moi|da)\s+(?:tim|xanh)\b|\btim tai\b/ },
  { pattern: /\b(?:co giat|dong kinh dang co giat)\b/ },
  { pattern: /\b(?:bat tinh|hon me|mat y thuc|ngat xiu)\b/ },
  { pattern: /\bkhong tinh\b/, ignoreNegation: true },
  { pattern: /\b(?:dot quy|yeu liet dot ngot|liet nua nguoi|yeu mot ben|meo mieng|noi kho dot ngot|noi ngo ngu|liem luoi)\b/ },
  { pattern: /\bchay mau\b.{0,35}\b(?:khong cam|khong ngung|nhieu|du doi|khong dung|o at|at at)\b/ },
  { pattern: /\bkhong\s+(?:tho duoc|the tho)\b/, ignoreNegation: true },
  { pattern: /\bngat tho\b/ }
]

const NEGATION_AT_END = /(?:^|\s)(?:khong|chua|khong bi|khong co|khong phai|khong con)(?:\s+[a-z0-9]+){0,4}\s*$/
const splitIntoClauses = (text) => text.split(/[,;.!?]|\b(?:nhung|tuy nhien|con)\b/).map((part) => part.trim()).filter(Boolean)

const isEmergency = (symptoms) => {
  const clauses = splitIntoClauses(normalize(symptoms))
  return clauses.some((clause) => EMERGENCY_PATTERNS.some(({ pattern, ignoreNegation }) => {
    const match = pattern.exec(clause)
    if (!match) return false
    return ignoreNegation || !NEGATION_AT_END.test(clause.slice(0, match.index))
  }))
}

const isGenericPainOnly = (symptoms) => {
  const text = normalize(symptoms).replace(/\s+(?:(?:thi|toi) )?(?:(?:nen|can) )?(?:kham(?: gi| khoa nao| dich vu nao)?|di kham o dau)$/, '')
  return /^(?:(?:toi|minh) )?(?:dang )?(?:bi )?dau (?:tai|chan|tay|dau|bung|lung|co|vai|goi|khop|hong|nguc)(?: (?:(?:rat )?(?:nhe|hoi)(?: thoi)?|hoi nhe|mot chut|thoi))?$/.test(text)
}

const isInsufficientSymptomDetail = (symptoms) => {
  const text = normalize(symptoms)
  if (/\b(?:khong biet minh bi gi|khong biet bi benh gi|khong ro minh bi gi|cam thay trong nguoi khong khoe|trong nguoi khong khoe)\b/.test(text)
    || /^(?:(?:toi|minh) )?khong khoe$/.test(text)) return true
  return isGenericPainOnly(text)
}

const isMedicationRequest = (symptoms) => {
  const text = normalize(symptoms)
  return (
    /\b(thuoc nao|uống gi|uong gi|nen uong|lieu thuoc|ke don|ke thuoc|cho xin thuoc|thuoc tri|thuoc ha sot)\b/.test(
      text
    ) ||
    (text.includes('thuoc') &&
      /\b(het sot|giam sot|chua sot|tri sot)\b/.test(text))
  )
}

const isVagueSkinConcern = (symptoms) => {
  const text = normalize(symptoms)
  return (
    /\b(da mat|da cua toi|mat cua toi)\b/.test(text) &&
    /\b(xau|khong dep|khong on|co van de)\b/.test(text) &&
    !/\b(ngua|mun|noi ban|phat ban|do|sung|dau|rat|bong|kho|loet|mun trung ca)\b/.test(
      text
    )
  )
}

const emergencyResult = () => ({
  predicted_specialty: null,
  specialty_id: null,
  assessment_status: 'EMERGENCY',
  recommendation_source: 'RULE_BASED',
  urgency_level: 'EMERGENCY',
  urgency_text:
    'Dấu hiệu có thể cần cấp cứu. Hãy gọi 115 hoặc đến cơ sở cấp cứu gần nhất ngay.',
  initial_advice:
    'Không chờ tư vấn trực tuyến và không tiếp tục đặt lịch thông thường. Gọi 115 hoặc nhờ người đưa đến cơ sở cấp cứu gần nhất ngay.',
  follow_up_questions: [],
  booking_allowed: false,
  disclaimer: DISCLAIMER
})

const noSpecialtyResult = ({
  initialAdvice,
  questions = [],
  specialty = null,
  assessmentStatus = specialty ? 'CLARIFY' : 'NEEDS_INFORMATION',
  urgencyText = 'Chưa đủ thông tin để gợi ý chuyên khoa phù hợp.'
} = {}) => ({
  predicted_specialty: specialty?.name || null,
  specialty_id: specialty ? Number(specialty.id) : null,
  assessment_status: assessmentStatus,
  recommendation_source: 'RULE_BASED',
  urgency_level: null,
  urgency_text: urgencyText,
  initial_advice:
    initialAdvice ||
    'Bạn có thể mô tả rõ vị trí, biểu hiện và thời điểm bắt đầu để tôi giúp định hướng phù hợp hơn.',
  follow_up_questions: questions.slice(0, 3),
  booking_allowed: false,
  disclaimer: DISCLAIMER
})

// Fallback groups and their order are defined by the project SRS/HLD.
const RULE_GROUPS = [
  {
    keys: ['rang', 'nhuc rang', 'rang e buot'],
    terms: ['rang ham mat', 'nha khoa', 'rang']
  },
  {
    keys: ['tim', 'nguc', 'kho tho', 'huyet ap', 'hoi hop'],
    terms: ['tim mach', 'tim']
  },
  { keys: ['da', 'ngua', 'di ung', 'man do', 'mun'], terms: ['da lieu', 'da'] },
  {
    keys: ['tai', 'mui', 'hong', 'xoang', 'so mui'],
    terms: ['tai mui hong', 'tai mui']
  },
  { keys: ['mat', 'thi luc', 'nhin mo'], terms: ['mat', 'nhan khoa'] },
  {
    keys: ['xuong', 'khop', 'lung', 'co bap'],
    terms: ['co xuong khop', 'xuong khop']
  },
  { keys: ['tre em', 'be ', 'nhi', 'con tôi'], terms: ['nhi khoa', 'nhi'] }
]

const classifyByRules = (symptoms, specialties) => {
  const text = normalize(symptoms)
  if (isMedicationRequest(text)) {
    return noSpecialtyResult({
      urgencyText: 'Trợ lý không kê thuốc hoặc liều dùng.',
      initialAdvice:
        'Tôi không thể đề xuất thuốc hạ sốt. Bạn có thể mô tả thêm các triệu chứng để được định hướng nơi khám, hoặc hỏi nhân viên y tế.',
      questions: [
        'Bạn đang gặp thêm dấu hiệu nào ngoài sốt?',
        'Tình trạng bắt đầu từ khi nào?'
      ]
    })
  }
  if (isVagueSkinConcern(text)) {
    return noSpecialtyResult({
      urgencyText: 'Mô tả hiện chưa đủ cụ thể để chọn chuyên khoa.',
      initialAdvice:
        'Bạn đang lo về dấu hiệu nào ở da mặt? Mô tả cụ thể hơn sẽ giúp định hướng phù hợp.',
      questions: [
        'Bạn thấy biểu hiện gì cụ thể, chẳng hạn ngứa, nổi mụn hay đỏ da?',
        'Biểu hiện bắt đầu từ khi nào?'
      ]
    })
  }
  if (isInsufficientSymptomDetail(text)) {
    let preliminarySpecialty = null
    for (const group of RULE_GROUPS) {
      if (group.keys.some((key) => matchesRuleKeyword(text, key))) {
        preliminarySpecialty = findSpecialtyByTerms(specialties, group.terms)
        if (preliminarySpecialty) break
      }
    }
    return noSpecialtyResult({
      specialty: preliminarySpecialty,
      assessmentStatus: isGenericPainOnly(text) ? 'CLARIFY' : 'NEEDS_INFORMATION',
      urgencyText: 'Chưa đủ thông tin để đánh giá mức độ cần chú ý.',
      initialAdvice: 'Mô tả hiện tại chưa đủ chi tiết để xác định mức độ cần chú ý. Hãy bổ sung thông tin để được định hướng phù hợp hơn.',
      questions: [
        'Triệu chứng ở vị trí nào và bắt đầu từ khi nào?',
        'Mức độ ra sao, có tăng lên hoặc ảnh hưởng sinh hoạt không?',
        'Bạn có dấu hiệu nào khác đi kèm không?'
      ]
    })
  }
  let selected = null
  for (const group of RULE_GROUPS) {
    if (!group.keys.some((key) => matchesRuleKeyword(text, key))) continue
    selected = findSpecialtyByTerms(specialties, group.terms)
    if (selected) break
  }
  if (!selected) {
    return noSpecialtyResult({
      initialAdvice:
        'Chưa tìm được chuyên khoa phù hợp từ mô tả này. Bạn có thể bổ sung triệu chứng cụ thể hoặc liên hệ nhân viên y tế.',
      questions: [
        'Bạn đang gặp biểu hiện gì cụ thể và ở vị trí nào?',
        'Tình trạng bắt đầu từ khi nào?'
      ]
    })
  }
  return {
    predicted_specialty: selected?.name || null,
    specialty_id: selected ? Number(selected.id) : null,
    assessment_status: 'ASSESSED',
    recommendation_source: 'RULE_BASED',
    urgency_level: 'ROUTINE',
    urgency_text:
      'Có thể trao đổi với chuyên khoa này; nhân viên y tế sẽ đánh giá trực tiếp.',
    initial_advice: `Mô tả của bạn có thể phù hợp để được tư vấn tại chuyên khoa ${selected.name}.`,
    follow_up_questions: [],
    booking_allowed: true,
    disclaimer: DISCLAIMER
  }
}

const isValidContract = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value).sort()
  const expectedKeys = RESPONSE_SCHEMA.required.slice().sort()
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  )
    return false
  return (
    (typeof value.predicted_specialty === 'string' ||
      value.predicted_specialty === null) &&
    (Number.isInteger(value.specialty_id) || value.specialty_id === null) &&
    ['AI', 'RULE_BASED'].includes(value.recommendation_source) &&
    (value.urgency_level === null || ['ROUTINE', 'URGENT', 'EMERGENCY'].includes(value.urgency_level)) &&
    ['urgency_text', 'initial_advice', 'disclaimer'].every(
      (key) => typeof value[key] === 'string'
    ) &&
    Array.isArray(value.follow_up_questions) &&
    value.follow_up_questions.length <= 3 &&
    value.follow_up_questions.every((item) => typeof item === 'string') &&
    typeof value.booking_allowed === 'boolean'
  )
}

const extractResponseText = (body) => {
  if (typeof body?.output_text === 'string') return body.output_text
  const parts = []
  for (const item of body?.output || []) {
    if (item.type !== 'message') continue
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string')
        parts.push(content.text)
    }
  }
  return parts.join('')
}

const requestOpenAI = async ({
  symptoms,
  specialties,
  fetchImpl = globalThis.fetch,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
  baseUrl = process.env.OPENAI_BASE_URL,
  timeoutMs = 12000
}) => {
  if (!apiKey || !model || !baseUrl || typeof fetchImpl !== 'function')
    throw new Error('OPENAI_UNAVAILABLE')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(
      `${String(baseUrl).replace(/\/+$/, '')}/responses`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'system',
              content:
                'Bạn chỉ hỗ trợ định hướng chuyên khoa dựa trên triệu chứng/lý do khám. Nếu người dùng hỏi việc ngoài phạm vi, lịch khám, lịch trống, hóa đơn hoặc thanh toán, không giả vờ tra cứu; trả specialty và ID là null, hỏi người dùng mô tả triệu chứng hoặc hướng họ đến trang chức năng phù hợp nếu được chỉ dẫn. Không chẩn đoán, không nêu bệnh có thể mắc, không kê đơn hoặc liều thuốc. Chỉ chọn specialty đang hoạt động trong danh sách; điền đúng ID. Không yêu cầu tuổi, giới tính hay thông tin định danh trừ khi thật sự cần cho việc định hướng an toàn. Nếu thiếu thông tin cần thiết, urgency_level phải là null, booking_allowed phải false và đặt tối đa 3 câu hỏi cụ thể; không suy ra ROUTINE chỉ vì chưa nhận diện dấu hiệu cấp cứu. Có thể nêu specialty sơ bộ nếu có căn cứ, nhưng không đồng nghĩa được đặt lịch. follow_up_questions cũng có thể gồm câu hỏi bổ sung không bắt buộc; nếu mô tả đã đủ căn cứ, vẫn đặt booking_allowed=true và không hạ kết quả chỉ vì có câu hỏi phụ. Khi không phù hợp danh mục, specialty và ID phải là null. Trả lời ngắn gọn, lịch sự bằng tiếng Việt. EMERGENCY chỉ dùng cho dấu hiệu cấp cứu rõ; booking_allowed chỉ true khi đủ thông tin cần thiết, có chuyên khoa đang hoạt động được xác định và không phải cấp cứu. Nếu đầu vào gồm mô tả ban đầu, câu hỏi làm rõ trước đó và thông tin người dùng bổ sung, hãy đọc chúng như cùng một vấn đề sức khỏe; ghép từng câu trả lời với câu hỏi tương ứng, giữ lại các dữ kiện đã nêu và không hỏi lại thông tin đã được trả lời. Chỉ hỏi phần còn thiếu để định hướng an toàn, không tự suy ra dữ kiện chưa được cung cấp.'
            },
            {
              role: 'user',
              content: JSON.stringify({
                symptoms,
                active_specialties: specialties.map(({ id, name }) => ({
                  id: Number(id),
                  name
                }))
              })
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'symptom_triage',
              strict: true,
              schema: RESPONSE_SCHEMA
            }
          },
          max_output_tokens: 900
        })
      }
    )
    if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`)
    const body = await response.json()
    const raw = extractResponseText(body)
    if (!raw) throw new Error('OPENAI_EMPTY_RESPONSE')
    return JSON.parse(raw)
  } finally {
    clearTimeout(timeout)
  }
}

const validateAndNormalizeAIResult = (candidate, specialties) => {
  if (!isValidContract(candidate)) return null
  if (candidate.urgency_level === 'EMERGENCY') return emergencyResult()
  const name = candidate.predicted_specialty?.trim() || null
  const questions = candidate.follow_up_questions
    .map((question) => question.trim())
    .filter(Boolean)
    .slice(0, 3)
  const needsClarification = candidate.booking_allowed !== true || candidate.urgency_level === null
  if (name === null) {
    if (candidate.specialty_id !== null) return null
    const questions = candidate.follow_up_questions
      .map((question) => question.trim())
      .filter(Boolean)
      .slice(0, 3)
    return {
      ...candidate,
      predicted_specialty: null,
      specialty_id: null,
      assessment_status: 'NEEDS_INFORMATION',
      recommendation_source: 'AI',
      urgency_level: candidate.urgency_level === 'ROUTINE' ? null : candidate.urgency_level,
      urgency_text: candidate.urgency_level === 'ROUTINE'
        ? 'Chưa đủ thông tin để đánh giá mức độ cần chú ý.'
        : candidate.urgency_text.slice(0, 300),
      booking_allowed: false,
      initial_advice:
        candidate.initial_advice.slice(0, 1000) ||
        'Bạn có thể mô tả rõ hơn để được định hướng phù hợp.',
      follow_up_questions: questions.length
        ? questions
        : ['Bạn đang gặp biểu hiện gì cụ thể và ở vị trí nào?'],
      disclaimer: DISCLAIMER
    }
  }

  const active = specialties.find(
    (item) => normalize(item.name) === normalize(name)
  )
  if (
    !active ||
    !Number.isInteger(Number(active.id)) ||
    candidate.specialty_id !== Number(active.id)
  )
    return null
  return {
    ...candidate,
    predicted_specialty: active.name,
    specialty_id: Number(active.id),
    assessment_status: needsClarification ? 'CLARIFY' : 'ASSESSED',
    recommendation_source: 'AI',
    urgency_level: needsClarification && candidate.urgency_level === 'ROUTINE'
      ? null
      : candidate.urgency_level,
    booking_allowed: candidate.booking_allowed === true && !needsClarification && candidate.urgency_level !== 'EMERGENCY',
    urgency_text:
      candidate.urgency_level === 'EMERGENCY'
        ? emergencyResult().urgency_text
        : needsClarification && candidate.urgency_level === 'ROUTINE'
          ? 'Chưa đủ thông tin để đánh giá mức độ cần chú ý.'
        : candidate.urgency_text.slice(0, 300),
    initial_advice:
      candidate.urgency_level === 'EMERGENCY'
        ? emergencyResult().initial_advice
        : candidate.initial_advice.slice(0, 1000),
    follow_up_questions: (questions.length
      ? questions
      : needsClarification
        ? ['Bạn có thể mô tả rõ hơn vị trí, thời điểm bắt đầu và dấu hiệu đi kèm không?']
        : []).map((question) => question.slice(0, 240)),
    disclaimer: DISCLAIMER
  }
}

const getFallbackReason = (error) => {
  if (error?.name === 'AbortError') return 'timeout'
  if (error?.message === 'OPENAI_UNAVAILABLE') return 'configuration_missing'
  if (error instanceof SyntaxError) return 'invalid_json'
  const status = String(error?.message || '').match(
    /^OPENAI_HTTP_(\d{3})$/
  )?.[1]
  if (status) return `provider_http_${status}`
  return 'provider_error'
}

const createSymptomClassifier =
  ({ provider = requestOpenAI, logger = console } = {}) =>
  async (symptoms, specialties) => {
    const text = String(symptoms || '').trim()
    if (!text || text.length > MAX_SYMPTOM_LENGTH)
      throw new Error('INVALID_SYMPTOMS')
    if (isEmergency(text)) return emergencyResult()
    if (isInsufficientSymptomDetail(text))
      return classifyByRules(text, Array.isArray(specialties) ? specialties : [])
    if (isMedicationRequest(text) || isVagueSkinConcern(text))
      return classifyByRules(
        text,
        Array.isArray(specialties) ? specialties : []
      )
    if (!Array.isArray(specialties) || specialties.length === 0)
      return classifyByRules(text, [])

    try {
      const candidate = await provider({ symptoms: text, specialties })
      const normalized = validateAndNormalizeAIResult(candidate, specialties)
      if (normalized) return normalized
      logger.warn?.('[AI] Rule guidance used: invalid_contract.')
      return classifyByRules(text, specialties)
    } catch (error) {
      // Only log a fixed reason code. Never log the symptom, provider body, credentials, or raw error.
      logger.warn?.(`[AI] Rule guidance used: ${getFallbackReason(error)}.`)
      return classifyByRules(text, specialties)
    }
  }

const classifySymptomWithAI = createSymptomClassifier()

module.exports = {
  MAX_SYMPTOM_LENGTH,
  RESPONSE_SCHEMA,
  classifyByRules,
  createSymptomClassifier,
  classifySymptomWithAI,
  isEmergency,
  isInsufficientSymptomDetail,
  isMedicationRequest,
  isVagueSkinConcern,
  emergencyResult,
  isValidContract,
  requestOpenAI
}
