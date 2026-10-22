require('dotenv').config();
const { pool } = require('../src/config/db');
const runMigrations = require('./migrate');

runMigrations()
  .then(() => console.log('[Database] Migrations are up to date.'))
  .catch((error) => { console.error('[Database] Migration failed:', error.message); process.exitCode = 1; })
  .finally(() => pool.end());
