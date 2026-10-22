'use strict';

const http = require('http');

const HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const PORT = Number(process.env.GATEWAY_PORT || 5001);
const UPSTREAM_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const UPSTREAM_PORT = Number(process.env.BACKEND_PORT || 5000);
const MAX_WEBHOOK_BYTES = 64 * 1024;
const ALLOWED_PATHS = new Map([
  ['/health', { method: 'GET', upstreamPath: '/api/health' }],
  ['/api/payments/sepay-webhook', { method: 'POST', upstreamPath: '/api/payments/sepay-webhook' }]
]);

const json = (res, status, body, headers = {}) => {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': payload.length, ...headers });
  res.end(payload);
};

const createGatewayServer = () => http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://gateway.local'); }
  catch { return json(res, 400, { success: false, message: 'Invalid request URL.' }); }

  const rule = ALLOWED_PATHS.get(url.pathname);
  if (!rule || url.search) {
    req.resume();
    return json(res, 404, { success: false, message: 'Not found.' });
  }
  if (req.method !== rule.method) {
    req.resume();
    return json(res, 405, { success: false, message: 'Method not allowed.' }, { allow: rule.method });
  }
  if (rule.method === 'POST' && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    req.resume();
    return json(res, 415, { success: false, message: 'Webhook requests must use application/json.' });
  }
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (rule.method === 'POST' && declaredLength > MAX_WEBHOOK_BYTES) {
    req.resume();
    return json(res, 413, { success: false, message: 'Webhook body is too large.' });
  }

  const headers = { ...req.headers, host: `${UPSTREAM_HOST}:${UPSTREAM_PORT}`, connection: 'close' };
  delete headers['proxy-authorization'];
  const upstream = http.request({
    hostname: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    method: rule.method,
    path: rule.upstreamPath,
    headers,
    timeout: 25000
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on('timeout', () => upstream.destroy(new Error('Backend request timed out.')));
  upstream.on('error', () => {
    if (!res.headersSent) json(res, 502, { success: false, message: 'Webhook backend is unavailable.' });
    else res.destroy();
  });

  if (rule.method !== 'POST') return upstream.end();
  let received = 0;
  req.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_WEBHOOK_BYTES) {
      upstream.destroy();
      if (!res.headersSent) json(res, 413, { success: false, message: 'Webhook body is too large.' });
      req.destroy();
    }
  });
  req.pipe(upstream);
});

if (require.main === module) {
  if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535 || !Number.isInteger(UPSTREAM_PORT) || UPSTREAM_PORT < 1 || UPSTREAM_PORT > 65535) {
    throw new Error('GATEWAY_PORT and BACKEND_PORT must be valid TCP ports.');
  }
  createGatewayServer().listen(PORT, HOST, () => {
    console.log(`Webhook gateway listening on http://${HOST}:${PORT}; only POST webhook and GET /health are allowed.`);
  });
}

module.exports = { createGatewayServer, ALLOWED_PATHS, MAX_WEBHOOK_BYTES };
