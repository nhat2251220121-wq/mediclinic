// Additive billing flags for the doctor-save billing flow.
// Existing prescription rows default to UNBILLED so pending legacy orders can be
// billed once from their catalog snapshot before any stock is dispensed.
const columnExists = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]
  );
  return Number(row.found) > 0;
};

exports.up = async (connection) => {
  if (!(await columnExists(connection, 'prescriptions', 'billing_status'))) {
    await connection.query(
      "ALTER TABLE prescriptions ADD COLUMN billing_status ENUM('UNBILLED','BILLED') NOT NULL DEFAULT 'UNBILLED' AFTER unit_price"
    );
  }
  if (!(await columnExists(connection, 'invoices', 'cash_requested_at'))) {
    await connection.query('ALTER TABLE invoices ADD COLUMN cash_requested_at DATETIME NULL AFTER payment_method');
  }
};
