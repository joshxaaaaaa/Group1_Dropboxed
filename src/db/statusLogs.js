// Data access for STATUS_LOGS (complaint history / tracking log).
const { pool } = require('./pool');

async function create({ complaintId, staffId, status, remarks }, db = pool) {
  await db.query(
    'INSERT INTO status_logs (complaint_id, staff_id, status, remarks) VALUES ($1, $2, $3, $4)',
    [complaintId, staffId, status, remarks]
  );
}

async function listForComplaint(complaintId) {
  const { rows } = await pool.query(
    `SELECT l.status_log_id, l.status, l.remarks, l.updated_at, s.full_name AS staff_name
     FROM status_logs l
     JOIN staff s ON s.staff_id = l.staff_id
     WHERE l.complaint_id = $1
     ORDER BY l.updated_at, l.status_log_id`,
    [complaintId]
  );
  return rows;
}

module.exports = { create, listForComplaint };
