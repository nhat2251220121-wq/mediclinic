const { pool } = require('../config/db');
const { isEmergency, isVagueSkinConcern } = require('../config/ai');

const MAX_QUESTION_LENGTH = 2000;
const SEARCH_STOP_WORDS = new Set([
  'toi', 'minh', 'bi', 'thi', 'la', 'gi', 'nao', 'cho', 'hoi', 'muon', 'can', 'nen',
  'kham', 'dich', 'vu', 'gia', 'bao', 'nhieu', 'chi', 'phi', 'tien', 'co', 'the', 'duoc',
  'o', 'tai', 'khong', 'va', 'voi', 'mot', 'nay', 'do', 've', 'sao',
  'danh', 'sach', 'liet', 'ke', 'cac', 'tat', 'ca', 'phu', 'hop', 'xem'
]);
const normalize = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase();
const normalizePhrase = (value) => normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
const containsPhrase = (text, phrase) => {
  const normalizedText = normalizePhrase(text);
  const normalizedPhrase = normalizePhrase(phrase);
  return Boolean(normalizedPhrase) && ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
};

const tokenize = (value) => [...new Set(normalize(value).match(/[a-z0-9]+/g) || [])]
  .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
const isUnlocalizedPainQuestion = (question) => {
  const tokens = tokenize(question);
  return tokens.length === 1 && tokens[0] === 'dau';
};

const requestedServiceList = (question) => {
  const text = normalize(question);
  return ['danh sach', 'liet ke', 'tat ca', 'cac dich vu'].some((phrase) => text.includes(phrase));
};

const SERVICE_SELECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    service_id: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    clarification_required: { type: 'boolean' }
  },
  required: ['service_id', 'clarification_required']
};

const extractResponseText = (body) => {
  if (typeof body?.output_text === 'string') return body.output_text;
  for (const item of body?.output || []) {
    if (item.type !== 'message') continue;
    const content = item.content?.find((part) => part.type === 'output_text' && typeof part.text === 'string');
    if (content) return content.text;
  }
  return '';
};

const requestServiceSelection = async ({
  question,
  candidates,
  specialtyHint = null,
  fetchImpl = globalThis.fetch,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
  baseUrl = process.env.OPENAI_BASE_URL,
  timeoutMs = 10000
}) => {
  if (!apiKey || !model || !baseUrl || typeof fetchImpl !== 'function') throw new Error('SERVICE_SELECTOR_UNAVAILABLE');
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
            content: 'Bạn chỉ chọn dịch vụ phù hợp nhất từ toàn bộ danh sách dịch vụ đang hoạt động do hệ thống cung cấp. Dựa trên câu hỏi, tên, mô tả, chuyên khoa và search_keywords do phòng khám quản lý. Gợi ý chuyên khoa (nếu có) chỉ là thông tin hỗ trợ xếp hạng, tuyệt đối không loại ứng viên thuộc chuyên khoa khác. Từ khóa chỉ giúp định hướng tới dịch vụ khám, không chứng minh phòng khám có xét nghiệm, nội soi, siêu âm, điều trị hay kỹ thuật riêng; chỉ xác nhận kỹ thuật nếu tên hoặc mô tả dịch vụ nêu rõ. Nếu khách nói về trẻ em thì ưu tiên dịch vụ nhi khoa khi phù hợp; nếu đối tượng hoặc nhu cầu chưa rõ thì trả null và yêu cầu làm rõ. Chỉ trả service_id đúng bằng một ID trong danh sách hoặc null. Không tự tạo, sửa tên dịch vụ, chuyên khoa hay dữ liệu. Nếu không đủ căn cứ hoặc có nhiều dịch vụ ngang mức phù hợp, trả service_id null và clarification_required true. Không chẩn đoán, không nêu bệnh có thể mắc, không kê thuốc hoặc liều. Không suy diễn bác sĩ, giá, ảnh hay liên hệ.'
          },
          { role: 'user', content: JSON.stringify({ question, specialty_hint: specialtyHint, active_services: candidates }) }
        ],
        text: { format: { type: 'json_schema', name: 'service_selection', strict: true, schema: SERVICE_SELECTION_SCHEMA } },
        max_output_tokens: 180
      })
    });
    if (!response.ok) throw new Error(`SERVICE_SELECTOR_HTTP_${response.status}`);
    const body = await response.json();
    const raw = extractResponseText(body);
    if (!raw) throw new Error('SERVICE_SELECTOR_EMPTY_RESPONSE');
    return JSON.parse(raw);
  } finally {
    clearTimeout(timeout);
  }
};

const isValidServiceSelection = (selection, candidateIds) => Boolean(
  selection
  && typeof selection === 'object'
  && !Array.isArray(selection)
  && Object.keys(selection).length === 2
  && Object.prototype.hasOwnProperty.call(selection, 'service_id')
  && Object.prototype.hasOwnProperty.call(selection, 'clarification_required')
  && (selection.service_id === null || (Number.isInteger(selection.service_id) && candidateIds.has(selection.service_id)))
  && typeof selection.clarification_required === 'boolean'
);

const findMatchingServices = (question, services, specialtyId = null) => {
  const queryTokens = tokenize(question);
  if (!queryTokens.length) return { matches: [], clarificationRequired: requestedServiceList(question) };
  const scored = services.map((service) => {
    const scoreField = (value, weight) => tokenize(value).reduce(
      (total, token) => total + (queryTokens.includes(token) ? weight : 0), 0
    );
    const exactConfiguredKeyword = String(service.search_keywords || '')
      .split(/[,;\n]/)
      .some((phrase) => containsPhrase(question, phrase));
    const score = scoreField(service.name, 6)
      + scoreField(service.specialty_name, 4)
      + scoreField(service.search_keywords, 3)
      + scoreField(service.description, 2)
      + (exactConfiguredKeyword ? 12 : 0)
      + (specialtyId !== null && Number(service.specialty_id) === specialtyId ? 2 : 0);
    const exactCatalogPhrase = [service.name, service.specialty_name, service.search_keywords]
      .some((field) => tokenize(field).length >= 2 && containsPhrase(question, field));
    const searchableTokens = new Set([
      ...tokenize(service.name), ...tokenize(service.specialty_name), ...tokenize(service.description),
      ...tokenize(service.search_keywords)
    ]);
    const matchedCatalogTokenCount = queryTokens.filter((token) => searchableTokens.has(token)).length;
    return { service, score, hasEvidence: exactCatalogPhrase || exactConfiguredKeyword || matchedCatalogTokenCount >= 2 };
  }).filter(({ score, hasEvidence }) => score >= 5 && hasEvidence)
    .sort((a, b) => b.score - a.score || String(a.service.name).localeCompare(String(b.service.name), 'vi'));

  if (!scored.length) return { matches: [], clarificationRequired: false };
  if (scored[1] && scored[0].score - scored[1].score <= 2) {
    return { matches: [], clarificationRequired: true };
  }
  return { matches: [scored[0].service], clarificationRequired: false };
};

const createAIServiceController = ({ db = pool, serviceSelector = requestServiceSelection } = {}) => ({
  serviceAdvice: async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const allowedKeys = ['question', 'specialty_id', 'include_doctors'];
      if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
        return res.status(400).json({ success: false, message: 'Dữ liệu yêu cầu không hợp lệ.' });
      }

      const question = typeof body.question === 'string' ? body.question.trim() : '';
      const specialtyId = body.specialty_id === undefined || body.specialty_id === null || body.specialty_id === ''
        ? null
        : Number(body.specialty_id);
      const includeDoctors = body.include_doctors === true;
      if (!question || !/[\p{L}\p{N}]/u.test(question) || question.length > MAX_QUESTION_LENGTH
        || (specialtyId !== null && (!Number.isInteger(specialtyId) || specialtyId <= 0))
        || (body.include_doctors !== undefined && typeof body.include_doctors !== 'boolean')) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi hợp lệ (tối đa 2.000 ký tự).' });
      }

      if (isEmergency(question)) {
        return res.status(200).json({
          success: true,
          message: 'Dấu hiệu cần được xử lý cấp cứu ngay; không tiếp tục tư vấn dịch vụ hoặc đặt lịch thông thường.',
          data: { status: 'EMERGENCY', booking_allowed: false, services: [], doctors_included: false, emergency: true }
        });
      }
      if (isUnlocalizedPainQuestion(question)) {
        return res.status(200).json({
          success: true,
          message: 'Bạn đau ở vị trí nào và có thể mô tả thêm cảm giác hoặc dấu hiệu đi kèm không? Tôi cần thêm thông tin để gợi ý dịch vụ phù hợp.',
          data: { status: 'CLARIFY', booking_allowed: false, services: [], doctors_included: false, clarification_required: true }
        });
      }
      if (isVagueSkinConcern(question)) {
        return res.status(200).json({
          success: true,
          message: 'Mô tả này chưa đủ rõ để chọn dịch vụ phù hợp. Bạn có thể cho biết vấn đề cụ thể đang gặp không?',
          data: { status: 'CLARIFY', booking_allowed: false, services: [], doctors_included: false, clarification_required: true }
        });
      }
      if (includeDoctors && !req.user) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập bằng tài khoản bệnh nhân để xem bác sĩ phụ trách.' });
      }
      if (includeDoctors && req.user.role !== 'PATIENT') {
        return res.status(403).json({ success: false, message: 'Chỉ tài khoản bệnh nhân được xem thông tin bác sĩ liên quan.' });
      }

      const [catalog] = await db.query(`
        SELECT svc.id, svc.name, svc.price, svc.description, svc.search_keywords, svc.image_url,
               svc.specialty_id, sp.name AS specialty_name
        FROM services svc
        JOIN specialties sp ON sp.id = svc.specialty_id AND sp.is_active = TRUE
        WHERE svc.is_active = TRUE
        ORDER BY svc.name ASC
      `);
      let serviceMatch;
      const specialtyHintService = specialtyId === null
        ? null
        : catalog.find((service) => Number(service.specialty_id) === specialtyId);
      const specialtyHint = specialtyHintService
        ? { specialty_id: specialtyId, specialty_name: specialtyHintService.specialty_name }
        : null;
      if (requestedServiceList(question)) {
        serviceMatch = findMatchingServices(question, catalog, specialtyHint?.specialty_id ?? null);
      } else {
        const candidates = catalog.map((service) => ({
          service_id: Number(service.id),
          name: service.name,
          description: service.description,
          specialty: service.specialty_name,
          search_keywords: service.search_keywords || ''
        }));
        const candidateIds = new Set(candidates.map((candidate) => candidate.service_id));
        try {
          if (!candidates.length) throw new Error('NO_ACTIVE_SERVICE_CANDIDATES');
          const selection = await serviceSelector({ question, candidates, specialtyHint });
          if (!isValidServiceSelection(selection, candidateIds)) throw new Error('INVALID_SERVICE_SELECTION');
          if (selection.clarification_required) {
            serviceMatch = { matches: [], clarificationRequired: true };
          } else if (selection.service_id === null) {
            serviceMatch = { matches: [], clarificationRequired: selection.clarification_required };
          } else {
            serviceMatch = {
              matches: catalog.filter((service) => Number(service.id) === selection.service_id),
              clarificationRequired: false
            };
          }
        } catch {
          serviceMatch = findMatchingServices(question, catalog, specialtyHint?.specialty_id ?? null);
        }
      }
      let matchingServices = serviceMatch.matches;
      if (matchingServices.length) {
        const selectedIds = [...new Set(matchingServices.map((service) => Number(service.id)))];
        const placeholders = selectedIds.map(() => '?').join(', ');
        const [verifiedServices] = await db.query(`
          SELECT svc.id, svc.name, svc.price, svc.description, svc.image_url,
                 svc.specialty_id, sp.name AS specialty_name
          FROM services svc
          JOIN specialties sp ON sp.id = svc.specialty_id AND sp.is_active = TRUE
          WHERE svc.is_active = TRUE AND svc.id IN (${placeholders})
          ORDER BY svc.name ASC
        `, selectedIds);
        const verifiedById = new Map(verifiedServices.map((service) => [Number(service.id), service]));
        matchingServices = selectedIds.map((id) => verifiedById.get(id)).filter(Boolean);
      }
      if (!matchingServices.length) {
        const status = serviceMatch.clarificationRequired ? 'CLARIFY' : 'NOT_FOUND';
        return res.status(200).json({
          success: true,
          message: status === 'CLARIFY'
            ? 'Tôi chưa thể chọn một dịch vụ phù hợp. Bạn có thể mô tả rõ hơn nhu cầu hoặc dấu hiệu đang gặp không?'
            : 'Chưa tìm thấy dịch vụ phù hợp trong danh mục đang hoạt động.',
          data: { status, booking_allowed: false, services: [], doctors_included: false, clarification_required: status === 'CLARIFY' }
        });
      }

      let doctorsBySpecialty = new Map();
      if (includeDoctors) {
        const specialtyIds = [...new Set(matchingServices.map((service) => Number(service.specialty_id)).filter(Number.isInteger))];
        if (specialtyIds.length) {
          const placeholders = specialtyIds.map(() => '?').join(', ');
          const [doctors] = await db.query(`
            SELECT d.id, d.specialty_id, u.full_name, u.phone, u.email, sp.name AS specialty_name,
                   r.name AS room_name, r.location AS room_location
            FROM doctors d
            JOIN users u ON u.id = d.user_id AND u.role = 'DOCTOR' AND u.is_active = TRUE
            JOIN specialties sp ON sp.id = d.specialty_id AND sp.is_active = TRUE
            LEFT JOIN rooms r ON r.id = d.room_id AND r.is_active = TRUE
            WHERE d.is_active = TRUE AND d.specialty_id IN (${placeholders})
            ORDER BY sp.name, u.full_name
          `, specialtyIds);
          for (const doctor of doctors) {
            const key = Number(doctor.specialty_id);
            if (!doctorsBySpecialty.has(key)) doctorsBySpecialty.set(key, []);
            doctorsBySpecialty.get(key).push({
              id: doctor.id,
              full_name: doctor.full_name,
              phone: doctor.phone || null,
              email: doctor.email || null,
              specialty_name: doctor.specialty_name,
              room_name: doctor.room_name,
              room_location: doctor.room_location
            });
          }
        }
      }

      const services = matchingServices.map((service) => ({
        service_id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        image_url: service.image_url,
        specialty: { id: service.specialty_id, name: service.specialty_name },
        price_available: service.price !== null && service.price !== undefined && Number.isFinite(Number(service.price)),
        ...(includeDoctors ? {
          // The schema relates doctors to services through specialties; there is no direct assignment table.
          doctor_relation: 'SPECIALTY',
          doctors: doctorsBySpecialty.get(Number(service.specialty_id)) || [],
          doctor_contact_public: Boolean((doctorsBySpecialty.get(Number(service.specialty_id)) || [])
            .some((doctor) => doctor.phone || doctor.email))
        } : {})
      }));

      return res.status(200).json({
        success: true,
        message: 'Đã tìm thấy dịch vụ phù hợp trong danh mục.',
        data: {
          status: 'MATCHED',
          booking_allowed: services[0].price_available,
          services,
          doctors_included: includeDoctors,
          clarification_required: false
        }
      });
    } catch (error) {
      next(error);
    }
  }
});

module.exports = {
  ...createAIServiceController(),
  createAIServiceController,
  findMatchingServices,
  requestedServiceList,
  isUnlocalizedPainQuestion,
  requestServiceSelection,
  isValidServiceSelection,
  SERVICE_SELECTION_SCHEMA
};
