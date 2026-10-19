# Schema changes from Checkpoint 1

The front end and `sql/schema.sql` use the improved schema below. Each row lists what changed from the Checkpoint 1 draft and why.

## Structural changes

| # | Draft | Now | Why |
|---|-------|-----|-----|
| 1 | `BOOK.total_copies`, `BOOK.available_copies` stored on the book | Removed. Counts are computed from `book_copies.status` | Stored counters drift out of sync with the real copies (update anomaly). |
| 2 | `COPIES.available_copies` (a count on each copy) and `Available?` (boolean) | `book_copies.status` = `available` / `loaned` / `held` / `lost` | A single copy cannot have a "count". Status also covers copies reserved for a hold and lost copies. |
| 3 | Author stored as text on `BOOK` (`first_name`, `last_name`, 20 chars) | New `authors` table plus a `book_authors` junction table (`book_id`, `author_id`, `author_order`; primary key on the pair). `books` no longer has an author column. | A book can have several authors (for example the *Fundamentals of Database Systems* textbook) and an author can write many books, so the relationship is many-to-many. It also avoids repeating and mistyping names (your note "author (FK)" already pointed here). |
| 4 | `MEDIA.total_copies`, `available_copies` | New `media_copies` table (same pattern as books); `media_items` holds the title and type | Needed so a loan can reference one physical media copy. |
| 5 | `ROOM.total_rooms`, `available_rooms` | `rooms` is one row per room (+ `capacity`); availability comes from the new `room_reservations` table | A room row cannot also be a count of rooms. The draft listed room reservations as a relationship but had no table for them. |
| 6 | `LOANS.item_id` (FK to what?) and `Role (Books/Media)` | `loans.book_copy_id` and `loans.media_copy_id`, with a CHECK that exactly one is set | A single `item_id` cannot be a foreign key to two tables. This also enforces your rule "every loan references exactly one physical item". |
| 7 | "A physical copy can have at most one active loan" (constraint list only) | Filtered unique indexes on `loans(book_copy_id)` and `loans(media_copy_id)` where `return_date IS NULL` | Enforced by the database, not just the application. |
| 8 | `HOLDS.item_id` | `holds.book_id` / `holds.media_id` (exactly one set) + `status` (`waiting`, `ready`, `fulfilled`, `expired`, `cancelled`) + `ready_date` | A hold is on a title (a queue), not a specific copy. Status and `ready_date` are needed for the 3-day pickup window and the queue. |
| 9 | `PAYMENTS(user_id, item_id, due_date, amount_due, payment_method int)` | `payments(fine_id, user_id, amount_paid, payment_method, payment_date)` | A payment pays a fine, so it should reference `fines`. `item_id`, `due_date` and `amount_due` duplicated data that already lives on the loan and fine. `payment_method` is text (Cash, Card, ...). |
| 10 | `RECEIPTS(user_id, item_id, paid_date, amount_paid, transaction_code)` | `receipts(payment_id UNIQUE, transaction_code UNIQUE, issued_date)` | Amount, user and date are already on the payment (1-to-1), so they are not repeated. |
| 11 | Loans–Fines described as both 1-to-1 and 1-to-many | `fines.loan_id` is UNIQUE (1-to-1) | Your constraints say "a fine is created when a returned item is late", which is one fine per loan. Change it to 1-to-many if your team wants fines to accumulate in several rows. |
| 12 | `USERS.password varchar(18)` | `password_hash VARCHAR(255)` | Passwords must be stored as hashes (BCrypt), which are about 60 characters. Also the front end never stores or shows real passwords once the back end is connected. |
| 13 | `USERS.Type` (student/faculty, string 7) | `members.role` with CHECK (`student`, `faculty`) | Same data; a CHECK stops invalid values. Table renamed `members` to avoid confusion with database users. |
| 14 | `EMPLOYEE/ADMIN.id`, `Admin?` | `staff.staff_id`, `is_admin` | Naming only. Staff stay in a separate table so "only administrators can view staff records" can be enforced by role. |
| 15 | No way to "delete" data | `is_active` flag on members, staff, books, media, rooms; delete buttons archive instead | Hard deletes would break loan, fine and payment history. Authors and reservations (no history) are really deleted. |
| 16 | No audit table | New `audit_log` | Lets the demo show triggers firing. |
| 17 | `BOOK.publisher` was in the attribute list only in the conceptual schema | Kept as `books.publisher` (nullable) | Matches the conceptual schema. |
| 18 | Dates written MM-DD-YYYY | Stored as `DATE` / `DATETIME2`; displayed as MM-DD-YYYY in the app | Real date types sort and compare correctly. |
| 19 | IDs "3 const" / "4" digits | Plain `INT IDENTITY` | Digit limits would cap the library at 999 members. Start values (members 100, books 1000) keep IDs readable. |
| 20 | Book fields "number borrowed" (Checkpoint text) | Computed with `COUNT(*)` on `loans` (see "Most borrowed titles" report) | Another stored counter that would go stale. |

## Business-rule interpretations (please confirm with your team)

- **Fine formula**: "$5 base + $1/week" is implemented as `5 + floor(days_overdue / 7)`. A book 1 to 6 days late costs $5, 7 to 13 days costs $6, and so on.
- **Hold limit**: "Users request Items (1 to 3)" is read as at most 3 active holds per member.
- **Holds on available items**: placing a hold when a copy is on the shelf makes the hold `ready` immediately and sets that copy aside for 3 days. If every copy is out, the member joins the queue.
- **Hold expiry**: a ready hold may be picked up through its `expiration_date`; the nightly job expires it the next day.
- **Borrowing is in person**: the website lets members place holds and pay fines, but check-out and return are staff actions.
- **Payments**: a fine is paid in full (no partial payments).
- **Warning at 2 days**: shown on the member's "My Library" page as "(title) must be returned in N days".

## Tables in the final schema

`members`, `staff`, `authors`, `books`, `book_authors`, `book_copies`, `media_items`, `media_copies`, `rooms`, `room_reservations`, `loans`, `fines`, `holds`, `payments`, `receipts`, `audit_log` (16 tables).
