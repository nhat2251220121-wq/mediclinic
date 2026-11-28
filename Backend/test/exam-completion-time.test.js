const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/db');
const { createMedicalRecord } = require('../src/controllers/medicalRecordController');
const appointmentController = require('../src/controllers/appointmentController');
const {
  isEarlyExamDemoEnabled,
  appointmentStartMinute,
  isAppointmentStartReached
} = require('../src/utils/examCompletionTiming');

const responseRecorder = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const withDemoFlag = async (value, run) => {
  const previous = process.env.ALLOW_EARLY_EXAM_DEMO;
  if (value === undefined) delete process.env.ALLOW_EARLY_EXAM_DEMO;
  else process.env.ALLOW_EARLY_EXAM_DEMO = value;
  try { await run(); }
  finally {
    if (previous === undefined) delete process.env.ALLOW_EARLY_EXAM_DEMO;
    else process.env.ALLOW_EARLY_EXAM_DEMO = previous;
  }
};

test('demo flag chỉ bật với giá trị true; thiếu hoặc cấu hình sai mặc định tắt', () => {
  assert.equal(isEarlyExamDemoEnabled('true'), true);
  assert.equal(isEarlyExamDemoEnabled(' TRUE '), true);
  for (const value of [undefined, '', 'false', 'yes', '1', 'on']) {
    assert.equal(isEarlyExamDemoEnabled(value), false, String(value));
  }
});

test('thời điểm bắt đầu được so theo Asia/Ho_Chi_Minh và sau giờ bắt đầu vẫn được phép kể cả sau giờ kết thúc', () => {
  const appointment = { appointmentDate: '2026-11-28', timeSlot: '08:30 - 09:00' };
  assert.equal(appointmentStartMinute(appointment.appointmentDate, appointment.timeSlot), '2026-11-28T08:30');
  assert.equal(isAppointmentStartReached({ ...appointment, now: new Date('2026-11-28T01:29:00Z') }), false);
  assert.equal(isAppointmentStartReached({ ...appointment, now: new Date('2026-11-28T01:30:00Z') }), true);
  assert.equal(isAppointmentStartReached({ ...appointment, now: new Date('2026-11-28T02:00:00Z') }), true);
  assert.equal(isAppointmentStartReached({ ...appointment, now: new Date('2026-11-28T02:30:00Z') }), true);
});

test('POST bệnh án trực tiếp trước giờ hẹn bị từ chối và không insert hoặc chuyển COMPLETED', async () => {
  await withDemoFlag('false', async () => {
    const originalGetConnection = pool.getConnection;
    const state = { inserted: false, completed: false, rolledBack: false };
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      query: async (sql) => {
        if (sql.includes('FROM invoices')) return [[]];
        if (sql.includes('FROM appointments a JOIN doctors')) return [[{
          appointment_id: 77, patient_id: 12, doctor_id: 5, service_id: 3,
          status: 'CONFIRMED', appointment_date: '2099-05-10', time_slot: '08:30 - 09:00', user_id: 42
        }]];
        if (sql.includes('INSERT INTO appointment_records')) state.inserted = true;
        if (sql.includes("SET status = 'COMPLETED'")) state.completed = true;
        throw new Error('Unexpected query after the time guard');
      },
      rollback: async () => { state.rolledBack = true; },
      release: () => {}
    });
    try {
      const response = responseRecorder();
      await createMedicalRecord({
        body: { appointment_id: 77, final_diagnosis: 'Kiểm thử', prescriptions: [] },
        user: { id: 42, role: 'DOCTOR' }
      }, response, (error) => { throw error; });
      assert.equal(response.statusCode, 409);
      assert.equal(response.body.message, 'Chưa đến giờ hẹn, không thể hoàn thành buổi khám.');
      assert.equal(state.rolledBack, true);
      assert.equal(state.inserted, false);
      assert.equal(state.completed, false);
    } finally { pool.getConnection = originalGetConnection; }
  });
});

test('POST bệnh án với demo bật bỏ qua giới hạn giờ nhưng vẫn tiếp tục qua các kiểm tra còn lại', async () => {
  await withDemoFlag('true', async () => {
    const originalGetConnection = pool.getConnection;
    const state = { reachedRecordInsert: false, rolledBack: false };
    const stopAtInsert = new Error('Stopped at mocked record insert');
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      query: async (sql) => {
        if (sql.includes('FROM invoices')) return [[]];
        if (sql.includes('FROM appointments a JOIN doctors')) return [[{
          appointment_id: 78, patient_id: 12, doctor_id: 5, service_id: 3,
          status: 'CONFIRMED', appointment_date: '2099-05-10', time_slot: '08:30 - 09:00', user_id: 42
        }]];
        if (sql.includes('INSERT INTO appointment_records')) {
          state.reachedRecordInsert = true;
          throw stopAtInsert;
        }
        throw new Error('Unexpected query before record insert');
      },
      rollback: async () => { state.rolledBack = true; },
      release: () => {}
    });
    try {
      let forwardedError;
      await createMedicalRecord({
        body: { appointment_id: 78, final_diagnosis: 'Kiểm thử', prescriptions: [] },
        user: { id: 42, role: 'DOCTOR' }
      }, responseRecorder(), (error) => { forwardedError = error; });
      assert.equal(state.reachedRecordInsert, true);
      assert.equal(forwardedError, stopAtInsert);
      assert.equal(state.rolledBack, true);
    } finally { pool.getConnection = originalGetConnection; }
  });
});

test('PATCH COMPLETED trực tiếp cũng bị chặn trước giờ hẹn và không cập nhật trạng thái', async () => {
  await withDemoFlag(undefined, async () => {
    const originalGetConnection = pool.getConnection;
    const state = { updated: false, rolledBack: false };
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      query: async (sql) => {
        if (sql.includes('FROM invoices')) return [[]];
        if (sql.includes('FROM appointments a JOIN doctors')) return [[{
          appointment_id: 79, patient_id: 12, status: 'CONFIRMED', follow_up_id: null,
          appointment_date: '2099-05-10', time_slot: '08:30 - 09:00', doctor_user_id: 42
        }]];
        if (sql.includes('UPDATE appointments SET status')) state.updated = true;
        throw new Error('Unexpected query after the time guard');
      },
      rollback: async () => { state.rolledBack = true; },
      commit: async () => {},
      release: () => {}
    });
    try {
      const response = responseRecorder();
      await appointmentController.updateAppointmentStatus({
        params: { id: '79' }, body: { status: 'COMPLETED' }, user: { id: 42, role: 'DOCTOR' }
      }, response, (error) => { throw error; });
      assert.equal(response.statusCode, 409);
      assert.equal(response.body.message, 'Chưa đến giờ hẹn, không thể hoàn thành buổi khám.');
      assert.equal(state.updated, false);
      assert.equal(state.rolledBack, true);
    } finally { pool.getConnection = originalGetConnection; }
  });
});
