exports.up = async (connection) => {
  await connection.query(`CREATE TABLE IF NOT EXISTS password_reset_otps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME NULL,
    consumed_at DATETIME NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_email_created (email, created_at),
    INDEX idx_password_reset_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
