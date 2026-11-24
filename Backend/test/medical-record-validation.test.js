const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateVitalSigns,
  normalizeIcd10Code,
  icd10CodeExists
} = require('../src/utils/medicalRecordValidation');
const { createMedicalRecord } = require('../src/controllers/medicalRecordController');
const { pool } = require('../src/config/db');

const responseRecorder = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

test('blood pressure accepts and normalizes two ordered values', () => {
  const result = validateVitalSigns({ blood_pressure: ' 120  /  80 ' });
  assert.equal(result.errors.length, 0);
  assert.equal(result.normalized.blood_pressure, '120/80');
});

test('blood pressure rejects text, partial values, missing side and invalid ordering as hard errors', () => {
  for (const blood_pressure of ['tầm thu', 'abc', '120', '120/abc', '80/120', '00/00', 120]) {
    const result = validateVitalSigns({ blood_pressure });
    assert.equal(result.errors.some((issue) => issue.field === 'blood_pressure'), true, String(blood_pressure));
    assert.equal(result.warnings.some((issue) => issue.field === 'blood_pressure'), false, String(blood_pressure));
  }
  assert.equal(validateVitalSigns({}).errors.length, 0, 'blood pressure remains optional');
});

test('numeric vital signs reject wrong types, negatives, NaN, Infinity and SpO2 above 100', () => {
  for (const value of ['25', -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = validateVitalSigns({ weight: value });
    assert.equal(result.errors.some((issue) => issue.field === 'weight'), true, String(value));
  }
  assert.equal(validateVitalSigns({ spo2: 101 }).errors.some((issue) => issue.code === 'SPO2_OVER_100'), true);
});

test('existing wide-range warnings require explicit acknowledgement while plausible readings remain recordable', async () => {
  const outliers = { temperature: 29, heart_rate: 260, spo2: 69, weight: 25 };
  const needsAcknowledgement = validateVitalSigns(outliers);
  assert.equal(needsAcknowledgement.errors.length, 0);
  assert.equal(needsAcknowledgement.warnings.length, 3);
  assert.equal(needsAcknowledgement.requiresAcknowledgement, true);
  assert.equal(validateVitalSigns(outliers, { acknowledged: true }).valid, true);

  const observedValues = validateVitalSigns({ temperature: 32, heart_rate: 170, spo2: 86, weight: 25 });
  assert.equal(observedValues.errors.length, 0);
  assert.equal(observedValues.warnings.length, 0);

  const { validateVitalInputs } = await import('../../Frontend/src/utils/medicalRecordValidation.mjs');
  const frontend = validateVitalInputs({ temperature: '29', heart_rate: '260', spo2: '69', weight: '25' });
  assert.deepEqual(frontend.issues.map(({ field, type, code }) => ({ field, type, code })), needsAcknowledgement.issues.map(({ field, type, code }) => ({ field, type, code })));
});

test('direct medical-record handler rejects malformed vitals before acquiring a database connection', async () => {
  const originalGetConnection = pool.getConnection;
  let connectionAttempts = 0;
  pool.getConnection = async () => { connectionAttempts += 1; throw new Error('database must not be reached for invalid input'); };
  try {
    for (const blood_pressure of ['tầm thu', 'abc', '120', '120/abc']) {
      const res = responseRecorder();
      await createMedicalRecord({ body: { appointment_id: 26, final_diagnosis: 'Test', prescriptions: [], blood_pressure } }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, 'INVALID_VITALS');
    }
    const numericRes = responseRecorder();
    await createMedicalRecord({ body: { appointment_id: 26, final_diagnosis: 'Test', prescriptions: [], weight: '25' } }, numericRes, (error) => { throw error; });
    assert.equal(numericRes.statusCode, 400);
    assert.equal(connectionAttempts, 0);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('direct handler requires acknowledgement for warning readings and lets acknowledged values reach persistence', async () => {
  const originalGetConnection = pool.getConnection;
  let connectionAttempts = 0;
  pool.getConnection = async () => { connectionAttempts += 1; throw new Error('stopped at mocked persistence boundary'); };
  try {
    const warningPayload = { appointment_id: 26, final_diagnosis: 'Test', prescriptions: [], temperature: 29 };
    const unacknowledged = responseRecorder();
    await createMedicalRecord({ body: warningPayload }, unacknowledged, (error) => { throw error; });
    assert.equal(unacknowledged.statusCode, 400);
    assert.equal(unacknowledged.body.code, 'VITALS_ACKNOWLEDGEMENT_REQUIRED');
    assert.equal(connectionAttempts, 0);

    await assert.rejects(
      () => createMedicalRecord({ body: { ...warningPayload, vitals_acknowledged: true } }, responseRecorder(), (error) => { throw error; }),
      /stopped at mocked persistence boundary/
    );
    assert.equal(connectionAttempts, 1, 'acknowledged abnormal value passes validation and proceeds toward persistence');
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('ICD-10 stays optional, normalizes surrounding whitespace, and checks catalog membership', async () => {
  assert.deepEqual(normalizeIcd10Code(undefined), { code: null, issue: null });
  assert.deepEqual(normalizeIcd10Code('   '), { code: null, issue: null });
  assert.deepEqual(normalizeIcd10Code(' I10 '), { code: 'I10', issue: null });
  assert.ok(normalizeIcd10Code(10).issue);

  let queryCount = 0;
  const catalog = new Set(['I10']);
  const connection = { query: async (_sql, [code]) => { queryCount += 1; return [[...(catalog.has(code) ? [{ code }] : [])]]; } };
  assert.equal(await icd10CodeExists(connection, 'I10'), true);
  assert.equal(await icd10CodeExists(connection, 'Z99.9'), false);
  const beforeOptional = queryCount;
  assert.equal(await icd10CodeExists(connection, null), true);
  assert.equal(queryCount, beforeOptional, 'no catalog lookup for omitted code');
});

test('direct medical-record handler rejects an unknown supplied ICD-10 code without inserting', async () => {
  const originalGetConnection = pool.getConnection;
  const state = { inserted: false, rolledBack: false };
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    query: async (sql) => {
      if (sql.includes('FROM icd10_codes')) return [[]];
      state.inserted = true;
      throw new Error('unexpected query after unknown ICD-10');
    },
    rollback: async () => { state.rolledBack = true; },
    release: () => {}
  });
  try {
    const res = responseRecorder();
    await createMedicalRecord({ body: { appointment_id: 26, final_diagnosis: 'Test', prescriptions: [], icd10_code: 'Z99.9' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'ICD10_NOT_FOUND');
    assert.equal(state.rolledBack, true);
    assert.equal(state.inserted, false);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});
