const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const assertDatabaseNameConfigured = (environment = process.env.NODE_ENV, databaseName = process.env.DB_NAME) => {
    if (environment === 'production' && !String(databaseName || '').trim()) {
        throw new Error('DB_NAME must be explicitly configured in production.');
    }
};

assertDatabaseNameConfigured();

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
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('✅ [Database] Kết nối MySQL thành công tới database:', process.env.DB_NAME || 'mediclinic_db');
    } catch (error) {
        const safeCode = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'EACCES', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].includes(error?.code)
            ? error.code
            : 'DB_CONNECTION_FAILED';
        console.error(`❌ [Database] Không kết nối được MySQL (${safeCode}). Backend sẽ không khởi động.`);
        const startupError = new Error('MySQL connection failed.');
        startupError.code = safeCode;
        throw startupError;
    } finally {
        connection?.release();
    }
};

module.exports = {
    pool,
    testConnection,
    assertDatabaseNameConfigured
};
