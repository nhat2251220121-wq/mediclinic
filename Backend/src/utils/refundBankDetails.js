const crypto = require('crypto');

const encryptionKey = () => {
  const configured = process.env.REFUND_PII_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) {
    const error = new Error('Máy chủ chưa cấu hình khóa mã hóa thông tin tài khoản hoàn tiền.');
    error.statusCode = 503;
    throw error;
  }
  return crypto.createHash('sha256').update(configured, 'utf8').digest();
};

const encryptBankDetails = (details) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(details), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
};

const decryptBankDetails = (value) => {
  if (!value) return null;
  const envelope = JSON.parse(value);
  if (envelope.v !== 1) throw new Error('Định dạng thông tin tài khoản hoàn tiền không hợp lệ.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
};

const maskAccountNumber = (accountNumber) => accountNumber ? `•••• ${String(accountNumber).slice(-4)}` : null;

module.exports = { encryptBankDetails, decryptBankDetails, maskAccountNumber };
