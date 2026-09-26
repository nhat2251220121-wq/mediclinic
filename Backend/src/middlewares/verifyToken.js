const { verifyJwtToken } = require('../config/jwt');

/**
 * Middleware xác thực Bearer JWT Token từ Header
 */
const verifyToken = (req, res, next) => {
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

        // Gắn thông tin user giải mã được vào req.user
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token đã hết hạn hoặc không có hiệu lực. Vui lòng đăng nhập lại.',
            error: error.message
        });
    }
};

module.exports = verifyToken;
