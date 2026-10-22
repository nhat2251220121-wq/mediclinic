const windows = new Map();

const rateLimit = ({ windowMs, max, message }) => (req, res, next) => {
  const key = `${req.baseUrl}${req.path}:${req.ip || req.socket.remoteAddress}`;
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
  entry.count += 1;
  windows.set(key, entry);
  if (entry.count > max) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ success: false, message });
  }
  if (windows.size > 10000) {
    for (const [key, value] of windows) if (value.resetAt <= now) windows.delete(key);
  }
  next();
};

module.exports = rateLimit;
