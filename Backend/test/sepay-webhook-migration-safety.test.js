const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, assertDatabaseNameConfigured } = require('../src/config/db');
const migrations = require('../database/migrate');
const { validateMigrationCommand } = require('../database/migrate-cli');

const notificationsPath = require.resolve('../src/utils/invoiceNotifications');
const originalNotificationsModule = require.cache[notificationsPath];
require.cache[notificationsPath] = {
  id: notificationsPath,
  filename: notificationsPath,
  loaded: true,
  exports: {
    syncInvoiceNotification: async () => ({ changed: false }),
    emitNotificationsUpdated: () => {}
  }
};
const paymentController = require('../src/controllers/paymentController');
if (originalNotificationsModule) require.cache[notificationsPath] = originalNotificationsModule;
else delete require.cache[notificationsPath];

const validPayload = (overrides = {}) => ({
  id: 24501,
  accountNumber: 'TEST_RECEIVING_ACCOUNT',
  transferType: 'in',
  transferAmount: 125000,
  code: 'MEDICLINIC7',
  content: 'MEDICLINIC7 chuyen tien',
  description: 'bank generated description',
  referenceCode: 'TEST_REFERENCE',
  ...overrides
});

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const makeConnection = ({ duplicate = false, paid = 0 } = {}) => {
  const queries = [];
  return {
    queries,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes('FROM invoices WHERE appointment_id')) return [[{
        id: 19, patient_id: 4, total_amount: 125000, invoice_status: 'ACTIVE',
        payment_method: 'BANK_TRANSFER', appointment_id: 7
      }]];
      if (sql.includes('FROM appointments WHERE appointment_id')) return [[{ status: 'PENDING' }]];
      if (sql.includes("provider = 'SEPAY' AND external_transaction_id")) return [duplicate ? [{ payment_id: 8 }] : []];
      if (sql.includes('AS paid')) return [[{ paid }]];
      return [{ affectedRows: 1 }];
    }
  };
};

test('SePay accepts an exact code and matching original content token', () => {
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload()), 7);
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload({ code: null, content: 'MEDICLINIC7' })), 7);
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload({ code: null, content: 'MEDICLINIC7 chuyen tien' })), 7);
});

test('SePay code matching ignores description and rejects missing, ambiguous, or conflicting references', () => {
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload({ code: 'MEDICLINIC8' })), null);
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload({ code: null, content: 'ghi chu MEDICLINIC7 va MEDICLINIC8' })), null);
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload({ code: null, content: 'XMEDICLINIC7' })), null);
  assert.equal(paymentController.getAppointmentIdFromSePayPayload(validPayload({ code: null, content: '', description: 'MEDICLINIC7' })), null);
});

test('valid webhook records a partial transfer and returns SePay success contract', async () => {
  const originalGetConnection = pool.getConnection;
  const connection = makeConnection();
  const originalKey = process.env.SEPAY_API_KEY;
  const originalAccount = process.env.BANK_ACCOUNT;
  process.env.SEPAY_API_KEY = 'test-only-sepay-key';
  process.env.BANK_ACCOUNT = 'TEST_RECEIVING_ACCOUNT';
  pool.getConnection = async () => connection;
  try {
    const req = {
      headers: { authorization: 'Apikey test-only-sepay-key' },
      body: validPayload({ transferAmount: 50000 }),
      app: { get: () => ({ to: () => ({ emit: () => {} }) }) }
    };
    const res = makeResponse();
    await paymentController.sepayWebhook(req, res, (error) => { throw error; });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(connection.queries.some(({ sql }) => sql.includes('INSERT INTO payments')), true);
    assert.equal(connection.queries.some(({ sql }) => sql.includes("status = 'CONFIRMED'")), false);
  } finally {
    pool.getConnection = originalGetConnection;
    if (originalKey === undefined) delete process.env.SEPAY_API_KEY; else process.env.SEPAY_API_KEY = originalKey;
    if (originalAccount === undefined) delete process.env.BANK_ACCOUNT; else process.env.BANK_ACCOUNT = originalAccount;
  }
});

test('duplicate SePay delivery returns exactly success and does not insert another payment', async () => {
  const originalGetConnection = pool.getConnection;
  const connection = makeConnection({ duplicate: true });
  const originalKey = process.env.SEPAY_API_KEY;
  const originalAccount = process.env.BANK_ACCOUNT;
  process.env.SEPAY_API_KEY = 'test-only-sepay-key';
  process.env.BANK_ACCOUNT = 'TEST_RECEIVING_ACCOUNT';
  pool.getConnection = async () => connection;
  try {
    const req = {
      headers: { authorization: 'Apikey test-only-sepay-key' }, body: validPayload(),
      app: { get: () => null }
    };
    const res = makeResponse();
    await paymentController.sepayWebhook(req, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(connection.queries.some(({ sql }) => sql.includes('INSERT INTO payments')), false);
  } finally {
    pool.getConnection = originalGetConnection;
    if (originalKey === undefined) delete process.env.SEPAY_API_KEY; else process.env.SEPAY_API_KEY = originalKey;
    if (originalAccount === undefined) delete process.env.BANK_ACCOUNT; else process.env.BANK_ACCOUNT = originalAccount;
  }
});

test('production database configuration refuses an implicit database name', () => {
  assert.throws(() => assertDatabaseNameConfigured('production', ''), /DB_NAME must be explicitly configured/);
  assert.doesNotThrow(() => assertDatabaseNameConfigured('production', 'mediclinic_vps'));
});

test('migration CLI requires an explicit database and production confirmation for writes', () => {
  assert.throws(() => validateMigrationCommand({ databaseName: '', environment: 'development' }), /DB_NAME must be explicitly configured/);
  assert.throws(() => validateMigrationCommand({ databaseName: 'mediclinic_prod', environment: 'production', statusOnly: false, confirmProduction: false }), /--confirm-production/);
  assert.doesNotThrow(() => validateMigrationCommand({ databaseName: 'mediclinic_prod', environment: 'production', statusOnly: true, confirmProduction: false }));
  assert.doesNotThrow(() => validateMigrationCommand({ databaseName: 'mediclinic_prod', environment: 'production', statusOnly: false, confirmProduction: true }));
});

test('migration status is read-only and reports pending files when the tracking table is absent', async () => {
  const statements = [];
  const status = await migrations.getMigrationStatus({
    query: async (sql) => {
      statements.push(sql);
      return [[{ found: 0 }]];
    }
  });
  assert.equal(status.tableExists, false);
  assert.deepEqual(status.applied, []);
  assert.deepEqual(status.pending, migrations.getMigrationFiles());
  assert.equal(statements.length, 1);
  assert.match(statements[0], /information_schema\.tables/i);
  assert.doesNotMatch(statements.join('\n'), /CREATE|INSERT|UPDATE|DELETE|ALTER|DROP/i);
});

test('migration status separates applied from pending without executing migration statements', async () => {
  const files = migrations.getMigrationFiles();
  const statements = [];
  const status = await migrations.getMigrationStatus({
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('information_schema.tables')) return [[{ found: 1 }]];
      if (sql === 'SELECT version FROM schema_migrations') return [[{ version: files[0] }]];
      throw new Error(`Unexpected query: ${sql}`);
    }
  });
  assert.deepEqual(status.applied, [files[0]]);
  assert.deepEqual(status.pending, files.slice(1));
  assert.equal(statements.length, 2);
  assert.doesNotMatch(statements.join('\n'), /CREATE|INSERT|UPDATE|DELETE|ALTER|DROP/i);
});
