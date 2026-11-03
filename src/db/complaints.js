// Data access for COMPLAINTS.
const { pool } = require('./pool');

const DETAIL_SELECT = `
  SELECT c.complaint_id, c.user_id, c.category_id, c.location_id, c.description, c.status,
         c.is_flagged, c.flag_reason, c.submitted_at, c.resolved_at,
         cat.category_name,
         l.house_number, l.street, l.barangay, l.city, l.postal_code,
         u.full_name AS resident_name, u.email AS resident_email, u.phone_number AS resident_phone,
         (SELECT COUNT(*)::int FROM attachments a WHERE a.complaint_id = c.complaint_id) AS attachment_count,
         (SELECT string_agg(s.full_name, ', ' ORDER BY s.full_name)
            FROM complaint_assignments ca
            JOIN staff s ON s.staff_id = ca.staff_id
           WHERE ca.complaint_id = c.complaint_id) AS assigned_staff
  FROM complaints c
  JOIN complaint_categories cat ON cat.category_id = c.category_id
  JOIN locations l ON l.location_id = c.location_id
  JOIN users u ON u.user_id = c.user_id`;

const SORTS = {
  newest: 'c.submitted_at DESC',
  oldest: 'c.submitted_at ASC',
  status: "CASE c.status WHEN 'Pending' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END, c.submitted_at ASC",
  category: 'cat.category_name ASC, c.submitted_at DESC',
  barangay: 'l.barangay ASC, c.submitted_at DESC',
};

async function insert({ userId, categoryId, locationId, description, isFlagged, flagReason }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO complaints (user_id, category_id, location_id, description, is_flagged, flag_reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING complaint_id`,
    [userId, categoryId, locationId, description, isFlagged, flagReason]
  );
  return rows[0].complaint_id;
}

// Business Rule 10: an unresolved complaint for the same category and household
// submitted within the duplicate window.
async function findRecentSimilar({ categoryId, locationId, windowHours }, db = pool) {
  const { rows } = await db.query(
    `SELECT complaint_id, user_id
     FROM complaints
     WHERE category_id = $1
       AND location_id = $2
       AND status <> 'Resolved'
       AND submitted_at >= LOCALTIMESTAMP - make_interval(hours => $3)
     ORDER BY submitted_at ASC
     LIMIT 1`,
    [categoryId, locationId, windowHours]
  );
  return rows[0] || null;
}

async function findById(complaintId) {
  const { rows } = await pool.query(`${DETAIL_SELECT} WHERE c.complaint_id = $1`, [complaintId]);
  return rows[0] || null;
}

async function lockForUpdate(complaintId, db) {
  const { rows } = await db.query(
    'SELECT complaint_id, status FROM complaints WHERE complaint_id = $1 FOR UPDATE',
    [complaintId]
  );
  return rows[0] || null;
}

async function setStatus(complaintId, status, db = pool) {
  await db.query(
    `UPDATE complaints
     SET status = $2::varchar,
         resolved_at = CASE WHEN $2::varchar = 'Resolved' THEN LOCALTIMESTAMP ELSE NULL END
     WHERE complaint_id = $1`,
    [complaintId, status]
  );
}

async function setFlag(complaintId, isFlagged, flagReason) {
  await pool.query('UPDATE complaints SET is_flagged = $2, flag_reason = $3 WHERE complaint_id = $1', [
    complaintId,
    isFlagged,
    isFlagged ? flagReason : null,
  ]);
}

async function listForUser(userId) {
  const { rows } = await pool.query(
    `${DETAIL_SELECT} WHERE c.user_id = $1 ORDER BY c.submitted_at DESC`,
    [userId]
  );
  return rows;
}

async function countByStatusForUser(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved
     FROM complaints WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

// Filtered, sorted and paginated list for the staff complaint queue.
async function search(filters = {}) {
  const where = [];
  const params = [];
  const param = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.status === 'open') where.push("c.status <> 'Resolved'");
  else if (filters.status) where.push(`c.status = ${param(filters.status)}`);
  if (filters.categoryId) where.push(`c.category_id = ${param(filters.categoryId)}`);
  if (filters.barangay) where.push(`l.barangay = ${param(filters.barangay)}`);
  if (filters.flagged === 'yes') where.push('c.is_flagged');
  if (filters.flagged === 'no') where.push('NOT c.is_flagged');
  if (filters.assignedTo === 'none') {
    where.push('NOT EXISTS (SELECT 1 FROM complaint_assignments a WHERE a.complaint_id = c.complaint_id)');
  } else if (filters.assignedTo) {
    where.push(
      `EXISTS (SELECT 1 FROM complaint_assignments a WHERE a.complaint_id = c.complaint_id AND a.staff_id = ${param(filters.assignedTo)})`
    );
  }
  if (filters.from) where.push(`c.submitted_at >= ${param(filters.from)}::date`);
  if (filters.to) where.push(`c.submitted_at < ${param(filters.to)}::date + 1`);
  if (filters.q) {
    const text = param(`%${filters.q}%`);
    const conditions = [`c.description ILIKE ${text}`, `u.full_name ILIKE ${text}`, `l.street ILIKE ${text}`];
    const id = Number(String(filters.q).replace(/^#/, ''));
    if (Number.isInteger(id) && id > 0) conditions.push(`c.complaint_id = ${param(id)}`);
    where.push(`(${conditions.join(' OR ')})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const fromSql = `
    FROM complaints c
    JOIN complaint_categories cat ON cat.category_id = c.category_id
    JOIN locations l ON l.location_id = c.location_id
    JOIN users u ON u.user_id = c.user_id
    ${whereSql}`;

  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS total ${fromSql}`, params);
  const total = countRows[0].total;

  const pageSize = filters.pageSize || 15;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page || 1), pages);
  const orderBy = SORTS[filters.sort] || SORTS.newest;

  const { rows } = await pool.query(
    `${DETAIL_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params
  );
  return { rows, total, page, pages, pageSize };
}

module.exports = {
  SORTS,
  insert,
  findRecentSimilar,
  findById,
  lockForUpdate,
  setStatus,
  setFlag,
  listForUser,
  countByStatusForUser,
  search,
};
