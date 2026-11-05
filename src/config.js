const path = require('path');

// Load .env if present (Node 21.7+). Database settings use the standard
// libpq variables PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD.
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  // .env is optional; real environment variables still apply.
}

const config = {
  port: Number(process.env.PORT) || 3000,
  timezone: process.env.APP_TIMEZONE || 'Asia/Manila',
  dbSchema: 'dropboxed',
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  usingDefaultSessionSecret: !process.env.SESSION_SECRET,
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024,
  maxUploadFiles: 5,
  // Business Rule 10: same category + same household within this window is flagged.
  duplicateWindowHours: Number(process.env.DUPLICATE_WINDOW_HOURS) || 72,

  city: 'San Pedro',
  postalCode: '4023',
  barangays: [
    'Bagong Silang', 'Calendola', 'Chrysanthemum', 'Cuyab', 'Estrella', 'Fatima',
    'G.S.I.S.', 'Landayan', 'Langgam', 'Laram', 'Magsaysay', 'Maharlika', 'Narra',
    'Nueva', 'Pacita 1', 'Pacita 2', 'Poblacion', 'Riverside', 'Rosario',
    'Sampaguita Village', 'San Antonio', 'San Lorenzo Ruiz', 'San Roque',
    'San Vicente', 'Santo Niño', 'United Bayanihan', 'United Better Living',
  ],
};

// TIMESTAMP columns have no time zone, so Node and PostgreSQL must agree on one.
process.env.TZ = config.timezone;

module.exports = config;
