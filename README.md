<<<<<<< HEAD
# Uma's Library: front end

React + TypeScript (Vite) web app for the Group 8 library database project. Theme: Times New Roman, dark red, with the cougar mascot (`public/mascot.png`).

## Run it

You need Node.js 18 or newer.

```bash
npm install
npm run dev        # opens http://localhost:5173
```

`npm run build` type-checks and builds for production.

The app works on its own with demo data stored in your browser (`src/api/store.ts`), so you can demo it before the Java back end and Azure database are ready. If you change the demo data in code, bump the `KEY` in `src/api/store.ts` (or clear site data) so the browser reloads it. Admins can reset the demo data on the **Triggers & Audit Log** page.

## Demo accounts

| Role | Email | Password | Good for showing |
|---|---|---|---|
| Student | esther@uni.edu | student123 | Esther Burns: at the 3-item limit, one item due tomorrow, one overdue |
| Student | uriel@uni.edu | student123 | Uriel Smith: one item on loan |
| Faculty | aliza@uni.edu | faculty123 | Aliza Salman: overdue item, a hold that becomes ready |
| Employee | clark@library.edu | staff123 | Clark Nguyen: circulation, forms, queries, reports |
| Admin | azael@library.edu | admin123 | Azael Aaron: everything, plus staff records |

## Where each required feature lives

| Requirement | Where |
|---|---|
| **User authentication, different roles** | `LoginPage`, `auth/AuthContext.tsx`, route guards in `App.tsx`. Four roles: student, faculty, employee, admin. Patrons see My Library, Catalog, Study Rooms. Employees add the staff tools, queries and reports. Only admins open **Staff**. |
| **Data entry forms: add, modify, delete** | Manage Books (+ Authors), Manage Media, Manage Rooms, Members, Staff. Generic form in `components/EntityManager.tsx`. "Delete" archives the row (`is_active = 0`) so loan history survives. Also: Circulation (check out / return / hold / payment) and Study Rooms (reserve / cancel). |
| **Triggers (at least 2)** | `sql/triggers.sql`: `trg_loans_enforce_limit`, `trg_loans_after_insert`, `trg_loans_after_return`, `trg_payments_after_insert`, `trg_reservations_no_overlap`, plus `sp_promote_next_hold` and `sp_expire_holds`. The page **Triggers & Audit Log** shows each one firing as you use the app. |
| **Data queries (at least 3)** | **Queries** page: items checked out by a member, overdue loans with projected fines, catalog availability search, hold queue for an item. Each shows its T-SQL. |
| **Data reports (at least 3)** | **Reports** page: most borrowed titles, fines by month, borrowing activity by role, inventory status. Each has stats, a chart, a table and its T-SQL. |

## Things worth showing in the demo

1. Sign in as **Esther** (student) → My Library shows the "must be returned in 1 day" warning and the "Trying to borrow more books?" message at her limit.
2. Sign in as **Clark** → Circulation → try to check out a 4th item to Esther (limit trigger blocks it).
3. Return Esther's overdue copy of *Crime and Punishment* → a fine is created and Aliza's hold becomes **ready** (open Triggers & Audit Log).
4. Record the fine payment → receipt code appears.
5. Study Rooms: book Room 101 tomorrow 10:30 to 11:30 (overlap is rejected).

## Project layout

```
src/
  api/        api.ts (what pages call) · rules.ts (rules + simulated triggers) · analytics.ts (queries/reports + SQL)
              seed.ts, store.ts, state.ts (demo database in browser storage)
  auth/       AuthContext.tsx
  components/ Layout, EntityManager, ui
  pages/      one file per screen
sql/          schema.sql, triggers.sql (Azure SQL / T-SQL)
docs/         SCHEMA_CHANGES.md, API_CONTRACT.md
```

## Connecting the real back end

1. Create the database on Azure SQL: run `sql/schema.sql`, then `sql/triggers.sql`. Add your client IP in the Azure SQL server firewall settings.
2. Build the Java service from `docs/API_CONTRACT.md` and enable CORS for `http://localhost:5173`.
3. In `src/api/api.ts` and `src/api/analytics.ts`, replace each function body with a `fetch` call to the matching endpoint. Keep the signatures, and the pages keep working.
4. Delete the demo-account panel in `LoginPage.tsx`.

Schema changes from your Checkpoint 1 draft are all listed in `docs/SCHEMA_CHANGES.md`.
=======
# Team 8 — Library Database

Use **[team8.sql](team8.sql)**. Please finish testing it before submission.

**Due Wednesday, September 30, 2026. Email the final SQL dump to uramamur@bcm.edu. GitHub is for sharing our work.**

## What is in the file?

- **14 tables** with keys and constraints.
- **fine_status:** a saved query (a view) that calculates whether a fine is paid.
- **save_room_reservation:** a saved SQL command (a procedure) that checks room bookings before saving.
- **No sample records.** The export used “no data,” so everyone must add their own test records.

The room command is inside this file because “Include stored routines” was selected when exporting. It is not a separate download.

## Changes made after Saleem's feedback

- Added `author` and `book_author`. Removed `book.author_name`.
- Added a unique calculated column to block two active loans for one copy. Do not enter `active_copy_id` yourself.
- Removed `paid_status` and `paid_date` from `fine`. Read them from `fine_status` instead:
  ```sql
  SELECT * FROM fine_status;
  ```
  Unpaid or partially paid means status 0 and no paid date. Fully covered means status 1, with the latest payment date.
- Added `save_room_reservation` for new bookings and edits. **Direct INSERT/UPDATE on room_reservations bypasses this check.** The application must use the procedure.

## How to open it on your computer

1. Install/start MySQL and connect DataGrip to your own server. Cloning GitHub does not connect you to Clark's database.
2. Download or pull the latest `team8.sql`. Make a copy for testing.
3. In that copy, remove the three whole lines containing `SQL_LOG_BIN` and the one whole line containing `GTID_PURGED`. They are server settings, not project tables.
4. Remove only this text wherever it appears: `` DEFINER=`root`@`localhost` ``. Keep the rest of the line. This lets the view and procedure belong to your importing account.
5. In your MySQL console, create and select a new, empty database:
   ```sql
   CREATE DATABASE team8_review;
   USE team8_review;
   ```
6. Run the entire cleaned file in that database. It contains DROP commands, so do not run it over work you need.
7. Run `SHOW FULL TABLES;`: expect 14 base tables and the fine_status view. Run `SHOW CREATE PROCEDURE save_room_reservation;` to check the procedure imported too.

## What still needs testing?

**Confirmed:** trying to lend the same copy twice without a return was rejected.

**Still to test:**
- Return the copy, then borrow it again: should succeed.
- Give one book two authors: should succeed.
- Add partial and full payments; edit/delete a payment; check `fine_status` each time.
- Add and edit room bookings through the procedure: overlapping times should fail; back-to-back times should work.
- Import the final dump into another empty database without errors.

For room bookings, the arguments are reservation ID, user ID, room ID, start, end. Use NULL for a new reservation, or its existing ID to edit. Example below assumes user 1 and room 1 exist; replace them with your actual IDs:
```sql
CALL save_room_reservation(
    NULL, 1, 1,
    '2026-09-30 14:00:00',
    '2026-09-30 15:00:00'
);
```
Call it on its own; it manages its own transaction.

Borrowing limits, automatic fines, copy-availability updates, and reminders are not implemented. This file is not the finished application.

## Finish and submit

After fixing/testing, export again with **Include stored routines checked**. Uncheck “no data” if the team is including sample records. Check the exported file for the same import settings above, test the exact final file, then commit/push it and email it before the deadline.

Pull before editing so you have the latest team changes.
>>>>>>> 39bfd4618bd98b385f234c98f6d34c932892ffb8
