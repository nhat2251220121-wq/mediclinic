const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Tạo token JWT cho người dùng
 * @param {Object} payload - Thông tin người dùng { id, email, role, full_name }
 * @returns {string} token
 */
const generateToken = (payload) => {
    if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
};

/**
 * Giải mã và xác thực token JWT
 * @param {string} token 
 * @returns {Object} decoded payload
 */
const verifyJwtToken = (token) => {
    if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET is not configured.');
    return jwt.verify(token, JWT_SECRET);
};

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN,
    generateToken,
    verifyJwtToken
};
