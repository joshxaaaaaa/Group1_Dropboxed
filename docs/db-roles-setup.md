# Database users, roles and privileges

Required by Activity 3, Part B ("User and role setup documentation"). This is also the access-control plan and security rationale for DropBoxed that Activity 4 asks for. The scripts are [database/03_roles.sql](../database/03_roles.sql) and [database/04_privileges.sql](../database/04_privileges.sql). No real password is in this repository.

## Principle

Each account receives only what its job requires, and PostgreSQL enforces it. Business rules that must never be broken are enforced by missing privileges as well as by application code. For example, Business Rule 11 holds even if the application has a bug, because `dropboxed_app` has no `DELETE` on `complaints`.

## Access-control plan

| Login role | Group role | Application role served | Responsibility | Required privileges |
|---|---|---|---|---|
| `dropboxed_app` | `dropboxed_runtime_grp` | Resident, Staff, Visitor | Normal application operations | See the matrix below |
| `dropboxed_report` | `dropboxed_readonly_grp` | Reports viewer / auditor | Inspect records and produce reports | `SELECT` on approved tables and columns |
| `dropboxed_dba` | `dropboxed_dba_grp` | Database administrator | Maintenance, monitoring, data correction | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MAINTAIN`, `pg_monitor` |
| `dropboxed_backup` | `dropboxed_backup_grp` | Backup operator | `pg_dump` backups | `SELECT` on all tables and sequences |
| `postgres` | none | Database owner | Provisioning, DDL, restore | Superuser. Justified only for these tasks and never used by the running application. |

Group roles are `NOLOGIN`. Every login belongs to exactly one group and holds no direct grants, so the group defines what it can do. None has `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` or `BYPASSRLS`. Role names start with `dropboxed_` because roles are cluster-wide and other projects share the server.

## Privilege matrix

Each `dropboxed_` group also has `CONNECT` on the database and `USAGE` on the `dropboxed` schema. `PUBLIC` has neither, and it has no access to the `public` schema in this database.

| Table | `dropboxed_runtime_grp` | `dropboxed_readonly_grp` | `dropboxed_backup_grp` | `dropboxed_dba_grp` |
|---|---|---|---|---|
| `users` | `SELECT`, `INSERT`, `UPDATE (full_name, phone_number, password_hash, account_status)` | `SELECT (user_id, full_name, account_status, created_at)` | `SELECT` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MAINTAIN` |
| `staff` | `SELECT`, `INSERT`, `UPDATE (password_hash, account_status)` | `SELECT (staff_id, full_name, account_status, created_at)` | `SELECT` | same |
| `complaint_categories` | `SELECT`, `INSERT`, `UPDATE (category_name, description)`, `DELETE` | `SELECT` | `SELECT` | same |
| `locations` | `SELECT`, `INSERT` | `SELECT` | `SELECT` | same |
| `complaints` | `SELECT`, `INSERT`, `UPDATE (status, resolved_at, is_flagged, flag_reason)` | `SELECT` | `SELECT` | same |
| `complaint_assignments` | `SELECT`, `INSERT`, `DELETE` | `SELECT` | `SELECT` | same |
| `status_logs` | `SELECT`, `INSERT` | `SELECT` | `SELECT` | same |
| `attachments` | `SELECT`, `INSERT` | `SELECT` | `SELECT` | same |
| Sequences | none | none | `SELECT` | `SELECT` |

## Why these decisions were made

| Decision | Reason |
|---|---|
| No `DELETE` on `complaints`, `users` or `staff` for the runtime | Business Rules 11 and 12: flagged complaints stay, and accounts are deactivated rather than deleted. |
| `status_logs` is `SELECT` and `INSERT` only for the runtime | Business Rule 7: the history cannot be rewritten by the application. |
| Column-level `UPDATE` | The application never changes an email, a `submitted_at` or a complaint's owner, so it cannot do so by accident or through a bug. |
| No `USAGE` on sequences for the runtime | All primary keys are `GENERATED ALWAYS AS IDENTITY`. An `INSERT` advances an identity sequence without a sequence privilege, so a grant would add nothing but the ability to waste ids with `nextval()`. Tests 3 and 19 in `npm run db:verify` prove both sides. A column using `SERIAL` would need the grant. |
| Read-only role cannot see `password_hash`, `email` or `phone_number` | Reports need names and counts, not credentials or contact details. |
| Backup role can read password hashes | A backup that omits a column cannot restore the system. The dump files must be protected for this reason. |
| DBA has `MAINTAIN` rather than ownership | It can run `VACUUM` and `ANALYZE` but cannot drop or alter tables. Requires PostgreSQL 17 or newer, and the script prints a notice on older versions. |
| DBA has `pg_monitor` | Shows all sessions and query text in `pg_stat_activity` without superuser rights. |
| Objects stay owned by `postgres` | Part 12 of the approved blueprint names `postgres` as the database owner. Only the application's connection changed. |
| `REVOKE ALL ON DATABASE ... FROM PUBLIC` | By default any login on the server may connect to any database. This keeps other projects' logins out of `dropboxed_db`. |
| `REVOKE ALL ON SCHEMA public FROM PUBLIC` | The application stores nothing in `public`, so nobody needs access to it. |
| Default privileges cover only the backup and DBA groups | Backups must include new tables automatically. The runtime and read-only groups get new tables only by a deliberate grant in `04_privileges.sql`. |
| Superuser password kept in a separate `.env.setup` | The running application never loads that file, so compromising the application does not reveal it. |
| Passwords are sent as SCRAM verifiers | Plain text never appears in a SQL statement, so it cannot reach the server log. |

**A limit on unrelated databases:** PostgreSQL gives `PUBLIC` the `CONNECT` privilege on every new database, including the built-in `postgres` database. DropBoxed's scripts close `dropboxed_db` only, because they must not alter other projects' databases. So `dropboxed_app` can still connect to a database whose owner has not revoked this, although it cannot read that database's tables without a grant. An administrator of a shared server can add `pg_hba.conf` rules to restrict this further.

## Setting up the roles

`npm run db:setup` applies both scripts and sets the passwords from `.env` and `.env.setup`. It is safe to re-run and does not delete data.

To do it by hand with psql, which prompts for each password without showing or storing it:

```bash
psql -U postgres -d dropboxed_db -f database/03_roles.sql
```
```bash
psql -U postgres -d dropboxed_db -f database/04_privileges.sql
```
```bash
psql -U postgres -d dropboxed_db -c "\password dropboxed_app"
```

Repeat the last command for `dropboxed_dba`, `dropboxed_report` and `dropboxed_backup`.

## Testing the privileges

```bash
npm run db:verify
```

This logs in as each account with its own password and runs 48 allowed and denied operations. Each statement is rolled back, so no data changes. To save the table for the PDF:

```bash
npm run db:verify -- --out privilege-results.md
```

It prints the account, statement, expected result, actual result and the server's response, followed by each role's attributes and memberships. It exits with an error if any result is unexpected.

To check a result by hand, or for a screenshot:

```bash
psql -U dropboxed_report -d dropboxed_db -c "UPDATE dropboxed.complaints SET status = 'Resolved' WHERE FALSE"
```

Expected result: `ERROR: permission denied for table complaints`.

## Inspecting effective privileges

```sql
\du dropboxed_*
\l dropboxed_db
\dn+ dropboxed
\dp dropboxed.*
SELECT has_table_privilege('dropboxed_app', 'dropboxed.complaints', 'DELETE');
SELECT has_column_privilege('dropboxed_report', 'dropboxed.users', 'password_hash', 'SELECT');
```
