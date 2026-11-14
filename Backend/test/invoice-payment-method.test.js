const test = require('node:test');
const assert = require('node:assert/strict');
const invoiceController = require('../src/controllers/invoiceController');
const { pool } = require('../src/config/db');

test('cash request refuses to switch a QR invoice to cash', async () => {
  const originalGetConnection = pool.getConnection;
  const queries = [];
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      queries.push(sql);
      return [[{
        id: 42,
        patient_id: 7,
        appointment_id: 15,
        total_amount: 300000,
        invoice_status: 'ACTIVE',
        payment_method: 'BANK_TRANSFER'
      }]];
    }
  });

  try {
    let statusCode;
    let responseBody;
    const req = { params: { id: '42' }, user: { id: 7 }, app: { get: () => null } };
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { responseBody = body; return this; }
    };

    await invoiceController.requestCashPayment(req, res, (error) => { throw error; });

    assert.equal(statusCode, 409);
    assert.match(responseBody.message, /đã chọn QR/i);
    assert.equal(queries.length, 1, 'the handler must stop before any payment or invoice update');
  } finally {
    pool.getConnection = originalGetConnection;
  }
});
