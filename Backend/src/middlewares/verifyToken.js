const { verifyJwtToken } = require('../config/jwt');
const { pool } = require('../config/db');

/**
 * Middleware xác thực Bearer JWT Token từ Header
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Không tìm thấy Token xác thực hoặc Token không hợp lệ.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyJwtToken(token);

        const [users] = await pool.query(
            'SELECT id, role, is_active FROM users WHERE id = ?', [decoded.id]
        );
        if (!users.length || !users[0].is_active) {
            return res.status(401).json({ success: false, message: 'Tài khoản không còn hoạt động. Vui lòng đăng nhập lại.' });
        }
        req.user = { ...decoded, id: users[0].id, role: users[0].role };
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token đã hết hạn hoặc không có hiệu lực. Vui lòng đăng nhập lại.',
        });
    }
};

module.exports = verifyToken;
