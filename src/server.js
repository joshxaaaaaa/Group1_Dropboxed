const config = require('./config');
const app = require('./app');
const { pool } = require('./db/pool');

async function start() {
  try {
    const { rows } = await pool.query(
      `SELECT current_database() AS db, version() AS version, current_user AS account,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser`
    );
    console.log(`Connected to PostgreSQL database "${rows[0].db}" as ${rows[0].account} (${rows[0].version.split(',')[0]})`);
    if (rows[0].is_superuser) {
      console.warn(`WARNING: ${rows[0].account} is a superuser. Set PGUSER=dropboxed_app in .env (see docs/db-roles-setup.md).`);
    }
    if (config.usingDefaultSessionSecret) {
      console.warn('WARNING: SESSION_SECRET is not set, so a built-in development value is being used.');
    }
  } catch (err) {
    console.error(`Cannot connect to PostgreSQL: ${err.message}`);
    console.error('Check the PG* settings in .env, then run "npm run db:setup". See README.md.');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`DropBoxed is running at http://localhost:${config.port}`);
  });

  const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
