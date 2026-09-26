/**
 * Middleware tập trung xử lý lỗi toàn hệ thống Express
 */
const errorHandler = (err, req, res, next) => {
    console.error('🔥 [Unhandled Error]:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Đã xảy ra lỗi nội bộ trên máy chủ.';

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

/**
 * Middleware bắt 404 cho routes không tồn tại
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Đường dẫn API [${req.method}] ${req.originalUrl} không tồn tại trên hệ thống.`
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
