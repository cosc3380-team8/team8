# team 8 - library database - project document

cosc 3380, section 17184, team 8

website: https://umas-library.vercel.app (logins are in the README)

our app is a library for a university. students and faculty borrow books, media (dvds, audio cds) and devices (laptops, calculators). every title can have many copies. when nothing is on the shelf you can join a hold queue. there are also study rooms you can book. staff run the front desk and the admin sees the reports.

the database is azure sql with 17 tables: user, staff, borrow_policy, author, book, book_author, media, copies, room, room_reservations, loan, waitlist (holds), fine, payments, receipts, notification and audit_log. plus a view called fine_status that works out if a fine is paid.

## 1. data you can add, change and delete

we dont really delete anything that has history. "delete" means archive (is_active = 0), so old loans and fines still make sense.

| data | add | change | delete / archive | who |
|---|---|---|---|---|
| books (title, isbn, publisher, year, authors) | yes | yes | archive | staff |
| copies of a book or media item | yes | - | archive one copy (lost/broken) | staff |
| media and devices | yes | yes | archive | staff |
| authors (first, middle, last name, two authors can have the same name) | yes | yes | yes | staff |
| study rooms | yes | yes | archive | staff |
| members (students and faculty) | admin | staff | deactivate | admin / staff |
| staff accounts (employees and admins) | yes | yes | deactivate | admin |
| loans | check out | return | - | staff |
| holds | join the queue | - | cancel | members (staff can cancel too) |
| room bookings | yes | - | cancel | members and staff |
| fine payments | record a cash payment, prints a receipt | - | - | staff |
| notifications | made by triggers | mark as read | - | members |

## 2. user roles

| role | what they can do |
|---|---|
| student | borrow up to 3 items for 20 days, up to 3 holds, book rooms, see their own loans, fines, receipts and notifications |
| faculty | same as student but up to 6 items for 30 days and up to 6 holds |
| employee (staff) | front desk: check out, return, holds, fines and payments, manage books/media/rooms, manage members |
| admin | everything staff can do, plus staff accounts and the reports page |

the borrow limits and loan days live in the borrow_policy table, so they are data, not hard coded.

## 3. semantic constraints done as triggers

| trigger | when it runs | business rule | what it does |
|---|---|---|---|
| trg_loan_checkout | after a new loan is inserted | a student can have 3 items out, faculty 6. no borrowing on a deactivated account or an archived copy | if the limit is passed it stops the checkout with "Trying to borrow more books? Return one today and experience another book's world!". otherwise it marks the copy as not on the shelf, writes the audit log and tells the member the due date |
| trg_loan_return | after a loan is updated (returned) | late fee is $5 plus $1 for every full week late | sets the final fine from the real return date, puts the copy back on the shelf (unless its being held for someone), logs it and tells the member their final fine |
| trg_hold_queue | after a loan is updated (returned) | when a book comes back, the first person waiting gets it | gives the returned copy to the first waiting hold, marks it ready, sets the pick up date to 3 days later, logs it and sends "your book is available, pick it up by ..." |
| trg_hold_expired | after a hold is updated | you have 3 days to pick up a ready hold | when a ready hold expires it lets go of the copy, puts the copy back on the shelf, tells the member, and gives the copy to the next person in line |
| trg_room_reservations_overlap | after a room booking is inserted or changed | the same room cant be booked for overlapping times | stops the booking if the times overlap with another booking for that room |

there is also a daily job (vercel cron, every day 5 am houston time) that runs 3 stored procedures:
- expire_holds: marks ready holds past their pick up date as expired (this is what fires trg_hold_expired)
- send_due_reminders: sends "(book name) must be returned in 2 days" two days before the due date
- update_overdue_fines: makes fines go up $1 every week while a late item is still not returned

## 4. queries and reports

### reports (admin, reports page)

every report has filters (dates, member, role, author, keyword, book or media) and a view report button. each one pulls from more than one table.

| report | what it shows |
|---|---|
| most borrowed titles | top 10 titles by number of loans, can filter by author or a word in the title |
| personalized loan history | every loan that matches the filters, pick a member to get their own history |
| borrowing by author | which authors get borrowed the most and how many of their titles |
| fines by month | fines charged, collected and still owed, grouped by month |
| borrowing activity by member role | students vs faculty: number of loans, current loans, overdue items, average loans per member |
| inventory status | copies per title split into available, on loan and held for pickup |

### queries people use every day

| where | query |
|---|---|
| catalog | search books and media by title, author or isbn, shows how many copies are on the shelf |
| catalog | your place in the hold queue for a title |
| circulation (staff) | items on loan with due date and overdue / due soon status |
| circulation (staff) | active holds with queue position and pick up by date |
| circulation (staff) | fines with amount owed, paid and receipt |
| member pages | my loans, my fines, my receipts, my notifications, my room bookings |
| rooms | your upcoming bookings, plus past and cancelled ones |
