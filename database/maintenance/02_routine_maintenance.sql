-- =====================================================================
-- DropBoxed: routine maintenance (Activity 5, Part C)
-- Run as dropboxed_dba, which holds MAINTAIN on these tables and is not a superuser:
--   psql -U dropboxed_dba -d dropboxed_db -f database/maintenance/02_routine_maintenance.sql
--
-- Do not run this inside a transaction: VACUUM must be a standalone command.
-- VACUUM FULL is left out on purpose because it takes an exclusive lock.
-- =====================================================================

\echo '--- ANALYZE: refresh planner statistics for the whole schema'
ANALYZE VERBOSE dropboxed.users, dropboxed.staff, dropboxed.complaint_categories,
                dropboxed.locations, dropboxed.complaints, dropboxed.complaint_assignments,
                dropboxed.status_logs, dropboxed.attachments;

\echo '--- VACUUM: complaints has the most UPDATEs (every status and flag change)'
VACUUM (VERBOSE, ANALYZE) dropboxed.complaints;

\echo '--- Confirm that the operations ran'
SELECT relname, n_dead_tup, last_vacuum, last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'dropboxed'
ORDER BY relname;
