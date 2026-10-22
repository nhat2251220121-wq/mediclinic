const hasColumn = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, column]
  );
  return Number(row.found) > 0;
};

const hasIndex = async (connection, table, index) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, [table, index]
  );
  return Number(row.found) > 0;
};

const hasForeignKey = async (connection, table, constraint) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
    [table, constraint]
  );
  return Number(row.found) > 0;
};

exports.up = async (connection) => {
  if (!(await hasColumn(connection, 'services', 'specialty_id'))) {
    // Keep existing service rows intact; the clinic must map these NULL values in admin.
    await connection.query('ALTER TABLE `services` ADD COLUMN `specialty_id` INT NULL');
  }
  if (!(await hasIndex(connection, 'services', 'idx_services_specialty'))) {
    await connection.query('ALTER TABLE `services` ADD INDEX `idx_services_specialty` (`specialty_id`)');
  }
  if (!(await hasForeignKey(connection, 'services', 'fk_services_specialty'))) {
    await connection.query(
      'ALTER TABLE `services` ADD CONSTRAINT `fk_services_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`) ON DELETE RESTRICT'
    );
  }
};
