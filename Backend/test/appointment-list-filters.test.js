const test = require('node:test');
const assert = require('node:assert/strict');
const appointmentController = require('../src/controllers/appointmentController');
const doctorController = require('../src/controllers/doctorController');
const medicalRecordController = require('../src/controllers/medicalRecordController');
const { pool } = require('../src/config/db');
const { parseAdminAppointmentFilters } = appointmentController;
const { parseMyCalendarRange } = doctorController;

const invoke = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextError;
  await handler(req, res, (error) => { nextError = error; });
  if (nextError) throw nextError;
  return res;
};

test('Admin appointment filters accept doctor, date range, and status together', () => {
  assert.deepEqual(parseAdminAppointmentFilters({
    doctor_id: '12', startDate: '2026-11-02', endDate: '2026-11-03', status: 'CONFIRMED'
  }), {
    filters: { doctorId: 12, startDate: '2026-11-02', endDate: '2026-11-03', status: 'CONFIRMED' }
  });
});

test('Admin appointment filters reject invalid dates, ranges, doctors, and statuses', () => {
  assert.ok(parseAdminAppointmentFilters({ startDate: '2026-02-30' }).error);
  assert.ok(parseAdminAppointmentFilters({ startDate: '2026-11-03', endDate: '2026-11-02' }).error);
  assert.match(parseAdminAppointmentFilters({ startDate: '2025-01-01', endDate: '2026-01-02' }).error, /366/);
  assert.ok(parseAdminAppointmentFilters({ doctor_id: '1.2' }).error);
  assert.ok(parseAdminAppointmentFilters({ status: 'ONLINE' }).error);
});

test('Doctor calendar requires real ISO dates and limits the requested range', () => {
  assert.deepEqual(parseMyCalendarRange({ startDate: '2026-11-01', endDate: '2026-11-30' }), {
    startDate: '2026-11-01', endDate: '2026-11-30'
  });
  assert.ok(parseMyCalendarRange({ startDate: '2026-02-30', endDate: '2026-03-01' }).error);
  assert.ok(parseMyCalendarRange({ startDate: ['2026-11-01'], endDate: '2026-11-30' }).error);
  assert.ok(parseMyCalendarRange({ startDate: '2026-11-03', endDate: '2026-11-02' }).error);
  assert.match(parseMyCalendarRange({ startDate: '2025-01-01', endDate: '2026-01-02' }).error, /366/);
});

test('Doctor calendar returns assigned slots and bookings scoped to the authenticated doctor', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT id FROM doctors')) return [[{ id: 8 }]];
    if (sql.includes('FROM shift_day_employee sd') && sql.includes('JOIN shifts sh')) {
      return [[{ work_date: '2026-11-03', shift_employee_id: 16, shift_status: 'AVAILABLE', shift_id: 2,
        shift_name: 'Ca sáng', start_time: '08:00', end_time: '12:00' }]];
    }
    if (sql.includes('JOIN shift_time_slots st')) {
      return [[{ shift_employee_id: 16, slot_id: 20, start_time: '08:00', end_time: '08:30',
        stored_slot_status: 'BOOKED', appointment_id: 55, appointment_status: 'CONFIRMED',
        appointment_date: '2026-11-03', time_slot: '08:00 - 08:30', patient_name: 'Bệnh nhân thử',
        service_name: 'Khám thử', initial_symptoms: 'Đau đầu' }]];
    }
    if (sql.includes('a.slot_id IS NULL')) return [[]];
    throw new Error(`Unexpected query in calendar test: ${sql}`);
  };
  try {
    const response = await invoke(doctorController.getMyCalendar, {
      user: { id: 42, role: 'DOCTOR' },
      query: { startDate: '2026-11-01', endDate: '2026-11-30', doctor_id: '999' }
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].work_date, '2026-11-03');
    assert.equal(response.body.data[0].shifts[0].slots[0].status, 'BOOKED');
    assert.equal(response.body.data[0].shifts[0].slots[0].appointment.patient_name, 'Bệnh nhân thử');
    assert.equal(response.body.data[0].shifts[0].slots[0].appointment.initial_symptoms, 'Đau đầu');
    assert.equal(calls.length, 4);
    assert.equal(calls[0].params[0], 42, 'doctor profile lookup must use the authenticated user ID');
    assert.ok(calls.slice(1).every(({ params }) => params[0] === 8), 'schedule queries must use the doctor ID resolved from that authenticated account');
    assert.ok(calls.every(({ params }) => !params.includes('999')), 'client-supplied doctor ID must be ignored');
  } finally { pool.query = originalQuery; }
});

test('Admin appointment list applies doctor, date, and status filters in SQL', async () => {
  const originalQuery = pool.query;
  let call;
  pool.query = async (sql, params) => { call = { sql, params }; return [[{ id: 77 }]]; };
  try {
    const response = await invoke(appointmentController.getAppointments, {
      user: { id: 5, role: 'ADMIN' },
      query: { doctor_id: '8', startDate: '2026-11-03', endDate: '2026-11-04', status: 'CONFIRMED' }
    });
    assert.equal(response.statusCode, 200);
    assert.match(call.sql, /a\.doctor_id = \?/);
    assert.match(call.sql, /a\.appointment_date BETWEEN \? AND \?/);
    assert.match(call.sql, /a\.status = \?/);
    assert.deepEqual(call.params, [8, '2026-11-03', '2026-11-04', 'CONFIRMED']);
  } finally { pool.query = originalQuery; }
});

test('Doctor medical history lookup is tied to the assigned appointment and patient', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM appointment_records mr')) return [[{ record_id: 4, patient_id: 300, appointment_id: 12 }]];
    if (sql.includes('FROM prescriptions pr')) return [[]];
    throw new Error(`Unexpected query in medical history test: ${sql}`);
  };
  try {
    const response = await invoke(medicalRecordController.getPatientRecords, {
      user: { id: 42, role: 'DOCTOR' }, query: { patient_id: '300', appointment_id: '55' }
    });
    assert.equal(response.statusCode, 200);
    assert.match(calls[0].sql, /assigned_app\.appointment_id = \?/);
    assert.match(calls[0].sql, /assigned_doc\.user_id = \?/);
    assert.match(calls[0].sql, /assigned_app\.status IN \('PENDING','CONFIRMED','COMPLETED'\)/);
    assert.deepEqual(calls[0].params, [300, 42, 55]);
  } finally { pool.query = originalQuery; }
});
