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
