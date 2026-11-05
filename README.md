<div align="center">

# 💧 DropBoxed

### An Environmental Complaint Application for Household Water Quality Monitoring in San Pedro

Report household water problems and track each one from **Pending → In Progress → Resolved**.

![Node.js](https://img.shields.io/badge/Node.js-21.7%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)

</div>

| | |
|---|---|
| **Application** | DropBoxed: An Environmental Complaint Application for Household Water Quality Monitoring in San Pedro |
| **Subject** | COMP 018 – Database Administration |
| **Professor** | Mr. John Kenneth Timblaco |
| **Section** | BSIT 3-2 |
| **Group** | Group 1 |
| **Members** | Denver Reyes, Jan Emmanuel Dela Cruz, Jhayciel Santiago, Joshua Abalo, Rhaine Cyrel Valera |

---

## 📑 Contents

- [What is DropBoxed?](#-what-is-dropboxed)
- [What you need](#-what-you-need)
- [How to run it](#-how-to-run-it)
- [Sample accounts](#-sample-accounts)
- [Things to try](#-things-to-try)
- [Check that everything works](#-check-that-everything-works)
- [If something goes wrong](#-if-something-goes-wrong)
- [Useful commands](#-useful-commands)
- [Technical details](#-technical-details)
- [Documentation](#-documentation)

---

## 💡 What is DropBoxed?

Many households in San Pedro deal with rusty or contaminated water, low pressure, foul odor and pipe leaks, with no easy way to report them and follow up.

- **Residents** file a complaint with a category, description, address and photos, then track its progress.
- **Water district staff** review, assign, update and report on every complaint.

---

## 🧰 What you need

Install these first. If you already have them, you can check your versions with the commands below.

| Software | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org/) | 21.7 or newer | `node --version` |
| [PostgreSQL](https://www.postgresql.org/download/) | 17 or newer (we used 18.6) | `psql --version` |
| [Git](https://git-scm.com/downloads) | Any recent version | `git --version` |

You also need the **`postgres` password** you chose when you installed PostgreSQL.

> [!TIP]
> **On Windows, is `psql` not recognized?** Add `C:\Program Files\PostgreSQL\18\bin` to your `PATH`, then open a new terminal.

---

## 🚀 How to run it

Run each command in a terminal, one step at a time. On Windows, use PowerShell or Git Bash.

### Step 1: Download the project

```bash
git clone https://github.com/joshxaaaaaa/Group1_Dropboxed.git
```
```bash
cd Group1_Dropboxed
```

### Step 2: Install the dependencies

```bash
npm install
```

### Step 3: Create the database

It will ask for your `postgres` password.

```bash
psql -U postgres -f database/00_create_database.sql
```

### Step 4: Create your two settings files

```bash
cp .env.example .env
```
```bash
cp .env.setup.example .env.setup
```

Open both files in a text editor and fill in these values. Passwords you "make up" can be anything, because they only exist on your computer.

**In `.env`**

| Setting | What to enter |
|---|---|
| `PGPASSWORD` | Make up a password |
| `SESSION_SECRET` | Type any long random text |

**In `.env.setup`**

| Setting | What to enter |
|---|---|
| `DB_ADMIN_PASSWORD` | Your real `postgres` password |
| `DB_DBA_PASSWORD` | Make up a password |
| `DB_REPORT_PASSWORD` | Make up a password |
| `DB_BACKUP_PASSWORD` | Make up a password |
| `ADMIN_PASSWORD` | Optional. If left blank, it is `Admin@12345` |

> [!WARNING]
> Never commit `.env` or `.env.setup`. Git is already set up to ignore them.

### Step 5: Set up the database and sample data

This creates the tables, the database accounts and the sample data.

```bash
npm run db:setup -- --sample
```

You should see `Done.` at the end.

### Step 6: Start the app

```bash
npm start
```

You should see something like this:

```text
Connected to PostgreSQL database "dropboxed_db" as dropboxed_app (PostgreSQL 18.6 ...)
DropBoxed is running at http://localhost:3000
```

### Step 7: Open it in your browser

Go to **http://localhost:3000** and log in with a [sample account](#-sample-accounts). 🎉

To stop the app, press **Ctrl + C** in the terminal. To start it again later, just run `npm start`.

---

## 🔑 Sample accounts

These exist after Step 5. They are for local testing only.

### Staff: log in at [/staff/login](http://localhost:3000/staff/login)

| Name | Email | Password |
|---|---|---|
| System Administrator | `admin@dropboxed.local` | `ADMIN_PASSWORD` from `.env.setup`, or `Admin@12345` if left blank |
| Denver Reyes | `denver.reyes@dropboxed.local` | `Password@123` |
| Jan Emmanuel Dela Cruz | `jan.delacruz@dropboxed.local` | `Password@123` |
| Jhayciel Santiago | `jhayciel.santiago@dropboxed.local` | `Password@123` |
| Joshua Abalo | `joshua.abalo@dropboxed.local` | `Password@123` |
| Rhaine Cyrel Valera | `rhaine.valera@dropboxed.local` | `Password@123` |

### Residents: log in at [/login](http://localhost:3000/login)

All residents use the password `Password@123`.

| Name | Email |
|---|---|
| Juan Dela Cruz | `juan.delacruz@example.com` |
| Ana Reyes | `ana.reyes@example.com` |
| Mark Villanueva | `mark.villanueva@example.com` |
| Grace Bautista | `grace.bautista@example.com` |
| Paolo Garcia | `paolo.garcia@example.com` |
| Rhea Mendoza | `rhea.mendoza@example.com` |
| Carlo Aquino | `carlo.aquino@example.com` |
| Joy Ramos | `joy.ramos@example.com` |
| Nestor Castillo | `nestor.castillo@example.com` |
| Lourdes Navarro | `lourdes.navarro@example.com` |

---

## 🧭 Things to try

**As a resident**

1. Register a new account, or log in with a sample one.
2. File a complaint with a photo (JPEG or PNG, up to 5 photos, 5 MB each).
3. File the same problem at the same address again, and see it get flagged as a possible duplicate.
4. Open your complaint and follow its status history.

**As staff**

1. Look at the dashboard, then filter and sort the complaint list.
2. Open a complaint, assign a staff member, and move it to **In Progress**, then **Resolved**.
3. Flag a complaint for review, or clear a flag.
4. Open **Reports** and export a CSV.
5. Manage residents, staff and categories.

---

## ✅ Check that everything works

These two tests are optional, but they are useful when you are checking this project for an activity.

**Test the database accounts.** This checks 48 operations that each account should or should not be allowed to do. It changes no data.

```bash
npm run db:verify
```

**Test the app.** Keep the app running, then run this in a second terminal. It checks every create, read, update and delete, and it adds test records named "Smoke Test" to your database.

```bash
npm run test:smoke -- --yes
```

Both should end with `0 unexpected results` or `0 failed`.

---

## 🛠 If something goes wrong

| Problem | Solution |
|---|---|
| `psql` is not recognized | Add PostgreSQL's `bin` folder to your `PATH`, then open a new terminal. |
| `password authentication failed for user "postgres"` | Check `DB_ADMIN_PASSWORD` in `.env.setup`. |
| `password authentication failed for user "dropboxed_app"` | Check `PGPASSWORD` in `.env`, then run `npm run db:setup` again. |
| `database "dropboxed_db" does not exist` | You skipped Step 3. |
| `database "dropboxed_db" already exists` | Nothing is wrong. Continue to the next step. |
| `permission denied for schema dropboxed` | `.env.setup` is missing. Go back to Step 4. |
| `client password must be a string` | A password is blank in `.env` or `.env.setup`. |
| `ECONNREFUSED` | PostgreSQL is not running. On Windows, start `postgresql-x64-18` in `services.msc`. |
| `EADDRINUSE` | Port 3000 is in use. Set `PORT=3001` in `.env`. |
| A sample account won't log in | You ran setup without `--sample`. Run `npm run db:setup -- --sample`. |

More solutions are in the [troubleshooting guide](docs/troubleshooting.md).

---

## 💻 Useful commands

| Command | What it does |
|---|---|
| `npm start` | Starts the app |
| `npm run dev` | Starts the app and restarts it when files change |
| `npm run db:setup` | Creates anything missing and applies database permissions. Safe to run again |
| `npm run db:setup -- --sample` | Same as above, and also loads sample data if there are no complaints yet |
| `npm run db:setup -- --reset --sample` | ⚠️ **Deletes all data and uploaded photos**, then starts fresh |
| `npm run db:verify` | Tests each database account's permissions |
| `npm run test:smoke -- --yes` | Tests the running app. Adds test records |

---

## 🔍 Technical details

<details>
<summary><strong>Features</strong></summary>

<br>

| # | Functional requirement | Where it lives |
|---|---|---|
| 1 | User registration and login | `/register`, `/login`, `/staff/login`. Passwords are hashed with bcrypt. |
| 2 | Submit a complaint under a category | `/my/complaints/new` |
| 3 | Description, location and photos | Same form. Up to 5 JPEG/PNG photos, 5 MB each. |
| 4 | View complaint status | `/my/complaints` and `/my/complaints/:id`, with a progress stepper and history |
| 5 | Admin: view all complaints with filtering and sorting | `/admin/complaints`: search, status, type, barangay, flag, assignee, date range, 5 sort orders |
| 6 | Admin: update complaint status | Complaint page, one step at a time, with remarks shown to the resident |
| 7 | Admin: generate reports | `/admin/reports`: by status, type, barangay, area×type, monthly trend, staff activity. CSV export and print. |
| 8 | Complaint history and tracking log | Every status change is written to `status_logs` with staff, time and remarks |

Also included: a staff dashboard, assigning staff to complaints (M:N), flagging for review, managing residents, staff and categories, password changes, and a `/health` endpoint.

</details>

<details>
<summary><strong>How each business rule is enforced</strong></summary>

<br>

| Rule | Database (PostgreSQL) | Application (Node.js) |
|---|---|---|
| 1, 2: one account, many complaints; required fields | `fk_complaints_user`, `NOT NULL`s, `ck_complaints_description` | Form validation |
| 3, 4: category and location | `fk_complaints_category`, `fk_complaints_location` | Locations are reused per address (`locations.findOrCreate`) |
| 5: Pending → In Progress → Resolved | `ck_complaints_status`, `ck_complaints_resolved_at` | `services/complaints.js` `advanceStatus`: one step at a time, row locked with `FOR UPDATE` |
| 6: complaints M:N staff | `complaint_assignments` + `uq_complaint_assignments_complaint_staff` | Staff who start work on an unassigned complaint are assigned automatically |
| 7: every status update is logged | `status_logs` FKs to complaint and staff, `updated_at` default | Log row written in the same transaction as the status change |
| 8, 9: photo attachments | `fk_attachments_complaint`, `ck_attachments_file_type`, `ck_attachments_file_size` | File type checked by magic bytes, size and count limits, private storage |
| 10: duplicate and spam detection | `is_flagged`, `flag_reason` | Same category + same household, unresolved, within 72 hours → auto-flagged |
| 11: flagged complaints are never deleted | `dropboxed_app` has no `DELETE` privilege on complaints; FKs block cascading deletes | Flag and clear only |
| 12: unique emails and account status | `uq_users_email`, `uq_staff_email`, `ck_*_account_status` | Inactive accounts can't log in and are signed out on their next request |

</details>

<details>
<summary><strong>Architecture and project structure</strong></summary>

<br>

```text
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

```text
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

</details>

<details>
<summary><strong>Database notes for the DBA</strong></summary>

<br>

| Item | Value |
|---|---|
| Database | `dropboxed_db` |
| Schema | `dropboxed` (the blueprint's Part 11 says `dropbox` and Part 12 says `dropboxed`; this build uses `dropboxed`) |
| Tables | 8: users, staff, complaint_categories, locations, complaints, complaint_assignments, status_logs, attachments |
| Keys | `INTEGER GENERATED ALWAYS AS IDENTITY` primary keys; named `pk_`, `fk_`, `uq_`, `ck_` constraints |
| Indexes | Every foreign key plus `complaints(status)`, `complaints(submitted_at)`, `locations(barangay)` |
| Accounts | `dropboxed_app` (runtime), `dropboxed_report` (read-only), `dropboxed_dba` (maintenance), `dropboxed_backup` (backups). See [role setup](docs/db-roles-setup.md). |
| Documentation | `COMMENT ON` for the schema, tables and key columns (visible in pgAdmin and `\d+`) |
| Time zone | `TIMESTAMP` columns hold Asia/Manila local time; the app sets `TimeZone` on every connection |

To list the tables:

```bash
psql -U postgres -d dropboxed_db -c "\dt+ dropboxed.*"
```

For backups, see [backup and recovery](docs/backup-recovery.md). Back up the `uploads/` folder together with the database, because `attachments.file_path` points into it.

Known limitations (same as the handoff sheet): duplicate detection lives in the application, photo storage is local disk, and `status_logs` and `attachments` will need an archiving strategy as they grow.

</details>

<details>
<summary><strong>Security measures</strong></summary>

<br>

- The application connects with a least-privilege account, and PostgreSQL itself refuses deleting complaints, rewriting history or changing the schema
- `.env.setup` keeps the superuser password away from the running app
- bcrypt password hashes; generic "incorrect email or password" message with timing protection
- Signed, `HttpOnly`, `SameSite=Lax` session cookie; CSRF token on every form
- Role checks on every route; residents can see only their own complaints and photos
- Photos are served only through an access-checked route. Types are verified from file contents and names are randomized on disk.
- Parameterized SQL everywhere; CSV export protects against formula injection

</details>

<details>
<summary><strong>Already set up with <code>PGUSER=postgres</code>?</strong></summary>

<br>

Your data stays as it is. Fill in `.env.setup` as in [Step 4](#step-4-create-your-two-settings-files), change `.env` to `PGUSER=dropboxed_app` with a new `PGPASSWORD`, then run `npm run db:setup` (without `--sample`) and `npm run db:verify`.

</details>

<details>
<summary><strong>No PostgreSQL installed? (development only)</strong></summary>

<br>

`npm run db:embedded` starts PGlite, which is real PostgreSQL compiled to WebAssembly, on `127.0.0.1:5433` and stores its data in `.pgdata/`. Point `.env` at it with `PGHOST=127.0.0.1`, `PGPORT=5433`, `PGDATABASE=postgres`, `PGUSER=postgres`, `PGPASSWORD=postgres` and `DB_POOL_MAX=4`, and do not create `.env.setup`. Then run `npm run db:setup -- --sample` and `npm start` in a second terminal.

Stop it with **Ctrl + C** so it shuts down cleanly. If it is killed abruptly it may fail to start next time ("Aborted()"). In that case, delete the `.pgdata/` folder and run `npm run db:setup -- --sample` again. Use a real PostgreSQL server for the DBA activities.

</details>

---

## 📚 Documentation

| Document | Contents |
|---|---|
| [Database](docs/database.md) | Database name, schema, ERD, tables, relationships, keys, constraints, indexes, differences from the blueprint |
| [User roles](docs/user-roles.md) | Application user roles and how they map to database roles |
| [Database roles setup](docs/db-roles-setup.md) | Group roles, login accounts, privileges, access-control plan and rationale |
| [Troubleshooting](docs/troubleshooting.md) | Common setup errors and solutions |
| [Maintenance](docs/maintenance.md) | Health checks, log review, VACUUM and ANALYZE, query plans |
| [Backup and recovery](docs/backup-recovery.md) | Backup plan, RPO and RTO, restore and recovery procedures |
| [Requirements check](docs/requirements-check.md) | Every activity requirement, checked against this system |
| [Progress report draft](docs/progress-report-draft.md) | Draft content for the PDF progress documentation |

---

## 🤖 AI usage

This implementation, its database scripts and its documentation were generated with **Claude (Anthropic)** from our group's Activity 2 blueprint. The requirements, business rules, ERD, schema and architecture were designed by the group. The group is responsible for reviewing, testing and being able to explain all of it. The full declaration is in our PDF progress documentation.
