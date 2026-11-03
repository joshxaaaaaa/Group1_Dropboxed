const config = require('./config');
const app = require('./app');
const { pool } = require('./db/pool');

async function start() {
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    console.log(`Connected to PostgreSQL database "${rows[0].db}" (${rows[0].version.split(',')[0]})`);
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
