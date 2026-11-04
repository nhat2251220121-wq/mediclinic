const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyByRules,
  createSymptomClassifier,
  emergencyResult,
  isEmergency,
  isValidContract,
  requestOpenAI
} = require('../src/config/ai');
const { createAIController } = require('../src/controllers/aiController');
const { createAIRouter } = require('../src/routes/aiRoutes');

const specialties = [
  { id: 4, name: 'Tim mạch' },
  { id: 9, name: 'Da liễu' },
  { id: 12, name: 'Nội tổng quát' }
];
const makeCandidate = (overrides = {}) => ({
  predicted_specialty: 'Da liễu',
  specialty_id: 9,
  recommendation_source: 'AI',
  urgency_level: 'ROUTINE',
  urgency_text: 'Có thể đặt lịch khám phù hợp.',
  initial_advice: 'Bạn có thể chọn dịch vụ trong chuyên khoa được gợi ý.',
  follow_up_questions: ['Triệu chứng bắt đầu từ khi nào?'],
  booking_allowed: true,
  disclaimer: 'Chỉ mang tính tham khảo.',
  ...overrides
});

test('chấp nhận đầu ra đủ schema, chỉ giữ chuyên khoa hoạt động và chuẩn hóa source', async () => {
  const classifier = createSymptomClassifier({ provider: async () => makeCandidate(), logger: {} });
  const result = await classifier('Da bị ngứa', specialties);
  assert.deepEqual(Object.keys(result).sort(), [
    'booking_allowed', 'disclaimer', 'follow_up_questions', 'initial_advice',
    'predicted_specialty', 'recommendation_source', 'specialty_id', 'urgency_level', 'urgency_text'
  ].sort());
  assert.equal(result.recommendation_source, 'AI');
  assert.equal(result.specialty_id, 9);
  assert.equal(result.predicted_specialty, 'Da liễu');
  assert.equal(result.follow_up_questions.length, 1);
});

test('đầu ra thiếu trường, thêm trường hoặc câu hỏi quá 3 bị fallback', async () => {
  for (const invalid of [
    (() => { const { initial_advice, ...rest } = makeCandidate(); return rest; })(),
    makeCandidate({ possible_conditions: ['x'] }),
    makeCandidate({ follow_up_questions: ['1', '2', '3', '4'] })
  ]) {
    const result = await createSymptomClassifier({ provider: async () => invalid, logger: {} })('ngứa da', specialties);
    assert.equal(result.recommendation_source, 'RULE_BASED');
  }
  assert.equal(isValidContract(makeCandidate()), true);
});

test('từ chối ID không tồn tại, chuyên khoa không hoạt động hoặc ID lệch tên', async () => {
  for (const candidate of [
    makeCandidate({ specialty_id: 999 }),
    makeCandidate({ predicted_specialty: 'Khoa đã ngừng', specialty_id: 33 }),
    makeCandidate({ predicted_specialty: 'Tim mạch', specialty_id: 9 })
  ]) {
    const result = await createSymptomClassifier({ provider: async () => candidate, logger: {} })('mô tả triệu chứng', specialties);
    assert.equal(result.recommendation_source, 'RULE_BASED');
    assert.ok(specialties.some((item) => item.id === result.specialty_id) || result.specialty_id === null);
  }
});

test('nhận diện dấu hiệu cấp cứu trước provider và cấm đặt lịch', async () => {
  for (const phrase of ['đau ngực dữ dội', 'khó thở nặng, tím tái', 'không thở được', 'co giật', 'bất tỉnh', 'dấu hiệu đột quỵ, méo miệng', 'liệt nửa người', 'chảy máu nhiều không cầm', 'chảy máu ồ ạt']) {
    assert.equal(isEmergency(phrase), true, phrase);
  }
  let called = false;
  const result = await createSymptomClassifier({ provider: async () => { called = true; }, logger: {} })('Tôi bị đau ngực dữ dội', specialties);
  assert.equal(called, false);
  assert.deepEqual(result, emergencyResult());
  assert.equal(result.urgency_level, 'EMERGENCY');
  assert.equal(result.booking_allowed, false);
  assert.equal(result.recommendation_source, 'RULE_BASED');
  const { isSymptomBookingAllowed } = await import('../../Frontend/src/utils/symptomAssistant.mjs');
  assert.equal(isSymptomBookingAllowed(result), false);
  assert.equal(isSymptomBookingAllowed({ urgency_level: 'ROUTINE', booking_allowed: true, predicted_specialty: null, specialty_id: null }), false);
  assert.equal(isSymptomBookingAllowed({ urgency_level: 'URGENT', booking_allowed: false }), false);
});

test('không tìm được chuyên khoa thì không tự gán ID hoặc mở nút đặt lịch', async () => {
  const available = specialties.filter((specialty) => specialty.id !== 12);
  const result = classifyByRules('đau răng', available);
  assert.equal(result.specialty_id, null);
  assert.equal(result.predicted_specialty, null);
  assert.equal(result.booking_allowed, false);
  assert.ok(result.follow_up_questions.length > 0);
  assert.doesNotMatch(result.initial_advice, /Nội tổng quát/);
  const modelNoMatch = await createSymptomClassifier({ provider: async () => makeCandidate({ predicted_specialty: null, specialty_id: null }), logger: {} })('đau răng', available);
  assert.equal(modelNoMatch.recommendation_source, 'AI');
  assert.equal(modelNoMatch.specialty_id, null);
  assert.equal(modelNoMatch.booking_allowed, false);
  let providerCalled = false;
  const noActiveSpecialties = await createSymptomClassifier({ provider: async () => { providerCalled = true; }, logger: {} })('mô tả bất kỳ', []);
  assert.equal(providerCalled, false);
  assert.equal(noActiveSpecialties.specialty_id, null);
  assert.equal(noActiveSpecialties.booking_allowed, false);
});

test('no-specialty AI answer is retained with its clarifying questions', async () => {
  const candidate = makeCandidate({ predicted_specialty: null, specialty_id: null, follow_up_questions: ['Biểu hiện cụ thể là gì?', 'Bắt đầu từ khi nào?'], booking_allowed: false });
  const aiNoMatch = await createSymptomClassifier({ provider: async () => candidate, logger: {} })('Mô tả triệu chứng không thuộc danh sách', specialties);
  assert.equal(aiNoMatch.recommendation_source, 'AI');
  assert.equal(aiNoMatch.specialty_id, null);
  assert.equal(aiNoMatch.booking_allowed, false);
  assert.equal(aiNoMatch.follow_up_questions.length, 2);
});

test('fever medication request is not prescribed and vague skin concern asks for details', async () => {
  let providerCalled = false;
  const classifier = createSymptomClassifier({ provider: async () => { providerCalled = true; return makeCandidate(); }, logger: {} });
  const fever = await classifier('Có thuốc nào uống hết sốt không?', specialties);
  assert.equal(fever.specialty_id, null);
  assert.equal(fever.booking_allowed, false);
  assert.match(fever.initial_advice, /không thể đề xuất thuốc/i);
  assert.doesNotMatch(JSON.stringify(fever), /\b\d+\s*(mg|viên)\b|liều\s+\d/i);

  const skin = await classifier('Da mặt của tôi bị xấu nên cần đi khám khoa nào?', specialties);
  assert.equal(skin.specialty_id, null);
  assert.equal(skin.booking_allowed, false);
  assert.ok(skin.follow_up_questions.length > 0 && skin.follow_up_questions.length <= 3);
  assert.equal(providerCalled, false);
});

test('Răng Hàm Mặt chỉ được gợi ý nếu chuyên khoa đang hoạt động', () => {
  const active = [...specialties, { id: 21, name: 'Răng Hàm Mặt' }];
  const result = classifyByRules('Tôi bị đau răng ê buốt, nên khám gì?', active);
  assert.equal(result.specialty_id, 21);
  assert.equal(result.predicted_specialty, 'Răng Hàm Mặt');
  assert.equal(result.booking_allowed, true);

  const unavailable = classifyByRules('Tôi bị đau răng ê buốt, nên khám gì?', specialties);
  assert.equal(unavailable.specialty_id, null);
  assert.equal(unavailable.booking_allowed, false);
});

test('assistant routes appointment questions to existing pages without inventing lookup results', async () => {
  const { getAssistantNavigationIntent, formatSymptomReply, isSymptomBookingAllowed } = await import('../../Frontend/src/utils/symptomAssistant.mjs');
  const availability = getAssistantNavigationIntent('Bác sĩ hôm nay có ca khám nào trống?', true);
  assert.equal(availability.kind, 'availability');
  assert.equal(availability.action.link, '/patient/booking');
  assert.match(availability.message, /chưa tra cứu khung giờ cụ thể/);

  const guestHistory = getAssistantNavigationIntent('Ngày mai tôi có lịch khám không?', false);
  assert.equal(guestHistory.action.link, '/login');
  const patientHistory = getAssistantNavigationIntent('Ngày mai tôi có lịch khám không?', true);
  assert.equal(patientHistory.action.link, '/patient/history');

  const emergency = emergencyResult();
  assert.equal(isSymptomBookingAllowed(emergency), false);
  assert.equal(isSymptomBookingAllowed({ booking_allowed: true, urgency_level: 'ROUTINE', predicted_specialty: null, specialty_id: null }), false);
  const reply = formatSymptomReply(emergency);
  assert.doesNotMatch(reply, /EMERGENCY|RULE_BASED|AI|fallback/);
  assert.match(reply, /115/);
});

test('lỗi provider, timeout và JSON lỗi đều dùng fallback mà không log triệu chứng', async () => {
  const warnings = [];
  for (const error of [new Error('provider failed'), Object.assign(new Error('timeout'), { name: 'AbortError' }), new SyntaxError('bad JSON')]) {
    const result = await createSymptomClassifier({ provider: async () => { throw error; }, logger: { warn: (...args) => warnings.push(args.join(' ')) } })('da bị ngứa', specialties);
    assert.equal(result.recommendation_source, 'RULE_BASED');
  }
  assert.ok(warnings.every((line) => !line.includes('da bị ngứa')));
  assert.ok(warnings.every((line) => !line.includes('provider failed')));
});

test('chặn mô tả rỗng hoặc quá 2.000 ký tự trước provider', async () => {
  let called = false;
  const classifier = createSymptomClassifier({ provider: async () => { called = true; }, logger: {} });
  await assert.rejects(() => classifier('x'.repeat(2001), specialties), /INVALID_SYMPTOMS/);
  await assert.rejects(() => classifier('   ', specialties), /INVALID_SYMPTOMS/);
  assert.equal(called, false);
});

test('Responses API request dùng model/config và JSON Schema; không cần gọi OpenAI thật', async () => {
  let captured;
  const result = makeCandidate();
  const response = await requestOpenAI({
    symptoms: 'ngứa da', specialties, apiKey: 'test-only-key', model: 'test-selected-model', baseUrl: 'https://provider.example/v1',
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }) };
    }
  });
  assert.equal(captured.url, 'https://provider.example/v1/responses');
  assert.equal(captured.body.model, 'test-selected-model');
  assert.equal(captured.body.text.format.type, 'json_schema');
  assert.equal(captured.body.text.format.strict, true);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-only-key');
  assert.deepEqual(response, result);
});

test('public guest API accepts symptom and existing per-IP quota is enforced', async () => {
  const db = { query: async () => [specialties] };
  const controller = createAIController({ db, classify: async () => makeCandidate() });
  const router = createAIRouter(controller);
  const route = router.stack.find((layer) => layer.route?.path === '/classify-symptom')?.route;
  assert.ok(route?.methods?.post);
  assert.equal(route.stack.length, 2, 'public route retains rate limiter and controller, without auth middleware');
  const [limiter, handler] = route.stack.map((layer) => layer.handle);
  let statusCode;
  let payload;
  const response = { set() { return this; }, status(code) { statusCode = code; return this; }, json(body) { payload = body; return this; } };
  for (let index = 0; index < 10; index += 1) {
    statusCode = null;
    payload = null;
    let passed = false;
    const req = { baseUrl: '/api/ai', path: '/classify-symptom', ip: 'test-ai-guest', socket: { remoteAddress: 'test-ai-guest' }, body: { symptoms: 'mô tả triệu chứng' } };
    let completion;
    limiter(req, response, () => { passed = true; completion = handler(req, response, (error) => { throw error; }); });
    if (completion) await completion;
    assert.equal(passed, true);
    assert.equal(statusCode, 200);
    assert.equal(payload.data.specialty_id, 9);
    assert.equal(payload.data.possible_conditions, undefined);
  }
  statusCode = null;
  limiter({ baseUrl: '/api/ai', path: '/classify-symptom', ip: 'test-ai-guest', socket: { remoteAddress: 'test-ai-guest' }, body: {} }, response, () => assert.fail('quota should stop request'));
  assert.equal(statusCode, 429);
});

test('controller rejects guest payload missing symptoms or over limit before DB read', async () => {
  let dbCalled = false;
  const controller = createAIController({ db: { query: async () => { dbCalled = true; return [[]]; } } });
  const run = async (body) => {
    const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await controller.classifySymptom({ body }, response, (error) => { throw error; });
    return response;
  };
  assert.equal((await run({})).statusCode, 400);
  assert.equal((await run({ symptoms: ' '.repeat(2) })).statusCode, 400);
  assert.equal((await run({ symptoms: 'x'.repeat(2001) })).statusCode, 400);
  assert.equal(dbCalled, false);
});

test('controller accepts the 2,000-character boundary', async () => {
  const controller = createAIController({
    db: { query: async () => [specialties] },
    classify: async (symptom) => { assert.equal(symptom.length, 2000); return makeCandidate(); }
  });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.classifySymptom({ body: { symptoms: 'a'.repeat(2000) } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
});

test('controller returns emergency before database or provider work', async () => {
  let dbCalled = false;
  let providerCalled = false;
  const controller = createAIController({
    db: { query: async () => { dbCalled = true; throw new Error('DB should not be needed'); } },
    classify: async () => { providerCalled = true; throw new Error('provider should not be called'); }
  });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.classifySymptom({ body: { symptoms: 'Tôi đang khó thở nặng' } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.urgency_level, 'EMERGENCY');
  assert.equal(response.body.data.booking_allowed, false);
  assert.equal(dbCalled, false);
  assert.equal(providerCalled, false);
});

test('classification reads only active specialty catalog and never persists/logs symptom text', async () => {
  const symptom = 'triệu chứng riêng để kiểm tra không lưu';
  const queries = [];
  const logged = [];
  const controller = createAIController({
    db: { query: async (sql, params) => { queries.push({ sql, params }); return [specialties]; } },
    classify: createSymptomClassifier({ provider: async () => { throw new Error('offline'); }, logger: { warn: (...args) => logged.push(args) } })
  });
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.classifySymptom({ body: { symptoms: symptom } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /^SELECT id, name FROM specialties WHERE is_active = TRUE/);
  assert.equal(JSON.stringify(queries).includes(symptom), false);
  assert.equal(JSON.stringify(logged).includes(symptom), false);
  assert.equal(logged[0][0].includes(symptom), false);
});
