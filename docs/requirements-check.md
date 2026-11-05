# Requirements check

Every instruction in the COMP 018 activity sheets, checked against DropBoxed.

**Status labels:** **Met** means confirmed by a test or inspection. **Your action** means only the group can do it. **Later** means work on other groups' projects, which is being done later.

**How this was tested:** on throwaway PostgreSQL 18.6 servers, following the README from a clean copy of the project. Your real `dropboxed_db` has not been changed. Evidence for submission must come from your own runs.

## Activity 2: Database blueprint

| Requirement | Status | Evidence |
|---|---|---|
| Application meets the minimum requirements (real problem, users, persistent data, related entities, CRUD, business rules) | Met | `docs/database.md`, `npm run test:smoke` |
| 8 functional requirements | Met | README feature table; all exercised by the smoke test |
| 12 business rules enforced | Met | README rule table; `04_privileges.sql` adds database enforcement of rules 7 and 11 |
| ERD, relational schema, data dictionary and implementation agree (Part 14 reminder) | Met | All 8 tables and every column type and nullability in `01_schema.sql` match Parts 6 and 7 |
| Integrity constraints of Part 9 | Met | Every listed PK, FK, NOT NULL, UNIQUE, CHECK and DEFAULT is in `01_schema.sql` |
| Three-tier architecture of Part 10 | Met | Browser, Express, PostgreSQL. Data access uses `pg` instead of JDBC, as recorded in `docs/database.md` |
| Database plan and handoff of Parts 11 and 12 | Met | `dropboxed_db`, 8 tables, owner `postgres` |
| "Backup and recovery procedures still need to be defined" (Part 12) | Met | `docs/backup-recovery.md` |

### Errors in your blueprint PDF

The implementation is correct, but the PDF contradicts itself in these places. They matter because the sheet grades consistency and members may be asked to explain the document. If the PDF can still be corrected, fix them. If not, be ready to explain them.

| Where | Problem |
|---|---|
| Part 14 evidence notes | **Text from another project:** "Subscribers, Tickets", "ticket submission", "the TICKET table", "the 5 core entities and their 1:N relationships", "5 schemas", "Outlined 8 rules". DropBoxed has complaints, 8 tables, an M:N relationship and 12 rules. |
| Part 14, "Requirements sources" | Mentions "SLA review, and SME discussions", but Part 3 marks subject-matter expert discussion as "Not used". |
| Parts 1 and 14 | Say PostgreSQL 16, but the screenshots and Parts 10 to 12 show 18.6. |
| Part 11 and Part 12 | Schema is `dropbox` in one and `dropboxed` in the other. |
| Part 13, Valera row | Refers to a "Backup & Recovery Plan", but the document does not contain one. |

## Activity 3: System development and repository

| Requirement | Status | Evidence or action |
|---|---|---|
| Identify user roles and their functions and data | Met | `docs/user-roles.md` |
| Implement the database as designed | Met | `database/01_schema.sql` |
| Essential create, retrieve, update and delete | Met | 30 tests pass. Delete covers assignments and unused categories; complaints and accounts are kept by design (Rules 11, 12) |
| Test database operations | Met | `npm run test:smoke`, `npm run db:verify` |
| `README.md` | Met | Followed step by step on a clean copy and a new server |
| `.env.example` with placeholders only | Met | Also `.env.setup.example`. No secrets are tracked by git |
| Database migrations or SQL scripts | Met | `database/00` to `04` |
| Seeders or sample data | Met | `02_seed.sql`, `npm run db:setup -- --sample` |
| Database documentation | Met | `docs/database.md` |
| Application user roles documentation, mapped to database roles | Met | `docs/user-roles.md` |
| User and role setup documentation, no real passwords | Met | `docs/db-roles-setup.md` |
| Troubleshooting guide | Met | `docs/troubleshooting.md` |
| Excludes dependencies, dumps and secrets | Met | `.gitignore` covers `node_modules`, `.env`, `.env.setup`, `uploads`, `*.dump` |
| Project in the group's own repository, accessible to other groups | Your action | `github.com/jedelacruz/Dropboxed` exists, with one commit. Push this work, and check access from an account outside the group |
| Every member added as collaborator | Your action | Check the repository settings |
| Meaningful commits, every member contributing | **Your action, important** | History has one commit by one author. The sheet says the PDF must reflect the repository history, so each member should commit real work from here on. Do not back-date or invent commits |
| Register in the Google Sheets tracker | Your action | Group, repository URL, branch, tech stack (Node.js/Express, PostgreSQL 18.6), status, PDF link |
| PDF progress documentation, 10 sections | Your action | `docs/progress-report-draft.md` has the content that can be drafted from the project |
| Screenshots of the working system and CRUD results | Your action | Run the tests on your own database and take screenshots with no credentials visible |
| AI usage declaration | Your action | Draft in `docs/progress-report-draft.md`. Each member must add what they validated |
| Test all other groups' projects | Later | |
| Respond to feedback about DropBoxed | Later | |

## Activity 4: Roles and privileges

The sheet has you do this on the other groups' projects. DropBoxed now has the same setup built in, which helps the groups testing it and gives you a tested pattern to reuse.

| Requirement | Status | Evidence |
|---|---|---|
| Group roles created `NOLOGIN` | Met | `03_roles.sql`, 4 group roles |
| Individual login roles and memberships | Met | `03_roles.sql`, 4 logins, each in one group |
| Database, schema, table, sequence privileges | Met | `04_privileges.sql` |
| Default privileges reviewed | Met | `ALTER DEFAULT PRIVILEGES`; tested on a new table |
| No elevated attributes | Met | `db:verify` checks all 8 roles |
| App does not use a superuser | Met once applied | `.env.example` and the code are ready, and the app warns if it is a superuser. **Your real `.env` still has `PGUSER=postgres`** until you apply this |
| Read-only accounts cannot write | Met | Tests 23 to 32 |
| Users cannot modify outside their responsibilities | Met | Column-level grants; tests 8 to 18 |
| No database creation or role management | Met | Tests in `db:verify` for each account |
| `PUBLIC` privileges and inherited memberships reviewed | Met | `REVOKE ... FROM PUBLIC`; membership table in the `db:verify` output |
| Permitted and denied operations tested, with account, statement, expected and actual | Met | `npm run db:verify`: 48 tests |
| No passwords in scripts, tracker, PDF | Met | Passwords are in ignored files only and reach the server as SCRAM verifiers. A search of the test server's log found none |
| Set up other groups' projects, access-control plans, `db-access-control/group-XX/`, Activity 4 Log | Later | |

## Activity 5: Maintenance and monitoring

| Requirement | Status | Evidence |
|---|---|---|
| Health checks: version, size, objects, sessions, running queries, roles | Met | `database/maintenance/01_health_checks.sql`, run as `dropboxed_dba` |
| Logs reviewed | Guide ready | `docs/maintenance.md` explains where to look. Log review needs your real server |
| `ANALYZE` and `VACUUM` without a superuser | Met | `02_routine_maintenance.sql`, run as `dropboxed_dba` through `MAINTAIN` |
| Query plan interpreted, recommendation justified | Met | `03_query_plan.sql`, `docs/maintenance.md`. No index was added without evidence |
| Reports, `db-maintenance/group-XX/`, Activity 5 Log for other groups' projects | Later | Reuse these scripts as a starting point |

## Activity 6: Backup and recovery

| Requirement | Status | Evidence |
|---|---|---|
| Backup plan: objects, method, storage, access, verification, schedule, retention, RPO, RTO, recreating roles | Met | `docs/backup-recovery.md`. RPO, RTO and schedule are proposals for your group to confirm |
| `pg_dump -Fc` with a suitable non-runtime account | Met | Tested as `dropboxed_backup` |
| Checksum and `pg_restore --list` | Met | Commands tested |
| Restore to a separate test database | Met | Tested, including into a brand-new server |
| Verify objects, records, constraints, query | Met | `database/maintenance/04_verify_restore.sql` |
| Roles recreated; one permitted and one denied operation | Met | All 48 tests pass against the restored database |
| Recovery simulation on disposable data | Met | Tested. The record was deleted and then recovered into a fresh database |
| Backups not committed | Met | `.gitignore` blocks `*.dump`, `*.backup` and `backups/` |
| Backup, restore and simulate for other groups' projects, `db-backup-recovery/group-XX/`, Activity 6 Log | Later | |
