const tableInfo = async (connection, tableName) => {
  const [[row]] = await connection.query(
    `SELECT ENGINE AS engine FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [tableName]
  );
  return row || null;
};

const columnInfo = async (connection, tableName, columnName) => {
  const [[row]] = await connection.query(
    `SELECT DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, EXTRA AS extra,
     GENERATION_EXPRESSION AS generationExpression
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return row || null;
};

const indexExists = async (connection, tableName, indexName) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, [tableName, indexName]
  );
  return Number(row?.found || 0) > 0;
};

const foreignKeyExists = async (connection, tableName, constraintName) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return Number(row?.found || 0) > 0;
};

exports.up = async (connection) => {
  const appointments = await tableInfo(connection, 'appointments');
  const followUps = await tableInfo(connection, 'follow_up_visits');
  if (!appointments || !followUps) throw new Error('appointments and follow_up_visits tables must exist before migration 019.');
  if (String(appointments.engine).toUpperCase() !== 'INNODB' || String(followUps.engine).toUpperCase() !== 'INNODB') {
    throw new Error('Migration 019 requires both tables to use InnoDB.');
  }

  const followUpPk = await columnInfo(connection, 'follow_up_visits', 'follow_up_id');
  if (!followUpPk || !/^int\(/i.test(followUpPk.columnType)) throw new Error('follow_up_visits.follow_up_id must be an INT column.');
  const currentLink = await columnInfo(connection, 'appointments', 'follow_up_id');
  if (currentLink && currentLink.columnType !== followUpPk.columnType) {
    throw new Error('appointments.follow_up_id does not match follow_up_visits.follow_up_id.');
  }
  if (!currentLink) await connection.query('ALTER TABLE appointments ADD COLUMN follow_up_id INT NULL AFTER slot_id');

  const activeLink = await columnInfo(connection, 'appointments', 'active_follow_up_id');
  if (!activeLink) {
    await connection.query(
      `ALTER TABLE appointments
       ADD COLUMN active_follow_up_id INT GENERATED ALWAYS AS (
         CASE WHEN follow_up_id IS NOT NULL AND status IN ('PENDING','CONFIRMED') THEN follow_up_id ELSE NULL END
       ) STORED`
    );
  } else if (!String(activeLink.extra).toLowerCase().includes('stored generated')) {
    throw new Error('appointments.active_follow_up_id exists but is not a STORED generated column.');
  } else {
    const normalize = (value) => String(value || '').toLowerCase().replace(/[`()\s]/g, '');
    const expected = normalize("CASE WHEN follow_up_id IS NOT NULL AND status IN ('PENDING','CONFIRMED') THEN follow_up_id ELSE NULL END");
    if (normalize(activeLink.generationExpression) !== expected) {
      throw new Error('appointments.active_follow_up_id has an unexpected generated expression.');
    }
  }

  if (!(await indexExists(connection, 'appointments', 'idx_appointments_follow_up_id'))) {
    await connection.query('CREATE INDEX idx_appointments_follow_up_id ON appointments (follow_up_id)');
  }
  if (!(await indexExists(connection, 'appointments', 'uq_appointments_active_follow_up_id'))) {
    await connection.query('CREATE UNIQUE INDEX uq_appointments_active_follow_up_id ON appointments (active_follow_up_id)');
  }
  if (!(await foreignKeyExists(connection, 'appointments', 'fk_appointments_follow_up'))) {
    await connection.query(
      `ALTER TABLE appointments ADD CONSTRAINT fk_appointments_follow_up
       FOREIGN KEY (follow_up_id) REFERENCES follow_up_visits (follow_up_id) ON DELETE RESTRICT`
    );
  }
};

exports.down = async (connection) => {
  if (await foreignKeyExists(connection, 'appointments', 'fk_appointments_follow_up')) {
    await connection.query('ALTER TABLE appointments DROP FOREIGN KEY fk_appointments_follow_up');
  }
  if (await indexExists(connection, 'appointments', 'uq_appointments_active_follow_up_id')) {
    await connection.query('DROP INDEX uq_appointments_active_follow_up_id ON appointments');
  }
  if (await indexExists(connection, 'appointments', 'idx_appointments_follow_up_id')) {
    await connection.query('DROP INDEX idx_appointments_follow_up_id ON appointments');
  }
  if (await columnInfo(connection, 'appointments', 'active_follow_up_id')) {
    await connection.query('ALTER TABLE appointments DROP COLUMN active_follow_up_id');
  }
  if (await columnInfo(connection, 'appointments', 'follow_up_id')) {
    await connection.query('ALTER TABLE appointments DROP COLUMN follow_up_id');
  }
};

exports._internals = { tableInfo, columnInfo, indexExists, foreignKeyExists };
