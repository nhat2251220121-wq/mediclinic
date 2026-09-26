const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection } = require('./config/db');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// Nạp biến môi trường
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình Middleware cơ bản
app.use(cors({
    origin: '*', // Trong production nên đổi thành domain cụ thể của Frontend
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gắn toàn bộ Routes vào tiền tố /api
app.use('/api', routes);

// Middleware xử lý Route 404 và Lỗi
app.use(notFoundHandler);
app.use(errorHandler);

// Khởi chạy server
const startServer = async () => {
    // Kiểm tra kết nối MySQL
    await testConnection();

    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🏥 MediClinic Backend Server running on port: ${PORT}`);
        console.log(`🌐 Base API URL: http://localhost:${PORT}/api`);
        console.log(`🤖 AI Symptom Classifier: http://localhost:${PORT}/api/ai/classify-symptom`);
        console.log(`=======================================================`);
    });
};

startServer();
