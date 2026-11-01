const test = require('node:test');
const assert = require('node:assert/strict');
const { minutesUntilStart } = require('../src/controllers/cancellationController');
const { encryptBankDetails, decryptBankDetails, maskAccountNumber } = require('../src/utils/refundBankDetails');

test('uses Asia/Ho_Chi_Minh for the exact two-hour cancellation threshold', () => {
  const appointmentDate = '2026-10-31';
  const nowAtTwoHours = new Date('2026-10-31T03:00:00.000Z'); // 10:00 in Vietnam; appointment at 12:00.
  const oneSecondLater = new Date('2026-10-31T03:00:01.000Z');
  assert.equal(minutesUntilStart(appointmentDate, '12:00 - 12:30', nowAtTwoHours), 120);
  assert.ok(minutesUntilStart(appointmentDate, '12:00 - 12:30', oneSecondLater) < 120);
});

test('NO_SHOW threshold is reached only after the full 15 minutes', () => {
  const appointmentDate = '2026-10-31';
  assert.equal(minutesUntilStart(appointmentDate, '12:00 - 12:30', new Date('2026-10-31T05:15:00.000Z')), -15);
  assert.ok(minutesUntilStart(appointmentDate, '12:00 - 12:30', new Date('2026-10-31T05:14:59.000Z')) > -15);
});

test('rejects malformed clinic-local appointment date or time', () => {
  const now = new Date('2026-10-31T00:00:00.000Z');
  assert.equal(minutesUntilStart('2026-02-30', '12:00 - 12:30', now), null);
  assert.equal(minutesUntilStart('2026-10-31', 'not a time', now), null);
});

test('encrypts bank details at rest and exposes only a masked account number to patients', () => {
  const previous = process.env.REFUND_PII_ENCRYPTION_KEY;
  process.env.REFUND_PII_ENCRYPTION_KEY = 'test-only-cancellation-key-with-32-plus-chars';
  try {
    const details = { accountName: 'Patient Example', bankName: 'Test Bank', accountNumber: '123456789012' };
    const encrypted = encryptBankDetails(details);
    assert.equal(encrypted.includes(details.accountNumber), false);
    assert.deepEqual(decryptBankDetails(encrypted), details);
    assert.equal(maskAccountNumber(details.accountNumber), '•••• 9012');
  } finally {
    if (previous === undefined) delete process.env.REFUND_PII_ENCRYPTION_KEY;
    else process.env.REFUND_PII_ENCRYPTION_KEY = previous;
  }
});
