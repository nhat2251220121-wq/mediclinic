const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const runMigrations = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(190) NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((name) => /^\d+_[\w-]+\.(sql|js)$/.test(name)).sort();
  for (const file of files) {
    const [[applied]] = await pool.query('SELECT version FROM schema_migrations WHERE version = ?', [file]);
    if (applied) continue;
      const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (file.endsWith('.js')) await require(path.join(dir, file)).up(connection);
      else {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) await connection.query(statement);
      }
      await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
      await connection.commit();
      console.log(`[Database] Applied migration ${file}`);
    } catch (error) {
      await connection.rollback();
      throw new Error(`Migration ${file} failed: ${error.message}`);
    } finally {
      connection.release();
    }
  }
};

module.exports = runMigrations;
