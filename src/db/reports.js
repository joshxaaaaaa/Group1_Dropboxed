// Aggregate queries for the staff dashboard and the Reports page.
// Every report is limited to complaints submitted between `from` and `to`
// (inclusive dates, 'YYYY-MM-DD').
const { pool } = require('./pool');

const IN_PERIOD = 'c.submitted_at >= $1::date AND c.submitted_at < $2::date + 1';
const AVG_HOURS = `ROUND((AVG(EXTRACT(EPOCH FROM c.resolved_at - c.submitted_at) / 3600)
                   FILTER (WHERE c.status = 'Resolved'))::numeric, 1)::float8`;

async function summary(from, to) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE c.status = 'Pending')::int AS pending,
            COUNT(*) FILTER (WHERE c.status = 'In Progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE c.status = 'Resolved')::int AS resolved,
            COUNT(*) FILTER (WHERE c.is_flagged)::int AS flagged,
            ${AVG_HOURS} AS avg_resolution_hours
     FROM complaints c
     WHERE ${IN_PERIOD}`,
    [from, to]
  );
  return rows[0];
}

async function byCategory(from, to) {
  const { rows } = await pool.query(
    `SELECT cat.category_id, cat.category_name,
            COUNT(c.complaint_id)::int AS total,
            COUNT(c.complaint_id) FILTER (WHERE c.status = 'Pending')::int AS pending,
            COUNT(c.complaint_id) FILTER (WHERE c.status = 'In Progress')::int AS in_progress,
            COUNT(c.complaint_id) FILTER (WHERE c.status = 'Resolved')::int AS resolved,
            ${AVG_HOURS} AS avg_resolution_hours
     FROM complaint_categories cat
     LEFT JOIN complaints c ON c.category_id = cat.category_id AND ${IN_PERIOD}
     GROUP BY cat.category_id
     ORDER BY total DESC, cat.category_name`,
    [from, to]
  );
  return rows;
}

async function byBarangay(from, to) {
  const { rows } = await pool.query(
    `SELECT l.barangay,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE c.status = 'Pending')::int AS pending,
            COUNT(*) FILTER (WHERE c.status = 'In Progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE c.status = 'Resolved')::int AS resolved
     FROM complaints c
     JOIN locations l ON l.location_id = c.location_id
     WHERE ${IN_PERIOD}
     GROUP BY l.barangay
     ORDER BY total DESC, l.barangay`,
    [from, to]
  );
  return rows;
}

// Barangay x category counts, pivoted into a matrix by the route.
async function barangayCategoryMatrix(from, to) {
  const { rows } = await pool.query(
    `SELECT l.barangay, c.category_id, COUNT(*)::int AS total
     FROM complaints c
     JOIN locations l ON l.location_id = c.location_id
     WHERE ${IN_PERIOD}
     GROUP BY l.barangay, c.category_id`,
    [from, to]
  );
  return rows;
}

async function monthly(from, to) {
  const { rows } = await pool.query(
    `SELECT to_char(m, 'YYYY-MM') AS month,
            (SELECT COUNT(*)::int FROM complaints c
              WHERE c.submitted_at >= m AND c.submitted_at < m + interval '1 month'
                AND ${IN_PERIOD}) AS submitted,
            (SELECT COUNT(*)::int FROM complaints c
              WHERE c.resolved_at >= m AND c.resolved_at < m + interval '1 month'
                AND ${IN_PERIOD}) AS resolved
     FROM generate_series(date_trunc('month', $1::timestamp),
                          date_trunc('month', $2::timestamp),
                          interval '1 month') AS m
     ORDER BY m`,
    [from, to]
  );
  return rows;
}

async function staffActivity(from, to) {
  const { rows } = await pool.query(
    `SELECT s.staff_id, s.full_name,
            COUNT(l.status_log_id) FILTER (WHERE l.status = 'In Progress')::int AS started,
            COUNT(l.status_log_id) FILTER (WHERE l.status = 'Resolved')::int AS resolved,
            (SELECT COUNT(*)::int
               FROM complaint_assignments a
               JOIN complaints c ON c.complaint_id = a.complaint_id
              WHERE a.staff_id = s.staff_id AND c.status <> 'Resolved') AS open_assignments
     FROM staff s
     LEFT JOIN status_logs l
            ON l.staff_id = s.staff_id
           AND l.updated_at >= $1::date AND l.updated_at < $2::date + 1
     WHERE s.account_status = 'Active'
     GROUP BY s.staff_id
     ORDER BY resolved DESC, started DESC, s.full_name`,
    [from, to]
  );
  return rows;
}

// One row per complaint for the CSV export.
async function complaintRows(from, to) {
  const { rows } = await pool.query(
    `SELECT c.complaint_id, c.submitted_at, c.status, cat.category_name,
            l.house_number, l.street, l.barangay, l.city, l.postal_code,
            u.full_name AS resident_name, u.email AS resident_email,
            c.is_flagged, c.flag_reason, c.resolved_at,
            ROUND((EXTRACT(EPOCH FROM c.resolved_at - c.submitted_at) / 3600)::numeric, 1)::float8 AS resolution_hours,
            (SELECT string_agg(s.full_name, '; ' ORDER BY s.full_name)
               FROM complaint_assignments a JOIN staff s ON s.staff_id = a.staff_id
              WHERE a.complaint_id = c.complaint_id) AS assigned_staff,
            c.description
     FROM complaints c
     JOIN complaint_categories cat ON cat.category_id = c.category_id
     JOIN locations l ON l.location_id = c.location_id
     JOIN users u ON u.user_id = c.user_id
     WHERE ${IN_PERIOD}
     ORDER BY c.submitted_at`,
    [from, to]
  );
  return rows;
}

// Dashboard: open complaints that have waited longest without being started.
async function oldestPending(limit = 5) {
  const { rows } = await pool.query(
    `SELECT c.complaint_id, c.submitted_at, cat.category_name, l.barangay
     FROM complaints c
     JOIN complaint_categories cat ON cat.category_id = c.category_id
     JOIN locations l ON l.location_id = c.location_id
     WHERE c.status = 'Pending'
     ORDER BY c.submitted_at
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  summary,
  byCategory,
  byBarangay,
  barangayCategoryMatrix,
  monthly,
  staffActivity,
  complaintRows,
  oldestPending,
};
