-- =====================================================================
-- DropBoxed: query performance analysis (Activity 5, Part D)
-- Run as dropboxed_report. These are SELECTs, so EXPLAIN ANALYZE changes nothing:
--   psql -U dropboxed_report -d dropboxed_db -f database/maintenance/03_query_plan.sql
--
-- Query 1 is byBarangay in src/db/reports.js, run when staff open the Reports page.
-- Query 2 is findRecentSimilar in src/db/complaints.js, run on every submission.
-- Replace the dates and ids to suit your data.
-- =====================================================================

SET search_path TO dropboxed;

\echo '--- Query 1: complaints by barangay, estimated plan'
EXPLAIN
SELECT l.barangay,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE c.status = 'Pending')::int AS pending,
       COUNT(*) FILTER (WHERE c.status = 'In Progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE c.status = 'Resolved')::int AS resolved
FROM complaints c
JOIN locations l ON l.location_id = c.location_id
WHERE c.submitted_at >= '2026-01-01'::date AND c.submitted_at < '2026-12-31'::date + 1
GROUP BY l.barangay
ORDER BY total DESC, l.barangay;

\echo '--- Query 1: actual run'
EXPLAIN (ANALYZE, BUFFERS)
SELECT l.barangay,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE c.status = 'Pending')::int AS pending,
       COUNT(*) FILTER (WHERE c.status = 'In Progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE c.status = 'Resolved')::int AS resolved
FROM complaints c
JOIN locations l ON l.location_id = c.location_id
WHERE c.submitted_at >= '2026-01-01'::date AND c.submitted_at < '2026-12-31'::date + 1
GROUP BY l.barangay
ORDER BY total DESC, l.barangay;

\echo '--- Query 2: duplicate check on submission, actual run'
EXPLAIN (ANALYZE, BUFFERS)
SELECT complaint_id, user_id
FROM complaints
WHERE category_id = 1
  AND location_id = 1
  AND status <> 'Resolved'
  AND submitted_at >= LOCALTIMESTAMP - make_interval(hours => 72)
ORDER BY submitted_at ASC
LIMIT 1;
