const test = require('node:test');
const assert = require('node:assert/strict');
const adminController = require('../src/controllers/adminMgmtController');
const { pool } = require('../src/config/db');
const { getClinicClock } = require('../src/utils/appointmentReminders');

test('appointment reminder clock uses Asia/Ho_Chi_Minh, including date rollover', () => {
  assert.deepEqual(getClinicClock(new Date('2026-11-13T17:00:00.000Z')), {
    date: '2026-11-14',
    dateTime: '2026-11-14 00:00:00'
  });
});

test('admin reminder query is read-only, limited, confirmed, service-paid and scoped to clinic today', async () => {
  const originalQuery = pool.query;
  let capturedSql = '';
  let capturedParams = [];
  pool.query = async (sql, params) => {
    capturedSql = sql;
    capturedParams = params;
    return [[{
      appointment_id: 91,
      appointment_date: '2026-11-14',
      time_slot: '08:30 - 09:00',
      status: 'CONFIRMED',
      patient_name: 'Patient Test',
      doctor_name: 'Doctor Test',
      service_or_specialty: 'Nhi khoa',
      minutes_until: -4,
      reminder_total: 7
    }]];
  };
  try {
    let response;
    const req = {};
    const res = { json(body) { response = body; return this; } };
    await adminController.getAppointmentReminders(req, res, (error) => { throw error; });

    assert.equal(response.success, true);
    assert.equal(response.data.total, 7);
    assert.equal(response.data.check_in_tracking, false);
    assert.equal(response.data.items.length, 1);
    assert.equal(response.data.items[0].minutes_until, -4);
    assert.match(capturedSql, /a\.appointment_date = \?/);
    assert.match(capturedSql, /a\.status = 'CONFIRMED'/);
    assert.match(capturedSql, /SUM\(pay\.amount\).*>= i\.service_fee/s);
    assert.match(capturedSql, /DATE_ADD\(\?, INTERVAL 60 MINUTE\)/);
    assert.match(capturedSql, /COUNT\(\*\) OVER\(\)/);
    assert.match(capturedSql, /LIMIT 5/);
    assert.doesNotMatch(capturedSql, /\b(INSERT|UPDATE|DELETE)\b/i);
    assert.equal(capturedParams.length, 6);
    assert.equal(capturedParams[0], response.data.as_of);
    assert.equal(capturedParams[1], response.data.clinic_date);
  } finally {
    pool.query = originalQuery;
  }
});

test('empty reminder query returns zero badge and empty list', async () => {
  const originalQuery = pool.query;
  pool.query = async () => [[]];
  try {
    let response;
    await adminController.getAppointmentReminders({}, { json(body) { response = body; return this; } }, (error) => { throw error; });
    assert.equal(response.data.total, 0);
    assert.deepEqual(response.data.items, []);
  } finally {
    pool.query = originalQuery;
  }
});
