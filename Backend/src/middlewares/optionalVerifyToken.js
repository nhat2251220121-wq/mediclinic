const verifyToken = require('./verifyToken');

// Public routes may be used without a session. If a token is supplied,
// validate it against the active account so role-specific data is never
// selected from a client-controlled role value.
const createOptionalVerifyToken = (verify = verifyToken) => (req, res, next) => {
  if (!req.headers?.authorization) return next();
  return verify(req, res, next);
};

module.exports = createOptionalVerifyToken();
module.exports.createOptionalVerifyToken = createOptionalVerifyToken;
