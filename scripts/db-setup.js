// Creates the dropboxed schema, reference data, the first staff account, and the
// database roles and privileges.
//
//   npm run db:setup             create schema (if missing), seed categories, create admin,
//                                apply database/03_roles.sql and database/04_privileges.sql
//   npm run db:setup -- --sample also load demo residents, staff and complaints
//   npm run db:setup -- --reset  drop and recreate the schema (deletes ALL data and uploads)
//
// Setup needs an administrative account but the running app must not have one, so
// the admin credentials live in .env.setup, which only the setup scripts read.
// Without .env.setup this falls back to the PG* settings in .env.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { useAdminConnection, scramVerifier } = require('./setup-env');

// Must run before pool.js is loaded, because the pool reads PGUSER and PGPASSWORD.
const runtime = useAdminConnection();
const { pool, withTransaction } = require('../src/db/pool');

const args = new Set(process.argv.slice(2));
const DB_DIR = path.join(__dirname, '..', 'database');

const admin = {
  name: process.env.ADMIN_NAME || 'System Administrator',
  email: (process.env.ADMIN_EMAIL || 'admin@dropboxed.local').toLowerCase(),
  password: process.env.ADMIN_PASSWORD || 'Admin@12345',
};
const SAMPLE_PASSWORD = process.env.SAMPLE_PASSWORD || 'Password@123';

async function runSqlFile(name) {
  const sql = fs.readFileSync(path.join(DB_DIR, name), 'utf8');
  await pool.query(sql);
  console.log(`  ran ${name}`);
}

async function schemaExists() {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'complaints'`,
    [config.dbSchema]
  );
  return rows.length > 0;
}

function clearUploads() {
  if (!fs.existsSync(config.uploadDir)) return;
  for (const entry of fs.readdirSync(config.uploadDir)) {
    if (entry === '.gitkeep') continue;
    fs.rmSync(path.join(config.uploadDir, entry), { recursive: true, force: true });
  }
}

async function main() {
  console.log(`Connecting to ${process.env.PGDATABASE || '(default database)'} on ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}`);

  if (args.has('--reset')) {
    await pool.query(`DROP SCHEMA IF EXISTS ${config.dbSchema} CASCADE`);
    clearUploads();
    console.log('  dropped schema and cleared uploads');
  }

  if (await schemaExists()) {
    console.log('  schema already exists (use --reset to recreate it)');
  } else {
    await runSqlFile('01_schema.sql');
  }
  await runSqlFile('02_seed.sql');

  const hash = await bcrypt.hash(admin.password, 10);
  const { rowCount } = await pool.query(
    `INSERT INTO staff (full_name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [admin.name, admin.email, hash]
  );
  console.log(rowCount ? `  created staff account ${admin.email}` : `  staff account ${admin.email} already exists`);

  if (args.has('--sample')) await loadSampleData();

  await applyAccessControl();

  console.log('Done.');
}

// Activity 4: creates the roles, sets their passwords and applies the privileges.
// Passwords are sent as SCRAM verifiers so plain text never reaches the server log.
async function applyAccessControl() {
  const { rows } = await pool.query('SELECT rolsuper FROM pg_roles WHERE rolname = current_user');
  if (!rows[0].rolsuper) {
    console.log('  skipped roles and privileges: this account is not a superuser (see .env.setup.example)');
    return;
  }
  await runSqlFile('03_roles.sql');
  await runSqlFile('04_privileges.sql');

  const passwords = {
    dropboxed_app: runtime.user === 'dropboxed_app' ? runtime.password : undefined,
    dropboxed_dba: process.env.DB_DBA_PASSWORD,
    dropboxed_report: process.env.DB_REPORT_PASSWORD,
    dropboxed_backup: process.env.DB_BACKUP_PASSWORD,
  };
  for (const [role, password] of Object.entries(passwords)) {
    if (password) {
      await pool.query(`ALTER ROLE ${role} PASSWORD '${scramVerifier(password)}'`);
      console.log(`  set password for ${role}`);
    } else {
      console.log(`  no password provided for ${role}; it cannot log in until one is set`);
    }
  }
}

// ---------------------------------------------------------------------
// Demo data: deterministic so every group member gets the same records.
// ---------------------------------------------------------------------
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadSampleData() {
  const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS n FROM complaints');
  if (existing[0].n > 0) {
    console.log('  complaints already exist; skipping sample data');
    return;
  }

  const rand = mulberry32(20261103);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (min, max) => min + rand() * (max - min);
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const now = Date.now();
  const hash = await bcrypt.hash(SAMPLE_PASSWORD, 10);

  const staffSeed = [
    ['Denver Reyes', 'denver.reyes@dropboxed.local'],
    ['Jan Emmanuel Dela Cruz', 'jan.delacruz@dropboxed.local'],
    ['Jhayciel Santiago', 'jhayciel.santiago@dropboxed.local'],
    ['Joshua Abalo', 'joshua.abalo@dropboxed.local'],
    ['Rhaine Cyrel Valera', 'rhaine.valera@dropboxed.local'],
  ];
  const residentSeed = [
    ['Juan Dela Cruz', 'juan.delacruz@example.com', '09171234501'],
    ['Ana Reyes', 'ana.reyes@example.com', '09171234502'],
    ['Mark Villanueva', 'mark.villanueva@example.com', null],
    ['Grace Bautista', 'grace.bautista@example.com', '09171234504'],
    ['Paolo Garcia', 'paolo.garcia@example.com', '09171234505'],
    ['Rhea Mendoza', 'rhea.mendoza@example.com', null],
    ['Carlo Aquino', 'carlo.aquino@example.com', '09171234507'],
    ['Joy Ramos', 'joy.ramos@example.com', '09171234508'],
    ['Nestor Castillo', 'nestor.castillo@example.com', '09171234509'],
    ['Lourdes Navarro', 'lourdes.navarro@example.com', '09171234510'],
  ];
  const streets = ['Rizal St.', 'Mabini St.', 'Bonifacio Ave.', 'Luna St.', 'Del Pilar St.', 'Aguinaldo St.',
    'Sampaguita St.', 'Narra St.', 'Molave St.', 'Acacia Ave.', 'Mango St.', 'Ilang-Ilang St.'];
  const descriptions = {
    'Rusty / Contaminated Water': [
      'Tap water comes out brown for the first few minutes every morning. There is visible sediment at the bottom of the pail.',
      'Water from the kitchen faucet is yellowish and smells of metal. We stopped using it for cooking.',
      'Orange-brown water after the supply came back this afternoon. White clothes are getting stained in the laundry.',
      'Cloudy water with small black particles. Our neighbours on the same street report the same problem.',
    ],
    'Low Water Pressure': [
      'Very weak flow from all faucets between 6 AM and 9 AM. The second floor gets almost no water.',
      'Water pressure has been low for three days. It takes 20 minutes to fill a single pail.',
      'Supply is intermittent; water stops completely in the afternoon and only returns late at night.',
    ],
    'Foul Odor': [
      'Water smells like rotten eggs, especially from the bathroom shower.',
      'Strong chlorine smell, much stronger than usual. Family members complain of skin irritation.',
      'Musty, sewage-like odor from the kitchen tap since yesterday.',
    ],
    'Pipe Leak': [
      'Leak at the service pipe near the water meter. Water is pooling on the sidewalk in front of the house.',
      'Pipe burst under the street outside our gate; water has been flowing for several hours.',
      'Small but constant leak at the connection before the meter. The ground is always wet.',
    ],
  };
  const resolvedRemarks = [
    'Flushed the service line and replaced the corroded section. Water tested clear.',
    'Repaired the leaking connection and restored normal pressure.',
    'Valve adjusted at the main line; pressure back to normal.',
    'Line flushing completed. Resident confirmed water is clear.',
  ];
  const progressRemarks = [
    'Field team scheduled for inspection.',
    'Inspection done; parts requested for repair.',
    'Crew dispatched to the area.',
    'Checking the main line serving this street.',
  ];

  await withTransaction(async (db) => {
    const staffIds = [];
    for (const [name, email] of staffSeed) {
      const { rows } = await db.query(
        `INSERT INTO staff (full_name, email, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING staff_id`,
        [name, email, hash]
      );
      staffIds.push(rows[0].staff_id);
    }

    const { rows: categories } = await db.query('SELECT category_id, category_name FROM complaint_categories');
    const categoryWeights = {
      'Rusty / Contaminated Water': 0.42, 'Low Water Pressure': 0.24, 'Foul Odor': 0.14, 'Pipe Leak': 0.2,
    };
    const pickCategory = () => {
      let r = rand();
      for (const c of categories) {
        r -= categoryWeights[c.category_name] ?? 0;
        if (r <= 0) return c;
      }
      return categories[0];
    };

    // Older pipelines cluster in a few barangays, so weight those more.
    const hotspots = ['Landayan', 'Poblacion', 'San Antonio', 'Pacita 1', 'Cuyab'];
    const residents = [];
    for (const [name, email, phone] of residentSeed) {
      const created = new Date(now - between(200, 260) * DAY);
      const { rows } = await db.query(
        `INSERT INTO users (full_name, email, password_hash, phone_number, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
        [name, email, hash, phone, created]
      );
      const barangay = rand() < 0.6 ? pick(hotspots) : pick(config.barangays);
      const loc = await db.query(
        `INSERT INTO locations (house_number, street, barangay, city, postal_code)
         VALUES ($1, $2, $3, $4, $5) RETURNING location_id`,
        [String(Math.floor(between(1, 300))), pick(streets), barangay, config.city, config.postalCode]
      );
      residents.push({ userId: rows[0].user_id, locationId: loc.rows[0].location_id });
    }

    let count = 0;
    for (let i = 0; i < 58; i++) {
      const resident = pick(residents);
      const category = pickCategory();
      const ageDays = Math.pow(rand(), 1.3) * 180;
      const submitted = new Date(now - ageDays * DAY - between(0, 8) * HOUR);
      const description = pick(descriptions[category.category_name]);

      // Older complaints are more likely to be finished.
      const r = rand();
      let status = 'Pending';
      if (ageDays > 20) status = r < 0.88 ? 'Resolved' : 'In Progress';
      else if (ageDays > 4) status = r < 0.45 ? 'Resolved' : r < 0.85 ? 'In Progress' : 'Pending';
      else status = r < 0.35 ? 'In Progress' : 'Pending';

      const inProgressAt = new Date(submitted.getTime() + between(4, 60) * HOUR);
      const resolvedAt = new Date(inProgressAt.getTime() + between(12, 24 * 9) * HOUR);
      const finalStatus = status === 'Resolved' && resolvedAt.getTime() > now ? 'In Progress' : status;

      const { rows } = await db.query(
        `INSERT INTO complaints (user_id, category_id, location_id, description, status, submitted_at, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING complaint_id`,
        [resident.userId, category.category_id, resident.locationId, description, finalStatus, submitted,
          finalStatus === 'Resolved' ? resolvedAt : null]
      );
      const complaintId = rows[0].complaint_id;
      count++;

      if (finalStatus !== 'Pending') {
        const staffId = pick(staffIds);
        await db.query(
          'INSERT INTO complaint_assignments (complaint_id, staff_id, assigned_at) VALUES ($1, $2, $3)',
          [complaintId, staffId, new Date(inProgressAt.getTime() - between(1, 3) * HOUR)]
        );
        await db.query(
          'INSERT INTO status_logs (complaint_id, staff_id, status, remarks, updated_at) VALUES ($1, $2, $3, $4, $5)',
          [complaintId, staffId, 'In Progress', pick(progressRemarks), inProgressAt]
        );
        if (finalStatus === 'Resolved') {
          await db.query(
            'INSERT INTO status_logs (complaint_id, staff_id, status, remarks, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [complaintId, staffId, 'Resolved', pick(resolvedRemarks), resolvedAt]
          );
        }
      }

      // A few residents re-submit the same issue within the duplicate window.
      if (finalStatus === 'Pending' && rand() < 0.3) {
        await db.query(
          `INSERT INTO complaints (user_id, category_id, location_id, description, is_flagged, flag_reason, submitted_at)
           VALUES ($1, $2, $3, $4, TRUE, $5, $6)`,
          [resident.userId, category.category_id, resident.locationId,
            `${description} Submitting again because there is still no update.`,
            `Possible duplicate of complaint #${complaintId}: same category and household within ${config.duplicateWindowHours} hours.`,
            new Date(Math.min(now - HOUR, submitted.getTime() + between(5, 30) * HOUR))]
        );
        count++;
      }
    }
    console.log(`  loaded sample data: ${staffSeed.length} staff, ${residentSeed.length} residents, ${count} complaints`);
    console.log(`  sample accounts use the password "${SAMPLE_PASSWORD}"`);
  });
}

main()
  .catch((err) => {
    console.error('Database setup failed:', err.message);
    console.error('See docs/troubleshooting.md for common setup errors and their solutions.');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
