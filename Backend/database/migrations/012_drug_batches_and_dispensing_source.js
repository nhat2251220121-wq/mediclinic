const columnExists = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]
  );
  return Number(row.found) > 0;
};

const foreignKeyExists = async (connection, table, name) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`, [table, name]
  );
  return Number(row.found) > 0;
};

exports.up = async (connection) => {
  if (!(await columnExists(connection, 'drugs', 'low_stock_threshold'))) {
    await connection.query('ALTER TABLE drugs ADD COLUMN low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 10 AFTER stock_quantity');
  }
  if (!(await columnExists(connection, 'prescriptions', 'dispensing_source'))) {
    // NULL deliberately means an old prescription whose source was never captured.
    // Do not infer or rewrite the historical doctor's order.
    await connection.query("ALTER TABLE prescriptions ADD COLUMN dispensing_source ENUM('CLINIC','EXTERNAL') NULL DEFAULT NULL AFTER dispensing_status");
  }
  if (!(await columnExists(connection, 'stock_movements', 'batch_id'))) {
    await connection.query('ALTER TABLE stock_movements ADD COLUMN batch_id BIGINT UNSIGNED NULL AFTER drug_id');
  }
  if (!(await columnExists(connection, 'stock_movements', 'note'))) {
    await connection.query('ALTER TABLE stock_movements ADD COLUMN note VARCHAR(255) NULL AFTER reason');
  }

  await connection.query(`CREATE TABLE IF NOT EXISTS drug_batches (
    batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drug_id INT NOT NULL,
    batch_code VARCHAR(100) NULL,
    quantity_received INT UNSIGNED NOT NULL,
    quantity_remaining INT UNSIGNED NOT NULL,
    received_on DATE NOT NULL,
    expires_on DATE NOT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_drug_batches_drug_expiry (drug_id, expires_on, quantity_remaining),
    CONSTRAINT fk_drug_batches_drug FOREIGN KEY (drug_id) REFERENCES drugs(drug_id) ON DELETE RESTRICT,
    CONSTRAINT fk_drug_batches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_drug_batches_received CHECK (quantity_received > 0),
    CONSTRAINT chk_drug_batches_remaining CHECK (quantity_remaining >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  if (!(await foreignKeyExists(connection, 'stock_movements', 'fk_stock_movements_batch'))) {
    await connection.query('ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_batch FOREIGN KEY (batch_id) REFERENCES drug_batches(batch_id) ON DELETE RESTRICT');
  }
};
