# Progress documentation: draft for the PDF

Activity 3, Part C, Step 3 requires one PDF with the 10 sections below. This draft holds what could be taken from the project. **Replace every item marked `[GROUP]`** with your own facts. Do not invent dates, contributions or test results, because the sheet says the PDF must reflect the repository history.

Before submitting, check that no password or secret appears anywhere, including in screenshots.

---

## 1. Cover and team

- **Project title:** DropBoxed: An Environmental Complaint Application for Household Water Quality Monitoring in San Pedro
- **Course:** COMP 018 Database Administration, BSIT 3-2, Mr. John Kenneth Timblaco
- **Group:** Group 1
- **Repository:** https://github.com/joshxaaaaaa/Group1_Dropboxed
- **Tracker:** `[GROUP: Google Sheets link]`

| Member | Role in the project |
|---|---|
| Abalo, Joshua | `[GROUP]` |
| Dela Cruz, Jan Emmanuel A. | `[GROUP]` |
| Reyes, Denver R. | `[GROUP]` |
| Santiago, Jhayciel D. | `[GROUP]` |
| Valera, Rhaine Cyrel M. | `[GROUP]` |

## 2. System overview

Many San Pedro households have rusty or contaminated water, low pressure, foul odor and pipe leaks, and no trackable way to report them. DropBoxed lets residents report these problems with a category, description, location and photos, and track each one from Pending to In Progress to Resolved. Water district staff review, assign, update and report on every complaint.

The system implements all 8 functional requirements and 12 business rules of the approved Activity 2 blueprint. Out of scope, as approved: billing and meter disputes, live chat, payments, and integration with external systems. See the feature and rule tables in `README.md`.

## 3. User roles

Copy the tables from `docs/user-roles.md`, and the access-control plan from `docs/db-roles-setup.md`.

## 4. Development progress log

`[GROUP]` Fill this in from your real history, with dates, who did the work and the key commits. `git log --format="%h %ad %an %s" --date=short` lists the commits.

| Date | Milestone | Member(s) | Commit |
|---|---|---|---|
| `[GROUP]` | Activity 2 blueprint completed | `[GROUP]` | n/a |
| `[GROUP]` | Initial application and database | `[GROUP]` | `c90fff1` |
| `[GROUP]` | Database roles, privileges, documentation and tests | `[GROUP]` | `[GROUP]` |

## 5. Database implementation

- **ERD:** the draw.io ERD from Part 5 of the blueprint. It still matches the implementation.
- **Schema summary:** copy from `docs/database.md`.
- **SQL scripts:** `00_create_database.sql`, `01_schema.sql`, `02_seed.sql`, `03_roles.sql`, `04_privileges.sql`, run by `npm run db:setup`.
- **Seed data:** 4 categories in `02_seed.sql`. With `--sample`: 5 staff, 10 residents and about 60 complaints.
- **Changes from the approved design, with reasons:** copy the table at the end of `docs/database.md`.

## 6. Application evidence

`[GROUP]` Add screenshots of the working system, for each role:

- Resident: registration, filing a complaint with a photo, status tracking
- Staff: dashboard, filtered queue, status update and history, assignment, reports

Then run these on your own database and paste the results:

```bash
npm run test:smoke -- --yes --out crud-results.md
```
```bash
npm run db:verify -- --out privilege-results.md
```

## 7. Setup and configuration

Condense the README's setup section. Environment variables, with placeholders only:

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=dropboxed_db
PGUSER=dropboxed_app
PGPASSWORD=<your password>
SESSION_SECRET=<a long random value>
```

The database user and role setup is in `docs/db-roles-setup.md`.

## 8. Issues and resolutions

Add any problems your group met. These were found while preparing the project:

| Issue | Cause | Resolution |
|---|---|---|
| The application connected as the `postgres` superuser | The original setup used one account for everything | Added a restricted `dropboxed_app` account, moved admin credentials to `.env.setup`, and added a startup warning |
| The README's restore command restored over the live database | It used `pg_restore --clean` on `dropboxed_db` | Replaced with a tested procedure that restores into a separate database |
| Privileges had to work with identity columns | The sheet warns that inserts may need sequence privileges | Tested it: `GENERATED ALWAYS AS IDENTITY` does not need `USAGE`, so none was granted. `db:verify` proves both sides |
| Staff could not remove a category, though the page implied it | The feature was missing | Added removal of unused categories. `fk_complaints_category` refuses categories in use |
| Blueprint says schema `dropbox` in Part 11 and `dropboxed` in Part 12 | Inconsistent document | Used `dropboxed` and recorded the difference |

## 9. Cross-group verification

`[GROUP]` To be written after testing the other groups' projects: who you tested, the results, the feedback you received about DropBoxed, and what you fixed.

## 10. AI usage declaration

| AI tool | Tasks performed | How the group validated or corrected the output | Member(s) |
|---|---|---|---|
| Claude (Anthropic) | Generated the application code, SQL scripts, role and privilege scripts, test scripts and documentation drafts from the group's Activity 2 blueprint. Compared the system with the activity sheets. | `[GROUP: what each member actually reviewed, ran and changed]` | `[GROUP]` |
| `[GROUP: any other tools]` | `[GROUP]` | `[GROUP]` | `[GROUP]` |

The requirements, business rules, ERD, schema, constraints and architecture were designed by the group in Activity 2. The sheet says each group is responsible for validating AI output and understanding what it submits, and members may be asked to explain it. Each member should be able to explain at least `database/04_privileges.sql` and how `advanceStatus` in `src/services/complaints.js` uses a transaction.
