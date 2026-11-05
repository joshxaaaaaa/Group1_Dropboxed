-- =====================================================================
-- DropBoxed: verify a restored database (Activity 6, Part C)
-- Read-only. Run as postgres against the restored copy, and against the original
-- to compare the results:
--   psql -U postgres -d dropboxed_restore_test -f database/maintenance/04_verify_restore.sql
-- =====================================================================

SET search_path TO dropboxed;

\echo '--- Tables present (expect 8)'
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'dropboxed' AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo '--- Row counts'
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'staff', COUNT(*) FROM staff
UNION ALL SELECT 'complaint_categories', COUNT(*) FROM complaint_categories
UNION ALL SELECT 'locations', COUNT(*) FROM locations
UNION ALL SELECT 'complaints', COUNT(*) FROM complaints
UNION ALL SELECT 'complaint_assignments', COUNT(*) FROM complaint_assignments
UNION ALL SELECT 'status_logs', COUNT(*) FROM status_logs
UNION ALL SELECT 'attachments', COUNT(*) FROM attachments
ORDER BY table_name;

\echo '--- Constraints by type (p primary key, f foreign key, u unique, c check, n not null)'
SELECT contype, COUNT(*) AS constraints
FROM pg_constraint
WHERE connamespace = 'dropboxed'::regnamespace
GROUP BY contype
ORDER BY contype;

\echo '--- Indexes (expect 22: 8 primary keys, 4 unique, 10 from 01_schema.sql)'
SELECT COUNT(*) AS indexes FROM pg_indexes WHERE schemaname = 'dropboxed';

\echo '--- Identity sequences continue after the highest existing id (expect is_ok = t)'
SELECT MAX(complaint_id) AS max_id,
       (SELECT last_value FROM complaints_complaint_id_seq) AS sequence_value,
       (SELECT last_value FROM complaints_complaint_id_seq) >= COALESCE(MAX(complaint_id), 0) AS is_ok
FROM complaints;

\echo '--- Integrity: both results should be 0'
SELECT COUNT(*) AS resolved_without_timestamp FROM complaints WHERE status = 'Resolved' AND resolved_at IS NULL;
SELECT COUNT(*) AS logs_without_complaint FROM status_logs l
LEFT JOIN complaints c ON c.complaint_id = l.complaint_id WHERE c.complaint_id IS NULL;

\echo '--- Representative query: complaints by status'
SELECT status, COUNT(*) FROM complaints GROUP BY status ORDER BY status;

\echo '--- Access control: schema privileges survive in the dump, database CONNECT does not'
SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'dropboxed' AND grantee LIKE 'dropboxed\_%'
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
SELECT datname, datacl FROM pg_database WHERE datname = current_database();
