const columnExists = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(row.found) > 0;
};

exports.up = async (connection) => {
  if (!(await columnExists(connection, 'invoices', 'medicine_payment_method'))) {
    await connection.query(
      "ALTER TABLE invoices ADD COLUMN medicine_payment_method ENUM('CASH','BANK_TRANSFER') NULL DEFAULT NULL AFTER payment_method"
    );
  }
};
