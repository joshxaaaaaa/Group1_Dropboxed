# Backup, restoration and recovery

The DropBoxed backup plan, following Activity 6. The sheet has each group do this on the other groups' projects, so this guide also serves the group that tests DropBoxed. These commands were tested end to end on a throwaway PostgreSQL 18.6 server. Your own evidence must come from running them yourself.

## Backup plan (Part A)

The schedule, retention, RPO and RTO below are proposals for a real deployment. Your group should confirm that it agrees with them.

| Item | Plan |
|---|---|
| What to back up | Database `dropboxed_db`: the `dropboxed` schema with 8 tables, sequences, constraints, indexes, comments and table grants. Also the `uploads/` folder, because `attachments.file_path` points to it and a dump does not contain the photos. |
| Method | `pg_dump` custom format (`-Fc`) with `pg_restore`. It is compressed, can restore a single table, and runs while the application is live. |
| Backup account | `dropboxed_backup`: it can read everything and change nothing. Not the application runtime account. |
| Storage | A protected folder outside the repository, readable only by the database administrator. Dumps contain password hashes and residents' personal details. `.gitignore` blocks `*.dump`. A real deployment also needs an off-site copy. |
| Who has access | `dropboxed_backup` creates the file. `postgres` restores it. Nobody else needs it. |
| How it is verified | Checksum, `pg_restore --list`, then a real restore into a separate test database, checked with `04_verify_restore.sql`. A backup is not proven until it has been restored. |
| Schedule | Daily at 02:00, when few complaints are filed, plus one before any schema change. |
| Retention | 7 daily, 4 weekly and 3 monthly backups. |
| RPO (acceptable data loss) | 24 hours. Residents can re-file a lost complaint, so a day's loss is tolerable. Status history cannot be recreated as easily, so a busier deployment should move to WAL archiving. |
| RTO (time to restore service) | 2 hours. The database is small and restoration takes minutes, but the service supports health-related water reports. |
| Roles after a restore | Roles are cluster-wide and not in a single-database dump, and database-level `CONNECT` is not in the archive either. Run `database/03_roles.sql` before restoring and `database/04_privileges.sql` after. Then set passwords, since they are not stored in the repository. |

## Create and inspect a backup (Part B)

Keep the file outside the project folder, and let psql or pg_dump prompt for the password.

```bash
pg_dump -U dropboxed_backup -h localhost -p 5432 -Fc -d dropboxed_db -f dropboxed_db_activity6.dump
```

Record the file name, size, date and checksum:

```bash
sha256sum dropboxed_db_activity6.dump
```

In PowerShell, use `Get-FileHash dropboxed_db_activity6.dump -Algorithm SHA256` instead.

Inspect the contents:

```bash
pg_restore --list dropboxed_db_activity6.dump
```

The listing shows the schema, tables, data, sequences, constraints, indexes, comments and grants the archive holds. It proves that the file is readable and what it claims to contain. It does not prove that those objects will restore correctly or that the data is right, which is why Part C follows.

Then back up the photos, from the project folder:

```bash
tar -czf dropboxed_uploads_activity6.tar.gz uploads
```

## Restore to a separate test database (Part C)

Never restore over `dropboxed_db`. Run these in order. The first step matters on a new server, because the archive grants privileges to roles that must already exist.

```bash
psql -U postgres -f database/03_roles.sql
```
```bash
createdb -U postgres -h localhost -p 5432 dropboxed_restore_test
```
```bash
pg_restore -U postgres -h localhost -p 5432 -d dropboxed_restore_test --exit-on-error dropboxed_db_activity6.dump
```
```bash
psql -U postgres -d dropboxed_restore_test -f database/04_privileges.sql
```

Verify objects, rows, constraints and a representative query. Run it on `dropboxed_db` too and compare the two:

```bash
psql -U postgres -d dropboxed_restore_test -f database/maintenance/04_verify_restore.sql
```

Verify access control. In `.env`, temporarily set `PGDATABASE=dropboxed_restore_test`, run the following, and change it back. To check that the application works on the restored copy, run `npm start` while the setting is in place.

```bash
npm run db:verify
```

## Controlled recovery simulation (Part D)

This uses only the restored test database and a clearly identified test record. `dropboxed_db` and the first backup stay untouched.

1. **Create the disposable record and record the original state**, connected to `dropboxed_restore_test`:
   ```sql
   INSERT INTO dropboxed.complaint_categories (category_name, description)
   VALUES ('ACTIVITY6-DISPOSABLE', 'Test record for the recovery simulation');
   SELECT * FROM dropboxed.complaint_categories WHERE category_name = 'ACTIVITY6-DISPOSABLE';
   ```
2. **Back up this state:**
   ```bash
   pg_dump -U postgres -h localhost -Fc -d dropboxed_restore_test -f restore_test_before_incident.dump
   ```
3. **Simulate the incident**, and show that the record is gone:
   ```sql
   DELETE FROM dropboxed.complaint_categories WHERE category_name = 'ACTIVITY6-DISPOSABLE';
   SELECT * FROM dropboxed.complaint_categories WHERE category_name = 'ACTIVITY6-DISPOSABLE';
   ```
4. **Recover into a fresh database**, keeping the damaged one for comparison:
   ```bash
   createdb -U postgres -h localhost dropboxed_recovery_test
   ```
   ```bash
   pg_restore -U postgres -h localhost -d dropboxed_recovery_test --exit-on-error restore_test_before_incident.dump
   ```
5. **Compare with the recorded state**, connected to `dropboxed_recovery_test`:
   ```sql
   SELECT * FROM dropboxed.complaint_categories WHERE category_name = 'ACTIVITY6-DISPOSABLE';
   ```

**If the incident happens after the most recent backup,** the backup cannot recover anything created since it was taken. With daily backups, up to 24 hours of complaints and status updates would be lost, which is the RPO above.

## Is this sufficient for a real system? (Part E)

Daily logical backups suit a small system with low write volume and the objectives above. To lose less than a day's data, add continuous WAL archiving for point-in-time recovery, since `pg_dump` can only return to the moment it ran. As the database grows towards the blueprint's expected 500,000 rows, restore time should be re-measured against the RTO. The `uploads/` folder is the weakest point: it needs its own copy, taken at about the same time as the dump, or rows may refer to photos that were not backed up.

## Clean up

```bash
dropdb -U postgres -h localhost dropboxed_recovery_test
```
```bash
dropdb -U postgres -h localhost dropboxed_restore_test
```
