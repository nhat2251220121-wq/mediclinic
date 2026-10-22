const http = require('http');
const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const { testConnection } = require('./config/db');
const runMigrations = require('../database/migrate');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// Nạp biến môi trường
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173').split(',').map((origin) => origin.trim());

// Socket.IO is authenticated; clients join only their own account room.
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
});

app.set('io', io);

const { verifyJwtToken } = require('./config/jwt');
const { pool } = require('./config/db');
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('unauthorized'));
        const decoded = verifyJwtToken(token);
        const [users] = await pool.query('SELECT id, role, is_active FROM users WHERE id = ?', [decoded.id]);
        if (!users[0]?.is_active) return next(new Error('unauthorized'));
        socket.user = { id: users[0].id, role: users[0].role };
        next();
    } catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);
});

// Cấu hình Middleware cơ bản
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { dotfiles: 'deny', index: false, maxAge: '1d' }));

// Gắn toàn bộ Routes vào tiền tố /api
app.use('/api', routes);

// Middleware xử lý Route 404 và Lỗi
app.use(notFoundHandler);
app.use(errorHandler);

// Khởi chạy server
const startServer = async () => {
    // Kiểm tra kết nối MySQL
    await testConnection();
    await runMigrations();

    server.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🏥 MediClinic Backend Server running on port: ${PORT}`);
        console.log(`🌐 Base API URL: http://localhost:${PORT}/api`);
        console.log(`⚡ Socket.IO Server active on port: ${PORT}`);
        console.log(`=======================================================`);
    });
};

startServer();
