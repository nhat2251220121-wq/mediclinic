const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mediclinic_default_secret_jwt_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Tạo token JWT cho người dùng
 * @param {Object} payload - Thông tin người dùng { id, email, role, full_name }
 * @returns {string} token
 */
const generateToken = (payload) => {
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
    return jwt.verify(token, JWT_SECRET);
};

module.exports = {
    JWT_SECRET,
    JWT_EXPIRES_IN,
    generateToken,
    verifyJwtToken
};
