const { Pool } = require('pg');
const config = require('../config');

// Connection settings come from PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD.
// Every session works inside the dropboxed schema and the app's time zone.
const pool = new Pool({
  max: config.dbPoolMax,
  options: `-c search_path=${config.dbSchema},public -c TimeZone=${config.timezone}`,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Runs fn(client) inside BEGIN/COMMIT, rolling back if it throws.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
