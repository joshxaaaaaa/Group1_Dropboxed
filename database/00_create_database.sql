-- =====================================================================
-- DropBoxed: database creation step (Part 11 - PostgreSQL Database Plan)
-- Run once as the postgres superuser, connected to the default database:
--   psql -U postgres -f database/00_create_database.sql
-- =====================================================================

CREATE DATABASE dropboxed_db
    WITH OWNER = postgres
         ENCODING = 'UTF8';

COMMENT ON DATABASE dropboxed_db IS
    'DropBoxed: Environmental complaint application for household water quality monitoring in San Pedro.';
