// Shared by the scripts that need more than the application's runtime account.
// .env.setup holds the administrative credentials and is never read by the app.
const crypto = require('crypto');
const path = require('path');

function loadSetupEnv() {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env.setup'));
  } catch {
    // Optional: the settings may come from real environment variables instead.
  }
}

// Points the standard PG* variables at the admin account and returns the runtime
// account they held before. Call this before anything loads src/db/pool.js.
function useAdminConnection() {
  loadSetupEnv();
  const runtime = { user: process.env.PGUSER, password: process.env.PGPASSWORD };
  if (process.env.DB_ADMIN_USER) {
    process.env.PGUSER = process.env.DB_ADMIN_USER;
    process.env.PGPASSWORD = process.env.DB_ADMIN_PASSWORD || '';
  }
  return runtime;
}

// Builds the SCRAM-SHA-256 verifier PostgreSQL stores, which is what psql's
// \password command sends, so the password itself is never in a SQL statement.
function scramVerifier(password) {
  const iterations = 4096;
  const salt = crypto.randomBytes(16);
  const salted = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const hmac = (text) => crypto.createHmac('sha256', salted).update(text).digest();
  const storedKey = crypto.createHash('sha256').update(hmac('Client Key')).digest();
  const b64 = (buffer) => buffer.toString('base64');
  return `SCRAM-SHA-256$${iterations}:${b64(salt)}$${b64(storedKey)}:${b64(hmac('Server Key'))}`;
}

module.exports = { loadSetupEnv, useAdminConnection, scramVerifier };
