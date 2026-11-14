const columnExists = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(row.found) > 0;
};

exports.up = async (connection) => {
  if (!(await columnExists(connection, 'services', 'search_keywords'))) {
    await connection.query('ALTER TABLE `services` ADD COLUMN `search_keywords` TEXT NULL AFTER `description`');
  }
};
