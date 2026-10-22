const addColumn = async (connection, table, column, definition) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, column]
  );
  if (!row.found) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
};

exports.up = async (connection) => {
  await addColumn(connection, 'doctors', 'avatar_url', 'VARCHAR(255) NULL');
};
