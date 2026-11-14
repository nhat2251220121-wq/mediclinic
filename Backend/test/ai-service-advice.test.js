const test = require('node:test');
const assert = require('node:assert/strict');
const { createAIServiceController } = require('../src/controllers/aiServiceController');
const { requestServiceSelection, SERVICE_SELECTION_SCHEMA } = require('../src/controllers/aiServiceController');
const { createAIRouter } = require('../src/routes/aiRoutes');
const { createOptionalVerifyToken } = require('../src/middlewares/optionalVerifyToken');

const serviceRows = [
  { id: 7, name: 'Khám răng tổng quát', price: '250000.00', description: 'Khám và tư vấn sức khỏe răng miệng.', image_url: null, specialty_id: 21, specialty_name: 'Răng Hàm Mặt' },
  { id: 8, name: 'Khám da liễu', price: '180000.00', description: 'Khám da và tư vấn.', image_url: null, specialty_id: 9, specialty_name: 'Da liễu' }
];
const doctors = [
  { id: 2, specialty_id: 21, full_name: 'Bác sĩ đang hoạt động', phone: '0900000000', email: 'doctor@example.test', specialty_name: 'Răng Hàm Mặt', room_name: 'Phòng 2', room_location: 'Tầng 1', avatar_url: null, bio: null, experience_years: 5 }
];

const invoke = async (controller, body, user) => {
  const res = {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
  await controller.serviceAdvice({ body, user }, res, (error) => { throw error; });
  return res;
};

const createTestServiceController = (options) => createAIServiceController({
  serviceSelector: async () => { throw new Error('MOCK_PROVIDER_OFFLINE'); },
  ...options
});

test('guest receives only active catalog facts and matching service price, with no doctor identity/contact', async () => {
  const queries = [];
  const controller = createTestServiceController({
    db: { query: async (sql, params) => { queries.push({ sql, params }); return [serviceRows]; } },
    serviceSelector: async () => ({ service_id: 7, clarification_required: false })
  });
  const response = await invoke(controller, { question: 'Tôi đau răng thì khám dịch vụ nào?' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.services.length, 1);
  assert.equal(response.body.data.services[0].service_id, 7);
  assert.equal(response.body.data.services[0].name, 'Khám răng tổng quát');
  assert.equal(response.body.data.services[0].description, serviceRows[0].description);
  assert.equal(response.body.data.services[0].price, '250000.00');
  assert.deepEqual(response.body.data.services[0].specialty, { id: 21, name: 'Răng Hàm Mặt' });
  assert.equal(response.body.data.services[0].image_url, null);
  assert.equal(response.body.data.status, 'MATCHED');
  assert.equal(response.body.data.booking_allowed, true);
  assert.equal('doctors' in response.body.data.services[0], false);
  assert.equal(JSON.stringify(response.body).includes('Bác sĩ đang hoạt động'), false);
  assert.match(queries[0].sql, /svc\.is_active = TRUE/);
  assert.match(queries[0].sql, /sp\.is_active = TRUE/);
});

test('model selects catalog services for varied phrasing without hard-coded service names', async () => {
  const matched = [];
  const controller = createTestServiceController({ db: { query: async (_sql, params) => {
    matched.push(params);
    return [serviceRows];
  } }, serviceSelector: async () => ({ service_id: 7, clarification_required: false }) });
  for (const question of ['Tôi bị đau răng', 'Răng ê buốt thì khám dịch vụ nào?']) {
    const response = await invoke(controller, { question });
    assert.equal(response.body.data.services[0].service_id, 7);
  }
  assert.equal(matched.length, 4, 'each request reads the catalog and verifies the chosen active service; nothing is cached');
});

test('dental phrasing finds the database-provided active specialty 6 service and preserves its stored image', async () => {
  const dentalRows = [{
    id: 55, name: 'Khám răng', price: '280000.00', description: 'Dịch vụ khám răng theo dữ liệu hiện có.',
    image_url: '/uploads/services/dental-photo.webp', specialty_id: 6, specialty_name: 'răng'
  }];
  const controller = createTestServiceController({ db: { query: async () => [dentalRows] }, serviceSelector: async () => ({ service_id: 55, clarification_required: false }) });
  for (const question of ['tôi bị đau răng', 'răng ê buốt thì khám dịch vụ nào?']) {
    const response = await invoke(controller, { question });
    const service = response.body.data.services[0];
    assert.equal(service.service_id, 55);
    assert.equal(service.name, 'Khám răng');
    assert.equal(service.specialty.id, 6);
    assert.equal(service.specialty.name, 'răng');
    assert.equal(service.price, '280000.00');
    assert.equal(service.image_url, '/uploads/services/dental-photo.webp');
  }
});

test('a new database service can be selected without adding its name or terms to production code', async () => {
  const testDatabaseRows = [{
    id: 91, name: 'Khám thị lực', price: '175000.00', description: 'Đánh giá thị lực theo nhu cầu.',
    image_url: '/uploads/services/service-test-image.webp',
    specialty_id: 61, specialty_name: 'Mắt'
  }];
  const controller = createTestServiceController({ db: { query: async (sql) => {
    assert.match(sql, /svc\.is_active = TRUE/);
    assert.match(sql, /sp\.is_active = TRUE/);
    if (!sql.includes('svc.id IN')) assert.match(sql, /svc\.search_keywords/);
    return [testDatabaseRows];
  } }, serviceSelector: async ({ candidates }) => ({ service_id: candidates[0].service_id, clarification_required: false }) });
  const response = await invoke(controller, { question: 'tôi nhìn mờ' });
  assert.equal(response.body.data.services.length, 1);
  assert.equal(response.body.data.services[0].service_id, 91);
  assert.equal(response.body.data.services[0].specialty.name, 'Mắt');
  assert.equal(response.body.data.services[0].image_url, '/uploads/services/service-test-image.webp');
});

test('the provider may select only a candidate ID for wording without exact keyword text', async () => {
  const testCatalog = [
    { ...serviceRows[0], id: 71, name: 'Khám răng', specialty_id: 21, specialty_name: 'Răng Hàm Mặt' },
    { ...serviceRows[0], id: 72, name: 'Khám tổng quát cho trẻ em', specialty_id: 12, specialty_name: 'Nhi khoa' },
    { ...serviceRows[0], id: 73, name: 'Siêu âm thai', specialty_id: 33, specialty_name: 'Sản phụ khoa' }
  ];
  const selections = new Map([
    ['răng tôi nhức', 71],
    ['đưa bé đi khám tổng quát', 72],
    ['tôi muốn siêu âm thai', 73]
  ]);
  const selected = [];
  const controller = createTestServiceController({
    db: { query: async (sql) => [testCatalog] },
    serviceSelector: async ({ question, candidates }) => {
      selected.push({ question, candidates });
      return { service_id: selections.get(question), clarification_required: false };
    }
  });
  for (const question of selections.keys()) {
    const response = await invoke(controller, { question });
    assert.equal(response.body.data.services[0].service_id, selections.get(question));
  }
  assert.equal(selected.length, 3);
  for (const { candidates } of selected) {
    assert.ok(candidates.every((candidate) => Object.keys(candidate).sort().join(',') === 'description,name,search_keywords,service_id,specialty'));
    assert.equal(JSON.stringify(candidates).includes('image_url'), false);
    assert.equal(JSON.stringify(candidates).includes('price'), false);
    assert.equal(JSON.stringify(candidates).includes('Bác sĩ'), false);
  }
});

test('AI provider failure uses only catalog text fallback and valid clarification does not guess', async () => {
  const providerFailure = createTestServiceController({
    db: { query: async () => [[{ ...serviceRows[0], search_keywords: 'răng, đau răng, nhức răng, ê buốt' }]] },
    serviceSelector: async () => { throw new Error('mock timeout'); }
  });
  const fallback = await invoke(providerFailure, { question: 'răng tôi đau quá' });
  assert.equal(fallback.body.data.services[0].service_id, 7, 'keyword fallback can match a supplied variation');
  const unsupportedSynonym = await invoke(providerFailure, { question: 'nhức' });
  assert.deepEqual(unsupportedSynonym.body.data.services, [], 'fallback must not infer synonyms absent from catalog text');
  const exactCatalogFallback = await invoke(providerFailure, { question: 'Khám răng tổng quát' });
  assert.equal(exactCatalogFallback.body.data.services[0].service_id, 7);

  let verifyQueryCount = 0;
  const clarificationController = createTestServiceController({
    db: { query: async () => { verifyQueryCount += 1; return [serviceRows]; } },
    serviceSelector: async () => ({ service_id: null, clarification_required: true })
  });
  const clarification = await invoke(clarificationController, { question: 'Tôi cần khám nhưng chưa rõ dịch vụ nào' });
  assert.deepEqual(clarification.body.data.services, []);
  assert.equal(clarification.body.data.status, 'CLARIFY');
  assert.equal(clarification.body.data.clarification_required, true);
  assert.equal(verifyQueryCount, 1, 'no service ID means no candidate is treated as selected');
});

test('jaw and tooth wording resolve to the same active dental service through database keywords', async () => {
  const dental = [{ ...serviceRows[0], search_keywords: 'đau hàm, đau răng, ê buốt răng' }];
  const controller = createTestServiceController({
    db: { query: async () => [dental] },
    serviceSelector: async () => { throw new Error('mock provider unavailable'); }
  });
  const jaw = await invoke(controller, { question: 'Tôi bị đau hàm quá', specialty_id: 9 });
  const tooth = await invoke(controller, { question: 'Tôi bị đau răng quá', specialty_id: null });
  assert.equal(jaw.body.data.status, 'MATCHED');
  assert.equal(tooth.body.data.status, 'MATCHED');
  assert.equal(jaw.body.data.booking_allowed, true);
  assert.equal(tooth.body.data.booking_allowed, true);
  assert.deepEqual(jaw.body.data.services, tooth.body.data.services);
});

test('AI receives all active service candidates and a wrong specialty is only a hint', async () => {
  const catalog = [
    { ...serviceRows[0], search_keywords: 'đau hàm, đau răng' },
    { ...serviceRows[1], search_keywords: 'mụn, ngứa da' }
  ];
  let received;
  const controller = createTestServiceController({
    db: { query: async () => [catalog] },
    serviceSelector: async (args) => {
      received = args;
      return { service_id: 7, clarification_required: false };
    }
  });
  const response = await invoke(controller, { question: 'Tôi bị đau hàm', specialty_id: 9 });
  assert.deepEqual(received.candidates.map((item) => item.service_id), [7, 8]);
  assert.deepEqual(received.specialtyHint, { specialty_id: 9, specialty_name: 'Da liễu' });
  assert.equal(response.body.data.status, 'MATCHED');
  assert.equal(response.body.data.services[0].service_id, 7);
});

test('valid model clarification or valid no-match is preserved without running keyword fallback', async () => {
  for (const [selection, expectedStatus] of [
    [{ service_id: null, clarification_required: true }, 'CLARIFY'],
    [{ service_id: 7, clarification_required: true }, 'CLARIFY'],
    [{ service_id: null, clarification_required: false }, 'NOT_FOUND']
  ]) {
    let providerCalls = 0;
    let catalogReads = 0;
    const controller = createTestServiceController({
      db: { query: async () => { catalogReads += 1; return [serviceRows]; } },
      serviceSelector: async () => { providerCalls += 1; return selection; }
    });
    const response = await invoke(controller, { question: 'câu chưa đủ căn cứ' });
    assert.equal(response.body.data.status, expectedStatus);
    assert.deepEqual(response.body.data.services, []);
    assert.equal(response.body.data.booking_allowed, false);
    assert.equal(providerCalls, 1);
    assert.equal(catalogReads, 1, 'no fallback or final selected-service recheck should run');
  }
});

test('malformed provider JSON triggers keyword fallback, which still requires a unique clear result', async () => {
  const clearCatalog = [{ ...serviceRows[0], search_keywords: 'đau hàm, đau răng' }, serviceRows[1]];
  const clear = createTestServiceController({
    db: { query: async () => [clearCatalog] },
    serviceSelector: async () => { throw new SyntaxError('mock invalid JSON'); }
  });
  const matched = await invoke(clear, { question: 'Tôi bị đau hàm' });
  assert.equal(matched.body.data.status, 'MATCHED');
  assert.equal(matched.body.data.services[0].service_id, 7);

  const ambiguousCatalog = [
    { ...serviceRows[0], id: 7, name: 'Khám chuyên khoa', specialty_name: 'Chuyên khoa', description: 'Đau hàm', search_keywords: 'đau hàm' },
    { ...serviceRows[1], id: 8, name: 'Khám chuyên khoa', specialty_name: 'Chuyên khoa', description: 'Đau hàm', search_keywords: 'đau hàm' }
  ];
  const ambiguous = createTestServiceController({
    db: { query: async () => [ambiguousCatalog] },
    serviceSelector: async () => { throw new Error('mock provider offline'); }
  });
  const clarify = await invoke(ambiguous, { question: 'đau hàm' });
  assert.equal(clarify.body.data.status, 'CLARIFY');
  assert.deepEqual(clarify.body.data.services, []);
});

test('frontend renders one canonical status result and guest booking keeps service_id for login return', async () => {
  const { normalizeServiceAdviceResult, getServiceBookingNavigation } = await import('../../Frontend/src/utils/serviceAdvice.mjs');
  const matched = normalizeServiceAdviceResult({
    status: 'MATCHED', booking_allowed: true,
    services: [{ service_id: 7 }, { service_id: 8 }]
  }, 'Đã tìm thấy dịch vụ.');
  assert.equal(matched.status, 'MATCHED');
  assert.equal(matched.services.length, 1);
  assert.equal(matched.services[0].service_id, 7);
  assert.equal(matched.bookingAllowed, true);

  for (const status of ['CLARIFY', 'NOT_FOUND', 'EMERGENCY']) {
    const result = normalizeServiceAdviceResult({ status, booking_allowed: false, services: [{ service_id: 7 }] }, 'Kết quả.');
    assert.equal(result.services.length, 0, `${status} must never show an unverified card`);
    assert.equal(result.bookingAllowed, false);
    assert.equal(result.noServiceMatch, status === 'NOT_FOUND');
  }
  assert.deepEqual(getServiceBookingNavigation(7, false), {
    path: '/login', options: { state: { from: { pathname: '/patient/booking', search: '?service_id=7' } } }
  });
  assert.deepEqual(getServiceBookingNavigation(7, true), { path: '/patient/booking?service_id=7' });
});

test('configured keyword groups match reordered wording while a generic pain question asks for clarification', async () => {
  const catalog = [
    { ...serviceRows[0], search_keywords: 'răng, đau răng, nhức răng, ê buốt, răng khôn, nướu, lợi' },
    { ...serviceRows[1], id: 22, name: 'Khám tai mũi họng', specialty_id: 22, specialty_name: 'Tai Mũi Họng', search_keywords: 'tai, đau tai, ù tai, mũi, nghẹt mũi, sổ mũi, xoang, họng, đau họng, khàn tiếng' }
  ];
  const controller = createTestServiceController({ db: { query: async () => [catalog] } });
  const dental = await invoke(controller, { question: 'răng tôi đau quá' });
  assert.equal(dental.body.data.services[0].service_id, 7);
  const ent = await invoke(controller, { question: 'mũi tôi đau' });
  assert.equal(ent.body.data.services[0].service_id, 22);
  const vague = await invoke(controller, { question: 'tôi bị đau' });
  assert.deepEqual(vague.body.data.services, []);
  assert.equal(vague.body.data.clarification_required, true);
  assert.match(vague.body.message, /đau ở vị trí nào/i);
});

test('documented customer phrases route to the active database service using stored keywords only', async () => {
  const catalog = [
    { id: 31, name: 'Khám da liễu', price: '1', description: 'Khám da.', image_url: null, specialty_id: 9, specialty_name: 'Da liễu', search_keywords: 'da, nổi mụn, mụn trứng cá, ngứa da, nấm móng, zona, chàm, rụng tóc' },
    { id: 32, name: 'Khám nhi khoa', price: '1', description: 'Khám trẻ em.', image_url: null, specialty_id: 12, specialty_name: 'Nhi khoa', search_keywords: 'bé, con tôi, trẻ em, trẻ sơ sinh, sốt, ho, đau bụng, buồn nôn, tiêm chủng, phát triển' },
    { id: 33, name: 'Khám nội tổng quát', price: '1', description: 'Khám tổng quát.', image_url: null, specialty_id: 13, specialty_name: 'Nội tổng quát', search_keywords: 'người lớn, khám sức khỏe, mệt mỏi, chóng mặt, đau đầu, đau bụng, đường huyết, huyết áp, gout' },
    { id: 34, name: 'Khám răng-hàm-mặt', price: '1', description: 'Khám răng.', image_url: null, specialty_id: 6, specialty_name: 'răng', search_keywords: 'răng, đau răng, nhức răng, ê buốt, chảy máu lợi, viêm lợi, răng khôn, khó há miệng' },
    { id: 35, name: 'Khám sản phụ khoa', price: '1', description: 'Khám sản phụ khoa.', image_url: null, specialty_id: 14, specialty_name: 'Sản phụ khoa', search_keywords: 'kinh nguyệt, rối loạn kinh nguyệt, khí hư, ngứa rát vùng kín, mang thai, thai kỳ, siêu âm thai' },
    { id: 36, name: 'Khám tai mũi họng', price: '1', description: 'Khám tai mũi họng.', image_url: null, specialty_id: 15, specialty_name: 'Tai Mũi Họng', search_keywords: 'tai, ù tai, nghe kém, mũi, nghẹt mũi, xoang, họng, khàn tiếng, mất thăng bằng' }
  ];
  const controller = createTestServiceController({ db: { query: async () => [catalog] } });
  const examples = [
    ['Mặt tôi nổi mụn, nên khám dịch vụ nào?', 31],
    ['Con tôi bị đau bụng và buồn nôn, đưa bé đi khám ở đâu?', 32],
    ['Tôi thường mệt mỏi và chóng mặt, nên khám ở đâu?', 33],
    ['Nướu tôi chảy máu, tôi nên đặt dịch vụ nào?', 34],
    ['Tôi bị rối loạn kinh nguyệt, nên khám ở đâu?', 35],
    ['Tôi bị ù tai và nghe không rõ, phòng khám có dịch vụ nào?', 36]
  ];
  for (const [question, expectedId] of examples) {
    const response = await invoke(controller, { question });
    assert.equal(response.body.data.services[0]?.service_id, expectedId, question);
  }
});

test('an unknown model ID is rejected and fallback result is revalidated against the active catalog', async () => {
  const fallbackController = createTestServiceController({
    db: { query: async () => [serviceRows] },
    serviceSelector: async () => ({ service_id: 999999, clarification_required: false })
  });
  const fallback = await invoke(fallbackController, { question: 'Khám răng tổng quát' });
  assert.equal(fallback.body.data.services[0].service_id, 7);

  let readCount = 0;
  const disabledBeforeReturn = createTestServiceController({
    db: { query: async () => { readCount += 1; return readCount === 1 ? [serviceRows] : [[]]; } },
    serviceSelector: async () => ({ service_id: 7, clarification_required: false })
  });
  const response = await invoke(disabledBeforeReturn, { question: 'đau răng' });
  assert.deepEqual(response.body.data.services, []);
  assert.equal(readCount, 2, 'backend rechecks selected IDs against the active service and specialty rows');
});

test('Responses provider uses configured model and sends only the constrained candidate fields', async () => {
  let requestBody;
  const result = await requestServiceSelection({
    question: 'răng tôi nhức',
    candidates: [{ service_id: 7, name: 'Khám răng', description: 'Mô tả', specialty: 'Răng Hàm Mặt', search_keywords: 'đau răng' }],
    apiKey: 'mock-key', baseUrl: 'https://mock-provider.invalid/v1', model: 'mock-model',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://mock-provider.invalid/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer mock-key');
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ output_text: JSON.stringify({ service_id: 7, clarification_required: false }) }) };
    }
  });
  assert.equal(result.service_id, 7);
  assert.equal(requestBody.model, 'mock-model');
  assert.deepEqual(requestBody.text.format.schema, SERVICE_SELECTION_SCHEMA);
  const sent = JSON.parse(requestBody.input[1].content);
  assert.deepEqual(Object.keys(sent.active_services[0]).sort(), ['description', 'name', 'search_keywords', 'service_id', 'specialty']);
});

test('fallback uses real service name and description; inactive catalog rows are excluded by query', async () => {
  let queryText = '';
  const controller = createTestServiceController({ db: { query: async (sql) => { if (!queryText) queryText = sql; return [serviceRows]; } } });
  const match = await invoke(controller, { question: 'Khám răng tổng quát' });
  assert.equal(match.body.data.services[0].service_id, 7);
  assert.match(queryText, /svc\.is_active = TRUE/);
  assert.match(queryText, /sp\.is_active = TRUE/);
  assert.match(queryText, /svc\.search_keywords/);

  const noActiveRows = createTestServiceController({ db: { query: async () => [[]] } });
  const inactive = await invoke(noActiveRows, { question: 'đau răng' });
  assert.deepEqual(inactive.body.data.services, []);
});

test('ambiguous matching and an unscoped request to list services ask for clarification', async () => {
  const candidates = [
    { ...serviceRows[0], name: 'Khám răng tổng quát' },
    { ...serviceRows[0], id: 11, name: 'Khám răng tổng quát' }
  ];
  const controller = createTestServiceController({ db: { query: async () => [candidates] } });
  const ambiguous = await invoke(controller, { question: 'Khám răng tổng quát' });
  assert.deepEqual(ambiguous.body.data.services, []);
  assert.equal(ambiguous.body.data.clarification_required, true);
  assert.match(ambiguous.body.message, /mô tả rõ hơn/);

  const list = await invoke(controller, { question: 'Liệt kê danh sách dịch vụ' });
  assert.equal(list.body.data.status, 'CLARIFY');
  assert.deepEqual(list.body.data.services, []);
});

test('PATIENT receives doctor contact only after role validation; contacts are linked through the service specialty', async () => {
  const queries = [];
  const controller = createTestServiceController({ db: { query: async (sql, params) => {
    queries.push({ sql, params });
    return [sql.includes('FROM doctors d') ? doctors : serviceRows];
  } }, serviceSelector: async () => ({ service_id: 7, clarification_required: false }) });
  const response = await invoke(controller, { question: 'đau răng', specialty_id: 21, include_doctors: true }, { id: 4, role: 'PATIENT' });
  assert.equal(response.statusCode, 200);
  const service = response.body.data.services[0];
  assert.equal(service.doctor_relation, 'SPECIALTY');
  assert.equal(service.doctors[0].full_name, 'Bác sĩ đang hoạt động');
  assert.equal(service.doctor_contact_public, true);
  assert.equal(service.doctors[0].phone, '0900000000');
  assert.equal(service.doctors[0].email, 'doctor@example.test');
  assert.equal('bio' in service.doctors[0], false);
  const doctorSql = queries.find(({ sql }) => sql.includes('FROM doctors d')).sql;
  assert.match(doctorSql, /d\.is_active = TRUE/);
  assert.match(doctorSql, /u\.is_active = TRUE/);
  assert.match(doctorSql, /u\.phone/);
  assert.match(doctorSql, /u\.email/);
});

test('guest cannot request doctor data and non-patient role is denied before catalog access', async () => {
  let queryCount = 0;
  const controller = createTestServiceController({ db: { query: async () => { queryCount += 1; return [serviceRows]; } } });
  const guest = await invoke(controller, { question: 'đau răng', include_doctors: true });
  assert.equal(guest.statusCode, 401);
  const doctor = await invoke(controller, { question: 'đau răng', include_doctors: true }, { id: 3, role: 'DOCTOR' });
  assert.equal(doctor.statusCode, 403);
  const admin = await invoke(controller, { question: 'đau răng', include_doctors: true }, { id: 1, role: 'ADMIN' });
  assert.equal(admin.statusCode, 403);
  assert.equal(queryCount, 0);
});

test('missing service data and vague skin concern do not guess another service', async () => {
  let queryCount = 0;
  const controller = createTestServiceController({ db: { query: async () => { queryCount += 1; return [serviceRows]; } } });
  const vague = await invoke(controller, { question: 'Da mặt của tôi bị xấu nên đi khám dịch vụ nào?' });
  assert.equal(vague.body.data.services.length, 0);
  assert.equal(vague.body.data.status, 'CLARIFY');
  assert.match(vague.body.message, /chưa đủ rõ/i);
  const unknown = await invoke(controller, { question: 'câu hỏi không liên quan' });
  assert.equal(unknown.body.data.services.length, 0);
  assert.equal(queryCount, 1, 'ambiguous skin wording is clarified before reading the service catalog');
});

test('missing price is reported as missing and not replaced by a guessed amount', async () => {
  const rowWithoutPrice = { ...serviceRows[0], price: null };
  const controller = createTestServiceController({ db: { query: async () => [[rowWithoutPrice]] }, serviceSelector: async () => ({ service_id: 7, clarification_required: false }) });
  const response = await invoke(controller, { question: 'đau răng', specialty_id: 21 });
  assert.equal(response.body.data.services[0].price, null);
  assert.equal(response.body.data.services[0].price_available, false);
  assert.equal(response.body.data.booking_allowed, false);
});

test('emergency text is handled before service catalog query and returns no service or booking data', async () => {
  let queryCount = 0;
  let providerCount = 0;
  const controller = createTestServiceController({
    db: { query: async () => { queryCount += 1; return [serviceRows]; } },
    serviceSelector: async () => { providerCount += 1; throw new Error('must not run'); }
  });
  const response = await invoke(controller, { question: 'Tôi đau ngực dữ dội, dịch vụ nào?' });
  assert.equal(response.body.data.emergency, true);
  assert.equal(response.body.data.status, 'EMERGENCY');
  assert.equal(response.body.data.booking_allowed, false);
  assert.deepEqual(response.body.data.services, []);
  assert.equal(queryCount, 0);
  assert.equal(providerCount, 0);
});

test('service advice route uses optional JWT middleware; classify-symptom route remains public', () => {
  const noOpAuth = (_req, _res, next) => next();
  const router = createAIRouter({ classifySymptom() {} }, { serviceAdvice() {} }, noOpAuth);
  const classifyRoute = router.stack.find((layer) => layer.route?.path === '/classify-symptom')?.route;
  const servicesRoute = router.stack.find((layer) => layer.route?.path === '/service-advice')?.route;
  assert.equal(classifyRoute.stack.length, 2, 'existing symptom route retains its limiter and controller');
  assert.equal(servicesRoute.stack.length, 3, 'service route has rate limiting, optional JWT validation, and controller');
});

test('optional JWT middleware allows guests and validates any supplied token', () => {
  let verified = 0;
  let nextCount = 0;
  const middleware = createOptionalVerifyToken((_req, _res, next) => { verified += 1; next(); });
  middleware({ headers: {} }, {}, () => { nextCount += 1; });
  middleware({ headers: { authorization: 'Bearer session-token' } }, {}, () => { nextCount += 1; });
  assert.equal(verified, 1);
  assert.equal(nextCount, 2);
});

test('service lookup intent uses generic request phrases while emergency safety remains in the backend', async () => {
  const { isDirectServiceLookupIntent, shouldRequestServiceAdvice } = await import('../../Frontend/src/utils/symptomAssistant.mjs');
  assert.equal(isDirectServiceLookupIntent('Khám da liễu giá bao nhiêu?'), true);
  assert.equal(isDirectServiceLookupIntent('Tôi đau răng thì khám dịch vụ nào?'), true);
  assert.equal(isDirectServiceLookupIntent('Da mặt của tôi bị xấu nên cần đi khám khoa nào?'), true);
  assert.equal(shouldRequestServiceAdvice('Tôi đau răng', { specialty_id: 21, urgency_level: 'ROUTINE' }), true);
  assert.equal(shouldRequestServiceAdvice('Tôi bị đau răng', { specialty_id: null, urgency_level: 'ROUTINE', follow_up_questions: ['Hỏi thêm'] }), true);
  assert.equal(shouldRequestServiceAdvice('đau ngực', { specialty_id: 21, urgency_level: 'EMERGENCY' }), false);
});
