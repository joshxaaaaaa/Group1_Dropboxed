// Data access for USERS (resident accounts).
const { pool } = require('./pool');

const COLUMNS = 'user_id, full_name, email, phone_number, account_status, created_at';

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(userId) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users WHERE user_id = $1`, [userId]);
  return rows[0] || null;
}

async function getPasswordHash(userId) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
  return rows[0] ? rows[0].password_hash : null;
}

async function create({ fullName, email, passwordHash, phoneNumber }) {
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, phone_number)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [fullName, email, passwordHash, phoneNumber]
  );
  return rows[0];
}

async function updateProfile(userId, { fullName, phoneNumber }) {
  await pool.query('UPDATE users SET full_name = $2, phone_number = $3 WHERE user_id = $1', [
    userId,
    fullName,
    phoneNumber,
  ]);
}

async function updatePassword(userId, passwordHash) {
  await pool.query('UPDATE users SET password_hash = $2 WHERE user_id = $1', [userId, passwordHash]);
}

async function setAccountStatus(userId, accountStatus) {
  await pool.query('UPDATE users SET account_status = $2 WHERE user_id = $1', [userId, accountStatus]);
}

// Residents with complaint counts, for the staff "Residents" page.
async function list({ q } = {}) {
  const { rows } = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.phone_number, u.account_status, u.created_at,
            COUNT(c.complaint_id)::int AS complaint_count,
            COUNT(c.complaint_id) FILTER (WHERE c.status <> 'Resolved')::int AS open_count,
            MAX(c.submitted_at) AS last_complaint_at
     FROM users u
     LEFT JOIN complaints c ON c.user_id = u.user_id
     WHERE $1::text IS NULL OR u.full_name ILIKE $1 OR u.email ILIKE $1
     GROUP BY u.user_id
     ORDER BY u.created_at DESC`,
    [q ? `%${q}%` : null]
  );
  return rows;
}

module.exports = {
  findByEmail,
  findById,
  getPasswordHash,
  create,
  updateProfile,
  updatePassword,
  setAccountStatus,
  list,
};
