# Troubleshooting guide

Common setup errors and their solutions (Activity 3, Part B).

## Installing and running

| Error or symptom | Cause | Solution |
|---|---|---|
| `psql` is not recognized | PostgreSQL's `bin` folder is not on `PATH` | Windows: add `C:\Program Files\PostgreSQL\18\bin` to `PATH` and open a new terminal, or run psql by its full path. |
| `process.loadEnvFile is not a function` | Node.js is too old | Install Node.js 21.7 or newer, then check with `node --version`. |
| `Cannot find module 'pg'` or `'express'` | Dependencies are not installed | Run `npm install` in the project folder. |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running, or uses another port | Windows: start the `postgresql-x64-18` service in `services.msc`. Check the port with `psql -U postgres -c "SHOW port"`, then set `PGPORT` in `.env`. |
| `listen EADDRINUSE: address already in use :::3000` | Another program is using port 3000 | Stop that program, or set `PORT=3001` in `.env`. |
| Warning: `SESSION_SECRET is not set` | `.env` is missing or has no `SESSION_SECRET` | Copy `.env.example` to `.env` and set a long random value. |
| Warning: `postgres is a superuser` at startup | `.env` still has `PGUSER=postgres` | Set `PGUSER=dropboxed_app` and its password in `.env`, as in the README. |

## Database setup

| Error or symptom | Cause | Solution |
|---|---|---|
| `database "dropboxed_db" does not exist` | Step 2 of the README was skipped | Run `psql -U postgres -f database/00_create_database.sql`. |
| `database "dropboxed_db" already exists` when running `00_create_database.sql` | It was created earlier | Nothing is wrong. Continue with the next step. |
| `password authentication failed for user "postgres"` | Wrong `DB_ADMIN_PASSWORD` in `.env.setup` | Use the password chosen when PostgreSQL was installed. |
| `password authentication failed for user "dropboxed_app"` | `PGPASSWORD` in `.env` differs from the role's password, or `db:setup` has not set it | Set `PGPASSWORD` in `.env`, then run `npm run db:setup` again. It will not delete data. |
| `role "dropboxed_app" does not exist` | The roles have not been created | Run `npm run db:setup`, which requires `DB_ADMIN_USER` in `.env.setup`. |
| `client password must be a string` | The password setting is blank | Fill in `PGPASSWORD` in `.env`, or `DB_ADMIN_PASSWORD` in `.env.setup`. |
| `permission denied for schema dropboxed` when running `db:setup` | `.env.setup` is missing, so setup used `dropboxed_app` | Copy `.env.setup.example` to `.env.setup` and fill it in. |
| `skipped roles and privileges: this account is not a superuser` | Same cause as above | Same solution as above. |
| `permission denied for table ...` in the app after adding a feature | The feature uses SQL the runtime role was not granted | Add the smallest necessary grant to `database/04_privileges.sql`, run `npm run db:setup`, and add a test to `scripts/verify-privileges.js`. |
| `relation "complaints" does not exist` | The schema was not created, or `search_path` is wrong | Run `npm run db:setup`. In psql, use `dropboxed.complaints` or run `SET search_path TO dropboxed;`. |
| `No password available for: ...` from `db:verify` | A password is blank in `.env.setup` or `.env` | Fill in all the passwords, then run `npm run db:setup` to apply them. |
| `database "dropboxed_verify_unrelated" already exists` from `db:verify` | An earlier run was interrupted | As `postgres`, run `DROP DATABASE dropboxed_verify_unrelated;` and `DROP ROLE dropboxed_verify_outsider;`. |
| Login with sample accounts fails | Sample data was not loaded | Run `npm run db:setup -- --sample`. It skips this if complaints already exist. |
| Complaint photos show "missing from storage" | Rows were restored without the `uploads/` folder, or sample data references nothing | Restore `uploads/` along with the database. See [backup-recovery.md](backup-recovery.md). |

## psql on Windows

| Error or symptom | Cause | Solution |
|---|---|---|
| `WARNING: Console code page (437) differs from Windows code page (1252)` | Terminal setting. This is harmless. | Run `chcp 1252` before psql to remove the warning. |
| `psql: error: ... fe_sendauth: no password supplied` | No password was given and no prompt was possible | Run psql in an interactive terminal, or use a `pgpass.conf` file. Never put a password in the command. |

## Backup and restore

| Error or symptom | Cause | Solution |
|---|---|---|
| `pg_restore: error: ... role "dropboxed_backup_grp" does not exist` | Roles are cluster-wide and are not in the dump | Run `database/03_roles.sql` on the server before restoring. |
| `permission denied for database` when connecting to a restored database | Database-level `CONNECT` is not in a `pg_dump` archive | Run `database/04_privileges.sql` on the restored database. |
| `pg_dump: error: aborting because of server version mismatch` | `pg_dump` is older than the server | Use the `pg_dump` from the same or a newer PostgreSQL version. |

## Embedded database (PGlite)

| Error or symptom | Cause | Solution |
|---|---|---|
| `Aborted()` on start | The server was killed abruptly last time | Delete the `.pgdata/` folder, then run `npm run db:setup -- --sample` again. |
| Connection errors with PGlite | It is configured differently from a normal server | See the README. Use a real PostgreSQL server for the DBA activities. |
