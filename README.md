# DropBoxed

**An environmental complaint application for household water quality monitoring in San Pedro.**

Residents report household water problems (rusty or contaminated water, low pressure, foul odor, pipe leaks) and track each one from **Pending → In Progress → Resolved**. Water district staff review, assign, update and report on every complaint.

This is the implementation of the *Activity 2 Database Blueprint* by RIPARION (BSIT 3-2, Database Administration). The schema, constraints and architecture follow that document.

---

## Features

| # | Functional requirement (Part 2) | Where it lives |
|---|---|---|
| 1 | User registration & login | `/register`, `/login`, `/staff/login`. Passwords are hashed with bcrypt. |
| 2 | Submit complaint under a category | `/my/complaints/new` |
| 3 | Description, location and photos | Same form. Up to 5 JPEG/PNG photos, 5 MB each. |
| 4 | View complaint status | `/my/complaints` and `/my/complaints/:id`, with a progress stepper and history |
| 5 | Admin: view all complaints with filtering/sorting | `/admin/complaints`: search, status, type, barangay, flag, assignee, date range, 5 sort orders |
| 6 | Admin: update complaint status | Complaint page, one step at a time, with remarks shown to the resident |
| 7 | Admin: generate reports | `/admin/reports`: by status, type, barangay, area×type, monthly trend, staff activity. CSV export and print. |
| 8 | Complaint history / tracking log | Every status change is written to `status_logs` with staff, time and remarks |

Also included: a staff dashboard, assigning staff to complaints (M:N), flagging for review, managing residents, staff and categories, password changes, and a `/health` endpoint.

### How each business rule (Part 4) is enforced

| Rule | Database (PostgreSQL) | Application (Node.js) |
|---|---|---|
| 1, 2: one account, many complaints; required fields | `fk_complaints_user`, `NOT NULL`s, `ck_complaints_description` | form validation |
| 3, 4: category and location | `fk_complaints_category`, `fk_complaints_location` | locations are reused per address (`locations.findOrCreate`) |
| 5: Pending → In Progress → Resolved | `ck_complaints_status`, `ck_complaints_resolved_at` | `services/complaints.js` `advanceStatus`: one step at a time, row locked with `FOR UPDATE` |
| 6: complaints M:N staff | `complaint_assignments` + `uq_complaint_assignments_complaint_staff` | staff who start work on an unassigned complaint are assigned automatically |
| 7: every status update is logged | `status_logs` FKs to complaint and staff, `updated_at` default | log row written in the same transaction as the status change |
| 8, 9: photo attachments | `fk_attachments_complaint`, `ck_attachments_file_type`, `ck_attachments_file_size` | file type checked by magic bytes, size/count limits, private storage |
| 10: duplicate/spam detection | `is_flagged`, `flag_reason` | same category + same household, unresolved, within 72 h → auto-flagged |
| 11: flagged complaints are never deleted | `dropboxed_app` has no `DELETE` privilege on complaints; FKs block cascading deletes | flag/clear only |
| 12: unique emails and account status | `uq_users_email`, `uq_staff_email`, `ck_*_account_status` | Inactive accounts can't log in and are signed out on their next request |

---

## Architecture (Part 10)

```
Browser (HTML/CSS/JS, server-rendered EJS)
   │  HTTP: forms + sessions (signed cookie, CSRF token on every POST)
   ▼
Application layer: Node.js + Express 5
   routes/      HTTP handlers (resident, admin, auth, attachments)
   services/    business rules: status lifecycle, duplicate flagging, auth, file storage
   middleware/  auth/role checks, CSRF, upload parsing
   │
   ▼
Data access layer: src/db/*.js, parameterized SQL via node-postgres (pg)
   │
   ▼
PostgreSQL 18: database dropboxed_db, schema dropboxed (8 tables)
   + local file storage in uploads/ (paths stored in attachments.file_path)
```

```
dropboxed/
├── database/
│   ├── 00_create_database.sql   CREATE DATABASE dropboxed_db
│   ├── 01_schema.sql            schema, 8 tables, constraints, indexes, comments
│   ├── 02_seed.sql              complaint categories
│   ├── 03_roles.sql             group roles and login roles
│   ├── 04_privileges.sql        GRANT, REVOKE and default privileges
│   └── maintenance/             health checks, VACUUM/ANALYZE, query plans, restore checks
├── docs/                        database, roles and operations documentation
├── scripts/
│   ├── db-setup.js              runs the SQL, creates the first staff account, optional sample data
│   ├── setup-env.js             keeps admin credentials away from the running app
│   ├── verify-privileges.js     tests each account's allowed and denied operations
│   ├── smoke-test.js            tests every create, read, update and delete over HTTP
│   └── embedded-db.js           dev-only PostgreSQL (PGlite) for machines without PostgreSQL
├── src/
│   ├── server.js, app.js, config.js, validation.js, errors.js
│   ├── db/          one module per table + reports.js
│   ├── services/    complaints.js, accounts.js, storage.js
│   ├── middleware/  auth.js, common.js, upload.js
│   ├── routes/      auth.js, resident.js, admin.js, attachments.js
│   ├── views/       EJS templates
│   └── public/      css, js, img
└── uploads/         photo files (not committed)
```

---

## Setup with PostgreSQL 18 (recommended)

Requirements: **Node.js 21.7+** and **PostgreSQL 17+** (developed against 18.6). `psql` must be on your `PATH`.

The application connects as a restricted account, `dropboxed_app`, never as a superuser. Setup needs an administrative account, so its credentials live in a separate file that the running application never reads.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create the database (as the `postgres` superuser):
   ```bash
   psql -U postgres -f database/00_create_database.sql
   ```
3. Copy both example files, then fill them in. Never commit `.env` or `.env.setup`.
   ```bash
   cp .env.example .env
   ```
   ```bash
   cp .env.setup.example .env.setup
   ```
   - In `.env`: choose a `PGPASSWORD` for `dropboxed_app`, and set `SESSION_SECRET`.
   - In `.env.setup`: enter your `postgres` password as `DB_ADMIN_PASSWORD`, and choose the other passwords.
4. Create the schema, categories, first staff account, database roles and privileges, plus demo residents, staff and about 60 complaints:
   ```bash
   npm run db:setup -- --sample
   ```
   Leave out `-- --sample` for an empty system. This command is safe to run again and does not delete data.
5. Confirm that each database account has exactly the access it should (48 allowed and denied tests):
   ```bash
   npm run db:verify
   ```
6. Start the app and open http://localhost:3000. The first line should say `as dropboxed_app`.
   ```bash
   npm start
   ```
   `npm run dev` restarts automatically when files change.
7. With the app running, test every create, read, update and delete from a second terminal. This adds test records, so use it only on a development database.
   ```bash
   npm run test:smoke -- --yes
   ```

`npm run db:setup -- --reset` drops the `dropboxed` schema and **deletes all data and uploaded photos**, then recreates everything. Use it only on a development database.

Something went wrong? See [docs/troubleshooting.md](docs/troubleshooting.md).

### Already set up with `PGUSER=postgres`?

Your data stays as it is. Fill in `.env.setup` as in step 3, change `.env` to `PGUSER=dropboxed_app` with a new `PGPASSWORD`, then run `npm run db:setup` (without `--sample`) and `npm run db:verify`.

### No PostgreSQL installed? (development only)

`npm run db:embedded` starts PGlite, which is real PostgreSQL compiled to WebAssembly, on `127.0.0.1:5433` and stores its data in `.pgdata/`. Point `.env` at it with `PGHOST=127.0.0.1`, `PGPORT=5433`, `PGDATABASE=postgres`, `PGUSER=postgres`, `PGPASSWORD=postgres` and `DB_POOL_MAX=4`, and do not create `.env.setup`. Then run `npm run db:setup -- --sample` and `npm start` in a second terminal.

Stop it with **Ctrl+C** so it shuts down cleanly. If it is killed abruptly it may fail to start next time ("Aborted()"). In that case, delete the `.pgdata/` folder and run `npm run db:setup -- --sample` again. Use a real PostgreSQL server for the DBA activities.

### Demo accounts (`--sample` only)

| Role | Email | Password |
|---|---|---|
| Staff | `admin@dropboxed.local` | `ADMIN_PASSWORD` from `.env.setup` (defaults to `Admin@12345`) |
| Staff | `maria.santos@dropboxed.local`, `ramon.dizon@dropboxed.local`, `liza.mercado@dropboxed.local` | `Password@123` |
| Resident | `juan.delacruz@example.com`, `ana.reyes@example.com`, … (10 total) | `Password@123` |

Change these passwords before using the system with real data.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/database.md](docs/database.md) | Database name, schema, ERD, tables, relationships, keys, constraints, indexes, differences from the blueprint |
| [docs/user-roles.md](docs/user-roles.md) | Application user roles and how they map to database roles |
| [docs/db-roles-setup.md](docs/db-roles-setup.md) | Group roles, login accounts, privileges, access-control plan and rationale |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common setup errors and solutions |
| [docs/maintenance.md](docs/maintenance.md) | Health checks, log review, VACUUM and ANALYZE, query plans |
| [docs/backup-recovery.md](docs/backup-recovery.md) | Backup plan, RPO and RTO, restore and recovery procedures |
| [docs/requirements-check.md](docs/requirements-check.md) | Every activity requirement, checked against this system |
| [docs/progress-report-draft.md](docs/progress-report-draft.md) | Draft content for the PDF progress documentation |

---

## Database notes for the DBA (Parts 11 and 12)

| Item | Value |
|---|---|
| Database | `dropboxed_db` |
| Schema | `dropboxed` (the blueprint's Part 11 says `dropbox` and Part 12 says `dropboxed`; this build uses `dropboxed`) |
| Tables | 8: users, staff, complaint_categories, locations, complaints, complaint_assignments, status_logs, attachments |
| Keys | `INTEGER GENERATED ALWAYS AS IDENTITY` primary keys; named `pk_`, `fk_`, `uq_`, `ck_` constraints |
| Indexes | Every foreign key plus `complaints(status)`, `complaints(submitted_at)`, `locations(barangay)` |
| Accounts | `dropboxed_app` (runtime), `dropboxed_report` (read-only), `dropboxed_dba` (maintenance), `dropboxed_backup` (backups). See [docs/db-roles-setup.md](docs/db-roles-setup.md). |
| Documentation | `COMMENT ON` for the schema, tables and key columns (visible in pgAdmin and `\d+`) |
| Time zone | `TIMESTAMP` columns hold Asia/Manila local time; the app sets `TimeZone` on every connection |

Handy command:

```bash
psql -U postgres -d dropboxed_db -c "\dt+ dropboxed.*"
```

For backups, see [docs/backup-recovery.md](docs/backup-recovery.md). Back up the `uploads/` folder together with the database, because `attachments.file_path` points into it.

Known limitations (same as the handoff sheet): duplicate detection lives in the application, photo storage is local disk, and `status_logs` and `attachments` will need an archiving strategy as they grow.

---

## Security measures

- The application connects with a least-privilege account, and PostgreSQL itself refuses deleting complaints, rewriting history or changing schema
- bcrypt password hashes; generic "incorrect email or password" message with timing protection
- Signed, `HttpOnly`, `SameSite=Lax` session cookie; CSRF token on every form
- Role checks on every route; residents can see only their own complaints and photos
- Photos are served only through an access-checked route. Types are verified from file contents and names are randomized on disk.
- Parameterized SQL everywhere; CSV export protects against formula injection

## AI usage (Part 13)

This implementation, its database scripts and its documentation were generated with **Claude (Anthropic)** from the group's blueprint. The requirements, business rules, ERD, schema and architecture were designed by the group in Activity 2. The group is responsible for reviewing, testing and being able to explain all of it. The full declaration is in the group's PDF progress documentation.
