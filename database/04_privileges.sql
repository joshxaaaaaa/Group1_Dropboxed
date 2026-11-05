-- =====================================================================
-- DropBoxed: least-privilege access control (Activity 4, Parts C and D)
--
-- Run as the database owner or a superuser, connected to the target database,
-- after 01_schema.sql and 03_roles.sql. npm run db:setup runs this automatically, or:
--   psql -U postgres -d dropboxed_db -f database/04_privileges.sql
--
-- Safe to re-run. It starts by removing earlier grants, so this file is always
-- the complete statement of who can do what. It uses current_database(), so it
-- also works on a restored test database (Activity 6).
-- =====================================================================

SET search_path TO dropboxed;

-- ---------------------------------------------------------------------
-- Database level: remove PUBLIC's default CONNECT and TEMPORARY so only
-- members of the DropBoxed groups can reach this database.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO dropboxed_dba_grp, dropboxed_runtime_grp, dropboxed_readonly_grp, dropboxed_backup_grp',
        current_database()
    );
END
$$;

-- ---------------------------------------------------------------------
-- Schema level: USAGE only. Nobody but the owner can create objects.
-- The application does not use the public schema, so it is closed too.
-- ---------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA dropboxed FROM PUBLIC;
GRANT USAGE ON SCHEMA dropboxed
    TO dropboxed_dba_grp, dropboxed_runtime_grp, dropboxed_readonly_grp, dropboxed_backup_grp;

-- Start clean. Revoking a table privilege also removes its column privileges.
REVOKE ALL ON ALL TABLES IN SCHEMA dropboxed
    FROM PUBLIC, dropboxed_dba_grp, dropboxed_runtime_grp, dropboxed_readonly_grp, dropboxed_backup_grp;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA dropboxed
    FROM PUBLIC, dropboxed_dba_grp, dropboxed_runtime_grp, dropboxed_readonly_grp, dropboxed_backup_grp;

-- ---------------------------------------------------------------------
-- Application runtime: exactly what src/db/*.js executes, nothing more.
--
-- Missing on purpose, and each one is enforced by PostgreSQL:
--   DELETE on complaints      Business Rule 11: complaints are never deleted.
--   DELETE on users, staff    accounts are deactivated through account_status.
--   UPDATE/DELETE on status_logs   Business Rule 7: the history is append-only.
--   UPDATE on users.email, staff.email   no feature changes a login email.
--   UPDATE/DELETE on locations     addresses are shared between complaints.
--   DELETE on attachments     Business Rule 9: unrelated photos are flagged, not erased.
--   TRUNCATE, REFERENCES, TRIGGER  never needed at runtime.
--
-- Sequences: every primary key is GENERATED ALWAYS AS IDENTITY. INSERT advances
-- an identity sequence without USAGE on the sequence, so none is granted.
-- scripts/verify-privileges.js proves INSERT works and nextval() is denied.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT ON users TO dropboxed_runtime_grp;
GRANT UPDATE (full_name, phone_number, password_hash, account_status) ON users TO dropboxed_runtime_grp;

GRANT SELECT, INSERT ON staff TO dropboxed_runtime_grp;
GRANT UPDATE (password_hash, account_status) ON staff TO dropboxed_runtime_grp;

GRANT SELECT, INSERT, DELETE ON complaint_categories TO dropboxed_runtime_grp;
GRANT UPDATE (category_name, description) ON complaint_categories TO dropboxed_runtime_grp;

GRANT SELECT, INSERT ON locations TO dropboxed_runtime_grp;

GRANT SELECT, INSERT ON complaints TO dropboxed_runtime_grp;
GRANT UPDATE (status, resolved_at, is_flagged, flag_reason) ON complaints TO dropboxed_runtime_grp;

GRANT SELECT, INSERT, DELETE ON complaint_assignments TO dropboxed_runtime_grp;
GRANT SELECT, INSERT ON status_logs TO dropboxed_runtime_grp;
GRANT SELECT, INSERT ON attachments TO dropboxed_runtime_grp;

-- ---------------------------------------------------------------------
-- Read-only reporting and audit: everything the reports need, but not password
-- hashes or residents' and staff's email addresses and phone numbers.
-- ---------------------------------------------------------------------
GRANT SELECT ON complaint_categories, locations, complaints,
                complaint_assignments, status_logs, attachments
    TO dropboxed_readonly_grp;
GRANT SELECT (user_id, full_name, account_status, created_at) ON users TO dropboxed_readonly_grp;
GRANT SELECT (staff_id, full_name, account_status, created_at) ON staff TO dropboxed_readonly_grp;

-- ---------------------------------------------------------------------
-- Backup: pg_dump must read every column and each sequence's position.
-- ---------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA dropboxed TO dropboxed_backup_grp;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA dropboxed TO dropboxed_backup_grp;

-- ---------------------------------------------------------------------
-- DBA: data correction and maintenance. Not granted: TRUNCATE and DDL.
-- Schema changes stay with the owner (postgres, Part 12 of the blueprint).
-- MAINTAIN allows VACUUM and ANALYZE without owning the table (PostgreSQL 17+).
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dropboxed TO dropboxed_dba_grp;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA dropboxed TO dropboxed_dba_grp;

DO $$
BEGIN
    IF current_setting('server_version_num')::int >= 170000 THEN
        EXECUTE 'GRANT MAINTAIN ON ALL TABLES IN SCHEMA dropboxed TO dropboxed_dba_grp';
    ELSE
        RAISE NOTICE 'PostgreSQL 16 or older: MAINTAIN does not exist. Run VACUUM and ANALYZE as the table owner.';
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- Future objects created in this schema by the role running this script.
-- Backups and the DBA must cover new tables automatically. The runtime and
-- read-only groups must not: each new table needs a deliberate grant above.
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA dropboxed GRANT SELECT ON TABLES TO dropboxed_backup_grp;
ALTER DEFAULT PRIVILEGES IN SCHEMA dropboxed GRANT SELECT ON SEQUENCES TO dropboxed_backup_grp;
ALTER DEFAULT PRIVILEGES IN SCHEMA dropboxed GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dropboxed_dba_grp;
ALTER DEFAULT PRIVILEGES IN SCHEMA dropboxed GRANT SELECT ON SEQUENCES TO dropboxed_dba_grp;
