const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, testConnection } = require('../src/config/db');
const { startServer, handleStartupFailure } = require('../src/server');

test('database connection check releases a successful connection', async () => {
  const originalGetConnection = pool.getConnection;
  const originalLog = console.log;
  let released = false;
  pool.getConnection = async () => ({ release: () => { released = true; } });
  console.log = () => {};
  try {
    await testConnection();
    assert.equal(released, true);
  } finally {
    pool.getConnection = originalGetConnection;
    console.log = originalLog;
  }
});

test('database connection failure logs a safe error and rejects startup', async () => {
  const originalGetConnection = pool.getConnection;
  const originalError = console.error;
  const messages = [];
  pool.getConnection = async () => {
    const error = new Error('connection failed; password=must-not-appear');
    error.code = 'ECONNREFUSED';
    throw error;
  };
  console.error = (message) => messages.push(String(message));
  try {
    await assert.rejects(testConnection(), (error) => error.code === 'ECONNREFUSED');
    assert.match(messages.join('\n'), /ECONNREFUSED/);
    assert.doesNotMatch(messages.join('\n'), /must-not-appear|password=/i);
  } finally {
    pool.getConnection = originalGetConnection;
    console.error = originalError;
  }
});

test('HTTP listener is never opened after database connection failure', async () => {
  let listenCalled = false;
  const fakeServer = {
    once() {},
    listen() { listenCalled = true; }
  };
  await assert.rejects(startServer({
    databaseCheck: async () => { throw new Error('database unavailable'); },
    httpServer: fakeServer,
    logger: { log() {} }
  }), /database unavailable/);
  assert.equal(listenCalled, false);
});

test('startup failure closes the pool and sets a nonzero process exit code without logging secrets', async () => {
  const originalExitCode = process.exitCode;
  const messages = [];
  let poolClosed = false;
  try {
    await handleStartupFailure(Object.assign(new Error('secret password'), { code: 'ECONNREFUSED' }), {
      logger: { error: (message) => messages.push(String(message)) },
      closePool: async () => { poolClosed = true; }
    });
    assert.equal(process.exitCode, 1);
    assert.equal(poolClosed, true);
    assert.match(messages.join('\n'), /ECONNREFUSED/);
    assert.doesNotMatch(messages.join('\n'), /secret|password/i);
  } finally {
    process.exitCode = originalExitCode;
  }
});
