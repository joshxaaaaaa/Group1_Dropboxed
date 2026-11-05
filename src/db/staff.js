// Data access for STAFF (water district staff / administrators).
const { pool } = require('./pool');

const COLUMNS = 'staff_id, full_name, email, account_status, created_at';

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(staffId) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM staff WHERE staff_id = $1`, [staffId]);
  return rows[0] || null;
}

async function getPasswordHash(staffId) {
  const { rows } = await pool.query('SELECT password_hash FROM staff WHERE staff_id = $1', [staffId]);
  return rows[0] ? rows[0].password_hash : null;
}

async function create({ fullName, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO staff (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNS}`,
    [fullName, email, passwordHash]
  );
  return rows[0];
}

async function updatePassword(staffId, passwordHash) {
  await pool.query('UPDATE staff SET password_hash = $2 WHERE staff_id = $1', [staffId, passwordHash]);
}

async function setAccountStatus(staffId, accountStatus) {
  await pool.query('UPDATE staff SET account_status = $2 WHERE staff_id = $1', [staffId, accountStatus]);
}

async function listActive() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM staff WHERE account_status = 'Active' ORDER BY full_name`
  );
  return rows;
}

// Staff with their workload, for the "Staff" page.
async function listWithWorkload() {
  const { rows } = await pool.query(
    `SELECT s.staff_id, s.full_name, s.email, s.account_status, s.created_at,
            (SELECT COUNT(*)::int
               FROM complaint_assignments a
               JOIN complaints c ON c.complaint_id = a.complaint_id
              WHERE a.staff_id = s.staff_id AND c.status <> 'Resolved') AS open_assignments,
            (SELECT COUNT(*)::int
               FROM status_logs l
              WHERE l.staff_id = s.staff_id AND l.status = 'Resolved') AS resolved_count,
            (SELECT MAX(l.updated_at) FROM status_logs l WHERE l.staff_id = s.staff_id) AS last_update_at
     FROM staff s
     ORDER BY s.account_status, s.full_name`
  );
  return rows;
}

module.exports = {
  findByEmail,
  findById,
  getPasswordHash,
  create,
  updatePassword,
  setAccountStatus,
  listActive,
  listWithWorkload,
};
