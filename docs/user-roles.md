# Application user roles

Required by Activity 3, Part B. This document separates what a person can do after logging in to DropBoxed from what a PostgreSQL account can do. People never connect to PostgreSQL directly. Everyone reaches the database through the application's single runtime account, `dropboxed_app`.

The blueprint (Part 10) defines two application roles, residents and staff/admin. The code enforces them with `requireResident` and `requireStaff` in `src/middleware/auth.js`. Staff and administrators are one role with the same permissions.

## Roles inside the application

| Application role | Responsibilities | Functions and data access | Intended database role |
|---|---|---|---|
| **Resident** (`users` table) | Reports household water problems and tracks them. | Create: own account, complaints, photos. Read: own complaints, photos, status history. Update: own name, phone and password. Cannot see other residents' data or the staff console. | `dropboxed_runtime_grp`, through `dropboxed_app` |
| **Staff / Administrator** (`staff` table) | Reviews, assigns, updates and resolves complaints; generates reports; manages accounts and categories. | Read: all complaints, photos, residents, reports. Update: complaint status (one step at a time), flags, resident and staff account status, own password. Create: staff accounts, categories, assignments, status logs. Delete: assignments, unused categories. Cannot delete complaints, accounts or history. | `dropboxed_runtime_grp`, through `dropboxed_app` |
| **Visitor** (not logged in) | Learns about the service, registers or logs in. | Read: home page, category names, `/health`. | `dropboxed_runtime_grp`, through `dropboxed_app` |

## Roles that exist only in PostgreSQL

These accounts are for the people and tools that run the system. None of them is an application login.

| System role | Responsibilities | Data access | Database group role | Login role |
|---|---|---|---|---|
| **Application runtime** | The account the application uses to connect. | Only the operations in `src/db/*.js`. | `dropboxed_runtime_grp` | `dropboxed_app` |
| **Reports viewer / auditor** | Inspects records and produces reports outside the application. | Read-only. No password hashes, emails or phone numbers. | `dropboxed_readonly_grp` | `dropboxed_report` |
| **Database administrator** | Maintains and monitors the database, corrects data. | Read and write rows, VACUUM, ANALYZE, monitoring views. No schema changes. | `dropboxed_dba_grp` | `dropboxed_dba` |
| **Backup operator** | Runs `pg_dump`. | Read-only on every table and sequence, including password hashes, because a backup must be complete. | `dropboxed_backup_grp` | `dropboxed_backup` |
| **Database owner** | Creates the database, schema and roles; restores backups. | Full control. Used only for provisioning, never by the application. | none | `postgres` (blueprint Part 12) |

## How to exercise the roles

After `npm run db:setup -- --sample`, these sample accounts are available:

| Application role | Log in at | Email | Password |
|---|---|---|---|
| Staff / Administrator | `/staff/login` | `admin@dropboxed.local` | `ADMIN_PASSWORD` from `.env.setup` (`Admin@12345` if left blank) |
| Staff / Administrator | `/staff/login` | `maria.santos@dropboxed.local` | `Password@123` |
| Resident | `/login` | `juan.delacruz@example.com` | `Password@123` |

These are published sample credentials for local testing only.

Known limitation: because staff and administrators are one role, any staff member can create or deactivate another staff account. This matches the approved blueprint. A separate administrator role would need a change to the `staff` table.

The database accounts, group roles and exact privileges are in [db-roles-setup.md](db-roles-setup.md).
