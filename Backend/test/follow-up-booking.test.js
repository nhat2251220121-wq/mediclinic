const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/db');
const appointmentController = require('../src/controllers/appointmentController');
const { resolveFollowUpStatus, validateFollowUpBooking } = require('../src/utils/followUps');

const futureDate = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 10);
  return date.toISOString().slice(0, 10);
};

const makeHarness = ({ linked = [], patientId = 41, specialtyId = 6, followUpId = 7 } = {}) => {
  const shared = {
    linked: [...linked], appointments: [], invoices: [], invoiceItems: [], slots: new Map(), nextAppointmentId: 900,
    nextInvoiceId: 700, lockTail: Promise.resolve()
  };
  const originalGetConnection = pool.getConnection;

  const acquireFollowUpLock = async () => {
    let release;
    const lock = new Promise((resolve) => { release = resolve; });
    const previous = shared.lockTail;
    shared.lockTail = previous.then(() => lock);
    await previous;
    return release;
  };

  pool.getConnection = async () => {
    let releaseLock = null;
    const connection = {
      async beginTransaction() {},
      async commit() { releaseLock?.(); releaseLock = null; },
      async rollback() { releaseLock?.(); releaseLock = null; },
      release() { releaseLock?.(); releaseLock = null; },
      async query(sql, params = []) {
        if (sql.includes('FROM follow_up_visits fv JOIN appointment_records mr') && sql.includes('FOR UPDATE')) {
          releaseLock = await acquireFollowUpLock();
          return [[{ follow_up_id: followUpId, patient_id: patientId, source_specialty_id: specialtyId, source_service_id: 21 }], []];
        }
        if (sql.includes('SELECT a.appointment_id, a.status') && sql.includes('a.follow_up_id = ?')) return [[
          ...shared.linked,
          ...shared.appointments
        ].filter((item) => Number(item.follow_up_id) === Number(params[0])), []];
        if (sql.includes('SELECT d.id, d.specialty_id')) return [[{ id: 13, specialty_id: specialtyId }], []];
        if (sql.includes('SELECT se.id AS shift_employee_id')) {
          const slotId = Number(params[0]);
          if (!shared.slots.has(slotId)) shared.slots.set(slotId, 'AVAILABLE');
          return shared.slots.get(slotId) === 'AVAILABLE'
            ? [[{ shift_employee_id: 31, slot_id: slotId, time_slot: '09:30 - 10:00', start_time: '09:30' }], []]
            : [[], []];
        }
        if (sql.includes('SELECT id, name, price, specialty_id FROM services')) return [[{ id: 21, name: 'Tái khám chuyên khoa', price: 50000, specialty_id: specialtyId }], []];
        if (sql.includes('SELECT id FROM specialties')) return [[{ id: specialtyId }], []];
        if (sql.includes('SELECT appointment_id FROM appointments WHERE slot_id')) {
          return [shared.appointments.filter((item) => Number(item.slot_id) === Number(params[0]) && item.status !== 'CANCELLED'), []];
        }
        if (sql.includes('INSERT INTO appointments')) {
          const appointment = {
            appointment_id: shared.nextAppointmentId++, patient_id: params[0], doctor_id: params[1], service_id: params[2],
            slot_id: params[4], follow_up_id: params[5] == null ? null : Number(params[5]), appointment_date: params[6], status: 'PENDING'
          };
          if (appointment.follow_up_id && shared.appointments.some((item) => item.follow_up_id === appointment.follow_up_id && ['PENDING', 'CONFIRMED'].includes(item.status))) {
            throw Object.assign(new Error('Duplicate entry for uq_appointments_active_follow_up_id'), { code: 'ER_DUP_ENTRY' });
          }
          shared.appointments.push(appointment);
          if (appointment.follow_up_id) shared.linked.push(appointment);
          return [{ insertId: appointment.appointment_id }, []];
        }
        if (sql.includes("UPDATE shift_time_slots SET status = 'BOOKED'")) {
          const slotId = Number(params[0]);
          if (shared.slots.get(slotId) !== 'AVAILABLE') return [{ affectedRows: 0 }, []];
          shared.slots.set(slotId, 'BOOKED');
          return [{ affectedRows: 1 }, []];
        }
        if (sql.includes('INSERT INTO invoices')) {
          const invoice = { id: shared.nextInvoiceId++, appointment_id: params[0], patient_id: params[1], total_amount: params[3] };
          shared.invoices.push(invoice);
          return [{ insertId: invoice.id }, []];
        }
        if (sql.includes('INSERT INTO invoice_items')) { shared.invoiceItems.push({ params }); return [{ insertId: shared.invoiceItems.length }, []]; }
        return [[], []];
      }
    };
    return connection;
  };

  const request = (slotId, followUp = true, serviceId = 21) => ({
    user: { id: patientId, role: 'PATIENT' },
    body: {
      doctor_id: 13, service_id: serviceId, payment_method: 'CASH', slot_id: slotId,
      appointment_date: futureDate(), initial_symptoms: 'Tái khám theo lời hẹn',
      ...(followUp ? { follow_up_id: followUpId } : {})
    },
    params: {}, query: {}, app: { get: () => null }
  });
  const invoke = async (req) => {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let forwardedError = null;
    await appointmentController.createAppointment(req, response, (error) => { forwardedError = error; });
    if (forwardedError) throw forwardedError;
    return response;
  };
  return { shared, request, invoke, restore: () => { pool.getConnection = originalGetConnection; } };
};

test('follow-up state is based on direct appointment status and a saved record', () => {
  assert.equal(resolveFollowUpStatus({ active_appointment_id: 1 }), 'BOOKED');
  assert.equal(resolveFollowUpStatus({ completed_appointment_id: 2, completed_has_record: 1 }), 'COMPLETED');
  assert.equal(resolveFollowUpStatus({ completed_appointment_id: 2, completed_has_record: 0 }), 'DATA_ISSUE');
  assert.equal(resolveFollowUpStatus({ latest_appointment_status: 'CANCELLED' }), 'NOT_BOOKED');
  assert.equal(resolveFollowUpStatus({ latest_appointment_status: 'NO_SHOW' }), 'NOT_BOOKED');
});

test('booking validation rejects another patient, active bookings, completed and mismatched specialties', () => {
  const followUp = { patient_id: 41, source_specialty_id: 6 };
  assert.equal(validateFollowUpBooking({ followUp, patientId: 99 }).status, 403);
  assert.equal(validateFollowUpBooking({ followUp, patientId: 41, linkedAppointments: [{ status: 'PENDING' }] }).status, 409);
  assert.equal(validateFollowUpBooking({ followUp, patientId: 41, linkedAppointments: [{ status: 'CONFIRMED' }] }).status, 409);
  assert.equal(validateFollowUpBooking({ followUp, patientId: 41, linkedAppointments: [{ status: 'COMPLETED', has_medical_record: 1 }] }).status, 409);
  assert.match(validateFollowUpBooking({ followUp, patientId: 41, selectedServiceSpecialtyId: 8 }).message, /cùng chuyên khoa/);
  assert.equal(validateFollowUpBooking({ followUp, patientId: 41, selectedServiceSpecialtyId: 6 }), null);
  assert.equal(validateFollowUpBooking({ followUp: { patient_id: 41 }, patientId: 41 }).status, 409);
});

test('cancelled or no-show attempts remain in history and allow a new linked appointment and invoice', async () => {
  for (const oldStatus of ['CANCELLED', 'NO_SHOW']) {
    const harness = makeHarness({ linked: [{ appointment_id: 30, follow_up_id: 7, status: oldStatus }] });
    try {
      const response = await harness.invoke(harness.request(oldStatus === 'CANCELLED' ? 51 : 52));
      assert.equal(response.statusCode, 201, JSON.stringify(response.body));
      assert.equal(harness.shared.linked[0].status, oldStatus);
      assert.equal(harness.shared.appointments.length, 1);
      assert.equal(harness.shared.appointments[0].follow_up_id, 7);
      assert.equal(harness.shared.invoices.length, 1);
      assert.equal(harness.shared.invoices[0].appointment_id, response.body.data.appointment_id);
      assert.equal(harness.shared.invoiceItems.length, 1);
    } finally { harness.restore(); }
  }
});

test('two concurrent requests for one follow-up and different slots create one appointment and invoice', async () => {
  const harness = makeHarness();
  try {
    const results = await Promise.all([harness.invoke(harness.request(61)), harness.invoke(harness.request(62))]);
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [201, 409], JSON.stringify(results.map((result) => result.body)));
    assert.equal(harness.shared.appointments.filter((item) => item.follow_up_id === 7).length, 1);
    assert.equal(harness.shared.invoices.length, 1);
    assert.equal([...harness.shared.slots.values()].filter((status) => status === 'BOOKED').length, 1);
  } finally { harness.restore(); }
});

test('PENDING, CONFIRMED, and COMPLETED follow-ups are rejected before writing appointment or invoice', async () => {
  for (const linked of [
    [{ follow_up_id: 7, status: 'PENDING' }],
    [{ follow_up_id: 7, status: 'CONFIRMED' }],
    [{ follow_up_id: 7, status: 'COMPLETED', has_medical_record: 1 }],
    [{ follow_up_id: 7, status: 'COMPLETED', has_medical_record: 0 }]
  ]) {
    const harness = makeHarness({ linked });
    try {
      const response = await harness.invoke(harness.request(81));
      assert.equal(response.statusCode, 409);
      assert.equal(harness.shared.appointments.length, 0);
      assert.equal(harness.shared.invoices.length, 0);
      assert.equal(harness.shared.slots.size, 0);
    } finally { harness.restore(); }
  }
});

test('regular appointment without follow_up_id still creates its normal invoice', async () => {
  const harness = makeHarness();
  try {
    const response = await harness.invoke(harness.request(71, false));
    assert.equal(response.statusCode, 201);
    assert.equal(harness.shared.appointments[0].follow_up_id, null);
    assert.equal(harness.shared.invoices.length, 1);
  } finally { harness.restore(); }
});

test('migration and schema define the direct FK and one-active-booking constraint without backfilling', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../database/migrations/019_appointment_follow_up_link.js'), 'utf8');
  const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  assert.match(migration, /FOREIGN KEY \(follow_up_id\) REFERENCES follow_up_visits \(follow_up_id\) ON DELETE RESTRICT/);
  assert.match(migration, /CREATE UNIQUE INDEX uq_appointments_active_follow_up_id/);
  assert.match(migration, /status IN \('PENDING','CONFIRMED'\)/);
  assert.match(schema, /UNIQUE KEY `uq_appointments_active_follow_up_id`/);
  assert.match(schema, /FOREIGN KEY \(`follow_up_id`\) REFERENCES `follow_up_visits`\(`follow_up_id`\)/);
  assert.doesNotMatch(migration, /UPDATE\s+appointments\s+SET\s+follow_up_id/i);
});
