// Data access for COMPLAINT_ASSIGNMENTS (complaints M:N staff).
const { pool } = require('./pool');

async function listForComplaint(complaintId) {
  const { rows } = await pool.query(
    `SELECT a.assignment_id, a.staff_id, a.assigned_at, s.full_name, s.email, s.account_status
     FROM complaint_assignments a
     JOIN staff s ON s.staff_id = a.staff_id
     WHERE a.complaint_id = $1
     ORDER BY a.assigned_at`,
    [complaintId]
  );
  return rows;
}

async function countForComplaint(complaintId, db = pool) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM complaint_assignments WHERE complaint_id = $1',
    [complaintId]
  );
  return rows[0].n;
}

// UNIQUE (complaint_id, staff_id) makes a repeated assignment a no-op.
async function assign(complaintId, staffId, db = pool) {
  const { rowCount } = await db.query(
    `INSERT INTO complaint_assignments (complaint_id, staff_id)
     VALUES ($1, $2)
     ON CONFLICT (complaint_id, staff_id) DO NOTHING`,
    [complaintId, staffId]
  );
  return rowCount > 0;
}

async function unassign(complaintId, staffId) {
  const { rowCount } = await pool.query(
    'DELETE FROM complaint_assignments WHERE complaint_id = $1 AND staff_id = $2',
    [complaintId, staffId]
  );
  return rowCount > 0;
}

module.exports = { listForComplaint, countForComplaint, assign, unassign };
