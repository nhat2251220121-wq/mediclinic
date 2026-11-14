require('dotenv').config();

const validateMigrationCommand = ({ databaseName, environment, statusOnly, confirmProduction }) => {
  if (!String(databaseName || '').trim()) {
    throw new Error('DB_NAME must be explicitly configured before running migration commands.');
  }
  if (!statusOnly && environment === 'production' && !confirmProduction) {
    throw new Error('Production migration execution requires the explicit --confirm-production flag.');
  }
};

const run = async (args = process.argv) => {
  const isStatusOnly = args.includes('--status');
  validateMigrationCommand({
    databaseName: process.env.DB_NAME,
    environment: process.env.NODE_ENV,
    statusOnly: isStatusOnly,
    confirmProduction: args.includes('--confirm-production')
  });

  const { pool } = require('../src/config/db');
  const runMigrations = require('./migrate');
  try {
    if (isStatusOnly) {
      const status = await runMigrations.getMigrationStatus(pool);
      console.log(`[Database] schema_migrations table: ${status.tableExists ? 'present' : 'not present (read-only check)'}`);
      console.log(`[Database] Applied migrations: ${status.applied.length}`);
      console.log(`[Database] Pending migrations: ${status.pending.length}`);
      for (const file of status.pending) console.log(`PENDING ${file}`);
      if (status.pending.length === 0) console.log('[Database] No pending migrations.');
      return;
    }

    await runMigrations();
    console.log('[Database] Migrations are up to date.');
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error('[Database] Migration command refused or failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { run, validateMigrationCommand };
