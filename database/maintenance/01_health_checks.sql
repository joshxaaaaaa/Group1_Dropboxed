-- =====================================================================
-- DropBoxed: database health and activity checks (Activity 5, Part A)
-- Read-only. Run as dropboxed_dba, which can see every session through pg_monitor:
--   psql -U dropboxed_dba -d dropboxed_db -f database/maintenance/01_health_checks.sql
-- dropboxed_report may also run it but sees other accounts' query text as hidden.
-- =====================================================================

\echo '--- Account, server version and database'
SELECT current_user AS account, current_database() AS database, version();

\echo '--- Database size'
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

\echo '--- Objects in the dropboxed schema'
SELECT c.relkind, COUNT(*) AS objects
FROM pg_class c
WHERE c.relnamespace = 'dropboxed'::regnamespace
GROUP BY c.relkind
ORDER BY c.relkind;

\echo '--- Table sizes and row estimates'
SELECT c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       s.n_live_tup AS live_rows,
       s.n_dead_tup AS dead_rows
FROM pg_class c
JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE c.relnamespace = 'dropboxed'::regnamespace
ORDER BY pg_total_relation_size(c.oid) DESC;

\echo '--- Connections to this database'
SELECT datname, numbackends, xact_commit, xact_rollback, deadlocks, conflicts
FROM pg_stat_database
WHERE datname = current_database();

\echo '--- Current sessions'
SELECT pid, usename, state, wait_event_type, wait_event, query_start, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start NULLS LAST;

\echo '--- Queries running for more than 5 seconds'
SELECT pid, usename, now() - query_start AS duration, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'active'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

\echo '--- Sessions blocked by another session'
SELECT blocked.pid AS blocked_pid, blocked.usename AS blocked_user,
       pg_blocking_pids(blocked.pid) AS blocked_by, left(blocked.query, 80) AS query
FROM pg_stat_activity blocked
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;

\echo '--- Activity 4 roles: confirm these match docs/db-roles-setup.md'
SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
       (SELECT string_agg(g.rolname, ', ') FROM pg_auth_members m
        JOIN pg_roles g ON g.oid = m.roleid WHERE m.member = r.oid) AS member_of
FROM pg_roles r
WHERE r.rolname LIKE 'dropboxed\_%'
ORDER BY r.rolname;

\echo '--- Logging settings that decide what the server log can show (Part B)'
SELECT name, setting FROM pg_settings
WHERE name IN ('logging_collector', 'log_directory', 'log_filename', 'log_connections',
               'log_disconnections', 'log_min_duration_statement', 'log_statement', 'log_lock_waits')
ORDER BY name;

\echo '--- Statistics and vacuum history: decides whether maintenance is needed (Part C)'
SELECT relname, n_live_tup, n_dead_tup, n_mod_since_analyze,
       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'dropboxed'
ORDER BY n_dead_tup DESC;

\echo '--- Index use'
SELECT relname AS table_name, indexrelname AS index_name, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'dropboxed'
ORDER BY relname, indexrelname;
