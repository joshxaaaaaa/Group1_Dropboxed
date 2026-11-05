-- =====================================================================
-- DropBoxed: database group roles and login roles (Activity 4, Part C)
--
-- Run as a superuser. npm run db:setup runs this automatically, or:
--   psql -U postgres -d dropboxed_db -f database/03_roles.sql
--
-- Roles are cluster-wide, so a single-database pg_dump does not contain them.
-- This file is safe to re-run, including after a restore (Activity 6).
--
-- No password is stored here. Logins created by this file cannot authenticate
-- until a password is set, either from .env and .env.setup by npm run db:setup,
-- or interactively with \password <role> in psql.
-- See docs/db-roles-setup.md for the reason behind each role.
-- =====================================================================

DO $$
DECLARE
    role_name text;
BEGIN
    -- Group roles hold the privileges and can never log in.
    FOREACH role_name IN ARRAY ARRAY[
        'dropboxed_dba_grp', 'dropboxed_runtime_grp',
        'dropboxed_readonly_grp', 'dropboxed_backup_grp'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('CREATE ROLE %I', role_name);
        END IF;
        EXECUTE format(
            'ALTER ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT',
            role_name
        );
    END LOOP;

    -- Login roles authenticate and get their privileges only through a group.
    FOREACH role_name IN ARRAY ARRAY[
        'dropboxed_dba', 'dropboxed_app', 'dropboxed_report', 'dropboxed_backup'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('CREATE ROLE %I', role_name);
        END IF;
        EXECUTE format(
            'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT',
            role_name
        );
    END LOOP;
END
$$;

-- Role membership: each login belongs to exactly one group.
GRANT dropboxed_dba_grp      TO dropboxed_dba;
GRANT dropboxed_runtime_grp  TO dropboxed_app;
GRANT dropboxed_readonly_grp TO dropboxed_report;
GRANT dropboxed_backup_grp   TO dropboxed_backup;

-- Lets the DBA see every session and query in pg_stat_activity (Activity 5, Part A)
-- without being a superuser.
GRANT pg_monitor TO dropboxed_dba_grp;

-- The app pool holds at most 10 connections (DB_POOL_MAX), so this leaves room
-- for a restart while stopping a connection leak from exhausting the server.
ALTER ROLE dropboxed_app CONNECTION LIMIT 20;

COMMENT ON ROLE dropboxed_dba_grp      IS 'DropBoxed: data correction, VACUUM/ANALYZE and monitoring. No DDL, not a superuser.';
COMMENT ON ROLE dropboxed_runtime_grp  IS 'DropBoxed: only the operations the application code performs.';
COMMENT ON ROLE dropboxed_readonly_grp IS 'DropBoxed: read-only reporting and audit. Cannot read password hashes or contact details.';
COMMENT ON ROLE dropboxed_backup_grp   IS 'DropBoxed: reads every table and sequence so pg_dump works. Cannot change data.';
COMMENT ON ROLE dropboxed_dba          IS 'DropBoxed login: database administrator.';
COMMENT ON ROLE dropboxed_app          IS 'DropBoxed login: application runtime account (PGUSER in .env).';
COMMENT ON ROLE dropboxed_report       IS 'DropBoxed login: reporting and audit user.';
COMMENT ON ROLE dropboxed_backup       IS 'DropBoxed login: pg_dump backups.';
