// Data access for ATTACHMENTS (photo evidence metadata).
const { pool } = require('./pool');

async function create({ complaintId, fileName, filePath, fileType, fileSizeBytes }, db = pool) {
  await db.query(
    `INSERT INTO attachments (complaint_id, file_name, file_path, file_type, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)`,
    [complaintId, fileName, filePath, fileType, fileSizeBytes]
  );
}

async function listForComplaint(complaintId) {
  const { rows } = await pool.query(
    `SELECT attachment_id, file_name, file_type, file_size_bytes, uploaded_at
     FROM attachments WHERE complaint_id = $1 ORDER BY attachment_id`,
    [complaintId]
  );
  return rows;
}

// Includes the owning resident so the route can check access.
async function findById(attachmentId) {
  const { rows } = await pool.query(
    `SELECT a.*, c.user_id
     FROM attachments a
     JOIN complaints c ON c.complaint_id = a.complaint_id
     WHERE a.attachment_id = $1`,
    [attachmentId]
  );
  return rows[0] || null;
}

module.exports = { create, listForComplaint, findById };
