# REST contract for the Java back end

The front end calls the functions in `src/api/api.ts` and `src/api/analytics.ts`. Today they read and write browser storage. To connect the Java service, keep each function's name and return type and replace its body with a `fetch` call to the endpoint below. Pages do not need to change.

Suggested stack: Spring Boot + Spring Security (JWT) + `mssql-jdbc` against Azure SQL. Enable CORS for `http://localhost:5173`.

| Front-end function | Method and path | Notes |
|---|---|---|
| `login(email, password)` | `POST /api/auth/login` | Returns `{ id, name, email, role }` and a JWT. Check `members` first, then `staff`. Compare with BCrypt. |
| `listBooks()` | `GET /api/books` | Join `book_authors` and `authors`; return `author_ids` (ordered by `author_order`) and `author_name` (names joined with "and"), plus `total_copies` and `available_copies` (COUNT on `book_copies`). |
| `saveBook(book, addCopies)` | `POST /api/books`, `PUT /api/books/{id}` | Body includes `author_ids` (at least one). In one transaction, replace the book's rows in `book_authors`. `addCopies` inserts rows into `book_copies`. |
| `deleteBook(id)` | `DELETE /api/books/{id}` | Soft delete (`is_active = 0`). Reject if any copy is loaned or held. |
| `listMedia()`, `saveMedia()`, `deleteMedia()` | `/api/media` | Same pattern as books. |
| `listAuthors()`, `saveAuthor()`, `deleteAuthor()` | `/api/authors` | Hard delete; reject if the author has rows in `book_authors`. |
| `listRooms()`, `saveRoom()`, `deleteRoom()` | `/api/rooms` | Soft delete; reject if future reservations exist. |
| `listMembers()`, `saveMember()`, `deleteMember()` | `/api/members` | Staff only. Hash passwords; blank password on update = keep. Reject duplicate email. |
| `listStaff()`, `saveStaff()`, `deleteStaff()` | `/api/staff` | **Admin only.** Keep at least one active admin. |
| `listLoans({userId, activeOnly})` | `GET /api/loans?userId=&activeOnly=` | Patrons may only request their own `userId`. |
| `doCheckout(userId, kind, itemId)` | `POST /api/loans` | Staff only. Back end picks a copy (the `held` one if the member has a ready hold), sets `due_date` (+20 / +30 days), inserts. Triggers do the rest. Surface the limit error text to the client. |
| `doReturn(loanId)` | `POST /api/loans/{id}/return` | `UPDATE loans SET return_date = ...`; `trg_loans_after_return` creates the fine and serves the hold queue. Return `{ fine }` if one was created. |
| `listHolds()`, `doPlaceHold()`, `doCancelHold()` | `/api/holds` | Max 3 active holds per member; call `sp_promote_next_hold` after insert and cancel. |
| `listFines(userId?)` | `GET /api/fines` | Join loan, member, payment and receipt. |
| `doPayFine(fineId, method)` | `POST /api/fines/{id}/payments` | Inserts into `payments`; `trg_payments_after_insert` marks it paid and creates the receipt. |
| `listReservations()`, `doReserveRoom()`, `cancelReservation()` | `/api/reservations` | Overlap is rejected by `trg_reservations_no_overlap` (HTTP 409). |
| `runMaintenance()` | `POST /api/admin/expire-holds` | Calls `sp_expire_holds`; also schedule it nightly. |
| `listAudit()` | `GET /api/audit` | Latest rows of `audit_log`. |
| `dashboardStats()` | `GET /api/stats` | Counts for the staff dashboard. |
| `runQuery(id, params)` | `GET /api/queries/{id}?userId=&search=&item=` | Use the SQL in `QUERIES[].sql` with bound parameters. Return `{ columns, rows }`. |
| `runReport(id)` | `GET /api/reports/{id}` | Use `REPORTS[].sql`. Return `{ columns, rows, stats, chart }`. |

## Security notes

- Enforce roles on the server, not only in the UI: patrons see only their own loans, holds and fines; only staff can check items in and out; only admins can read `/api/staff`.
- Use parameterised queries (`PreparedStatement`) for every SQL string in `analytics.ts`.
- Never return password hashes to the browser.
- Remove the demo-account block from `LoginPage.tsx` before submitting a real deployment.
