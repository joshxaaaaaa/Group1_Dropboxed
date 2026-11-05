// Activity 4, Part E: tests each login role's real privileges, allowed and denied.
//
//   npm run db:verify                 print the results as a table
//   npm run db:verify -- --out f.md   also write them to a file for the PDF
//
// Each account connects with its own password. Every statement runs in a
// transaction that is rolled back, so no application data changes. A temporary
// role and database prove that outsiders and unrelated databases are refused,
// and both are dropped at the end. Exits with code 1 if any result is unexpected.
const fs = require('fs');
const { Client } = require('pg');
require('../src/config');
const { useAdminConnection, scramVerifier } = require('./setup-env');

const runtime = useAdminConnection();
const database = process.env.PGDATABASE || 'dropboxed_db';
const OUTSIDER = 'dropboxed_verify_outsider';
const UNRELATED_DB = 'dropboxed_verify_unrelated';
const OUTSIDER_PASSWORD = require('crypto').randomBytes(18).toString('hex');

const passwords = {
  dropboxed_app: runtime.user === 'dropboxed_app' ? runtime.password : process.env.DB_APP_PASSWORD,
  dropboxed_report: process.env.DB_REPORT_PASSWORD,
  dropboxed_backup: process.env.DB_BACKUP_PASSWORD,
  dropboxed_dba: process.env.DB_DBA_PASSWORD,
  [OUTSIDER]: OUTSIDER_PASSWORD,
};

const ALLOWED = 'Allowed';
const DENIED = 'Denied';
const INSERT_CATEGORY = "INSERT INTO complaint_categories (category_name) VALUES ('verify-test') RETURNING category_id";

// [account, statement, expected]. Statements starting with "@connect" test a connection.
const TESTS = [
  // Application runtime: what src/db/*.js needs.
  ['dropboxed_app', 'SELECT complaint_id, status FROM complaints LIMIT 1', ALLOWED],
  ['dropboxed_app', 'SELECT password_hash FROM users LIMIT 1', ALLOWED],
  ['dropboxed_app', INSERT_CATEGORY, ALLOWED],
  ['dropboxed_app', "UPDATE complaints SET status = 'Pending', resolved_at = NULL WHERE FALSE", ALLOWED],
  ['dropboxed_app', 'SELECT complaint_id FROM complaints LIMIT 1 FOR UPDATE', ALLOWED],
  ['dropboxed_app', 'DELETE FROM complaint_assignments WHERE FALSE', ALLOWED],
  ['dropboxed_app', 'DELETE FROM complaint_categories WHERE FALSE', ALLOWED],
  // Application runtime: what the business rules forbid.
  ['dropboxed_app', 'DELETE FROM complaints WHERE FALSE', DENIED],
  ['dropboxed_app', 'DELETE FROM users WHERE FALSE', DENIED],
  ['dropboxed_app', 'DELETE FROM attachments WHERE FALSE', DENIED],
  ['dropboxed_app', "UPDATE status_logs SET remarks = 'x' WHERE FALSE", DENIED],
  ['dropboxed_app', 'DELETE FROM status_logs WHERE FALSE', DENIED],
  ['dropboxed_app', "UPDATE users SET email = 'x@example.com' WHERE FALSE", DENIED],
  ['dropboxed_app', 'UPDATE complaints SET submitted_at = NOW() WHERE FALSE', DENIED],
  ['dropboxed_app', 'TRUNCATE status_logs', DENIED],
  ['dropboxed_app', 'DROP TABLE status_logs', DENIED],
  ['dropboxed_app', 'CREATE TABLE dropboxed.verify_test (id INTEGER)', DENIED],
  ['dropboxed_app', 'CREATE TABLE public.verify_test (id INTEGER)', DENIED],
  ['dropboxed_app', "SELECT nextval('dropboxed.complaint_categories_category_id_seq')", DENIED],
  ['dropboxed_app', '@notx CREATE DATABASE verify_new_db', DENIED],
  ['dropboxed_app', 'CREATE ROLE verify_new_role', DENIED],
  ['dropboxed_app', `@connect ${UNRELATED_DB}`, DENIED],

  // Read-only reporting and audit.
  ['dropboxed_report', 'SELECT status, COUNT(*) FROM complaints GROUP BY status', ALLOWED],
  ['dropboxed_report', 'SELECT user_id, full_name FROM users LIMIT 1', ALLOWED],
  ['dropboxed_report', 'SELECT password_hash FROM users LIMIT 1', DENIED],
  ['dropboxed_report', 'SELECT email FROM users LIMIT 1', DENIED],
  ['dropboxed_report', 'SELECT * FROM staff LIMIT 1', DENIED],
  ['dropboxed_report', "UPDATE complaints SET status = 'Resolved' WHERE FALSE", DENIED],
  ['dropboxed_report', INSERT_CATEGORY, DENIED],
  ['dropboxed_report', 'DELETE FROM complaint_assignments WHERE FALSE', DENIED],
  ['dropboxed_report', 'ANALYZE complaints', DENIED],
  ['dropboxed_report', '@notx CREATE DATABASE verify_new_db', DENIED],

  // Backup account: reads everything pg_dump needs and changes nothing.
  ['dropboxed_backup', 'SELECT password_hash FROM staff LIMIT 1', ALLOWED],
  ['dropboxed_backup', 'SELECT last_value FROM dropboxed.complaints_complaint_id_seq', ALLOWED],
  ['dropboxed_backup', 'LOCK TABLE complaints IN ACCESS SHARE MODE', ALLOWED],
  ['dropboxed_backup', "UPDATE complaints SET status = 'Resolved' WHERE FALSE", DENIED],
  ['dropboxed_backup', 'DELETE FROM attachments WHERE FALSE', DENIED],
  ['dropboxed_backup', 'CREATE ROLE verify_new_role', DENIED],

  // Database administrator: maintenance and monitoring, no DDL, not a superuser.
  ['dropboxed_dba', 'SELECT COUNT(*) FROM complaints', ALLOWED],
  ['dropboxed_dba', "UPDATE complaints SET flag_reason = NULL WHERE FALSE", ALLOWED],
  ['dropboxed_dba', 'ANALYZE complaints', ALLOWED],
  ['dropboxed_dba', '@notx VACUUM complaints', ALLOWED],
  ['dropboxed_dba', 'SELECT query FROM pg_stat_activity LIMIT 1', ALLOWED],
  ['dropboxed_dba', 'DROP TABLE status_logs', DENIED],
  ['dropboxed_dba', 'TRUNCATE status_logs', DENIED],
  ['dropboxed_dba', '@notx CREATE DATABASE verify_new_db', DENIED],
  ['dropboxed_dba', 'CREATE ROLE verify_new_role', DENIED],

  // An account with no group membership, as another project's login would be.
  [OUTSIDER, `@connect ${database}`, DENIED],
];

function newClient(user, targetDatabase = database) {
  return new Client({
    user,
    password: passwords[user] || '',
    database: targetDatabase,
    options: '-c search_path=dropboxed,public',
  });
}

async function run(user, statement) {
  const expectConnection = statement.startsWith('@connect ');
  const client = newClient(user, expectConnection ? statement.slice(9) : database);
  let skipped = null;
  // ANALYZE and VACUUM report a missing privilege as a warning, not an error.
  client.on('notice', (notice) => {
    if (/permission denied/i.test(notice.message)) skipped = notice.message;
  });
  try {
    await client.connect();
  } catch (err) {
    return { actual: DENIED, detail: err.message };
  }
  if (expectConnection) {
    await client.end();
    return { actual: ALLOWED, detail: 'connected' };
  }
  const outsideTransaction = statement.startsWith('@notx ');
  const sql = outsideTransaction ? statement.slice(6) : statement;
  try {
    if (!outsideTransaction) await client.query('BEGIN');
    const { rowCount } = await client.query(sql);
    if (skipped) return { actual: DENIED, detail: skipped };
    return { actual: ALLOWED, detail: `ok (${rowCount ?? 0} rows, rolled back)` };
  } catch (err) {
    // Only a privilege error is a denial. Anything else is a fault in the test.
    if (err.code === '42501') return { actual: DENIED, detail: err.message };
    return { actual: `Error ${err.code}`, detail: err.message };
  } finally {
    if (!outsideTransaction) await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

async function adminQuery(sql, targetDatabase = database) {
  const client = new Client({ database: targetDatabase });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\s+/g, ' ');

async function main() {
  const missing = Object.keys(passwords).filter((role) => !passwords[role]);
  if (missing.length) {
    throw new Error(`No password available for: ${missing.join(', ')}. Fill in .env and .env.setup (see docs/db-roles-setup.md).`);
  }

  await adminQuery(`CREATE DATABASE ${UNRELATED_DB}`, 'postgres');
  try {
    await adminQuery(`REVOKE ALL ON DATABASE ${UNRELATED_DB} FROM PUBLIC`, 'postgres');
    await adminQuery(`CREATE ROLE ${OUTSIDER} LOGIN PASSWORD '${scramVerifier(OUTSIDER_PASSWORD)}'`, 'postgres');

    const lines = [
      `Database: ${database}. Run at ${new Date().toISOString()}.`,
      '',
      '| # | Account | Statement or operation | Expected | Actual | Result | Server response |',
      '|---|---|---|---|---|---|---|',
    ];
    let failures = 0;
    for (const [index, [user, statement, expected]] of TESTS.entries()) {
      const { actual, detail } = await run(user, statement);
      const passed = actual === expected;
      if (!passed) failures++;
      const shown = statement.replace(/^@connect /, 'Connect to database ').replace(/^@notx /, '');
      lines.push(`| ${index + 1} | ${user} | \`${cell(shown)}\` | ${expected} | ${actual} | ${passed ? 'PASS' : 'FAIL'} | ${cell(detail)} |`);
    }

    const { rows } = await adminQuery(
      `SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
              COALESCE((SELECT string_agg(g.rolname, ', ' ORDER BY g.rolname)
                          FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
                         WHERE m.member = r.oid), '') AS member_of
       FROM pg_roles r WHERE r.rolname LIKE 'dropboxed\\_%' AND r.rolname <> '${OUTSIDER}' ORDER BY r.rolname`
    );
    lines.push('', '| Role | Can log in | Superuser | Create DB | Create role | Replication | Bypass RLS | Member of |', '|---|---|---|---|---|---|---|---|');
    for (const r of rows) {
      lines.push(`| ${r.rolname} | ${r.rolcanlogin} | ${r.rolsuper} | ${r.rolcreatedb} | ${r.rolcreaterole} | ${r.rolreplication} | ${r.rolbypassrls} | ${r.member_of} |`);
    }
    const elevated = rows.filter((r) => r.rolsuper || r.rolcreatedb || r.rolcreaterole || r.rolreplication || r.rolbypassrls);
    if (elevated.length) failures += elevated.length;

    lines.push('', `${TESTS.length} tests, ${failures} unexpected results. ${elevated.length} roles with elevated attributes.`);
    const output = lines.join('\n');
    console.log(output);

    const outIndex = process.argv.indexOf('--out');
    if (outIndex > -1 && process.argv[outIndex + 1]) fs.writeFileSync(process.argv[outIndex + 1], `${output}\n`);
    if (failures) process.exitCode = 1;
  } finally {
    await adminQuery(`DROP ROLE IF EXISTS ${OUTSIDER}`, 'postgres');
    await adminQuery('DROP DATABASE IF EXISTS verify_new_db', 'postgres');
    await adminQuery('DROP ROLE IF EXISTS verify_new_role', 'postgres');
    await adminQuery(`DROP DATABASE IF EXISTS ${UNRELATED_DB}`, 'postgres');
  }
}

main().catch((err) => {
  console.error('Privilege verification failed:', err.message);
  process.exitCode = 1;
});
