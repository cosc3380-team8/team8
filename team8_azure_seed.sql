SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

SET IDENTITY_INSERT dbo.[staff] ON;
INSERT INTO dbo.[staff] ([staff_id], [first_name], [last_name], [email], [password], [is_admin], [is_active])
SELECT v.staff_id, v.first_name, v.last_name, v.email, pw.hash, v.is_admin, v.is_active
FROM (VALUES
    (1, N'Alex',   N'Morgan', N'alex.morgan@library.example',   1, 1),
    (2, N'Jordan', N'Rivera', N'jordan.rivera@library.example', 0, 1),
    (3, N'Taylor', N'Brooks', N'taylor.brooks@library.example', 0, 1),
    (4, N'Casey',  N'Nguyen', N'casey.nguyen@library.example',  0, 0)
) AS v (staff_id, first_name, last_name, email, is_admin, is_active)
CROSS JOIN (SELECT N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi' AS hash) AS pw;
SET IDENTITY_INSERT dbo.[staff] OFF;

SET IDENTITY_INSERT dbo.[user] ON;
INSERT INTO dbo.[user] ([user_id], [first_name], [last_name], [email], [password], [is_faculty], [is_active], [created_at])
SELECT v.user_id, v.first_name, v.last_name, v.email, pw.hash, v.is_faculty, v.is_active, CAST(v.created_at AS datetime2(0))
FROM (VALUES
    ( 1, N'Maya',   N'Tran',    N'maya.tran@campus.example',     0, 1, '2026-06-01 09:12:00'),
    ( 2, N'Daniel', N'Ortiz',   N'daniel.ortiz@campus.example',  0, 1, '2026-06-03 10:40:00'),
    ( 3, N'Priya',  N'Shah',    N'priya.shah@campus.example',    0, 1, '2026-06-20 14:05:00'),
    ( 4, N'Marcus', N'Lee',     N'marcus.lee@campus.example',    0, 1, '2026-07-08 11:30:00'),
    ( 5, N'Hannah', N'Kim',     N'hannah.kim@campus.example',    0, 1, '2026-08-24 16:15:00'),
    ( 6, N'Omar',   N'Haddad',  N'omar.haddad@campus.example',   0, 1, '2026-09-02 08:55:00'),
    ( 7, N'Chloe',  N'Bennett', N'chloe.bennett@campus.example', 0, 0, '2026-09-15 13:20:00'),
    ( 8, N'Elena',  N'Ruiz',    N'elena.ruiz@campus.example',    1, 1, '2026-06-01 08:30:00'),
    ( 9, N'Samuel', N'Okafor',  N'samuel.okafor@campus.example', 1, 1, '2026-07-15 09:45:00'),
    (10, N'Grace',  N'Liu',     N'grace.liu@campus.example',     1, 1, '2026-08-20 10:10:00')
) AS v (user_id, first_name, last_name, email, is_faculty, is_active, created_at)
CROSS JOIN (SELECT N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi' AS hash) AS pw;
SET IDENTITY_INSERT dbo.[user] OFF;

SET IDENTITY_INSERT dbo.[author] ON;
INSERT INTO dbo.[author] ([author_id], [first_name], [last_name]) VALUES
    ( 1, N'Ramez',      N'Elmasri'),
    ( 2, N'Shamkant',   N'Navathe'),
    ( 3, N'Abraham',    N'Silberschatz'),
    ( 4, N'Henry',      N'Korth'),
    ( 5, N'S.',         N'Sudarshan'),
    ( 6, N'Thomas',     N'Cormen'),
    ( 7, N'Charles',    N'Leiserson'),
    ( 8, N'Ronald',     N'Rivest'),
    ( 9, N'Clifford',   N'Stein'),
    (10, N'Robert',     N'Martin'),
    (11, N'Andrew',     N'Hunt'),
    (12, N'David',      N'Thomas'),
    (13, N'Martin',     N'Kleppmann'),
    (14, N'Harper',     N'Lee'),
    (15, N'George',     N'Orwell'),
    (16, N'F. Scott',   N'Fitzgerald'),
    (17, N'Yuval Noah', N'Harari');
SET IDENTITY_INSERT dbo.[author] OFF;

SET IDENTITY_INSERT dbo.[book] ON;
INSERT INTO dbo.[book] ([book_id], [title], [publisher], [isbn], [publish_year]) VALUES
    ( 1, N'Fundamentals of Database Systems',      N'Pearson',          N'9780133970777', 2015),
    ( 2, N'Database System Concepts',              N'McGraw-Hill',      N'9780078022159', 2019),
    ( 3, N'Introduction to Algorithms',            N'MIT Press',        N'9780262033848', 2009),
    ( 4, N'Clean Code',                            N'Prentice Hall',    N'9780132350884', 2008),
    ( 5, N'The Pragmatic Programmer',              N'Addison-Wesley',   N'9780201616224', 1999),
    ( 6, N'Designing Data-Intensive Applications', N'O''Reilly Media',  N'9781449373320', 2017),
    ( 7, N'To Kill a Mockingbird',                 N'Harper Perennial', N'9780061120084', 2006),
    ( 8, N'1984',                                  N'Signet Classics',  N'9780451524935', 1961),
    ( 9, N'The Great Gatsby',                      N'Scribner',         N'9780743273565', 2004),
    (10, N'Sapiens: A Brief History of Humankind', N'Harper',           N'9780062316097', 2015);
SET IDENTITY_INSERT dbo.[book] OFF;

INSERT INTO dbo.[book_author] ([book_id], [author_id]) VALUES
    (1, 1), (1, 2),
    (2, 3), (2, 4), (2, 5),
    (3, 6), (3, 7), (3, 8), (3, 9),
    (4, 10),
    (5, 11), (5, 12),
    (6, 13), (7, 14), (8, 15), (9, 16), (10, 17);

SET IDENTITY_INSERT dbo.[media] ON;
INSERT INTO dbo.[media] ([media_id], [title], [is_dvd]) VALUES
    (1, N'Cosmos: A Spacetime Odyssey',                1),
    (2, N'Planet Earth II',                            1),
    (3, N'The Feynman Lectures on Physics (Audio CD)', 0),
    (4, N'Learn Spanish: Level 1 (Audio CD)',          0);
SET IDENTITY_INSERT dbo.[media] OFF;

SET IDENTITY_INSERT dbo.[copies] ON;
INSERT INTO dbo.[copies] ([copy_id], [book_id], [media_id], [is_active]) VALUES
    ( 1,  1, NULL, 1), ( 2,  1, NULL, 1), ( 3,  1, NULL, 1),
    ( 4,  2, NULL, 1), ( 5,  2, NULL, 1),
    ( 6,  3, NULL, 1), ( 7,  3, NULL, 1), ( 8,  3, NULL, 1),
    ( 9,  4, NULL, 1), (10,  4, NULL, 1),
    (11,  5, NULL, 1), (12,  5, NULL, 1),
    (13,  6, NULL, 1), (14,  6, NULL, 1),
    (15,  7, NULL, 1), (16,  7, NULL, 1),
    (17,  8, NULL, 1), (18,  8, NULL, 1),
    (19,  9, NULL, 1), (20,  9, NULL, 0),
    (21, 10, NULL, 1), (22, 10, NULL, 1),
    (23, NULL, 1, 1), (24, NULL, 1, 1),
    (25, NULL, 2, 1),
    (26, NULL, 3, 1),
    (27, NULL, 4, 1);
SET IDENTITY_INSERT dbo.[copies] OFF;

SET IDENTITY_INSERT dbo.[room] ON;
INSERT INTO dbo.[room] ([room_id], [room_number], [capacity], [is_active]) VALUES
    (1, N'101', 4, 1),
    (2, N'102', 6, 1),
    (3, N'201', 8, 1),
    (4, N'202', 2, 0);
SET IDENTITY_INSERT dbo.[room] OFF;

SET IDENTITY_INSERT dbo.[loan] ON;
INSERT INTO dbo.[loan] ([loan_id], [user_id], [copy_id], [borrow_date], [due_date], [return_date])
SELECT v.loan_id, v.user_id, v.copy_id, CAST(v.borrowed AS date),
       DATEADD(day, bp.loan_days, CAST(v.borrowed AS date)), CAST(v.returned AS date)
FROM (VALUES
    ( 1,  1,  1, '2026-06-02', '2026-06-15'),
    ( 2,  2,  6, '2026-06-03', '2026-06-20'),
    ( 3,  8, 13, '2026-06-04', '2026-06-25'),
    ( 4,  1, 15, '2026-06-10', '2026-07-08'),
    ( 5,  3, 17, '2026-06-22', '2026-07-05'),
    ( 6,  2, 23, '2026-06-24', '2026-07-01'),
    ( 7,  8,  4, '2026-06-26', '2026-07-30'),
    ( 8,  4,  9, '2026-07-09', '2026-07-20'),
    ( 9,  3,  1, '2026-07-10', '2026-08-20'),
    (10,  9,  6, '2026-07-16', '2026-08-05'),
    (11,  1, 11, '2026-07-20', '2026-08-03'),
    (12,  4, 19, '2026-07-22', '2026-08-25'),
    (13,  2, 21, '2026-07-28', '2026-08-10'),
    (14,  9, 25, '2026-07-30', '2026-08-12'),
    (15,  8,  7, '2026-08-03', '2026-08-21'),
    (16,  1, 13, '2026-08-10', '2026-08-28'),
    (17,  3,  9, '2026-08-12', '2026-08-30'),
    (18,  5,  2, '2026-08-25', '2026-09-10'),
    (19,  5, 15, '2026-08-25', '2026-09-30'),
    (20, 10,  4, '2026-08-21', '2026-09-12'),
    (21,  4, 17, '2026-08-26', '2026-09-08'),
    (22,  2, 26, '2026-08-27', '2026-09-25'),
    (23,  6,  6, '2026-09-02', '2026-09-18'),
    (24,  6, 11, '2026-09-02', '2026-09-29'),
    (25,  1, 21, '2026-09-03', '2026-09-20'),
    (26,  9, 13, '2026-09-08', '2026-09-28'),
    (27,  3, 19, '2026-09-09', '2026-09-25'),
    (28,  7,  9, '2026-09-15', '2026-09-28'),
    (29, 10, 23, '2026-09-10', '2026-10-09'),
    (30,  5,  7, '2026-09-14', '2026-10-01'),
    (31,  4,  1, '2026-09-16', '2026-10-02'),
    (32,  8, 17, '2026-09-17', '2026-10-08')
) AS v (loan_id, user_id, copy_id, borrowed, returned)
JOIN dbo.[user] AS u ON u.user_id = v.user_id
JOIN dbo.[borrow_policy] AS bp ON bp.is_faculty = u.is_faculty;

INSERT INTO dbo.[loan] ([loan_id], [user_id], [copy_id], [borrow_date], [due_date])
SELECT v.loan_id, v.user_id, v.copy_id, CAST(v.borrowed AS date),
       DATEADD(day, bp.loan_days, CAST(v.borrowed AS date))
FROM (VALUES
    (33,  1,  3, '2026-10-01'),
    (34,  1, 14, '2026-10-05'),
    (35,  2,  8, '2026-09-15'),
    (36,  3,  5, '2026-09-18'),
    (37,  4, 10, '2026-10-06'),
    (38,  5, 12, '2026-10-07'),
    (39,  6, 16, '2026-09-21'),
    (40,  6, 18, '2026-10-08'),
    (41,  6, 22, '2026-10-09'),
    (42,  8, 24, '2026-09-28'),
    (43,  8,  2, '2026-10-02'),
    (44,  9, 27, '2026-10-05'),
    (45, 10, 26, '2026-10-10'),
    (46,  9, 13, '2026-10-06')
) AS v (loan_id, user_id, copy_id, borrowed)
JOIN dbo.[user] AS u ON u.user_id = v.user_id
JOIN dbo.[borrow_policy] AS bp ON bp.is_faculty = u.is_faculty;
SET IDENTITY_INSERT dbo.[loan] OFF;

INSERT INTO dbo.[fine] ([loan_id], [amount])
SELECT l.loan_id, 5 + DATEDIFF(day, l.due_date, l.return_date) / 7
FROM dbo.[loan] AS l
WHERE l.return_date > l.due_date
ORDER BY l.loan_id;

INSERT INTO dbo.[payments] ([fine_id], [user_id], [amount_paid], [payment_date], [payment_method])
SELECT f.fine_id, l.user_id, v.amount_paid, CAST(v.paid_at AS datetime2(0)), v.method
FROM (VALUES
    ( 4, 6.00, '2026-07-08 16:20:00', N'cash'),
    ( 7, 6.00, '2026-08-02 11:05:00', N'card'),
    ( 9, 5.00, '2026-08-20 14:40:00', N'card'),
    ( 9, 3.00, '2026-09-05 10:15:00', N'cash'),
    (12, 4.00, '2026-08-25 13:30:00', N'cash'),
    (22, 6.00, '2026-09-25 15:45:00', N'card'),
    (29, 5.00, '2026-10-09 12:10:00', N'card')
) AS v (loan_id, amount_paid, paid_at, method)
JOIN dbo.[loan] AS l ON l.loan_id = v.loan_id
JOIN dbo.[fine] AS f ON f.loan_id = l.loan_id
ORDER BY v.paid_at;

INSERT INTO dbo.[receipts] ([payment_id], [issue_date], [transaction_code])
SELECT p.payment_id, p.payment_date,
       CONCAT(N'TXN-', CONVERT(char(8), p.payment_date, 112), N'-', RIGHT(CONCAT(N'0000', p.payment_id), 4))
FROM dbo.[payments] AS p;

INSERT INTO dbo.[room_reservations] ([user_id], [room_id], [start_time], [end_time]) VALUES
    ( 1, 1, '2026-09-08 10:00:00', '2026-09-08 12:00:00'),
    ( 2, 1, '2026-09-08 12:00:00', '2026-09-08 13:00:00'),
    ( 3, 2, '2026-09-15 14:00:00', '2026-09-15 16:00:00'),
    ( 8, 3, '2026-09-22 09:00:00', '2026-09-22 11:00:00'),
    ( 4, 1, '2026-09-29 15:00:00', '2026-09-29 17:00:00'),
    ( 5, 2, '2026-10-06 10:00:00', '2026-10-06 11:30:00'),
    ( 6, 3, '2026-10-07 13:00:00', '2026-10-07 15:00:00'),
    ( 1, 2, '2026-10-13 10:00:00', '2026-10-13 12:00:00'),
    ( 9, 3, '2026-10-14 09:00:00', '2026-10-14 10:00:00'),
    ( 2, 1, '2026-10-14 14:00:00', '2026-10-14 16:00:00'),
    (10, 1, '2026-10-15 11:00:00', '2026-10-15 12:00:00'),
    ( 3, 2, '2026-10-16 13:00:00', '2026-10-16 14:30:00');

INSERT INTO dbo.[waitlist] ([user_id], [book_id], [media_id], [request_time], [status]) VALUES
    (3, 1,    NULL, '2026-07-02 10:30:00', N'fulfilled'),
    (1, NULL, 2,    '2026-07-29 17:05:00', N'cancelled'),
    (4, 6,    NULL, '2026-10-08 09:40:00', N'waiting'),
    (5, 6,    NULL, '2026-10-09 13:25:00', N'waiting'),
    (2, NULL, 3,    '2026-10-11 11:00:00', N'waiting');
