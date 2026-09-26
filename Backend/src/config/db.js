const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Khởi tạo Connection Pool cho MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mediclinic_db',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Hàm kiểm tra kết nối Database khi khởi động Server
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ [Database] Kết nối MySQL thành công tới database:', process.env.DB_NAME || 'mediclinic_db');
        connection.release();
    } catch (error) {
        console.error('❌ [Database] Lỗi kết nối MySQL:', error.message);
        console.error('💡 Gợi ý: Hãy đảm bảo MySQL đang chạy và file database/schema.sql đã được import.');
    }
};

module.exports = {
    pool,
    testConnection
};
