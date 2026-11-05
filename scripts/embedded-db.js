// Development-only PostgreSQL server for machines without PostgreSQL installed.
// Runs PGlite (PostgreSQL compiled to WebAssembly) and exposes it on
// 127.0.0.1:5433 using the normal PostgreSQL wire protocol, storing data in ./.pgdata.
//
//   npm run db:embedded
//
// PGlite has a single shared session, so the per-connection settings the app
// normally sends at startup are applied here once instead.

const path = require('path');
const config = require('../src/config');

async function main() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');

  const port = Number(process.env.EMBEDDED_DB_PORT) || 5433;
  const db = await PGlite.create(path.join(__dirname, '..', '.pgdata'));
  await db.query(`SET search_path TO ${config.dbSchema}, public`);
  await db.query(`SET TimeZone TO '${config.timezone}'`);

  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  console.log(`Embedded PostgreSQL (PGlite) listening on 127.0.0.1:${port}, data in .pgdata/`);

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Embedded database failed to start:', err);
  process.exit(1);
});
