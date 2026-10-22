const addColumn = async (connection, table, column, definition) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, column]
  );
  if (!row.found) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
};

exports.up = async (connection) => {
  await connection.query("ALTER TABLE prescriptions MODIFY dispensing_status ENUM('PRESCRIBED','DISPENSED','NOT_DISPENSED') NOT NULL DEFAULT 'PRESCRIBED'");
  await addColumn(connection, 'prescriptions', 'dispensed_quantity', 'INT UNSIGNED NOT NULL DEFAULT 0');
  await addColumn(connection, 'prescriptions', 'dispensed_unit_price', 'DECIMAL(12,2) NULL');
  await connection.query("UPDATE prescriptions SET dispensed_quantity = quantity, dispensed_unit_price = unit_price WHERE dispensing_status = 'DISPENSED' AND dispensed_quantity = 0");

  await addColumn(connection, 'payments', 'received_by', 'INT NULL');
  const [[cashierFk]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.referential_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'payments' AND constraint_name = 'fk_payments_received_by'`
  );
  if (!cashierFk.found) await connection.query('ALTER TABLE payments ADD CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL');

  await connection.query(`CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    recipient_user_id INT NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    invoice_id INT NULL,
    appointment_id INT NULL,
    dedupe_key VARCHAR(190) NOT NULL,
    status ENUM('ACTION_REQUIRED','PAID','REVIEW','SUPERSEDED') NOT NULL DEFAULT 'ACTION_REQUIRED',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notifications_dedupe (dedupe_key),
    INDEX idx_notifications_recipient (recipient_user_id, is_read, created_at),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_notifications_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    CONSTRAINT fk_notifications_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
