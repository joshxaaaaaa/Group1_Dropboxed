# Maintenance and monitoring

How to monitor and maintain the DropBoxed database, following Activity 5. The sheet has each group do this on the other groups' projects, so this guide also serves the group that tests DropBoxed. Run these against your own real database and capture the output yourself: the sheet says credit depends on evidence from real databases.

All scripts are in `database/maintenance/` and use the accounts from [db-roles-setup.md](db-roles-setup.md). No superuser is needed.

| Task | Account | Command |
|---|---|---|
| Health and activity (Part A) | `dropboxed_dba` | `psql -U dropboxed_dba -d dropboxed_db -f database/maintenance/01_health_checks.sql` |
| Routine maintenance (Part C) | `dropboxed_dba` | `psql -U dropboxed_dba -d dropboxed_db -f database/maintenance/02_routine_maintenance.sql` |
| Query plans (Part D) | `dropboxed_report` | `psql -U dropboxed_report -d dropboxed_db -f database/maintenance/03_query_plan.sql` |

## Logs (Part B)

The server log is outside the database. On a default Windows install it is in `C:\Program Files\PostgreSQL\18\data\log\`, which needs administrator rights to open. `01_health_checks.sql` shows the logging settings in effect.

Look for these messages:

| Message | Meaning |
|---|---|
| `password authentication failed for user` | A failed login: a wrong password, or someone guessing |
| `permission denied for table` from `dropboxed_app` | A missing privilege, and an application bug. It needs a fix in `04_privileges.sql`. |
| `permission denied` from another account | Often the expected result of an Activity 4 test |
| `deadlock detected`, `canceling statement` | Sessions blocking each other |
| `duplicate key value violates unique constraint "uq_users_email"` | Expected when someone registers an email twice. The application handles it. |

If the default settings hide what you need, `log_min_duration_statement` and `log_connections` can be turned on by a superuser. Both add log volume, so explain why before you change them.

## What maintenance does here

| Command | Why it applies to DropBoxed |
|---|---|
| `ANALYZE` | Refreshes the statistics the planner uses. Worth running after loading sample data or a large import. |
| `VACUUM` on `complaints` | Each status or flag change leaves a dead row version behind, and `complaints` is the table most often updated. |
| `VACUUM FULL` | Not used. It takes an exclusive lock and needs extra disk space, and the sheet says not to use it without approval. |

Autovacuum normally handles both. Check `last_autovacuum` and `n_dead_tup` in the health report before deciding that a manual run is needed.

## Query analysis

Two application queries are worth analyzing. These notes are from a test with the sample data (62 complaints). Capture and interpret your own plans.

| Query | Observed plan | Interpretation |
|---|---|---|
| `byBarangay`, Reports page, run by staff | Sequential scan on `complaints` and `locations`, hash join, under 1 ms | Reasonable. With tables this small, reading everything is cheaper than using an index, so the planner is right to ignore `idx_complaints_submitted_at`. |
| `findRecentSimilar`, every submission | Sequential scan on `complaints`, under 1 ms | Reasonable at this size, for the same reason. |

**At expected growth:** the blueprint expects 50,000 to 500,000 rows. Narrow date ranges should then use `idx_complaints_submitted_at`, and the duplicate check should use `idx_complaints_location_id`, since a household has few complaints. Confirm this with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data before adding anything. An index slows writes and takes storage, so none was added.

**One candidate to measure:** `findOrCreate` in `src/db/locations.js` compares `lower(house_number)` and `lower(street)`, which cannot use a plain index. If submissions slow down at scale, an expression index on those columns could help.

## Recommended schedule for a real deployment

| Task | Frequency |
|---|---|
| Review the health report and log | Weekly |
| Check `n_dead_tup` and autovacuum activity | Weekly |
| Manual `ANALYZE` | After bulk data loads |
| Review index use (`idx_scan` of 0 over a long period suggests an unused index) | Monthly |
| Review `status_logs` and `attachments` growth (blueprint Part 12) | Quarterly |
