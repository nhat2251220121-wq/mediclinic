const columnExists = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]
  );
  return Number(row.found) > 0;
};

exports.up = async (connection) => {
  if (!(await columnExists(connection, 'appointments', 'status'))) throw new Error('appointments.status is missing');
  const [[appointmentStatus]] = await connection.query(
    `SELECT COLUMN_TYPE AS column_type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'status'`
  );
  if (!String(appointmentStatus.column_type).includes('NO_SHOW')) {
    await connection.query("ALTER TABLE appointments MODIFY status ENUM('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'PENDING'");
  }
  if (!(await columnExists(connection, 'invoices', 'invoice_status'))) {
    await connection.query("ALTER TABLE invoices ADD COLUMN invoice_status ENUM('ACTIVE','VOID') NOT NULL DEFAULT 'ACTIVE' AFTER payment_status");
  }

  await connection.query(`CREATE TABLE IF NOT EXISTS appointment_cancellation_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    invoice_id INT NULL,
    patient_id INT NOT NULL,
    request_source ENUM('PATIENT','CLINIC') NOT NULL,
    patient_reason TEXT NULL,
    clinic_reason TEXT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    under_2_hours BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    processed_by INT NULL,
    processed_at DATETIME NULL,
    decision_note TEXT NULL,
    approved_refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    refund_status ENUM('NOT_REQUIRED','PENDING','PARTIAL','COMPLETED') NOT NULL DEFAULT 'NOT_REQUIRED',
    bank_details_encrypted TEXT NULL,
    INDEX idx_cancel_requests_status_time (status, requested_at),
    INDEX idx_cancel_requests_appointment (appointment_id, requested_at),
    INDEX idx_cancel_requests_patient (patient_id, requested_at),
    CONSTRAINT fk_cancel_request_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cancel_request_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cancel_request_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cancel_request_admin FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_cancel_request_refund_amount CHECK (approved_refund_amount >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS appointment_refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cancellation_request_id BIGINT UNSIGNED NOT NULL,
    payment_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    refund_method ENUM('BANK_TRANSFER','CASH_COUNTER') NOT NULL,
    status ENUM('PENDING','COMPLETED') NOT NULL DEFAULT 'PENDING',
    confirmed_by INT NULL,
    confirmed_at DATETIME NULL,
    reference_code VARCHAR(150) NULL,
    note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cancellation_refund_payment (cancellation_request_id, payment_id),
    INDEX idx_appointment_refunds_payment_status (payment_id, status),
    CONSTRAINT fk_appointment_refund_request FOREIGN KEY (cancellation_request_id) REFERENCES appointment_cancellation_requests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_refund_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_refund_admin FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_appointment_refund_amount CHECK (amount > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
