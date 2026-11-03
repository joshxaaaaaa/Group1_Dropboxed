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
| 11: flagged complaints are never deleted | no `DELETE` on complaints anywhere; FKs block cascading deletes | flag/clear only |
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
│   └── 02_seed.sql              complaint categories
├── scripts/
│   ├── db-setup.js              runs the SQL, creates the first staff account, optional sample data
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

Requirements: **Node.js 21.7+** and **PostgreSQL 16+** (developed against 18).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create the database (as the `postgres` superuser):
   ```bash
   psql -U postgres -f database/00_create_database.sql
   ```
3. Configure the connection. Copy `.env.example` to `.env` and set `PGPASSWORD`, `SESSION_SECRET` and `ADMIN_PASSWORD`. Never commit `.env`.
4. Create the schema, the categories and the first staff account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`):
   ```bash
   npm run db:setup
   ```
   To also load demo residents, staff and about 60 complaints:
   ```bash
   npm run db:setup -- --sample
   ```
5. Start the app and open http://localhost:3000:
   ```bash
   npm start
   ```
   `npm run dev` restarts automatically when files change.

`npm run db:setup -- --reset` drops the `dropboxed` schema and **deletes all data and uploaded photos**, then recreates everything. Use it only on a development database.

### No PostgreSQL installed? (development only)

`npm run db:embedded` starts PGlite, which is real PostgreSQL compiled to WebAssembly, on `127.0.0.1:5433` and stores its data in `.pgdata/`. Point `.env` at it with `PGHOST=127.0.0.1`, `PGPORT=5433`, `PGDATABASE=postgres`, `PGUSER=postgres`, `PGPASSWORD=postgres` and `DB_POOL_MAX=4`. Then run `npm run db:setup -- --sample` and `npm start` in a second terminal.

Stop it with **Ctrl+C** so it shuts down cleanly. If it is killed abruptly it may fail to start next time ("Aborted()"). In that case, delete the `.pgdata/` folder and run `npm run db:setup -- --sample` again. Use a real PostgreSQL server for the DBA activities.

### Demo accounts (`--sample` only)

| Role | Email | Password |
|---|---|---|
| Staff | `admin@dropboxed.local` | `ADMIN_PASSWORD` from `.env` (defaults to `Admin@12345`) |
| Staff | `maria.santos@dropboxed.local`, `ramon.dizon@dropboxed.local`, `liza.mercado@dropboxed.local` | `Password@123` |
| Resident | `juan.delacruz@example.com`, `ana.reyes@example.com`, … (10 total) | `Password@123` |

Change these passwords before using the system with real data.

---

## Database notes for the DBA (Parts 11 and 12)

| Item | Value |
|---|---|
| Database | `dropboxed_db` |
| Schema | `dropboxed` (the blueprint's Part 11 says `dropbox` and Part 12 says `dropboxed`; this build uses `dropboxed`) |
| Tables | 8: users, staff, complaint_categories, locations, complaints, complaint_assignments, status_logs, attachments |
| Keys | `INTEGER GENERATED ALWAYS AS IDENTITY` primary keys; named `pk_`, `fk_`, `uq_`, `ck_` constraints |
| Indexes | Every foreign key plus `complaints(status)`, `complaints(submitted_at)`, `locations(barangay)` |
| Documentation | `COMMENT ON` for the schema, tables and key columns (visible in pgAdmin and `\d+`) |
| Time zone | `TIMESTAMP` columns hold Asia/Manila local time; the app sets `TimeZone` on every connection |

Handy commands:

```bash
psql -U postgres -d dropboxed_db -c "\dt+ dropboxed.*"
```
```bash
pg_dump -U postgres -d dropboxed_db -n dropboxed -F c -f dropboxed_backup.dump
```
```bash
pg_restore -U postgres -d dropboxed_db --clean dropboxed_backup.dump
```

Back up the `uploads/` folder together with the database, because `attachments.file_path` points into it.

Known limitations (same as the handoff sheet): duplicate detection lives in the application, photo storage is local disk, and `status_logs` and `attachments` will need an archiving strategy as they grow.

---

## Security measures

- bcrypt password hashes; generic "incorrect email or password" message with timing protection
- Signed, `HttpOnly`, `SameSite=Lax` session cookie; CSRF token on every form
- Role checks on every route; residents can see only their own complaints and photos
- Photos are served only through an access-checked route. Types are verified from file contents and names are randomized on disk.
- Parameterized SQL everywhere; CSV export protects against formula injection

## AI usage (Part 13)

This implementation was generated with **Claude (Anthropic)** from the group's blueprint. Add a row to your AI usage statement, and make sure every member reviews, tests and can explain the code, as Part 3 of the activity requires.
