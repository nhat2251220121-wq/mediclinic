const addColumn = async (connection, table, column, definition) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, column]
  );
  if (!row.found) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
};

exports.up = async (connection) => {
  for (const table of ['doctors', 'specialties', 'rooms', 'services', 'drugs', 'units', 'dosage_times', 'meal_relations']) {
    await addColumn(connection, table, 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');
  }
  await addColumn(connection, 'payments', 'invoice_id', 'INT NULL');
  await addColumn(connection, 'payments', 'provider', "VARCHAR(32) NOT NULL DEFAULT 'INTERNAL'");
  await addColumn(connection, 'payments', 'external_transaction_id', 'VARCHAR(150) NULL');
  await addColumn(connection, 'payments', 'reconciliation_status', "ENUM('MATCHED','PARTIAL','OVERPAID','REVIEW') NOT NULL DEFAULT 'MATCHED'");
  await addColumn(connection, 'payments', 'expires_at', 'DATETIME NULL');
  const [[index]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'payments' AND index_name = 'uq_payments_provider_external_txn'`
  );
  if (!index.found) await connection.query('CREATE UNIQUE INDEX uq_payments_provider_external_txn ON payments (provider, external_transaction_id)');
  const [[fk]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.referential_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'payments' AND constraint_name = 'fk_payments_invoice'`
  );
  if (!fk.found) await connection.query('ALTER TABLE payments ADD CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT');
  await addColumn(connection, 'prescriptions', 'quantity', 'INT UNSIGNED NOT NULL DEFAULT 1');
  await addColumn(connection, 'prescriptions', 'unit_price', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumn(connection, 'prescriptions', 'dispensing_status', "ENUM('PRESCRIBED','DISPENSED') NOT NULL DEFAULT 'PRESCRIBED'");
  await addColumn(connection, 'prescriptions', 'dispensed_at', 'DATETIME NULL');
  await addColumn(connection, 'appointments', 'shift_employee_id', 'INT NULL');
  await addColumn(connection, 'appointments', 'full_name', 'VARCHAR(150) NULL');
  await addColumn(connection, 'appointments', 'phone_number', 'VARCHAR(20) NULL');
  const [[legacyName]] = await connection.query(`SELECT COUNT(*) AS found FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'appointments' AND column_name = 'fullname'`);
  if (legacyName.found) await connection.query('UPDATE appointments SET full_name = COALESCE(full_name, fullname) WHERE fullname IS NOT NULL');
  const [[legacyPhone]] = await connection.query(`SELECT COUNT(*) AS found FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'appointments' AND column_name = 'phoneNumber'`);
  if (legacyPhone.found) await connection.query('UPDATE appointments SET phone_number = COALESCE(phone_number, phoneNumber) WHERE phoneNumber IS NOT NULL');
  const [[shiftIndex]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'shift_employee' AND index_name = 'uq_shift_day_shift'`
  );
  if (!shiftIndex.found) await connection.query('CREATE UNIQUE INDEX uq_shift_day_shift ON shift_employee (shift_day_employee_id, shift_id)');
  const [[slotFk]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.referential_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'appointments' AND constraint_name = 'fk_app_shift_slot'`
  );
  if (!slotFk.found) await connection.query('ALTER TABLE appointments ADD CONSTRAINT fk_app_shift_slot FOREIGN KEY (shift_employee_id) REFERENCES shift_employee(id) ON DELETE RESTRICT');

  await connection.query(`CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    item_type ENUM('SERVICE','MEDICINE','OTHER') NOT NULL,
    item_reference_id INT NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_invoice_items_invoice (invoice_id),
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    CONSTRAINT chk_invoice_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_invoice_items_line_total CHECK (line_total >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    drug_id INT NOT NULL,
    quantity_delta INT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    reference_type VARCHAR(40) NULL,
    reference_id BIGINT NULL,
    performed_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_movements_drug_time (drug_id, created_at),
    INDEX idx_stock_movements_reference (reference_type, reference_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
