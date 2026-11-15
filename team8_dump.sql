SET NOCOUNT ON;
GO

CREATE TABLE [dbo].[audit_log] (
    [log_id] int IDENTITY(1,1) NOT NULL,
    [logged_at] datetime2(0) NOT NULL DEFAULT (getdate()),
    [trigger_name] nvarchar(50) NOT NULL,
    [table_name] nvarchar(50) NOT NULL,
    [message] nvarchar(300) NOT NULL,
    CONSTRAINT [PK__audit_lo__9E2397E06AD1E027] PRIMARY KEY ([log_id])
);
GO

CREATE TABLE [dbo].[author] (
    [author_id] int IDENTITY(1,1) NOT NULL,
    [first_name] nvarchar(50) NOT NULL,
    [middle_name] nvarchar(50) NULL,
    [last_name] nvarchar(50) NOT NULL,
    CONSTRAINT [PK__author__86516BCF82AB1880] PRIMARY KEY ([author_id])
);
GO

CREATE TABLE [dbo].[book] (
    [book_id] int IDENTITY(1,1) NOT NULL,
    [title] nvarchar(150) NOT NULL,
    [publisher] nvarchar(100) NULL DEFAULT (NULL),
    [publish_year] int NULL,
    [isbn] nvarchar(13) NULL DEFAULT (NULL),
    [is_active] bit NOT NULL DEFAULT ((1)),
    CONSTRAINT [PK__book__490D1AE12293D581] PRIMARY KEY ([book_id])
);
GO
CREATE UNIQUE INDEX [isbn] ON [dbo].[book] ([isbn]) WHERE ([isbn] IS NOT NULL);
GO

CREATE TABLE [dbo].[book_author] (
    [book_id] int NOT NULL,
    [author_id] int NOT NULL,
    CONSTRAINT [PK__book_aut__A1680C5D625FC89F] PRIMARY KEY ([book_id], [author_id])
);
GO

CREATE TABLE [dbo].[borrow_policy] (
    [is_faculty] bit NOT NULL,
    [max_items] int NOT NULL,
    [loan_days] int NOT NULL,
    CONSTRAINT [PK__borrow_p__FAD00EBD540EA8C1] PRIMARY KEY ([is_faculty]),
    CONSTRAINT [borrow_policy_chk_2] CHECK ([loan_days]>(0)),
    CONSTRAINT [borrow_policy_chk_1] CHECK ([max_items]>(0))
);
GO

CREATE TABLE [dbo].[copies] (
    [copy_id] int IDENTITY(1,1) NOT NULL,
    [book_id] int NULL DEFAULT (NULL),
    [is_available] bit NOT NULL DEFAULT ((1)),
    [media_id] int NULL DEFAULT (NULL),
    [is_active] bit NOT NULL DEFAULT ((1)),
    CONSTRAINT [PK__copies__3C21D2D2236264C5] PRIMARY KEY ([copy_id]),
    CONSTRAINT [copies_chk_1] CHECK ([book_id] IS NOT NULL AND [media_id] IS NULL OR [book_id] IS NULL AND [media_id] IS NOT NULL)
);
GO

CREATE TABLE [dbo].[fine] (
    [fine_id] int IDENTITY(1,1) NOT NULL,
    [loan_id] int NOT NULL,
    [amount] decimal(8,2) NOT NULL,
    CONSTRAINT [PK__fine__F3C688D1B059EC0A] PRIMARY KEY ([fine_id]),
    CONSTRAINT [uq_fine_loan_id] UNIQUE ([loan_id]),
    CONSTRAINT [fine_chk_1] CHECK ([amount]>(0))
);
GO

CREATE TABLE [dbo].[loan] (
    [loan_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [copy_id] int NOT NULL,
    [borrow_date] date NOT NULL,
    [due_date] date NOT NULL,
    [return_date] date NULL DEFAULT (NULL),
    [active_copy_id] AS (case when [return_date] IS NULL then [copy_id]  end),
    CONSTRAINT [PK__loan__A1F7955478620260] PRIMARY KEY ([loan_id]),
    CONSTRAINT [loan_chk_2] CHECK ([return_date] IS NULL OR [return_date]>=[borrow_date]),
    CONSTRAINT [loan_chk_1] CHECK ([due_date]>[borrow_date])
);
GO
CREATE UNIQUE INDEX [one_active_loan_per_copy] ON [dbo].[loan] ([copy_id]) WHERE ([return_date] IS NULL);
GO

CREATE TABLE [dbo].[media] (
    [media_id] int IDENTITY(1,1) NOT NULL,
    [title] nvarchar(150) NOT NULL,
    [is_active] bit NOT NULL DEFAULT ((1)),
    [media_type] varchar(10) NOT NULL,
    CONSTRAINT [PK__media__D0A840F4A90A5371] PRIMARY KEY ([media_id]),
    CONSTRAINT [CK_media_type] CHECK ([media_type]='Other' OR [media_type]='Device' OR [media_type]='Audiobook' OR [media_type]='DVD')
);
GO

CREATE TABLE [dbo].[notification] (
    [notification_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [created_at] datetime2(0) NOT NULL DEFAULT (getdate()),
    [source] nvarchar(50) NOT NULL,
    [message] nvarchar(300) NOT NULL,
    [is_read] bit NOT NULL DEFAULT ((0)),
    CONSTRAINT [PK__notifica__E059842FEE4B1567] PRIMARY KEY ([notification_id])
);
GO

CREATE TABLE [dbo].[payments] (
    [payment_id] int IDENTITY(1,1) NOT NULL,
    [fine_id] int NOT NULL,
    [user_id] int NOT NULL,
    [amount_paid] decimal(8,2) NOT NULL,
    [payment_date] datetime2(0) NOT NULL DEFAULT (getdate()),
    [payment_method] nvarchar(4) NOT NULL,
    [staff_id] int NULL,
    CONSTRAINT [PK__payments__ED1FC9EA08A1A450] PRIMARY KEY ([payment_id]),
    CONSTRAINT [payments_chk_1] CHECK ([amount_paid]>(0)),
    CONSTRAINT [CK__payments__paymen__3D2915A8] CHECK ([payment_method]=N'card' OR [payment_method]=N'cash')
);
GO

CREATE TABLE [dbo].[receipts] (
    [receipt_id] int IDENTITY(1,1) NOT NULL,
    [payment_id] int NOT NULL,
    [issue_date] datetime2(0) NOT NULL DEFAULT (getdate()),
    [transaction_code] nvarchar(50) NOT NULL,
    CONSTRAINT [PK__receipts__91F52C1FD9C37624] PRIMARY KEY ([receipt_id]),
    CONSTRAINT [uq_receipts_payment_id] UNIQUE ([payment_id]),
    CONSTRAINT [uq_receipts_transaction_code] UNIQUE ([transaction_code])
);
GO

CREATE TABLE [dbo].[room] (
    [room_id] int IDENTITY(1,1) NOT NULL,
    [room_number] nvarchar(10) NOT NULL,
    [capacity] int NOT NULL,
    [is_active] bit NOT NULL DEFAULT ((1)),
    [room_level] int NULL DEFAULT ((1)),
    CONSTRAINT [PK__room__19675A8A91E758AE] PRIMARY KEY ([room_id]),
    CONSTRAINT [uq_room_room_number] UNIQUE ([room_number]),
    CONSTRAINT [room_chk_1] CHECK ([capacity]>(0))
);
GO

CREATE TABLE [dbo].[room_reservations] (
    [reservation_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [room_id] int NOT NULL,
    [start_time] datetime2(0) NOT NULL,
    [end_time] datetime2(0) NOT NULL,
    [is_active] bit NOT NULL DEFAULT ((1)),
    CONSTRAINT [PK__room_res__31384C29A56AC814] PRIMARY KEY ([reservation_id]),
    CONSTRAINT [room_reservations_chk_1] CHECK ([end_time]>[start_time])
);
GO

CREATE TABLE [dbo].[staff] (
    [staff_id] int IDENTITY(1,1) NOT NULL,
    [first_name] nvarchar(30) NOT NULL,
    [last_name] nvarchar(30) NOT NULL,
    [email] nvarchar(100) NOT NULL,
    [password] nvarchar(255) NOT NULL,
    [is_admin] bit NOT NULL,
    [is_active] bit NOT NULL DEFAULT ((1)),
    CONSTRAINT [PK__staff__1963DD9C723A732A] PRIMARY KEY ([staff_id]),
    CONSTRAINT [uq_staff_email] UNIQUE ([email])
);
GO

CREATE TABLE [dbo].[user] (
    [user_id] int IDENTITY(1,1) NOT NULL,
    [first_name] nvarchar(30) NOT NULL,
    [last_name] nvarchar(30) NOT NULL,
    [email] nvarchar(100) NOT NULL,
    [password] nvarchar(255) NOT NULL,
    [is_faculty] bit NOT NULL,
    [is_active] bit NOT NULL DEFAULT ((1)),
    [created_at] datetime2(0) NOT NULL DEFAULT (getdate()),
    CONSTRAINT [PK__user__B9BE370F4C82B966] PRIMARY KEY ([user_id]),
    CONSTRAINT [uq_user_email] UNIQUE ([email])
);
GO

CREATE TABLE [dbo].[waitlist] (
    [waitlist_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [book_id] int NULL DEFAULT (NULL),
    [media_id] int NULL DEFAULT (NULL),
    [request_time] datetime2(0) NOT NULL DEFAULT (getdate()),
    [status] nvarchar(9) NOT NULL DEFAULT ('waiting'),
    [ready_date] date NULL,
    [expiration_date] date NULL,
    [held_copy_id] int NULL,
    CONSTRAINT [PK__waitlist__620FAF91E09FF61E] PRIMARY KEY ([waitlist_id]),
    CONSTRAINT [waitlist_chk_1] CHECK ([book_id] IS NOT NULL AND [media_id] IS NULL OR [book_id] IS NULL AND [media_id] IS NOT NULL),
    CONSTRAINT [waitlist_chk_status] CHECK ([status]=N'expired' OR [status]=N'cancelled' OR [status]=N'fulfilled' OR [status]=N'ready' OR [status]=N'waiting')
);
GO
CREATE UNIQUE INDEX [one_waiting_per_user_book] ON [dbo].[waitlist] ([user_id], [book_id]) WHERE ([status]=N'waiting' AND [book_id] IS NOT NULL);
GO
CREATE UNIQUE INDEX [one_waiting_per_user_media] ON [dbo].[waitlist] ([user_id], [media_id]) WHERE ([status]=N'waiting' AND [media_id] IS NOT NULL);
GO

SET IDENTITY_INSERT [dbo].[audit_log] ON;
INSERT INTO [dbo].[audit_log] ([log_id], [logged_at], [trigger_name], [table_name], [message]) VALUES
(2, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 11: room 1 booked by user 10, no overlap'),
(3, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 9: room 3 booked by user 9, no overlap'),
(4, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 4: room 3 booked by user 8, no overlap'),
(5, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 7: room 3 booked by user 6, no overlap'),
(6, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 6: room 2 booked by user 5, no overlap'),
(7, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 5: room 1 booked by user 4, no overlap'),
(8, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 12: room 2 booked by user 3, no overlap'),
(9, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 3: room 2 booked by user 3, no overlap'),
(10, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 10: room 1 booked by user 2, no overlap'),
(11, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 2: room 1 booked by user 2, no overlap'),
(12, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 8: room 2 booked by user 1, no overlap'),
(13, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 1: room 1 booked by user 1, no overlap'),
(14, '2026-11-03 23:27:17.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 14: room 1 booked by user 11, no overlap'),
(15, '2026-11-03 23:32:56.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 15: room 2 booked by user 12, no overlap'),
(16, '2026-11-03 23:33:16.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 16: room 2 booked by user 12, no overlap'),
(17, '2026-11-03 23:42:51.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 17: room 3 booked by user 4, no overlap'),
(18, '2026-11-03 23:43:42.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 18: room 1 booked by user 3, no overlap'),
(19, '2026-11-03 23:59:50.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 17: room 3 booked by user 4, no overlap'),
(20, '2026-11-03 23:59:58.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 18: room 1 booked by user 3, no overlap'),
(21, '2026-11-04 00:00:09.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 18: room 1 booked by user 3, no overlap'),
(22, '2026-11-04 00:03:37.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 15: room 2 booked by user 12, no overlap'),
(23, '2026-11-04 23:34:30.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 19: room 1 booked by user 11, no overlap'),
(24, '2026-11-04 23:34:37.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 19: cancelled'),
(25, '2026-11-05 00:51:37.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 20: room 1 booked by user 11, no overlap'),
(26, '2026-11-05 00:53:37.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 21: room 3 booked by user 11, no overlap'),
(27, '2026-11-05 02:05:17.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 21: cancelled'),
(28, '2026-11-05 02:05:18.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 20: cancelled'),
(29, '2026-11-05 02:05:38.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 22: room 3 booked by user 11, no overlap'),
(30, '2026-11-05 02:18:22.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 23: room 3 booked by user 11, no overlap'),
(31, '2026-11-05 02:18:58.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 24: room 3 booked by user 5, no overlap'),
(32, '2026-11-05 03:10:12.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 25: room 1 booked by user 14, no overlap'),
(36, '2026-11-07 03:27:55.000', N'trg_loan_return', N'loan', N'Loan 46: copy 13 returned, fine $6.00'),
(37, '2026-11-07 03:27:55.000', N'sp_promote_next_hold', N'waitlist', N'Hold 3 is ready for user 4; pick up by 2026-11-10'),
(38, '2026-11-07 03:28:38.000', N'payment_recorded', N'payments', N'Payment 8: fine 9 paid; receipt TXN-20261107-0008 issued.'),
(39, '2026-11-07 03:29:43.000', N'trg_loan_checkout', N'loan', N'Loan 51: copy 17 checked out to user 11, due 2026-11-27'),
(40, '2026-11-07 03:29:52.000', N'trg_loan_return', N'loan', N'Loan 45: copy 26 returned, fine $5.00'),
(41, '2026-11-07 03:29:52.000', N'sp_promote_next_hold', N'waitlist', N'Hold 5 is ready for user 2; pick up by 2026-11-10'),
(42, '2026-11-07 03:30:21.000', N'payment_recorded', N'payments', N'Payment 9: fine 7 paid; receipt TXN-20261107-0009 issued.'),
(43, '2026-11-07 03:31:56.000', N'trg_loan_checkout', N'loan', N'Loan 52: copy 9 checked out to user 2, due 2026-11-27'),
(44, '2026-11-07 03:35:08.000', N'sp_promote_next_hold', N'waitlist', N'Hold 16 is ready for user 11; pick up by 2026-11-10'),
(45, '2026-11-07 03:35:13.000', N'sp_promote_next_hold', N'waitlist', N'Hold 17 is ready for user 11; pick up by 2026-11-10'),
(47, '2026-11-07 04:01:15.000', N'trg_loan_checkout', N'loan', N'Loan 53: copy 48 checked out to user 18, due 2026-11-26'),
(48, '2026-11-07 04:01:15.000', N'trg_loan_checkout', N'loan', N'Loan 54: copy 49 checked out to user 18, due 2026-11-26'),
(49, '2026-11-07 04:01:16.000', N'trg_loan_checkout', N'loan', N'Loan 55: copy 50 checked out to user 18, due 2026-11-26'),
(50, '2026-11-07 04:01:17.000', N'trg_loan_return', N'loan', N'Loan 53: copy 48 returned'),
(51, '2026-11-07 04:01:28.000', N'trg_loan_checkout', N'loan', N'Loan 57: copy 48 checked out to user 18, due 2026-11-26'),
(52, '2026-11-07 04:01:55.000', N'trg_loan_return', N'loan', N'Loan 54: copy 49 returned'),
(53, '2026-11-07 04:01:55.000', N'trg_loan_return', N'loan', N'Loan 55: copy 50 returned'),
(54, '2026-11-07 04:01:55.000', N'trg_loan_return', N'loan', N'Loan 57: copy 48 returned'),
(55, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'loan', N'Loan 59: copy 48 checked out to user 19, due 2026-12-06'),
(56, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'loan', N'Loan 60: copy 49 checked out to user 19, due 2026-12-06'),
(57, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'loan', N'Loan 61: copy 50 checked out to user 19, due 2026-12-06'),
(58, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'loan', N'Loan 62: copy 51 checked out to user 19, due 2026-12-06'),
(59, '2026-11-07 04:01:57.000', N'trg_loan_checkout', N'loan', N'Loan 63: copy 52 checked out to user 19, due 2026-12-06'),
(60, '2026-11-07 04:01:57.000', N'trg_loan_checkout', N'loan', N'Loan 64: copy 53 checked out to user 19, due 2026-12-06'),
(61, '2026-11-07 04:01:59.000', N'trg_loan_checkout', N'loan', N'Loan 66: copy 54 checked out to user 18, due 2026-11-26'),
(62, '2026-11-07 04:01:59.000', N'trg_loan_checkout', N'loan', N'Loan 67: copy 55 checked out to user 18, due 2026-11-26'),
(63, '2026-11-07 04:02:43.000', N'sp_promote_next_hold', N'waitlist', N'Hold 20 is ready for user 18; pick up by 2026-11-09'),
(64, '2026-11-07 04:02:44.000', N'sp_promote_next_hold', N'waitlist', N'Hold 21 is ready for user 18; pick up by 2026-11-09'),
(65, '2026-11-07 04:02:46.000', N'sp_promote_next_hold', N'waitlist', N'Hold 22 is ready for user 18; pick up by 2026-11-09'),
(66, '2026-11-07 04:02:46.000', N'sp_promote_next_hold', N'waitlist', N'Hold 23 is ready for user 18; pick up by 2026-11-09'),
(67, '2026-11-07 04:03:34.000', N'trg_loan_checkout', N'loan', N'Loan 69: copy 56 checked out to user 18, due 2026-11-26'),
(68, '2026-11-07 04:03:35.000', N'trg_loan_return', N'loan', N'Loan 69: copy 56 returned'),
(69, '2026-11-07 04:03:35.000', N'sp_promote_next_hold', N'waitlist', N'Hold 24 is ready for user 19; pick up by 2026-11-09'),
(70, '2026-11-07 04:03:36.000', N'trg_loan_checkout', N'loan', N'Loan 70: copy 58 checked out to user 18, due 2026-11-26'),
(71, '2026-11-07 04:03:36.000', N'trg_loan_return', N'loan', N'Loan 59: copy 48 returned'),
(72, '2026-11-07 04:03:36.000', N'sp_promote_next_hold', N'waitlist', N'Hold 18 is ready for user 18; pick up by 2026-11-09'),
(73, '2026-11-07 04:04:09.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 26: room 6 booked by user 18, no overlap'),
(74, '2026-11-07 04:04:11.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 27: room 6 booked by user 19, no overlap'),
(75, '2026-11-07 04:04:13.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 26: cancelled'),
(76, '2026-11-07 04:04:14.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 28: room 6 booked by user 18, no overlap'),
(77, '2026-11-07 04:04:43.000', N'trg_loan_return', N'loan', N'Loan 60: copy 49 returned'),
(78, '2026-11-07 04:04:43.000', N'sp_promote_next_hold', N'waitlist', N'Hold 19 is ready for user 19; pick up by 2026-11-09'),
(79, '2026-11-07 04:04:43.000', N'trg_loan_return', N'loan', N'Loan 61: copy 50 returned'),
(80, '2026-11-07 04:04:43.000', N'trg_loan_return', N'loan', N'Loan 62: copy 51 returned'),
(81, '2026-11-07 04:04:44.000', N'trg_loan_return', N'loan', N'Loan 63: copy 52 returned'),
(82, '2026-11-07 04:04:44.000', N'trg_loan_return', N'loan', N'Loan 64: copy 53 returned'),
(83, '2026-11-07 04:04:47.000', N'sp_promote_next_hold', N'waitlist', N'Hold 25 is ready for user 19; pick up by 2026-11-09'),
(84, '2026-11-07 04:04:48.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 29: room 6 booked by user 18, no overlap'),
(85, '2026-11-07 04:05:57.000', N'trg_loan_return', N'loan', N'Loan 70: copy 58 returned'),
(86, '2026-11-07 04:05:57.000', N'trg_loan_return', N'loan', N'Loan 67: copy 55 returned'),
(87, '2026-11-07 04:05:57.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 28: cancelled'),
(88, '2026-11-07 04:05:57.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 29: cancelled'),
(89, '2026-11-07 04:05:57.000', N'trg_loan_return', N'loan', N'Loan 66: copy 54 returned'),
(90, '2026-11-07 04:05:58.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 27: cancelled'),
(91, '2026-11-07 04:05:58.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 30: room 6 booked by user 18, no overlap'),
(92, '2026-11-07 04:05:59.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 30: cancelled'),
(93, '2026-11-07 04:09:48.000', N'trg_loan_checkout', N'loan', N'Loan 72: copy 61 checked out to user 20, due 2026-11-26'),
(94, '2026-11-07 04:10:12.000', N'trg_loan_checkout', N'loan', N'Loan 73: copy 36 checked out to user 20, due 2026-11-26'),
(95, '2026-11-07 04:10:14.000', N'trg_loan_checkout', N'loan', N'Loan 74: copy 28 checked out to user 20, due 2026-11-26'),
(96, '2026-11-07 04:10:31.000', N'trg_loan_checkout', N'loan', N'Loan 76: copy 37 checked out to user 21, due 2026-12-06'),
(97, '2026-11-07 04:14:42.000', N'sp_promote_next_hold', N'waitlist', N'Hold 27 is ready for user 20; pick up by 2026-11-09'),
(98, '2026-11-07 04:16:55.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 31: room 1 booked by user 20, no overlap'),
(99, '2026-11-07 04:17:05.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 32: room 1 booked by user 20, no overlap'),
(100, '2026-11-07 04:18:46.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 33: room 1 booked by user 21, no overlap'),
(101, '2026-11-07 04:18:56.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 33: cancelled'),
(102, '2026-11-07 04:19:21.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 31: cancelled'),
(103, '2026-11-07 04:19:29.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 32: cancelled'),
(104, '2026-11-07 04:19:49.000', N'trg_loan_return', N'loan', N'Loan 72: copy 61 returned'),
(105, '2026-11-07 04:20:02.000', N'trg_loan_return', N'loan', N'Loan 73: copy 36 returned'),
(106, '2026-11-07 04:20:05.000', N'trg_loan_return', N'loan', N'Loan 74: copy 28 returned'),
(107, '2026-11-07 04:20:09.000', N'trg_loan_return', N'loan', N'Loan 76: copy 37 returned'),
(108, '2026-11-07 04:20:22.000', N'trg_loan_return', N'loan', N'Loan 35: copy 8 returned, fine $9.00'),
(109, '2026-11-07 04:20:38.000', N'payment_recorded', N'payments', N'Payment 10: fine 11 paid; receipt TXN-20261106-0010 issued.'),
(110, '2026-11-07 17:11:48.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 23: cancelled'),
(111, '2026-11-07 17:11:55.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 34: room 1 booked by user 11, no overlap'),
(112, '2026-11-07 17:44:30.000', N'trg_loan_checkout', N'loan', N'Loan 77: copy 15 checked out to user 8, due 2026-12-07'),
(113, '2026-11-07 17:44:57.000', N'trg_loan_checkout', N'loan', N'Loan 78: copy 63 checked out to user 22, due 2026-11-27'),
(114, '2026-11-07 17:46:28.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 34: cancelled'),
(115, '2026-11-07 17:46:31.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 24: cancelled'),
(116, '2026-11-07 17:46:37.000', N'trg_loan_return', N'loan', N'Loan 43: copy 2 returned, fine $6.00'),
(117, '2026-11-07 17:48:02.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 35: room 1 booked by user 11, no overlap'),
(118, '2026-11-07 17:48:45.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 36: room 1 booked by user 22, no overlap'),
(119, '2026-11-07 17:48:54.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 35: cancelled'),
(120, '2026-11-07 17:48:57.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 36: cancelled'),
(121, '2026-11-07 17:49:51.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 37: room 1 booked by user 11, no overlap'),
(122, '2026-11-07 17:57:23.000', N'sp_promote_next_hold', N'waitlist', N'Hold 30 is ready for user 14; pick up by 2026-11-10'),
(123, '2026-11-07 17:57:40.000', N'sp_promote_next_hold', N'waitlist', N'Hold 31 is ready for user 14; pick up by 2026-11-10'),
(124, '2026-11-07 18:09:54.000', N'sp_promote_next_hold', N'waitlist', N'Hold 32 is ready for user 14; pick up by 2026-11-10'),
(125, '2026-11-07 18:09:57.000', N'sp_promote_next_hold', N'waitlist', N'Hold 33 is ready for user 14; pick up by 2026-11-10'),
(126, '2026-11-07 18:16:03.000', N'trg_loan_checkout', N'loan', N'Loan 79: copy 21 checked out to user 14, due 2026-12-07'),
(127, '2026-11-07 18:16:45.000', N'trg_loan_checkout', N'loan', N'Loan 80: copy 6 checked out to user 14, due 2026-12-07'),
(128, '2026-11-07 18:28:37.000', N'trg_loan_checkout', N'loan', N'Loan 81: copy 62 checked out to user 14, due 2026-10-07'),
(129, '2026-11-07 18:32:36.000', N'trg_loan_return', N'loan', N'Loan 81: copy 62 returned, fine $9.00'),
(130, '2026-11-07 18:34:16.000', N'payment_recorded', N'payments', N'Payment 11: fine 13 paid; receipt TXN-20261107-0011 issued.'),
(131, '2026-11-07 18:37:07.000', N'sp_promote_next_hold', N'waitlist', N'Hold 36 is ready for user 14; pick up by 2026-11-10'),
(132, '2026-11-07 18:37:37.000', N'trg_loan_checkout', N'loan', N'Loan 83: copy 23 checked out to user 14, due 2026-07-20'),
(133, '2026-11-07 18:38:36.000', N'trg_loan_return', N'loan', N'Loan 83: copy 23 returned, fine $20.00'),
(134, '2026-11-07 19:49:48.000', N'trg_loan_checkout', N'loan', N'Loan 84: copy 11 checked out to user 11, due 2026-11-27'),
(135, '2026-11-07 19:52:51.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 38: room 8 booked by user 12, no overlap'),
(136, '2026-11-07 19:53:43.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 38: cancelled'),
(137, '2026-11-07 19:54:53.000', N'trg_loan_checkout', N'loan', N'Loan 85: copy 64 checked out to user 14, due 2026-12-07'),
(138, '2026-11-07 19:54:56.000', N'trg_loan_checkout', N'loan', N'Loan 86: copy 65 checked out to user 14, due 2026-12-07'),
(139, '2026-11-07 19:56:38.000', N'trg_loan_return', N'loan', N'Loan 86: copy 65 returned'),
(140, '2026-11-07 19:56:57.000', N'trg_loan_checkout', N'loan', N'Loan 87: copy 65 checked out to user 14, due 2026-12-07'),
(141, '2026-11-07 19:58:14.000', N'trg_loan_return', N'loan', N'Loan 85: copy 64 returned'),
(142, '2026-11-07 19:58:16.000', N'trg_loan_return', N'loan', N'Loan 87: copy 65 returned'),
(170, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 33: 17 days late, fine is now $7'),
(171, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 34: 13 days late, fine is now $6'),
(172, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 36: 30 days late, fine is now $9'),
(173, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 37: 12 days late, fine is now $6'),
(174, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 38: 11 days late, fine is now $6'),
(175, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 39: 27 days late, fine is now $8'),
(176, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 40: 10 days late, fine is now $6'),
(177, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 41: 9 days late, fine is now $6'),
(178, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 42: 15 days late, fine is now $7'),
(179, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 44: 8 days late, fine is now $6'),
(180, '2026-11-08 19:30:32.000', N'sp_update_overdue_fines', N'fine', N'Loan 34: 14 days late, fine is now $7'),
(181, '2026-11-08 19:30:32.000', N'sp_update_overdue_fines', N'fine', N'Loan 39: 28 days late, fine is now $9'),
(182, '2026-11-08 19:50:35.000', N'trg_loan_checkout', N'loan', N'Loan 2088: copy 2 checked out to user 22, due 2026-11-03'),
(183, '2026-11-08 19:50:42.000', N'sp_update_overdue_fines', N'fine', N'Loan 2088: 5 days late, fine is now $5'),
(184, '2026-11-08 19:55:18.000', N'trg_loan_checkout', N'loan', N'Loan 2089: copy 4 checked out to user 22, due 2026-11-03'),
(185, '2026-11-08 19:55:23.000', N'sp_update_overdue_fines', N'fine', N'Loan 2089: 5 days late, fine is now $5'),
(186, '2026-11-08 20:00:16.000', N'trg_loan_checkout', N'loan', N'Loan 2090: copy 7 checked out to user 11, due 2026-11-03'),
(187, '2026-11-08 20:00:19.000', N'sp_update_overdue_fines', N'fine', N'Loan 2090: 5 days late, fine is now $5'),
(188, '2026-11-08 22:01:05.000', N'sp_promote_next_hold', N'waitlist', N'Hold 38 is ready for user 22; pick up by 2026-11-11'),
(189, '2026-11-08 22:01:30.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 39: room 5 booked by user 22, no overlap'),
(190, '2026-11-08 22:01:37.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 39: cancelled'),
(191, '2026-11-08 22:02:39.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 40: room 2 booked by user 14, no overlap'),
(192, '2026-11-08 22:04:50.000', N'trg_loan_checkout', N'loan', N'Loan 2107: copy 66 checked out to user 2, due 2026-11-28'),
(193, '2026-11-08 22:06:28.000', N'trg_loan_return', N'loan', N'Loan 2090: copy 7 returned, final fine $5'),
(194, '2026-11-08 22:06:36.000', N'trg_loan_return', N'loan', N'Loan 2107: copy 66 returned'),
(195, '2026-11-08 22:06:48.000', N'trg_loan_return', N'loan', N'Loan 33: copy 3 returned, final fine $7'),
(196, '2026-11-08 22:29:12.000', N'trg_loan_checkout', N'loan', N'Loan 2111: copy 66 checked out to user 9, due 2026-12-08'),
(197, '2026-11-08 22:30:04.000', N'trg_loan_return', N'loan', N'Loan 2089: copy 4 returned, final fine $5'),
(198, '2026-11-08 22:30:19.000', N'trg_loan_return', N'loan', N'Loan 36: copy 5 returned, final fine $9'),
(199, '2026-11-08 22:31:51.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 41: room 4 booked by user 4, no overlap'),
(200, '2026-11-08 22:43:53.000', N'payment_recorded', N'payments', N'Payment 12: fine 10 paid; receipt TXN-20261108-0012 issued.'),
(201, '2026-11-08 22:53:11.000', N'payment_recorded', N'payments', N'Payment 13: fine 43 paid; receipt TXN-20261108-0013 issued.'),
(202, '2026-11-08 23:11:11.000', N'payment_recorded', N'payments', N'Payment 14: fine 5 paid; receipt TXN-20261108-0014 issued.'),
(203, '2026-11-08 23:11:21.000', N'payment_recorded', N'payments', N'Payment 15: fine 42 paid; receipt TXN-20261108-0015 issued.'),
(204, '2026-11-08 23:11:31.000', N'payment_recorded', N'payments', N'Payment 16: fine 41 paid; receipt TXN-20261108-0016 issued.'),
(205, '2026-11-08 23:36:57.000', N'payment_recorded', N'payments', N'Payment 17: fine 40 paid; receipt TXN-20261108-0017 issued.'),
(206, '2026-11-09 00:07:31.000', N'payment_recorded', N'payments', N'Payment 18: fine 39 paid; receipt TXN-20261108-0018 issued.'),
(207, '2026-11-09 00:07:34.000', N'payment_recorded', N'payments', N'Payment 19: fine 38 paid; receipt TXN-20261108-0019 issued.'),
(208, '2026-11-09 00:07:38.000', N'payment_recorded', N'payments', N'Payment 20: fine 37 paid; receipt TXN-20261108-0020 issued.'),
(209, '2026-11-09 00:07:50.000', N'payment_recorded', N'payments', N'Payment 21: fine 36 paid; receipt TXN-20261108-0021 issued.'),
(210, '2026-11-09 00:08:13.000', N'payment_recorded', N'payments', N'Payment 22: fine 35 paid; receipt TXN-20261108-0022 issued.'),
(211, '2026-11-09 00:09:03.000', N'payment_recorded', N'payments', N'Payment 23: fine 34 paid; receipt TXN-20261108-0023 issued.'),
(212, '2026-11-09 00:09:06.000', N'payment_recorded', N'payments', N'Payment 24: fine 33 paid; receipt TXN-20261108-0024 issued.'),
(213, '2026-11-09 00:09:10.000', N'sp_promote_next_hold', N'waitlist', N'Hold 29 is ready for user 11; pick up by 2026-11-11'),
(214, '2026-11-09 00:09:10.000', N'sp_promote_next_hold', N'waitlist', N'Hold 37 is ready for user 22; pick up by 2026-11-11'),
(215, '2026-11-09 00:09:13.000', N'payment_recorded', N'payments', N'Payment 25: fine 12 paid; receipt TXN-20261108-0025 issued.'),
(216, '2026-11-09 00:09:19.000', N'payment_recorded', N'payments', N'Payment 26: fine 31 paid; receipt TXN-20261108-0026 issued.'),
(217, '2026-11-09 00:09:24.000', N'payment_recorded', N'payments', N'Payment 27: fine 14 paid; receipt TXN-20261108-0027 issued.'),
(218, '2026-11-09 00:15:00.000', N'payment_recorded', N'payments', N'Payment 28: fine 32 paid; receipt TXN-20261108-0028 issued.'),
(219, '2026-11-09 00:39:10.000', N'payment_recorded', N'payments', N'Payment 29: fine 4 paid; receipt TXN-20261108-0029 issued.'),
(226, '2026-11-09 00:45:53.000', N'trg_loan_checkout', N'loan', N'Loan 2112: copy 68 checked out to user 13, due 2026-11-01'),
(227, '2026-11-09 00:46:14.000', N'sp_update_overdue_fines', N'fine', N'Loan 2112: 7 days late, fine is now $6'),
(228, '2026-11-09 00:46:32.000', N'payment_recorded', N'payments', N'Payment 30: fine 44 paid; receipt TXN-20261108-0030 issued.'),
(229, '2026-11-09 00:46:47.000', N'trg_loan_checkout', N'loan', N'Loan 2113: copy 36 checked out to user 22, due 2026-11-28'),
(230, '2026-11-09 00:46:53.000', N'trg_loan_checkout', N'loan', N'Loan 2114: copy 19 checked out to user 11, due 2026-11-28'),
(231, '2026-11-09 00:47:02.000', N'trg_loan_return', N'loan', N'Loan 2112: copy 68 returned, final fine $6'),
(232, '2026-11-09 01:10:25.000', N'trg_loan_return', N'loan', N'Loan 2114: copy 19 returned'),
(233, '2026-11-09 01:10:25.000', N'sp_promote_next_hold', N'waitlist', N'Hold 34 is ready for user 14; pick up by 2026-11-11'),
(234, '2026-11-09 01:15:22.000', N'trg_loan_return', N'loan', N'Loan 39: copy 16 returned, final fine $9'),
(235, '2026-11-09 01:27:56.000', N'trg_loan_return', N'loan', N'Loan 2113: copy 36 returned'),
(236, '2026-11-09 01:28:05.000', N'trg_loan_return', N'loan', N'Loan 2088: copy 2 returned, final fine $5'),
(237, '2026-11-09 01:40:52.000', N'trg_loan_return', N'loan', N'Loan 44: copy 27 returned, final fine $6'),
(238, '2026-11-09 01:40:52.000', N'sp_promote_next_hold', N'waitlist', N'Hold 39 is ready for user 22; pick up by 2026-11-11'),
(239, '2026-11-09 01:40:54.000', N'trg_loan_return', N'loan', N'Loan 37: copy 10 returned, final fine $6'),
(240, '2026-11-09 01:40:54.000', N'sp_promote_next_hold', N'waitlist', N'Hold 15 is ready for user 11; pick up by 2026-11-11'),
(241, '2026-11-09 01:41:06.000', N'trg_loan_return', N'loan', N'Loan 41: copy 22 returned, final fine $6'),
(242, '2026-11-09 01:45:24.000', N'trg_loan_return', N'loan', N'Loan 52: copy 9 returned'),
(243, '2026-11-09 01:54:45.000', N'trg_loan_return', N'loan', N'Loan 42: copy 24 returned, final fine $7'),
(244, '2026-11-09 01:54:47.000', N'trg_loan_return', N'loan', N'Loan 40: copy 18 returned, final fine $6'),
(245, '2026-11-09 03:23:55.000', N'trg_loan_checkout', N'loan', N'Loan 2115: copy 73 checked out to user 22, due 2026-11-28'),
(246, '2026-11-09 03:34:23.000', N'trg_loan_return', N'loan', N'Loan 2111: copy 66 returned'),
(247, '2026-11-09 04:26:21.000', N'trg_loan_return', N'loan', N'Loan 34: copy 14 returned, final fine $7'),
(248, '2026-11-09 04:30:03.000', N'trg_loan_return', N'loan', N'Loan 79: copy 21 returned'),
(249, '2026-11-09 04:33:06.000', N'trg_loan_checkout', N'loan', N'Loan 2116: copy 48 checked out to user 8, due 2026-04-25'),
(250, '2026-11-09 04:33:43.000', N'sp_update_overdue_fines', N'fine', N'Loan 2116: 197 days late, fine is now $33'),
(251, '2026-11-09 04:34:51.000', N'trg_loan_return', N'loan', N'Loan 2116: copy 48 returned, final fine $33'),
(252, '2026-11-09 04:35:10.000', N'payment_recorded', N'payments', N'Payment 31: fine 45 paid; receipt TXN-20261108-0031 issued.'),
(253, '2026-11-09 11:38:12.000', N'daily_job', N'fine', N'Daily job ran by itself: 0 late fine(s) went up, 0 hold(s) expired.'),
(254, '2026-11-09 22:15:42.000', N'trg_loan_return', N'loan', N'Loan 38: copy 12 returned, final fine $6'),
(255, '2026-11-09 22:23:09.000', N'trg_loan_checkout', N'loan', N'Loan 2117: copy 12 checked out to user 22, due 2026-11-10'),
(256, '2026-11-09 22:24:15.000', N'trg_loan_return', N'loan', N'Loan 2115: copy 73 returned'),
(257, '2026-11-09 22:24:29.000', N'trg_loan_checkout', N'loan', N'Loan 2118: copy 28 checked out to user 22, due 2026-10-21'),
(258, '2026-11-09 22:24:34.000', N'sp_update_overdue_fines', N'fine', N'Loan 2118: 19 days late, fine is now $7'),
(259, '2026-11-09 22:26:58.000', N'trg_loan_checkout', N'loan', N'Loan 2119: copy 40 checked out to user 14, due 2026-06-07'),
(260, '2026-11-09 22:27:32.000', N'sp_update_overdue_fines', N'fine', N'Loan 2119: 155 days late, fine is now $27'),
(261, '2026-11-09 22:28:14.000', N'trg_loan_checkout', N'loan', N'Loan 2120: copy 66 checked out to user 14, due 2025-11-09'),
(262, '2026-11-09 22:28:41.000', N'sp_update_overdue_fines', N'fine', N'Loan 2120: 365 days late, fine is now $57'),
(263, '2026-11-09 22:29:16.000', N'trg_loan_return', N'loan', N'Loan 84: copy 11 returned'),
(264, '2026-11-09 22:29:20.000', N'trg_loan_return', N'loan', N'Loan 2117: copy 12 returned'),
(265, '2026-11-09 22:32:22.000', N'trg_loan_checkout', N'loan', N'Loan 2121: copy 60 checked out to user 10, due 2026-09-05'),
(266, '2026-11-09 22:32:29.000', N'sp_update_overdue_fines', N'fine', N'Loan 2121: 65 days late, fine is now $14'),
(267, '2026-11-09 22:32:38.000', N'trg_loan_return', N'loan', N'Loan 2121: copy 60 returned, final fine $14'),
(268, '2026-11-09 22:33:07.000', N'payment_recorded', N'payments', N'Payment 32: fine 49 paid; receipt TXN-20261109-0032 issued.'),
(269, '2026-11-09 22:35:02.000', N'trg_loan_checkout', N'loan', N'Loan 2122: copy 59 checked out to user 22, due 2026-11-10'),
(270, '2026-11-09 22:40:38.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2040 is ready for user 22; pick up by 2026-11-12'),
(271, '2026-11-09 22:40:41.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2041 is ready for user 22; pick up by 2026-11-12'),
(272, '2026-11-09 22:40:51.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 42: room 4 booked by user 22, no overlap'),
(273, '2026-11-09 22:44:24.000', N'trg_loan_return', N'loan', N'Loan 2120: copy 66 returned, final fine $57'),
(274, '2026-11-09 22:44:46.000', N'payment_recorded', N'payments', N'Payment 33: fine 48 paid; receipt TXN-20261109-0033 issued.'),
(275, '2026-11-09 23:06:50.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2042 is ready for user 22; pick up by 2026-11-12'),
(276, '2026-11-10 00:11:50.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2043 is ready for user 22; pick up by 2026-11-12'),
(277, '2026-11-10 00:11:52.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2044 is ready for user 22; pick up by 2026-11-12'),
(278, '2026-11-10 00:12:25.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 43: room 5 booked by user 22, no overlap'),
(279, '2026-11-10 00:13:29.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2045 is ready for user 14; pick up by 2026-11-12'),
(280, '2026-11-10 00:17:17.000', N'trg_loan_return', N'loan', N'Loan 2119: copy 40 returned, final fine $27'),
(281, '2026-11-10 00:17:24.000', N'payment_recorded', N'payments', N'Payment 34: fine 47 paid; receipt TXN-20261109-0034 issued.'),
(282, '2026-11-10 11:38:15.000', N'daily_job', N'fine', N'Daily job ran by itself: 0 late fine(s) went up, 0 hold(s) expired.'),
(283, '2026-11-11 00:04:38.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2046 is ready for user 14; pick up by 2026-11-13'),
(284, '2026-11-11 06:04:21.000', N'sp_update_overdue_fines', N'fine', N'Loan 2118: 21 days late, fine is now $8'),
(285, '2026-11-11 06:04:21.000', N'sp_update_overdue_fines', N'fine', N'Loan 2122: 1 days late, fine is now $5'),
(286, '2026-11-11 06:05:37.000', N'trg_loan_checkout', N'loan', N'Loan 2123: copy 81 checked out to user 14, due 2026-12-11'),
(287, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'waitlist', N'Hold 3 expired, not picked up in 3 days'),
(288, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'waitlist', N'Hold 5 expired, not picked up in 3 days'),
(289, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'waitlist', N'Hold 31 expired, not picked up in 3 days'),
(290, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'waitlist', N'Hold 36 expired, not picked up in 3 days'),
(291, '2026-11-11 06:08:42.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2048 is ready for user 14; pick up by 2026-11-14'),
(292, '2026-11-11 06:08:57.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2050 is ready for user 14; pick up by 2026-11-14'),
(293, '2026-11-11 06:42:20.000', N'trg_loan_checkout', N'loan', N'Loan 2124: copy 18 checked out to user 14, due 2026-12-11'),
(294, '2026-11-11 06:42:41.000', N'trg_loan_checkout', N'loan', N'Loan 2125: copy 19 checked out to user 14, due 2026-12-11'),
(295, '2026-11-11 08:17:26.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 44: room 5 booked by user 22, no overlap'),
(296, '2026-11-11 11:38:12.000', N'daily_job', N'fine', N'Daily job ran by itself: 0 late fine(s) went up, 0 hold(s) expired.'),
(297, '2026-11-12 01:27:34.000', N'trg_loan_checkout', N'loan', N'Loan 2126: copy 31 checked out to user 11, due 2026-12-01'),
(298, '2026-11-12 01:40:41.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2049 is ready for user 14; pick up by 2026-11-14'),
(299, '2026-11-12 05:59:09.000', N'trg_loan_checkout', N'loan', N'Loan 2127: copy 58 checked out to user 4, due 2026-12-01'),
(300, '2026-11-12 05:59:10.000', N'trg_hold_queue', N'waitlist', N'Copy 58 was returned and given to hold 2051, first in line'),
(301, '2026-11-12 05:59:11.000', N'trg_loan_return', N'loan', N'Loan 2127: copy 58 returned'),
(302, '2026-11-12 11:38:11.000', N'trg_hold_expired', N'waitlist', N'Hold 15 expired, not picked up in 3 days'),
(303, '2026-11-12 11:38:11.000', N'trg_hold_expired', N'waitlist', N'Hold 29 expired, not picked up in 3 days'),
(304, '2026-11-12 11:38:12.000', N'daily_job', N'fine', N'Daily job ran by itself: 0 late fine(s) went up, 2 hold(s) expired.'),
(305, '2026-11-13 11:38:14.000', N'trg_hold_expired', N'waitlist', N'Hold 2042 expired, not picked up in 3 days'),
(306, '2026-11-13 11:38:14.000', N'trg_hold_expired', N'waitlist', N'Hold 2043 expired, not picked up in 3 days'),
(307, '2026-11-13 11:38:14.000', N'daily_job', N'fine', N'Daily job ran by itself: 0 late fine(s) went up, 2 hold(s) expired.'),
(308, '2026-11-13 23:18:27.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 45: room 1 booked by user 22, no overlap'),
(309, '2026-11-13 23:18:59.000', N'trg_room_reservations_overlap', N'room_reservations', N'Reservation 46: room 1 booked by user 22, no overlap'),
(310, '2026-11-14 11:38:12.000', N'daily_job', N'fine', N'Daily job ran by itself: 0 late fine(s) went up, 0 hold(s) expired.'),
(311, '2026-11-15 03:36:18.000', N'sp_promote_next_hold', N'waitlist', N'Hold 2053 is ready for user 22; pick up by 2026-11-17');
SET IDENTITY_INSERT [dbo].[audit_log] OFF;
GO

SET IDENTITY_INSERT [dbo].[author] ON;
INSERT INTO [dbo].[author] ([author_id], [first_name], [middle_name], [last_name]) VALUES
(1, N'Ramez', NULL, N'Elmasri'),
(2, N'Shamkant', NULL, N'Navathe'),
(3, N'Abraham', NULL, N'Silberschatz'),
(4, N'Henry', NULL, N'Korth'),
(5, N'S.', NULL, N'Sudarshan'),
(6, N'Thomas', NULL, N'Cormen'),
(7, N'Charles', NULL, N'Leiserson'),
(8, N'Ronald', NULL, N'Rivest'),
(9, N'Clifford', NULL, N'Stein'),
(10, N'Robert', NULL, N'Martin'),
(11, N'Andrew', NULL, N'Hunt'),
(12, N'David', NULL, N'Thomas'),
(13, N'Martin', NULL, N'Kleppmann'),
(14, N'Harper', NULL, N'Lee'),
(15, N'George', NULL, N'Orwell'),
(16, N'F. Scott', NULL, N'Fitzgerald'),
(17, N'Yuval Noah', NULL, N'Harari'),
(20, N'John', NULL, N'Kelly'),
(23, N'Jane', N'v', N'Austin'),
(24, N'Taylor', NULL, N'Swift'),
(25, N'Ray', NULL, N'Bradbury'),
(26, N'J. R. R.', NULL, N'Tolkien'),
(27, N'J. K.', NULL, N'Rowling'),
(28, N'Paulo', NULL, N'Coelho'),
(29, N'Aldous', NULL, N'Huxley'),
(30, N'William', NULL, N'Golding'),
(31, N'Dan', NULL, N'Brown'),
(32, N'demi', NULL, N'levato');
SET IDENTITY_INSERT [dbo].[author] OFF;
GO

SET IDENTITY_INSERT [dbo].[book] ON;
INSERT INTO [dbo].[book] ([book_id], [title], [publisher], [publish_year], [isbn], [is_active]) VALUES
(1, N'Fundamentals of Database Systems', N'Pearson', NULL, N'9780133970777', 1),
(2, N'Database System Concepts', N'McGraw-Hill', NULL, N'9780078022159', 1),
(3, N'Introduction to Algorithms', N'MIT Press', NULL, N'9780262033848', 1),
(4, N'Clean Code', N'Prentice Hall', NULL, N'9780132350884', 1),
(5, N'The Pragmatic Programmer', N'Addison-Wesley', NULL, N'9780201616224', 1),
(6, N'Designing Data-Intensive Applications', N'O''Reilly Media', NULL, N'9781449373320', 1),
(7, N'To Kill a Mockingbird', N'Harper Perennial', NULL, N'9780061120084', 1),
(8, N'1984', N'Signet Classics', NULL, N'9780451524935', 1),
(9, N'The Great Gatsby', N'Scribner', NULL, N'9780743273565', 1),
(10, N'Sapiens: A Brief History of Humankind', N'Harper', NULL, N'9780062316097', 1),
(20, N'Tender Is The Night', N'Scribner', NULL, N'9780743247412', 1),
(21, N'Animal Farm', N'Signet Classics', NULL, N'9780451526342', 1),
(22, N'Homage to Catalonia', N'Harcourt, Inc.', NULL, N'9780156421171', 1),
(23, N'This Side of Paradise', N'Scribner', NULL, N'9780684843780', 1),
(24, N'White Nights', N'', NULL, N'8765432109', 0),
(25, N'The Catcher in the Rye', N'Little, Brown and Company', NULL, N'9780316769488', 1),
(27, N'Brave New World', N'Harper Perennial', NULL, N'9780060850524', 1),
(28, N'Lord of the Files', N'Penguin Books', NULL, N'9780140283334', 0),
(29, N'The Hobbit', N'HarperCollins', NULL, N'9780547928227', 1),
(30, N'Harry Potter and the Sorcerer''s Stone', N'Scholastic', NULL, N'9780590353427', 1),
(31, N'The Alchemist', N'HarperOne', NULL, N'9780062315007', 0),
(32, N'Fahrenheit 451', N'Simon & Schuster', NULL, N'9781451673319', 1),
(33, N'Pride and Prejudice', N'Whitehall', NULL, N'9780141439518', 1),
(34, N'The Da Vinci Code', N'Vintage', NULL, N'9780307277671', 1),
(35, N'My Biography', N'', NULL, N'9234567890122', 1),
(36, N'emma', N'', NULL, N'1234561234567', 1);
SET IDENTITY_INSERT [dbo].[book] OFF;
GO

INSERT INTO [dbo].[book_author] ([book_id], [author_id]) VALUES
(1, 1),
(1, 2),
(2, 3),
(2, 4),
(2, 5),
(3, 6),
(3, 7),
(3, 8),
(3, 9),
(4, 10),
(5, 11),
(5, 12),
(6, 13),
(7, 14),
(8, 15),
(9, 16),
(10, 17),
(20, 16),
(21, 15),
(22, 15),
(23, 16),
(24, 20),
(25, 26),
(27, 29),
(28, 30),
(29, 26),
(30, 27),
(31, 28),
(32, 25),
(33, 23),
(34, 4),
(34, 31),
(35, 24),
(36, 32);
GO

INSERT INTO [dbo].[borrow_policy] ([is_faculty], [max_items], [loan_days]) VALUES
(0, 3, 20),
(1, 6, 30);
GO

SET IDENTITY_INSERT [dbo].[copies] ON;
INSERT INTO [dbo].[copies] ([copy_id], [book_id], [is_available], [media_id], [is_active]) VALUES
(1, 1, 1, NULL, 1),
(2, 1, 1, NULL, 1),
(3, 1, 1, NULL, 1),
(4, 2, 1, NULL, 1),
(5, 2, 1, NULL, 1),
(6, 3, 0, NULL, 1),
(7, 3, 1, NULL, 1),
(8, 3, 1, NULL, 1),
(9, 4, 1, NULL, 1),
(10, 4, 1, NULL, 1),
(11, 5, 1, NULL, 1),
(12, 5, 1, NULL, 1),
(13, 6, 1, NULL, 1),
(14, 6, 1, NULL, 1),
(15, 7, 0, NULL, 1),
(16, 7, 1, NULL, 1),
(17, 8, 0, NULL, 1),
(18, 8, 0, NULL, 1),
(19, 9, 0, NULL, 1),
(20, 9, 1, NULL, 0),
(21, 10, 1, NULL, 1),
(22, 10, 1, NULL, 1),
(23, NULL, 1, 1, 1),
(24, NULL, 1, 1, 1),
(25, NULL, 1, 2, 1),
(26, NULL, 1, 3, 1),
(27, NULL, 1, 4, 1),
(28, 20, 0, NULL, 1),
(29, 21, 1, NULL, 1),
(30, 20, 1, NULL, 1),
(31, 21, 0, NULL, 1),
(32, 21, 1, NULL, 1),
(33, 21, 1, NULL, 1),
(34, 21, 1, NULL, 1),
(35, 21, 1, NULL, 1),
(36, 22, 1, NULL, 1),
(37, 22, 1, NULL, 1),
(38, 22, 1, NULL, 1),
(39, 22, 1, NULL, 1),
(40, 22, 1, NULL, 1),
(41, 23, 1, NULL, 1),
(42, 23, 1, NULL, 1),
(43, 23, 1, NULL, 1),
(44, NULL, 1, 5, 0),
(45, NULL, 1, 5, 0),
(46, NULL, 1, 6, 0),
(47, 24, 1, NULL, 0),
(48, 25, 1, NULL, 1),
(49, 25, 1, NULL, 1),
(50, 25, 1, NULL, 1),
(51, 25, 1, NULL, 1),
(52, 25, 1, NULL, 1),
(53, 25, 1, NULL, 1),
(54, 25, 1, NULL, 1),
(55, 25, 1, NULL, 1),
(56, 27, 0, NULL, 1),
(57, 28, 1, NULL, 1),
(58, 29, 1, NULL, 1),
(59, 30, 0, NULL, 1),
(60, 31, 1, NULL, 1),
(61, 32, 1, NULL, 1),
(62, 32, 1, NULL, 1),
(63, 33, 0, NULL, 1),
(64, 34, 1, NULL, 1),
(65, 34, 1, NULL, 1),
(66, 35, 1, NULL, 1),
(67, 2, 1, NULL, 1),
(68, 2, 1, NULL, 1),
(69, 2, 1, NULL, 1),
(70, 2, 1, NULL, 1),
(71, 2, 1, NULL, 1),
(72, 8, 1, NULL, 1),
(73, 8, 1, NULL, 1),
(74, 8, 1, NULL, 1),
(75, 32, 1, NULL, 1),
(76, 32, 1, NULL, 1),
(77, 32, 1, NULL, 1),
(78, 8, 1, NULL, 1),
(79, NULL, 1, 1, 1),
(80, NULL, 1, 1, 1),
(81, 36, 0, NULL, 1),
(82, 36, 1, NULL, 1),
(83, 36, 1, NULL, 1),
(84, 36, 1, NULL, 1),
(85, 36, 1, NULL, 1),
(86, 36, 1, NULL, 1);
SET IDENTITY_INSERT [dbo].[copies] OFF;
GO

SET IDENTITY_INSERT [dbo].[fine] ON;
INSERT INTO [dbo].[fine] ([fine_id], [loan_id], [amount]) VALUES
(1, 4, 6),
(2, 7, 6),
(3, 9, 8),
(4, 12, 7),
(5, 19, 7),
(6, 22, 6),
(7, 24, 6),
(8, 29, 5),
(9, 46, 6),
(10, 45, 5),
(11, 35, 9),
(12, 43, 6),
(13, 81, 9),
(14, 83, 20),
(31, 33, 7),
(32, 34, 7),
(33, 36, 9),
(34, 37, 6),
(35, 38, 6),
(36, 39, 9),
(37, 40, 6),
(38, 41, 6),
(39, 42, 7),
(40, 44, 6),
(41, 2088, 5),
(42, 2089, 5),
(43, 2090, 5),
(44, 2112, 6),
(45, 2116, 33),
(46, 2118, 8),
(47, 2119, 27),
(48, 2120, 57),
(49, 2121, 14),
(50, 2122, 5);
SET IDENTITY_INSERT [dbo].[fine] OFF;
GO

SET IDENTITY_INSERT [dbo].[loan] ON;
INSERT INTO [dbo].[loan] ([loan_id], [user_id], [copy_id], [borrow_date], [due_date], [return_date]) VALUES
(1, 1, 1, '2026-06-02', '2026-06-22', '2026-06-15'),
(2, 2, 6, '2026-06-03', '2026-06-23', '2026-06-20'),
(3, 8, 13, '2026-06-04', '2026-06-29', '2026-06-25'),
(4, 1, 15, '2026-06-10', '2026-06-30', '2026-07-08'),
(5, 3, 17, '2026-06-22', '2026-07-12', '2026-07-05'),
(6, 2, 23, '2026-06-24', '2026-07-14', '2026-07-01'),
(7, 8, 4, '2026-06-26', '2026-07-21', '2026-07-30'),
(8, 4, 9, '2026-07-09', '2026-07-29', '2026-07-20'),
(9, 3, 1, '2026-07-10', '2026-07-30', '2026-08-20'),
(10, 9, 6, '2026-07-16', '2026-08-10', '2026-08-05'),
(11, 1, 11, '2026-07-20', '2026-08-09', '2026-08-03'),
(12, 4, 19, '2026-07-22', '2026-08-11', '2026-08-25'),
(13, 2, 21, '2026-07-28', '2026-08-17', '2026-08-10'),
(14, 9, 25, '2026-07-30', '2026-08-24', '2026-08-12'),
(15, 8, 7, '2026-08-03', '2026-08-28', '2026-08-21'),
(16, 1, 13, '2026-08-10', '2026-08-30', '2026-08-28'),
(17, 3, 9, '2026-08-12', '2026-09-01', '2026-08-30'),
(18, 5, 2, '2026-08-25', '2026-09-14', '2026-09-10'),
(19, 5, 15, '2026-08-25', '2026-09-14', '2026-09-30'),
(20, 10, 4, '2026-08-21', '2026-09-15', '2026-09-12'),
(21, 4, 17, '2026-08-26', '2026-09-15', '2026-09-08'),
(22, 2, 26, '2026-08-27', '2026-09-16', '2026-09-25'),
(23, 6, 6, '2026-09-02', '2026-09-22', '2026-09-18'),
(24, 6, 11, '2026-09-02', '2026-09-22', '2026-09-29'),
(25, 1, 21, '2026-09-03', '2026-09-23', '2026-09-20'),
(26, 9, 13, '2026-09-08', '2026-10-03', '2026-09-28'),
(27, 3, 19, '2026-09-09', '2026-09-29', '2026-09-25'),
(28, 7, 9, '2026-09-15', '2026-10-05', '2026-09-28'),
(29, 10, 23, '2026-09-10', '2026-10-05', '2026-10-09'),
(30, 5, 7, '2026-09-14', '2026-10-04', '2026-10-01'),
(31, 4, 1, '2026-09-16', '2026-10-06', '2026-10-02'),
(32, 8, 17, '2026-09-17', '2026-10-12', '2026-10-08'),
(33, 1, 3, '2026-10-01', '2026-10-21', '2026-11-08'),
(34, 1, 14, '2026-10-05', '2026-10-25', '2026-11-08'),
(35, 2, 8, '2026-09-15', '2026-10-05', '2026-11-06'),
(36, 3, 5, '2026-09-18', '2026-10-08', '2026-11-08'),
(37, 4, 10, '2026-10-06', '2026-10-26', '2026-11-08'),
(38, 5, 12, '2026-10-07', '2026-10-27', '2026-11-09'),
(39, 6, 16, '2026-09-21', '2026-10-11', '2026-11-08'),
(40, 6, 18, '2026-10-08', '2026-10-28', '2026-11-08'),
(41, 6, 22, '2026-10-09', '2026-10-29', '2026-11-08'),
(42, 8, 24, '2026-09-28', '2026-10-23', '2026-11-08'),
(43, 8, 2, '2026-10-02', '2026-10-27', '2026-11-07'),
(44, 9, 27, '2026-10-05', '2026-10-30', '2026-11-08'),
(45, 10, 26, '2026-10-10', '2026-11-04', '2026-11-07'),
(46, 9, 13, '2026-10-06', '2026-10-31', '2026-11-07'),
(51, 11, 17, '2026-11-07', '2026-11-27', NULL),
(52, 2, 9, '2026-11-07', '2026-11-27', '2026-11-08'),
(53, 18, 48, '2026-11-06', '2026-11-26', '2026-11-06'),
(54, 18, 49, '2026-11-06', '2026-11-26', '2026-11-06'),
(55, 18, 50, '2026-11-06', '2026-11-26', '2026-11-06'),
(57, 18, 48, '2026-11-06', '2026-11-26', '2026-11-06'),
(59, 19, 48, '2026-11-06', '2026-12-06', '2026-11-06'),
(60, 19, 49, '2026-11-06', '2026-12-06', '2026-11-06'),
(61, 19, 50, '2026-11-06', '2026-12-06', '2026-11-06'),
(62, 19, 51, '2026-11-06', '2026-12-06', '2026-11-06'),
(63, 19, 52, '2026-11-06', '2026-12-06', '2026-11-06'),
(64, 19, 53, '2026-11-06', '2026-12-06', '2026-11-06'),
(66, 18, 54, '2026-11-06', '2026-11-26', '2026-11-06'),
(67, 18, 55, '2026-11-06', '2026-11-26', '2026-11-06'),
(69, 18, 56, '2026-11-06', '2026-11-26', '2026-11-06'),
(70, 18, 58, '2026-11-06', '2026-11-26', '2026-11-06'),
(72, 20, 61, '2026-11-06', '2026-11-26', '2026-11-06'),
(73, 20, 36, '2026-11-06', '2026-11-26', '2026-11-06'),
(74, 20, 28, '2026-11-06', '2026-11-26', '2026-11-06'),
(76, 21, 37, '2026-11-06', '2026-12-06', '2026-11-06'),
(77, 8, 15, '2026-11-07', '2026-12-07', NULL),
(78, 22, 63, '2026-11-07', '2026-11-27', NULL),
(79, 14, 21, '2026-11-07', '2026-12-07', '2026-11-08'),
(80, 14, 6, '2026-11-07', '2026-12-07', NULL),
(81, 14, 62, '2026-10-01', '2026-10-07', '2026-11-07'),
(83, 14, 23, '2026-07-05', '2026-07-20', '2026-11-07'),
(84, 11, 11, '2026-11-07', '2026-11-27', '2026-11-09'),
(85, 14, 64, '2026-11-07', '2026-12-07', '2026-11-07'),
(86, 14, 65, '2026-11-07', '2026-12-07', '2026-11-07'),
(87, 14, 65, '2026-11-07', '2026-12-07', '2026-11-07'),
(2088, 22, 2, '2026-10-30', '2026-11-03', '2026-11-08'),
(2089, 22, 4, '2026-10-30', '2026-11-03', '2026-11-08'),
(2090, 11, 7, '2026-10-30', '2026-11-03', '2026-11-08'),
(2107, 2, 66, '2026-11-08', '2026-11-28', '2026-11-08'),
(2111, 9, 66, '2026-11-08', '2026-12-08', '2026-11-08'),
(2112, 13, 68, '2026-10-01', '2026-11-01', '2026-11-08'),
(2113, 22, 36, '2026-11-08', '2026-11-28', '2026-11-08'),
(2114, 11, 19, '2026-11-08', '2026-11-28', '2026-11-08'),
(2115, 22, 73, '2026-11-08', '2026-11-28', '2026-11-09'),
(2116, 8, 48, '2026-04-05', '2026-04-25', '2026-11-08'),
(2117, 22, 12, '2026-10-22', '2026-11-10', '2026-11-09'),
(2118, 22, 28, '2026-10-01', '2026-10-21', NULL),
(2119, 14, 40, '2026-05-07', '2026-06-07', '2026-11-09'),
(2120, 14, 66, '2025-10-09', '2025-11-09', '2026-11-09'),
(2121, 10, 60, '2026-08-15', '2026-09-05', '2026-11-09'),
(2122, 22, 59, '2026-10-20', '2026-11-10', NULL),
(2123, 14, 81, '2026-11-11', '2026-12-11', NULL),
(2124, 14, 18, '2026-11-11', '2026-12-11', NULL),
(2125, 14, 19, '2026-11-11', '2026-12-11', NULL),
(2126, 11, 31, '2026-11-11', '2026-12-01', NULL),
(2127, 4, 58, '2026-11-11', '2026-12-01', '2026-11-11');
SET IDENTITY_INSERT [dbo].[loan] OFF;
GO

SET IDENTITY_INSERT [dbo].[media] ON;
INSERT INTO [dbo].[media] ([media_id], [title], [is_active], [media_type]) VALUES
(1, N'Cosmos: A Spacetime Odyssey', 1, N'DVD'),
(2, N'Planet Earth II', 1, N'DVD'),
(3, N'The Feynman Lectures on Physics (Audio CD)', 1, N'Other'),
(4, N'Learn Spanish: Level 1 (Audio CD)', 1, N'Other'),
(5, N'test2', 0, N'DVD'),
(6, N'haha', 0, N'Audiobook');
SET IDENTITY_INSERT [dbo].[media] OFF;
GO

SET IDENTITY_INSERT [dbo].[notification] ON;
INSERT INTO [dbo].[notification] ([notification_id], [user_id], [created_at], [source], [message], [is_read]) VALUES
(2, 10, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-10-15 11:00.', 0),
(3, 9, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-10-14 09:00.', 0),
(4, 8, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-09-22 09:00.', 0),
(5, 6, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-10-07 13:00.', 0),
(6, 5, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-10-06 10:00.', 0),
(7, 4, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-09-29 15:00.', 0),
(8, 3, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-10-16 13:00.', 0),
(9, 3, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-09-15 14:00.', 0),
(10, 2, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-10-14 14:00.', 0),
(11, 2, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-09-08 12:00.', 0),
(12, 1, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-10-13 10:00.', 0),
(13, 1, '2026-11-03 22:26:04.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-09-08 10:00.', 0),
(14, 11, '2026-11-03 23:27:17.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-04 10:00.', 1),
(15, 12, '2026-11-03 23:32:56.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-11-05 14:00.', 1),
(16, 12, '2026-11-03 23:33:16.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-11-04 10:00.', 1),
(17, 4, '2026-11-03 23:42:51.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-11-17 10:00.', 0),
(18, 3, '2026-11-03 23:43:42.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-14 09:00.', 0),
(19, 4, '2026-11-03 23:59:50.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-11-17 10:00.', 0),
(20, 3, '2026-11-03 23:59:58.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-14 09:00.', 0),
(21, 3, '2026-11-04 00:00:09.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-14 09:00.', 0),
(22, 12, '2026-11-04 00:03:37.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-11-05 14:00.', 1),
(23, 11, '2026-11-04 23:34:30.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-05 10:00.', 1),
(24, 11, '2026-11-04 23:34:37.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-05 10:00 was cancelled.', 1),
(25, 11, '2026-11-05 00:51:37.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-05 10:00.', 1),
(26, 11, '2026-11-05 00:53:37.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-11-05 10:00.', 1),
(27, 11, '2026-11-05 02:05:17.000', N'trg_room_reservations_overlap', N'Your booking for room 201 on 2026-11-05 10:00 was cancelled.', 1),
(28, 11, '2026-11-05 02:05:18.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-05 10:00 was cancelled.', 1),
(29, 11, '2026-11-05 02:05:38.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-11-05 10:00.', 1),
(30, 11, '2026-11-05 02:18:22.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-11-12 10:00.', 1),
(31, 5, '2026-11-05 02:18:58.000', N'trg_room_reservations_overlap', N'Room 201 is booked for you on 2026-11-13 10:00.', 0),
(32, 14, '2026-11-05 03:10:12.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-05 10:00.', 1),
(36, 9, '2026-11-07 03:27:55.000', N'trg_loan_return', N'You returned "Designing Data-Intensive Applications". It was late, so a fine of $6.00 was added.', 0),
(37, 4, '2026-11-07 03:27:55.000', N'sp_promote_next_hold', N'Your hold on "Designing Data-Intensive Applications" is ready. Pick it up at the desk by 11-10-2026.', 0),
(38, 11, '2026-11-07 03:29:43.000', N'trg_loan_checkout', N'You borrowed "1984". It is due 11/27/2026.', 1),
(39, 10, '2026-11-07 03:29:52.000', N'trg_loan_return', N'You returned "The Feynman Lectures on Physics (Audio CD)". It was late, so a fine of $5.00 was added.', 0),
(40, 2, '2026-11-07 03:29:52.000', N'sp_promote_next_hold', N'Your hold on "The Feynman Lectures on Physics (Audio CD)" is ready. Pick it up at the desk by 11-10-2026.', 0),
(41, 2, '2026-11-07 03:31:56.000', N'trg_loan_checkout', N'You borrowed "Clean Code". It is due 11/27/2026.', 0),
(42, 11, '2026-11-07 03:35:08.000', N'sp_promote_next_hold', N'Your hold on "The Great Gatsby" is ready. Pick it up at the desk by 11-10-2026.', 1),
(43, 11, '2026-11-07 03:35:13.000', N'sp_promote_next_hold', N'Your hold on "Fundamentals of Database Systems" is ready. Pick it up at the desk by 11-10-2026.', 1),
(45, 18, '2026-11-07 04:01:15.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 11/26/2026.', 0),
(46, 18, '2026-11-07 04:01:15.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 11/26/2026.', 0),
(47, 18, '2026-11-07 04:01:16.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 11/26/2026.', 0),
(48, 18, '2026-11-07 04:01:17.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(49, 18, '2026-11-07 04:01:28.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 11/26/2026.', 0),
(50, 18, '2026-11-07 04:01:55.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(51, 18, '2026-11-07 04:01:55.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(52, 18, '2026-11-07 04:01:55.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(53, 19, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 12/06/2026.', 0),
(54, 19, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 12/06/2026.', 0),
(55, 19, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 12/06/2026.', 0),
(56, 19, '2026-11-07 04:01:56.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 12/06/2026.', 0),
(57, 19, '2026-11-07 04:01:57.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 12/06/2026.', 0),
(58, 19, '2026-11-07 04:01:57.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 12/06/2026.', 0),
(59, 18, '2026-11-07 04:01:59.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 11/26/2026.', 0),
(60, 18, '2026-11-07 04:01:59.000', N'trg_loan_checkout', N'You borrowed "TESTB Book". It is due 11/26/2026.', 0),
(61, 18, '2026-11-07 04:02:43.000', N'sp_promote_next_hold', N'Your hold on "TESTB Hold A" is ready. Pick it up at the desk by 11-09-2026.', 0),
(62, 18, '2026-11-07 04:02:44.000', N'sp_promote_next_hold', N'Your hold on "TESTB Hold B" is ready. Pick it up at the desk by 11-09-2026.', 0),
(63, 18, '2026-11-07 04:02:46.000', N'sp_promote_next_hold', N'Your hold on "TESTB Hold C" is ready. Pick it up at the desk by 11-09-2026.', 0),
(64, 18, '2026-11-07 04:02:46.000', N'sp_promote_next_hold', N'Your hold on "TESTB Hold B" is ready. Pick it up at the desk by 11-09-2026.', 0),
(65, 18, '2026-11-07 04:03:34.000', N'trg_loan_checkout', N'You borrowed "TESTB isbn12". It is due 11/26/2026.', 0),
(66, 18, '2026-11-07 04:03:35.000', N'trg_loan_return', N'You returned "TESTB isbn12".', 0),
(67, 19, '2026-11-07 04:03:35.000', N'sp_promote_next_hold', N'Your hold on "TESTB isbn12" is ready. Pick it up at the desk by 11-09-2026.', 0),
(68, 18, '2026-11-07 04:03:36.000', N'trg_loan_checkout', N'You borrowed "TESTB Hold A". It is due 11/26/2026.', 0),
(69, 19, '2026-11-07 04:03:36.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(70, 18, '2026-11-07 04:03:36.000', N'sp_promote_next_hold', N'Your hold on "TESTB Book" is ready. Pick it up at the desk by 11-09-2026.', 0),
(71, 18, '2026-11-07 04:04:09.000', N'trg_room_reservations_overlap', N'Room TESTB Room is booked for you on 2026-11-07 14:00.', 0),
(72, 19, '2026-11-07 04:04:11.000', N'trg_room_reservations_overlap', N'Room TESTB Room is booked for you on 2026-11-07 15:00.', 0),
(73, 18, '2026-11-07 04:04:13.000', N'trg_room_reservations_overlap', N'Your booking for room TESTB Room on 2026-11-07 14:00 was cancelled.', 0),
(74, 18, '2026-11-07 04:04:14.000', N'trg_room_reservations_overlap', N'Room TESTB Room is booked for you on 2026-11-07 14:00.', 0),
(75, 19, '2026-11-07 04:04:43.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(76, 19, '2026-11-07 04:04:43.000', N'sp_promote_next_hold', N'Your hold on "TESTB Book" is ready. Pick it up at the desk by 11-09-2026.', 0),
(77, 19, '2026-11-07 04:04:43.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(78, 19, '2026-11-07 04:04:43.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(79, 19, '2026-11-07 04:04:44.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(80, 19, '2026-11-07 04:04:44.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(81, 19, '2026-11-07 04:04:47.000', N'sp_promote_next_hold', N'Your hold on "TESTB Hold C" is ready. Pick it up at the desk by 11-09-2026.', 0),
(82, 18, '2026-11-07 04:04:48.000', N'trg_room_reservations_overlap', N'Room TESTB Room is booked for you on 2026-11-06 23:15.', 0),
(83, 18, '2026-11-07 04:05:57.000', N'trg_loan_return', N'You returned "TESTB Hold A".', 0),
(84, 18, '2026-11-07 04:05:57.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(85, 18, '2026-11-07 04:05:57.000', N'trg_room_reservations_overlap', N'Your booking for room TESTB Room on 2026-11-07 14:00 was cancelled.', 0),
(86, 18, '2026-11-07 04:05:57.000', N'trg_room_reservations_overlap', N'Your booking for room TESTB Room on 2026-11-06 23:15 was cancelled.', 0),
(87, 18, '2026-11-07 04:05:57.000', N'trg_loan_return', N'You returned "TESTB Book".', 0),
(88, 19, '2026-11-07 04:05:58.000', N'trg_room_reservations_overlap', N'Your booking for room TESTB Room on 2026-11-07 15:00 was cancelled.', 0),
(89, 18, '2026-11-07 04:05:58.000', N'trg_room_reservations_overlap', N'Room TESTB Room is booked for you on 2026-11-07 10:00.', 0),
(90, 18, '2026-11-07 04:05:59.000', N'trg_room_reservations_overlap', N'Your booking for room TESTB Room on 2026-11-07 10:00 was cancelled.', 0),
(91, 20, '2026-11-07 04:09:48.000', N'trg_loan_checkout', N'You borrowed "TESTA Book Edited". It is due 11/26/2026.', 1),
(92, 20, '2026-11-07 04:10:12.000', N'trg_loan_checkout', N'You borrowed "Homage to Catalonia". It is due 11/26/2026.', 1),
(93, 20, '2026-11-07 04:10:14.000', N'trg_loan_checkout', N'You borrowed "Tender Is The Night". It is due 11/26/2026.', 1),
(94, 21, '2026-11-07 04:10:31.000', N'trg_loan_checkout', N'You borrowed "Homage to Catalonia". It is due 12/06/2026.', 0),
(95, 20, '2026-11-07 04:14:42.000', N'sp_promote_next_hold', N'Your hold on "Homage to Catalonia" is ready. Pick it up at the desk by 11-09-2026.', 0),
(96, 20, '2026-11-07 04:16:55.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-06 23:00.', 0),
(97, 20, '2026-11-07 04:17:05.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-07 14:00.', 0),
(98, 21, '2026-11-07 04:18:46.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-07 15:00.', 0),
(99, 21, '2026-11-07 04:18:56.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-07 15:00 was cancelled.', 0),
(100, 20, '2026-11-07 04:19:21.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-06 23:00 was cancelled.', 0),
(101, 20, '2026-11-07 04:19:29.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-07 14:00 was cancelled.', 0),
(102, 20, '2026-11-07 04:19:49.000', N'trg_loan_return', N'You returned "TESTA Book Edited".', 0),
(103, 20, '2026-11-07 04:20:02.000', N'trg_loan_return', N'You returned "Homage to Catalonia".', 0),
(104, 20, '2026-11-07 04:20:05.000', N'trg_loan_return', N'You returned "Tender Is The Night".', 0),
(105, 21, '2026-11-07 04:20:09.000', N'trg_loan_return', N'You returned "Homage to Catalonia".', 0),
(106, 2, '2026-11-07 04:20:22.000', N'trg_loan_return', N'You returned "Introduction to Algorithms". It was late, so a fine of $9.00 was added.', 0),
(107, 11, '2026-11-07 17:11:48.000', N'trg_room_reservations_overlap', N'Your booking for room 201 on 2026-11-12 10:00 was cancelled.', 1),
(108, 11, '2026-11-07 17:11:55.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-08 10:00.', 1),
(109, 8, '2026-11-07 17:44:30.000', N'trg_loan_checkout', N'You borrowed "To Kill a Mockingbird". It is due 12/07/2026.', 0),
(110, 22, '2026-11-07 17:44:57.000', N'trg_loan_checkout', N'You borrowed "pride and prdijice". It is due 11/27/2026.', 1),
(111, 11, '2026-11-07 17:46:28.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-08 10:00 was cancelled.', 1),
(112, 5, '2026-11-07 17:46:31.000', N'trg_room_reservations_overlap', N'Your booking for room 201 on 2026-11-13 10:00 was cancelled.', 0),
(113, 8, '2026-11-07 17:46:37.000', N'trg_loan_return', N'You returned "Fundamentals of Database Systems". It was late, so a fine of $6.00 was added.', 0),
(114, 11, '2026-11-07 17:48:02.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-08 12:00.', 1),
(115, 22, '2026-11-07 17:48:45.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-08 10:00.', 1),
(116, 11, '2026-11-07 17:48:54.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-08 12:00 was cancelled.', 1),
(117, 22, '2026-11-07 17:48:57.000', N'trg_room_reservations_overlap', N'Your booking for room 101 on 2026-11-08 10:00 was cancelled.', 1),
(118, 11, '2026-11-07 17:49:51.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-08 10:00.', 1),
(119, 14, '2026-11-07 17:57:23.000', N'sp_promote_next_hold', N'Your hold on "Database System Concepts" is ready. Pick it up at the desk by 11-10-2026.', 1),
(120, 14, '2026-11-07 17:57:40.000', N'sp_promote_next_hold', N'Your hold on "Fundamentals of Database Systems" is ready. Pick it up at the desk by 11-10-2026.', 1),
(121, 14, '2026-11-07 18:09:54.000', N'sp_promote_next_hold', N'Your hold on "Homage to Catalonia" is ready. Pick it up at the desk by 11-10-2026.', 1),
(122, 14, '2026-11-07 18:09:57.000', N'sp_promote_next_hold', N'Your hold on "Sapiens: A Brief History of Humankind" is ready. Pick it up at the desk by 11-10-2026.', 1),
(123, 14, '2026-11-07 18:16:03.000', N'trg_loan_checkout', N'You borrowed "Sapiens: A Brief History of Humankind". It is due 12/07/2026.', 1),
(124, 14, '2026-11-07 18:16:45.000', N'trg_loan_checkout', N'You borrowed "Introduction to Algorithms". It is due 12/07/2026.', 1),
(125, 14, '2026-11-07 18:28:37.000', N'trg_loan_checkout', N'You borrowed "TESTA Book Edited". It is due 10/07/2026.', 1),
(126, 14, '2026-11-07 18:32:36.000', N'trg_loan_return', N'You returned "TESTA Book Edited". It was late, so a fine of $9.00 was added.', 1),
(127, 14, '2026-11-07 18:37:07.000', N'sp_promote_next_hold', N'Your hold on "Cosmos: A Spacetime Odyssey" is ready. Pick it up at the desk by 11-10-2026.', 1),
(128, 14, '2026-11-07 18:37:37.000', N'trg_loan_checkout', N'You borrowed "Cosmos: A Spacetime Odyssey". It is due 07/20/2026.', 1),
(129, 14, '2026-11-07 18:38:36.000', N'trg_loan_return', N'You returned "Cosmos: A Spacetime Odyssey". It was late, so a fine of $20.00 was added.', 1),
(130, 11, '2026-11-07 19:49:48.000', N'trg_loan_checkout', N'You borrowed "The Pragmatic Programmer". It is due 11/27/2026.', 1),
(131, 12, '2026-11-07 19:52:51.000', N'trg_room_reservations_overlap', N'Room test del is booked for you on 2026-11-08 10:00.', 0),
(132, 12, '2026-11-07 19:53:43.000', N'trg_room_reservations_overlap', N'Your booking for room test del on 2026-11-08 10:00 was cancelled.', 0),
(133, 14, '2026-11-07 19:54:53.000', N'trg_loan_checkout', N'You borrowed "testDelete". It is due 12/07/2026.', 1),
(134, 14, '2026-11-07 19:54:56.000', N'trg_loan_checkout', N'You borrowed "testDelete". It is due 12/07/2026.', 1),
(135, 14, '2026-11-07 19:56:38.000', N'trg_loan_return', N'You returned "testDelete".', 1),
(136, 14, '2026-11-07 19:56:57.000', N'trg_loan_checkout', N'You borrowed "testDelete". It is due 12/07/2026.', 1),
(137, 14, '2026-11-07 19:58:14.000', N'trg_loan_return', N'You returned "testDelete".', 1),
(138, 14, '2026-11-07 19:58:16.000', N'trg_loan_return', N'You returned "testDelete".', 1),
(166, 1, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Fundamentals of Database Systems" is now $7. It goes up $1 each week until you return it.', 0),
(167, 1, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Designing Data-Intensive Applications" is now $6. It goes up $1 each week until you return it.', 0),
(168, 3, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Database System Concepts" is now $9. It goes up $1 each week until you return it.', 0),
(169, 4, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Clean Code" is now $6. It goes up $1 each week until you return it.', 0),
(170, 5, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "The Pragmatic Programmer" is now $6. It goes up $1 each week until you return it.', 0),
(171, 6, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "To Kill a Mockingbird" is now $8. It goes up $1 each week until you return it.', 0),
(172, 6, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "1984" is now $6. It goes up $1 each week until you return it.', 0),
(173, 6, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Sapiens: A Brief History of Humankind" is now $6. It goes up $1 each week until you return it.', 0),
(174, 8, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Cosmos: A Spacetime Odyssey" is now $7. It goes up $1 each week until you return it.', 0),
(175, 9, '2026-11-07 21:04:41.000', N'sp_update_overdue_fines', N'Your fine on "Learn Spanish: Level 1 (Audio CD)" is now $6. It goes up $1 each week until you return it.', 0),
(176, 1, '2026-11-08 19:30:32.000', N'sp_update_overdue_fines', N'Your fine on "Designing Data-Intensive Applications" is now $7. It goes up $1 each week until you return it.', 0),
(177, 6, '2026-11-08 19:30:32.000', N'sp_update_overdue_fines', N'Your fine on "To Kill a Mockingbird" is now $9. It goes up $1 each week until you return it.', 0),
(178, 22, '2026-11-08 19:50:35.000', N'trg_loan_checkout', N'You borrowed "Fundamentals of Database Systems". It is due 11/03/2026.', 1),
(179, 22, '2026-11-08 19:50:42.000', N'sp_update_overdue_fines', N'Your fine on "Fundamentals of Database Systems" is now $5. It goes up $1 each week until you return it.', 1),
(180, 22, '2026-11-08 19:55:18.000', N'trg_loan_checkout', N'You borrowed "Database System Concepts". It is due 11/03/2026.', 1),
(181, 22, '2026-11-08 19:55:23.000', N'sp_update_overdue_fines', N'Your fine on "Database System Concepts" is now $5. It goes up $1 each week until you return it.', 1),
(182, 11, '2026-11-08 20:00:16.000', N'trg_loan_checkout', N'You borrowed "Introduction to Algorithms". It is due 11/03/2026.', 0),
(183, 11, '2026-11-08 20:00:19.000', N'sp_update_overdue_fines', N'Your fine on "Introduction to Algorithms" is now $5. It goes up $1 each week until you return it.', 0),
(184, 22, '2026-11-08 22:01:05.000', N'sp_promote_next_hold', N'Your hold on "Homage to Catalonia" is ready. Pick it up at the desk by 11-11-2026.', 1),
(185, 22, '2026-11-08 22:01:30.000', N'trg_room_reservations_overlap', N'Room 103 is booked for you on 2026-11-09 10:00.', 1),
(186, 22, '2026-11-08 22:01:37.000', N'trg_room_reservations_overlap', N'Your booking for room 103 on 2026-11-09 10:00 was cancelled.', 1),
(187, 14, '2026-11-08 22:02:39.000', N'trg_room_reservations_overlap', N'Room 102 is booked for you on 2026-11-09 10:00.', 1),
(188, 2, '2026-11-08 22:04:50.000', N'trg_loan_checkout', N'You borrowed "my biography". It is due 11/28/2026.', 0),
(189, 11, '2026-11-08 22:06:28.000', N'trg_loan_return', N'You returned "Introduction to Algorithms". It was 5 days late, so your final fine is $5.', 0),
(190, 2, '2026-11-08 22:06:36.000', N'trg_loan_return', N'You returned "my biography".', 0),
(191, 1, '2026-11-08 22:06:48.000', N'trg_loan_return', N'You returned "Fundamentals of Database Systems". It was 18 days late, so your final fine is $7.', 0),
(192, 9, '2026-11-08 22:29:12.000', N'trg_loan_checkout', N'You borrowed "my biography". It is due 12/08/2026.', 0),
(193, 22, '2026-11-08 22:30:04.000', N'trg_loan_return', N'You returned "Database System Concepts". It was 5 days late, so your final fine is $5.', 1),
(194, 3, '2026-11-08 22:30:19.000', N'trg_loan_return', N'You returned "Database System Concepts". It was 31 days late, so your final fine is $9.', 0),
(195, 4, '2026-11-08 22:31:51.000', N'trg_room_reservations_overlap', N'Room 202 is booked for you on 2026-11-09 10:00.', 0),
(196, 11, '2026-11-09 00:09:10.000', N'sp_promote_next_hold', N'Your hold on "1984" is ready. Pick it up at the desk by 11-11-2026.', 0),
(197, 22, '2026-11-09 00:09:10.000', N'sp_promote_next_hold', N'Your hold on "1984" is ready. Pick it up at the desk by 11-11-2026.', 1),
(204, 13, '2026-11-09 00:45:53.000', N'trg_loan_checkout', N'You borrowed "Database System Concepts". It is due 11/01/2026.', 0),
(205, 13, '2026-11-09 00:46:14.000', N'sp_update_overdue_fines', N'Your fine on "Database System Concepts" is now $6. It goes up $1 each week until you return it.', 0),
(206, 22, '2026-11-09 00:46:47.000', N'trg_loan_checkout', N'You borrowed "Homage to Catalonia". It is due 11/28/2026.', 1),
(207, 11, '2026-11-09 00:46:53.000', N'trg_loan_checkout', N'You borrowed "The Great Gatsby". It is due 11/28/2026.', 0),
(208, 13, '2026-11-09 00:47:02.000', N'trg_loan_return', N'You returned "Database System Concepts". It was 7 days late, so your final fine is $6.', 0),
(209, 11, '2026-11-09 01:10:25.000', N'trg_loan_return', N'You returned "The Great Gatsby".', 0),
(210, 14, '2026-11-09 01:10:25.000', N'sp_promote_next_hold', N'Your hold on "The Great Gatsby" is ready. Pick it up at the desk by 11-11-2026.', 1),
(211, 6, '2026-11-09 01:15:22.000', N'trg_loan_return', N'You returned "To Kill a Mockingbird". It was 28 days late, so your final fine is $9.', 0),
(212, 22, '2026-11-09 01:27:56.000', N'trg_loan_return', N'You returned "Homage to Catalonia".', 1),
(213, 22, '2026-11-09 01:28:05.000', N'trg_loan_return', N'You returned "Fundamentals of Database Systems". It was 5 days late, so your final fine is $5.', 1),
(214, 9, '2026-11-09 01:40:52.000', N'trg_loan_return', N'You returned "Learn Spanish: Level 1 (Audio CD)". It was 9 days late, so your final fine is $6.', 0),
(215, 22, '2026-11-09 01:40:52.000', N'sp_promote_next_hold', N'Your hold on "Learn Spanish: Level 1 (Audio CD)" is ready. Pick it up at the desk by 11-11-2026.', 1),
(216, 4, '2026-11-09 01:40:54.000', N'trg_loan_return', N'You returned "Clean Code". It was 13 days late, so your final fine is $6.', 0),
(217, 11, '2026-11-09 01:40:54.000', N'sp_promote_next_hold', N'Your hold on "Clean Code" is ready. Pick it up at the desk by 11-11-2026.', 0),
(218, 6, '2026-11-09 01:41:06.000', N'trg_loan_return', N'You returned "Sapiens: A Brief History of Humankind". It was 10 days late, so your final fine is $6.', 0),
(219, 2, '2026-11-09 01:45:24.000', N'trg_loan_return', N'You returned "Clean Code".', 0),
(220, 8, '2026-11-09 01:54:45.000', N'trg_loan_return', N'You returned "Cosmos: A Spacetime Odyssey". It was 16 days late, so your final fine is $7.', 0),
(221, 6, '2026-11-09 01:54:47.000', N'trg_loan_return', N'You returned "1984". It was 11 days late, so your final fine is $6.', 0),
(222, 22, '2026-11-09 03:23:55.000', N'trg_loan_checkout', N'You borrowed "1984". It is due 11/28/2026.', 1),
(223, 9, '2026-11-09 03:34:23.000', N'trg_loan_return', N'You returned "my biography".', 0),
(224, 1, '2026-11-09 04:26:21.000', N'trg_loan_return', N'You returned "Designing Data-Intensive Applications". It was 14 days late, so your final fine is $7.', 0),
(225, 14, '2026-11-09 04:30:03.000', N'trg_loan_return', N'You returned "Sapiens: A Brief History of Humankind".', 1),
(226, 8, '2026-11-09 04:33:06.000', N'trg_loan_checkout', N'You borrowed "The Catcher in the Rye". It is due 04/25/2026.', 0),
(227, 8, '2026-11-09 04:33:43.000', N'sp_update_overdue_fines', N'Your fine on "The Catcher in the Rye" is now $33. It goes up $1 each week until you return it.', 0),
(228, 8, '2026-11-09 04:34:51.000', N'trg_loan_return', N'You returned "The Catcher in the Rye". It was 197 days late, so your final fine is $33.', 0),
(229, 5, '2026-11-09 22:15:42.000', N'trg_loan_return', N'You returned "The Pragmatic Programmer". It was 13 days late, so your final fine is $6.', 0),
(230, 22, '2026-11-09 22:23:09.000', N'trg_loan_checkout', N'You borrowed "The Pragmatic Programmer". It is due 11/10/2026.', 1),
(231, 22, '2026-11-09 22:24:15.000', N'trg_loan_return', N'You returned "1984".', 1),
(232, 22, '2026-11-09 22:24:29.000', N'trg_loan_checkout', N'You borrowed "Tender Is The Night". It is due 10/21/2026.', 1),
(233, 22, '2026-11-09 22:24:34.000', N'sp_update_overdue_fines', N'Your fine on "Tender Is The Night" is now $7. It goes up $1 each week until you return it.', 1),
(234, 14, '2026-11-09 22:26:58.000', N'trg_loan_checkout', N'You borrowed "Homage to Catalonia". It is due 06/07/2026.', 1),
(235, 14, '2026-11-09 22:27:32.000', N'sp_update_overdue_fines', N'Your fine on "Homage to Catalonia" is now $27. It goes up $1 each week until you return it.', 1),
(236, 14, '2026-11-09 22:28:14.000', N'trg_loan_checkout', N'You borrowed "my biography". It is due 11/09/2025.', 1),
(237, 14, '2026-11-09 22:28:41.000', N'sp_update_overdue_fines', N'Your fine on "my biography" is now $57. It goes up $1 each week until you return it.', 1),
(238, 11, '2026-11-09 22:29:16.000', N'trg_loan_return', N'You returned "The Pragmatic Programmer".', 0),
(239, 22, '2026-11-09 22:29:20.000', N'trg_loan_return', N'You returned "The Pragmatic Programmer".', 1),
(240, 10, '2026-11-09 22:32:22.000', N'trg_loan_checkout', N'You borrowed "The Alchemist". It is due 09/05/2026.', 0),
(241, 10, '2026-11-09 22:32:29.000', N'sp_update_overdue_fines', N'Your fine on "The Alchemist" is now $14. It goes up $1 each week until you return it.', 0),
(242, 10, '2026-11-09 22:32:38.000', N'trg_loan_return', N'You returned "The Alchemist". It was 65 days late, so your final fine is $14.', 0),
(243, 22, '2026-11-09 22:35:02.000', N'trg_loan_checkout', N'You borrowed "Harry Potter and the Sorcerer''s Stone". It is due 11/10/2026.', 1),
(244, 22, '2026-11-09 22:40:38.000', N'sp_promote_next_hold', N'Your hold on "1984" is ready. Pick it up at the desk by 11-12-2026.', 1),
(245, 22, '2026-11-09 22:40:41.000', N'sp_promote_next_hold', N'Your hold on "Designing Data-Intensive Applications" is ready. Pick it up at the desk by 11-12-2026.', 1),
(246, 22, '2026-11-09 22:40:51.000', N'trg_room_reservations_overlap', N'Room 202 is booked for you on 2026-11-10 10:00.', 1),
(247, 14, '2026-11-09 22:44:24.000', N'trg_loan_return', N'You returned "My Biography". It was 365 days late, so your final fine is $57.', 1),
(248, 22, '2026-11-09 23:06:50.000', N'sp_promote_next_hold', N'Your hold on "Database System Concepts" is ready. Pick it up at the desk by 11-12-2026.', 1),
(249, 22, '2026-11-10 00:11:50.000', N'sp_promote_next_hold', N'Your hold on "Animal Farm" is ready. Pick it up at the desk by 11-12-2026.', 1),
(250, 22, '2026-11-10 00:11:52.000', N'sp_promote_next_hold', N'Your hold on "Brave New World" is ready. Pick it up at the desk by 11-12-2026.', 1),
(251, 22, '2026-11-10 00:12:25.000', N'trg_room_reservations_overlap', N'Room 103 is booked for you on 2026-11-10 00:02.', 1),
(252, 14, '2026-11-10 00:13:29.000', N'sp_promote_next_hold', N'Your hold on "1984" is ready. Pick it up at the desk by 11-12-2026.', 1),
(253, 14, '2026-11-10 00:17:17.000', N'trg_loan_return', N'You returned "Homage to Catalonia". It was 155 days late, so your final fine is $27.', 1),
(254, 14, '2026-11-11 00:04:38.000', N'sp_promote_next_hold', N'Your hold on "emma" is ready. Pick it up at the desk by 11-13-2026.', 1),
(255, 22, '2026-11-11 06:04:21.000', N'sp_update_overdue_fines', N'Your fine on "Tender Is The Night" is now $8. It goes up $1 each week until you return it.', 1),
(256, 22, '2026-11-11 06:04:21.000', N'sp_update_overdue_fines', N'Your fine on "Harry Potter and the Sorcerer''s Stone" is now $5. It goes up $1 each week until you return it.', 1),
(257, 14, '2026-11-11 06:05:37.000', N'trg_loan_checkout', N'You borrowed "emma". It is due 12/11/2026.', 1),
(258, 4, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'Your hold on "Designing Data-Intensive Applications" expired because it was not picked up in 3 days.', 0),
(259, 2, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'Your hold on "The Feynman Lectures on Physics (Audio CD)" expired because it was not picked up in 3 days.', 0),
(260, 14, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'Your hold on "Fundamentals of Database Systems" expired because it was not picked up in 3 days.', 1),
(261, 14, '2026-11-11 06:07:39.000', N'trg_hold_expired', N'Your hold on "Cosmos: A Spacetime Odyssey" expired because it was not picked up in 3 days.', 1),
(262, 14, '2026-11-11 06:08:42.000', N'sp_promote_next_hold', N'Your hold on "1984" is ready. Pick it up at the desk by 11-14-2026.', 1),
(263, 14, '2026-11-11 06:08:57.000', N'sp_promote_next_hold', N'Your hold on "Database System Concepts" is ready. Pick it up at the desk by 11-14-2026.', 1),
(264, 14, '2026-11-11 06:42:20.000', N'trg_loan_checkout', N'You borrowed "1984". It is due 12/11/2026.', 1),
(265, 14, '2026-11-11 06:42:41.000', N'trg_loan_checkout', N'You borrowed "The Great Gatsby". It is due 12/11/2026.', 1),
(266, 22, '2026-11-11 08:17:26.000', N'trg_room_reservations_overlap', N'Room 103 is booked for you on 2026-11-12 10:00.', 1),
(267, 11, '2026-11-12 01:27:34.000', N'trg_loan_checkout', N'You borrowed "Animal Farm". It is due 12/01/2026.', 0),
(268, 14, '2026-11-12 01:40:41.000', N'sp_promote_next_hold', N'Your hold on "Brave New World" is ready. Pick it up at the desk by 11-14-2026.', 1),
(269, 4, '2026-11-12 05:59:09.000', N'trg_loan_checkout', N'You borrowed "The Hobbit". It is due 12/01/2026.', 0),
(270, 5, '2026-11-12 05:59:10.000', N'trg_hold_queue', N'Your book "The Hobbit" is available. You are first in line. Pick it up at the desk by 11-14-2026.', 0),
(271, 4, '2026-11-12 05:59:11.000', N'trg_loan_return', N'You returned "The Hobbit".', 0),
(272, 11, '2026-11-12 11:38:11.000', N'trg_hold_expired', N'Your hold on "Clean Code" expired because it was not picked up in 3 days.', 0),
(273, 11, '2026-11-12 11:38:11.000', N'trg_hold_expired', N'Your hold on "1984" expired because it was not picked up in 3 days.', 0),
(274, 22, '2026-11-13 11:38:14.000', N'trg_hold_expired', N'Your hold on "Database System Concepts" expired because it was not picked up in 3 days.', 1),
(275, 22, '2026-11-13 11:38:14.000', N'trg_hold_expired', N'Your hold on "Animal Farm" expired because it was not picked up in 3 days.', 1),
(276, 22, '2026-11-13 23:18:27.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-14 10:00.', 1),
(277, 22, '2026-11-13 23:18:59.000', N'trg_room_reservations_overlap', N'Room 101 is booked for you on 2026-11-15 10:00.', 1),
(278, 22, '2026-11-15 03:36:18.000', N'sp_promote_next_hold', N'Your hold on "Brave New World" is ready. Pick it up at the desk by 11-17-2026.', 0);
SET IDENTITY_INSERT [dbo].[notification] OFF;
GO

SET IDENTITY_INSERT [dbo].[payments] ON;
INSERT INTO [dbo].[payments] ([payment_id], [fine_id], [user_id], [amount_paid], [payment_date], [payment_method], [staff_id]) VALUES
(1, 1, 1, 6, '2026-07-08 16:20:00.000', N'cash', NULL),
(2, 2, 8, 6, '2026-08-02 11:05:00.000', N'card', NULL),
(3, 3, 3, 5, '2026-08-20 14:40:00.000', N'card', NULL),
(4, 4, 4, 4, '2026-08-25 13:30:00.000', N'cash', NULL),
(5, 3, 3, 3, '2026-09-05 10:15:00.000', N'cash', NULL),
(6, 6, 2, 6, '2026-09-25 15:45:00.000', N'card', NULL),
(7, 8, 10, 5, '2026-10-09 12:10:00.000', N'card', NULL),
(8, 9, 9, 6, '2026-11-07 03:28:38.000', N'cash', 5),
(9, 7, 6, 6, '2026-11-07 03:30:21.000', N'cash', 5),
(10, 11, 2, 9, '2026-11-07 04:20:38.000', N'cash', 6),
(11, 13, 14, 9, '2026-11-07 18:34:16.000', N'cash', 6),
(12, 10, 10, 5, '2026-11-08 22:43:53.000', N'cash', 5),
(13, 43, 11, 5, '2026-11-08 22:53:11.000', N'card', 5),
(14, 5, 5, 7, '2026-11-08 23:11:11.000', N'card', 5),
(15, 42, 22, 5, '2026-11-08 23:11:21.000', N'card', 5),
(16, 41, 22, 5, '2026-11-08 23:11:31.000', N'card', 5),
(17, 40, 9, 6, '2026-11-08 23:36:57.000', N'cash', 5),
(18, 39, 8, 7, '2026-11-09 00:07:31.000', N'cash', 5),
(19, 38, 6, 6, '2026-11-09 00:07:34.000', N'card', 5),
(20, 37, 6, 6, '2026-11-09 00:07:38.000', N'cash', 5),
(21, 36, 6, 9, '2026-11-09 00:07:50.000', N'cash', 5),
(22, 35, 5, 6, '2026-11-09 00:08:13.000', N'card', 5),
(23, 34, 4, 6, '2026-11-09 00:09:03.000', N'card', 5),
(24, 33, 3, 9, '2026-11-09 00:09:06.000', N'cash', 5),
(25, 12, 8, 6, '2026-11-09 00:09:13.000', N'cash', 5),
(26, 31, 1, 7, '2026-11-09 00:09:19.000', N'cash', 5),
(27, 14, 14, 20, '2026-11-09 00:09:24.000', N'card', 5),
(28, 32, 1, 7, '2026-11-09 00:15:00.000', N'cash', 5),
(29, 4, 4, 3, '2026-11-09 00:39:10.000', N'cash', 5),
(30, 44, 13, 6, '2026-11-09 00:46:32.000', N'cash', 5),
(31, 45, 8, 33, '2026-11-09 04:35:10.000', N'cash', 5),
(32, 49, 10, 14, '2026-11-09 22:33:07.000', N'card', 5),
(33, 48, 14, 57, '2026-11-09 22:44:46.000', N'cash', 6),
(34, 47, 14, 27, '2026-11-10 00:17:24.000', N'cash', 6);
SET IDENTITY_INSERT [dbo].[payments] OFF;
GO

SET IDENTITY_INSERT [dbo].[receipts] ON;
INSERT INTO [dbo].[receipts] ([receipt_id], [payment_id], [issue_date], [transaction_code]) VALUES
(1, 1, '2026-07-08 16:20:00.000', N'TXN-20260708-0001'),
(2, 2, '2026-08-02 11:05:00.000', N'TXN-20260802-0002'),
(3, 3, '2026-08-20 14:40:00.000', N'TXN-20260820-0003'),
(4, 4, '2026-08-25 13:30:00.000', N'TXN-20260825-0004'),
(5, 5, '2026-09-05 10:15:00.000', N'TXN-20260905-0005'),
(6, 6, '2026-09-25 15:45:00.000', N'TXN-20260925-0006'),
(7, 7, '2026-10-09 12:10:00.000', N'TXN-20261009-0007'),
(8, 8, '2026-11-07 03:28:38.000', N'TXN-20261107-0008'),
(9, 9, '2026-11-07 03:30:21.000', N'TXN-20261107-0009'),
(10, 10, '2026-11-07 04:20:38.000', N'TXN-20261106-0010'),
(11, 11, '2026-11-07 18:34:16.000', N'TXN-20261107-0011'),
(12, 12, '2026-11-08 22:43:53.000', N'TXN-20261108-0012'),
(13, 13, '2026-11-08 22:53:11.000', N'TXN-20261108-0013'),
(14, 14, '2026-11-08 23:11:11.000', N'TXN-20261108-0014'),
(15, 15, '2026-11-08 23:11:21.000', N'TXN-20261108-0015'),
(16, 16, '2026-11-08 23:11:31.000', N'TXN-20261108-0016'),
(17, 17, '2026-11-08 23:36:57.000', N'TXN-20261108-0017'),
(18, 18, '2026-11-09 00:07:31.000', N'TXN-20261108-0018'),
(19, 19, '2026-11-09 00:07:34.000', N'TXN-20261108-0019'),
(20, 20, '2026-11-09 00:07:38.000', N'TXN-20261108-0020'),
(21, 21, '2026-11-09 00:07:50.000', N'TXN-20261108-0021'),
(22, 22, '2026-11-09 00:08:13.000', N'TXN-20261108-0022'),
(23, 23, '2026-11-09 00:09:03.000', N'TXN-20261108-0023'),
(24, 24, '2026-11-09 00:09:06.000', N'TXN-20261108-0024'),
(25, 25, '2026-11-09 00:09:13.000', N'TXN-20261108-0025'),
(26, 26, '2026-11-09 00:09:19.000', N'TXN-20261108-0026'),
(27, 27, '2026-11-09 00:09:24.000', N'TXN-20261108-0027'),
(28, 28, '2026-11-09 00:15:00.000', N'TXN-20261108-0028'),
(29, 29, '2026-11-09 00:39:10.000', N'TXN-20261108-0029'),
(30, 30, '2026-11-09 00:46:32.000', N'TXN-20261108-0030'),
(31, 31, '2026-11-09 04:35:10.000', N'TXN-20261108-0031'),
(32, 32, '2026-11-09 22:33:07.000', N'TXN-20261109-0032'),
(33, 33, '2026-11-09 22:44:46.000', N'TXN-20261109-0033'),
(34, 34, '2026-11-10 00:17:24.000', N'TXN-20261109-0034');
SET IDENTITY_INSERT [dbo].[receipts] OFF;
GO

SET IDENTITY_INSERT [dbo].[room] ON;
INSERT INTO [dbo].[room] ([room_id], [room_number], [capacity], [is_active], [room_level]) VALUES
(1, N'101', 4, 1, 1),
(2, N'102', 6, 1, 1),
(3, N'201', 8, 1, 2),
(4, N'202', 2, 1, 2),
(5, N'103', 10, 1, 1),
(6, N'204', 4, 1, 2),
(8, N'203', 4, 1, 2),
(9, N'104', 10, 0, 1);
SET IDENTITY_INSERT [dbo].[room] OFF;
GO

SET IDENTITY_INSERT [dbo].[room_reservations] ON;
INSERT INTO [dbo].[room_reservations] ([reservation_id], [user_id], [room_id], [start_time], [end_time], [is_active]) VALUES
(1, 1, 1, '2026-09-08 10:00:00.000', '2026-09-08 12:00:00.000', 1),
(2, 2, 1, '2026-09-08 12:00:00.000', '2026-09-08 13:00:00.000', 1),
(3, 3, 2, '2026-09-15 14:00:00.000', '2026-09-15 16:00:00.000', 1),
(4, 8, 3, '2026-09-22 09:00:00.000', '2026-09-22 11:00:00.000', 1),
(5, 4, 1, '2026-09-29 15:00:00.000', '2026-09-29 17:00:00.000', 1),
(6, 5, 2, '2026-10-06 10:00:00.000', '2026-10-06 11:30:00.000', 1),
(7, 6, 3, '2026-10-07 13:00:00.000', '2026-10-07 15:00:00.000', 1),
(8, 1, 2, '2026-10-13 10:00:00.000', '2026-10-13 12:00:00.000', 1),
(9, 9, 3, '2026-10-14 09:00:00.000', '2026-10-14 10:00:00.000', 1),
(10, 2, 1, '2026-10-14 14:00:00.000', '2026-10-14 16:00:00.000', 1),
(11, 10, 1, '2026-10-15 11:00:00.000', '2026-10-15 12:00:00.000', 1),
(12, 3, 2, '2026-10-16 13:00:00.000', '2026-10-16 14:30:00.000', 1),
(14, 11, 1, '2026-11-04 10:00:00.000', '2026-11-04 11:00:00.000', 1),
(15, 12, 2, '2026-11-05 14:00:00.000', '2026-11-05 15:00:00.000', 0),
(16, 12, 2, '2026-11-04 10:00:00.000', '2026-11-04 11:00:00.000', 1),
(17, 4, 3, '2026-11-17 10:00:00.000', '2026-11-17 11:00:00.000', 0),
(18, 3, 1, '2026-11-14 09:00:00.000', '2026-11-14 11:00:00.000', 0),
(19, 11, 1, '2026-11-05 10:00:00.000', '2026-11-05 11:00:00.000', 0),
(20, 11, 1, '2026-11-05 10:00:00.000', '2026-11-05 11:00:00.000', 0),
(21, 11, 3, '2026-11-05 10:00:00.000', '2026-11-05 11:00:00.000', 0),
(22, 11, 3, '2026-11-05 10:00:00.000', '2026-11-05 12:00:00.000', 1),
(23, 11, 3, '2026-11-12 10:00:00.000', '2026-11-12 11:00:00.000', 0),
(24, 5, 3, '2026-11-13 10:00:00.000', '2026-11-13 11:00:00.000', 0),
(25, 14, 1, '2026-11-05 10:00:00.000', '2026-11-05 11:00:00.000', 1),
(26, 18, 6, '2026-11-07 14:00:00.000', '2026-11-07 15:00:00.000', 0),
(27, 19, 6, '2026-11-07 15:00:00.000', '2026-11-07 16:00:00.000', 0),
(28, 18, 6, '2026-11-07 14:00:00.000', '2026-11-07 15:00:00.000', 0),
(29, 18, 6, '2026-11-06 23:15:00.000', '2026-11-06 23:45:00.000', 0),
(30, 18, 6, '2026-11-07 10:00:00.000', '2026-11-07 11:00:00.000', 0),
(31, 20, 1, '2026-11-06 23:00:00.000', '2026-11-06 23:30:00.000', 0),
(32, 20, 1, '2026-11-07 14:00:00.000', '2026-11-07 15:00:00.000', 0),
(33, 21, 1, '2026-11-07 15:00:00.000', '2026-11-07 16:00:00.000', 0),
(34, 11, 1, '2026-11-08 10:00:00.000', '2026-11-08 11:00:00.000', 0),
(35, 11, 1, '2026-11-08 12:00:00.000', '2026-11-08 15:00:00.000', 0),
(36, 22, 1, '2026-11-08 10:00:00.000', '2026-11-08 11:00:00.000', 0),
(37, 11, 1, '2026-11-08 10:00:00.000', '2026-11-08 11:00:00.000', 1),
(38, 12, 8, '2026-11-08 10:00:00.000', '2026-11-08 11:00:00.000', 0),
(39, 22, 5, '2026-11-09 10:00:00.000', '2026-11-09 11:00:00.000', 0),
(40, 14, 2, '2026-11-09 10:00:00.000', '2026-11-09 11:00:00.000', 1),
(41, 4, 4, '2026-11-09 10:00:00.000', '2026-11-09 11:00:00.000', 1),
(42, 22, 4, '2026-11-10 10:00:00.000', '2026-11-10 11:00:00.000', 1),
(43, 22, 5, '2026-11-10 00:02:00.000', '2026-11-10 16:00:00.000', 1),
(44, 22, 5, '2026-11-12 10:00:00.000', '2026-11-12 11:00:00.000', 1),
(45, 22, 1, '2026-11-14 10:00:00.000', '2026-11-14 11:00:00.000', 1),
(46, 22, 1, '2026-11-15 10:00:00.000', '2026-11-15 11:00:00.000', 1);
SET IDENTITY_INSERT [dbo].[room_reservations] OFF;
GO

SET IDENTITY_INSERT [dbo].[staff] ON;
INSERT INTO [dbo].[staff] ([staff_id], [first_name], [last_name], [email], [password], [is_admin], [is_active]) VALUES
(1, N'Alex', N'Morgan', N'alex@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 1, 1),
(2, N'Jordan', N'Rivera', N'jordan@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1),
(3, N'Taylor', N'Brooks', N'taylor@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1),
(4, N'Casey', N'Nguyen', N'casey@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1),
(5, N'Azael', N'Fuentes', N'azael@library.edu', N'$2b$10$RrdF8mCNp1t2l6iztqLkzeXfHfzf3TevE/I2c50iSmnpFWGB8igAm', 1, 1),
(6, N'Clark', N'Nguyen', N'clark@library.edu', N'$2b$10$VMvuL2hsdSGNi4MGNLqLo.KXI4cofaAL/1.FWdpr5DXu9leMF/SDK', 0, 1);
SET IDENTITY_INSERT [dbo].[staff] OFF;
GO

SET IDENTITY_INSERT [dbo].[user] ON;
INSERT INTO [dbo].[user] ([user_id], [first_name], [last_name], [email], [password], [is_faculty], [is_active], [created_at]) VALUES
(1, N'Maya', N'Tran', N'maya@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1, '2026-06-01 09:12:00.000'),
(2, N'Daniel', N'Ortiz', N'daniel@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1, '2026-06-03 10:40:00.000'),
(3, N'Priya', N'Shah', N'priya@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1, '2026-06-20 14:05:00.000'),
(4, N'Marcus', N'Lee', N'marcus@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1, '2026-07-08 11:30:00.000'),
(5, N'Hannah', N'Kim', N'hannah@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1, '2026-08-24 16:15:00.000'),
(6, N'Omar', N'Haddad', N'omar@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 1, '2026-09-02 08:55:00.000'),
(7, N'Chloee', N'Bennett', N'chloe@library.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 0, 0, '2026-09-15 13:20:00.000'),
(8, N'Elena', N'Ruiz', N'elena@uni.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 1, 1, '2026-06-01 08:30:00.000'),
(9, N'Samuel', N'Okafor', N'samuel@uni.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 1, 1, '2026-07-15 09:45:00.000'),
(10, N'Grace', N'Liu', N'grace@uni.edu', N'$2b$10$YTrKBhiyOvzwcaIR9UDpFOUU/y8tNGqH0dPZUxHWXBAtUOXhQOLSi', 1, 1, '2026-08-20 10:10:00.000'),
(11, N'Jake', N'Kennedy', N'jake@library.edu', N'$2b$10$OVOB3cmPTzUQSBv2DYXOfuSK93xrZERTVuKCYL390yPq1DOYVt6WG', 0, 1, '2026-10-27 02:34:15.000'),
(12, N'Crap', N'Bag', N'Crap@library.edu', N'$2b$10$Yjkb5SEo07rVD4sWI4dya.1tMHMkGaVO0MtK.osSO/lCUdLVUY2lm', 0, 0, '2026-10-27 02:34:15.000'),
(13, N'Uriel', N'Smith', N'uriel@library.edu', N'$2b$10$NdqmATncHodzR9zggjEqLOYKcPgCx2gLLxiLIHOKE21UMgSshIRI.', 0, 1, '2026-10-27 02:34:15.000'),
(14, N'Aliza', N'Salman', N'aliza@uni.edu', N'$2b$10$IvHe94PYqs.JcPkZOMnz8eU.7BHttbkhnMdKgCN/muyWDy/PuotBG', 1, 1, '2026-10-27 02:34:15.000'),
(15, N'Dan', N'Okafor', N'dan@uni.edu', N'$2b$10$IvHe94PYqs.JcPkZOMnz8eU.7BHttbkhnMdKgCN/muyWDy/PuotBG', 1, 1, '2026-10-27 02:34:15.000'),
(16, N'Lala', N'Lulu', N'lala@library.edu', N'$2b$10$dV1/9lqcDBKygZxkWI2Aa.vOn6/83F4DlSVRLJWRV5HP3GiEzzyu2', 0, 1, '2026-11-07 03:32:37.000'),
(17, N'John', N'Doe', N'john@library.edu', N'$2b$10$4hVZYDJvQJiIyRLO.B8U0.PNn1IyUlJT3YpMSd0YLURJwfvnZ3RNi', 0, 0, '2026-11-07 03:38:46.000'),
(18, N'Princess', N'Counsela Banahammock', N'princess@library.edu', N'$2b$10$Bt.jE/vBjFpk8sJTSk/m6ugVQ7FBcKzKI5DN4ZsuBcFreHk5/JhRC', 0, 1, '2026-11-07 03:58:57.000'),
(19, N'Spider', N'Man', N'spider@uni.edu', N'$2b$10$waHukFB00S2nUwCe9RE3ouPfYG31vDwuaOyV2ogZ88xwAj5OLYgTO', 1, 0, '2026-11-07 03:58:58.000'),
(20, N'Peter', N'Parker', N'peter@library.edu', N'$2b$10$Zz.1YHW545erB1X2br7bIu/uPcYCgsUfiSZoA3nVzwMSzwc/dtUV.', 0, 0, '2026-11-07 04:06:53.000'),
(21, N'Tesla', N'x', N'tesla@uni.edu', N'$2b$10$6cdd4DDSLSbk6hdZh3Fj2uEcJ2EJXpOEgIakCPt3dHeuTZw7yA44e', 1, 0, '2026-11-07 04:07:05.000'),
(22, N'Esther', N'Burns', N'esther@library.edu', N'$2b$10$k1bG4pNy9WtVKkR6btU9o..LbYI1vFnlbKppgRjFChhELQndQabia', 0, 1, '2026-11-07 17:40:28.000');
SET IDENTITY_INSERT [dbo].[user] OFF;
GO

SET IDENTITY_INSERT [dbo].[waitlist] ON;
INSERT INTO [dbo].[waitlist] ([waitlist_id], [user_id], [book_id], [media_id], [request_time], [status], [ready_date], [expiration_date], [held_copy_id]) VALUES
(1, 3, 1, NULL, '2026-07-02 10:30:00.000', N'fulfilled', NULL, NULL, NULL),
(2, 1, NULL, 2, '2026-07-29 17:05:00.000', N'cancelled', NULL, NULL, NULL),
(3, 4, 6, NULL, '2026-10-08 09:40:00.000', N'expired', '2026-11-07', '2026-11-10', NULL),
(4, 5, 6, NULL, '2026-10-09 13:25:00.000', N'cancelled', NULL, NULL, NULL),
(5, 2, NULL, 3, '2026-10-11 11:00:00.000', N'expired', '2026-11-07', '2026-11-10', NULL),
(6, 11, 8, NULL, '2026-10-30 23:30:56.000', N'cancelled', NULL, NULL, NULL),
(7, 11, 4, NULL, '2026-10-30 23:31:00.000', N'cancelled', NULL, NULL, NULL),
(8, 11, 2, NULL, '2026-10-30 23:31:27.000', N'cancelled', NULL, NULL, NULL),
(9, 12, 8, NULL, '2026-11-05 02:20:41.000', N'cancelled', NULL, NULL, NULL),
(10, 12, NULL, 3, '2026-11-05 02:21:01.000', N'cancelled', NULL, NULL, NULL),
(11, 12, 22, NULL, '2026-11-05 02:21:30.000', N'cancelled', NULL, NULL, NULL),
(12, 14, 8, NULL, '2026-11-05 02:58:15.000', N'cancelled', NULL, NULL, NULL),
(13, 14, 4, NULL, '2026-11-05 02:58:36.000', N'cancelled', NULL, NULL, NULL),
(14, 14, 6, NULL, '2026-11-05 02:58:49.000', N'cancelled', NULL, NULL, NULL),
(15, 11, 4, NULL, '2026-11-07 03:34:56.000', N'expired', '2026-11-08', '2026-11-11', NULL),
(16, 11, 9, NULL, '2026-11-07 03:35:08.000', N'fulfilled', '2026-11-07', '2026-11-10', NULL),
(17, 11, 1, NULL, '2026-11-07 03:35:12.000', N'cancelled', '2026-11-07', '2026-11-10', NULL),
(18, 18, 25, NULL, '2026-11-07 04:02:40.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(19, 19, 25, NULL, '2026-11-07 04:02:41.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(20, 18, 29, NULL, '2026-11-07 04:02:43.000', N'fulfilled', '2026-11-06', '2026-11-09', NULL),
(21, 18, 30, NULL, '2026-11-07 04:02:44.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(22, 18, 31, NULL, '2026-11-07 04:02:46.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(23, 18, 30, NULL, '2026-11-07 04:02:46.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(24, 19, 27, NULL, '2026-11-07 04:03:35.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(25, 19, 31, NULL, '2026-11-07 04:03:38.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(26, 20, 6, NULL, '2026-11-07 04:14:32.000', N'cancelled', NULL, NULL, NULL),
(27, 20, 22, NULL, '2026-11-07 04:14:42.000', N'cancelled', '2026-11-06', '2026-11-09', NULL),
(28, 20, 4, NULL, '2026-11-07 04:14:53.000', N'cancelled', NULL, NULL, NULL),
(29, 11, 8, NULL, '2026-11-07 17:47:09.000', N'expired', '2026-11-08', '2026-11-11', NULL),
(30, 14, 2, NULL, '2026-11-07 17:57:22.000', N'cancelled', '2026-11-07', '2026-11-10', NULL),
(31, 14, 1, NULL, '2026-11-07 17:57:40.000', N'expired', '2026-11-07', '2026-11-10', NULL),
(32, 14, 22, NULL, '2026-11-07 18:09:54.000', N'cancelled', '2026-11-07', '2026-11-10', NULL),
(33, 14, 10, NULL, '2026-11-07 18:09:57.000', N'fulfilled', '2026-11-07', '2026-11-10', NULL),
(34, 14, 9, NULL, '2026-11-07 18:30:44.000', N'fulfilled', '2026-11-08', '2026-11-11', NULL),
(35, 14, 33, NULL, '2026-11-07 18:36:26.000', N'cancelled', NULL, NULL, NULL),
(36, 14, NULL, 1, '2026-11-07 18:37:07.000', N'expired', '2026-11-07', '2026-11-10', NULL),
(37, 22, 8, NULL, '2026-11-08 22:00:59.000', N'fulfilled', '2026-11-08', '2026-11-11', NULL),
(38, 22, 22, NULL, '2026-11-08 22:01:05.000', N'fulfilled', '2026-11-08', '2026-11-11', NULL),
(39, 22, NULL, 4, '2026-11-08 22:01:09.000', N'cancelled', '2026-11-08', '2026-11-11', NULL),
(2040, 22, 8, NULL, '2026-11-09 22:40:38.000', N'cancelled', '2026-11-09', '2026-11-12', NULL),
(2041, 22, 6, NULL, '2026-11-09 22:40:41.000', N'cancelled', '2026-11-09', '2026-11-12', NULL),
(2042, 22, 2, NULL, '2026-11-09 23:06:50.000', N'expired', '2026-11-09', '2026-11-12', NULL),
(2043, 22, 21, NULL, '2026-11-10 00:11:49.000', N'expired', '2026-11-09', '2026-11-12', NULL),
(2044, 22, 27, NULL, '2026-11-10 00:11:52.000', N'cancelled', '2026-11-09', '2026-11-12', NULL),
(2045, 14, 8, NULL, '2026-11-10 00:13:29.000', N'cancelled', '2026-11-09', '2026-11-12', NULL),
(2046, 14, 36, NULL, '2026-11-11 00:04:38.000', N'fulfilled', '2026-11-10', '2026-11-13', NULL),
(2047, 14, 30, NULL, '2026-11-11 00:05:18.000', N'cancelled', NULL, NULL, NULL),
(2048, 14, 8, NULL, '2026-11-11 06:08:42.000', N'fulfilled', '2026-11-11', '2026-11-14', NULL),
(2049, 14, 27, NULL, '2026-11-11 06:08:53.000', N'cancelled', '2026-11-11', '2026-11-14', NULL),
(2050, 14, 2, NULL, '2026-11-11 06:08:57.000', N'cancelled', '2026-11-11', '2026-11-14', NULL),
(2051, 5, 29, NULL, '2026-11-12 05:59:09.000', N'cancelled', '2026-11-11', '2026-11-14', NULL),
(2052, 22, 30, NULL, '2026-11-12 22:49:09.000', N'cancelled', NULL, NULL, NULL),
(2053, 22, 27, NULL, '2026-11-13 23:14:37.000', N'ready', '2026-11-14', '2026-11-17', 56),
(2054, 22, 33, NULL, '2026-11-13 23:14:46.000', N'waiting', NULL, NULL, NULL),
(2055, 14, 27, NULL, '2026-11-15 03:36:43.000', N'waiting', NULL, NULL, NULL),
(2056, 14, 33, NULL, '2026-11-15 03:36:50.000', N'waiting', NULL, NULL, NULL);
SET IDENTITY_INSERT [dbo].[waitlist] OFF;
GO

ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_ibfk_1] FOREIGN KEY ([fine_id]) REFERENCES [dbo].[fine] ([fine_id]);
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_ibfk_2] FOREIGN KEY ([user_id]) REFERENCES [dbo].[user] ([user_id]);
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_ibfk_3] FOREIGN KEY ([staff_id]) REFERENCES [dbo].[staff] ([staff_id]);
ALTER TABLE [dbo].[receipts] ADD CONSTRAINT [receipts_ibfk_1] FOREIGN KEY ([payment_id]) REFERENCES [dbo].[payments] ([payment_id]);
ALTER TABLE [dbo].[room_reservations] ADD CONSTRAINT [room_reservations_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES [dbo].[user] ([user_id]);
ALTER TABLE [dbo].[room_reservations] ADD CONSTRAINT [room_reservations_ibfk_2] FOREIGN KEY ([room_id]) REFERENCES [dbo].[room] ([room_id]);
ALTER TABLE [dbo].[user] ADD CONSTRAINT [user_ibfk_1] FOREIGN KEY ([is_faculty]) REFERENCES [dbo].[borrow_policy] ([is_faculty]);
ALTER TABLE [dbo].[waitlist] ADD CONSTRAINT [waitlist_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES [dbo].[user] ([user_id]);
ALTER TABLE [dbo].[waitlist] ADD CONSTRAINT [waitlist_ibfk_2] FOREIGN KEY ([book_id]) REFERENCES [dbo].[book] ([book_id]);
ALTER TABLE [dbo].[waitlist] ADD CONSTRAINT [waitlist_ibfk_3] FOREIGN KEY ([media_id]) REFERENCES [dbo].[media] ([media_id]);
ALTER TABLE [dbo].[waitlist] ADD CONSTRAINT [waitlist_ibfk_4] FOREIGN KEY ([held_copy_id]) REFERENCES [dbo].[copies] ([copy_id]);
ALTER TABLE [dbo].[notification] ADD CONSTRAINT [notification_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES [dbo].[user] ([user_id]);
ALTER TABLE [dbo].[book_author] ADD CONSTRAINT [book_author_ibfk_1] FOREIGN KEY ([book_id]) REFERENCES [dbo].[book] ([book_id]);
ALTER TABLE [dbo].[book_author] ADD CONSTRAINT [book_author_ibfk_2] FOREIGN KEY ([author_id]) REFERENCES [dbo].[author] ([author_id]);
ALTER TABLE [dbo].[copies] ADD CONSTRAINT [copies_ibfk_1] FOREIGN KEY ([book_id]) REFERENCES [dbo].[book] ([book_id]);
ALTER TABLE [dbo].[copies] ADD CONSTRAINT [copies_ibfk_2] FOREIGN KEY ([media_id]) REFERENCES [dbo].[media] ([media_id]);
ALTER TABLE [dbo].[fine] ADD CONSTRAINT [fine_ibfk_1] FOREIGN KEY ([loan_id]) REFERENCES [dbo].[loan] ([loan_id]);
ALTER TABLE [dbo].[loan] ADD CONSTRAINT [loan_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES [dbo].[user] ([user_id]);
ALTER TABLE [dbo].[loan] ADD CONSTRAINT [loan_ibfk_2] FOREIGN KEY ([copy_id]) REFERENCES [dbo].[copies] ([copy_id]);
GO

CREATE VIEW dbo.fine_status
AS
SELECT f.fine_id, f.loan_id, f.amount,
       COALESCE(p.total_paid, 0) AS total_paid,
       CAST(CASE WHEN COALESCE(p.total_paid, 0) >= f.amount
                 THEN 1 ELSE 0 END AS bit) AS paid_status,
       CASE WHEN COALESCE(p.total_paid, 0) >= f.amount
            THEN CAST(p.last_payment AS date) ELSE NULL END AS paid_date
FROM dbo.fine AS f
LEFT JOIN (
    SELECT fine_id, SUM(amount_paid) AS total_paid, MAX(payment_date) AS last_payment
    FROM dbo.payments
    GROUP BY fine_id
) AS p ON p.fine_id = f.fine_id;
GO

CREATE   PROCEDURE dbo.checkout_item
    @p_user_id int,
    @p_book_id int,
    @p_media_id int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_days int = (
        SELECT bp.loan_days
        FROM dbo.[user] AS u
        JOIN dbo.borrow_policy AS bp ON bp.is_faculty = u.is_faculty
        WHERE u.user_id = @p_user_id
    );
    IF @v_days IS NULL
        THROW 51010, 'Member not found', 1;

    DECLARE @v_copy_id int = (
        SELECT TOP 1 held_copy_id
        FROM dbo.waitlist
        WHERE user_id = @p_user_id AND status = 'ready'
          AND (book_id = @p_book_id OR media_id = @p_media_id)
    );
    IF @v_copy_id IS NULL
        SET @v_copy_id = (
            SELECT TOP 1 c.copy_id
            FROM dbo.copies AS c
            WHERE c.is_active = 1
              AND c.is_available = 1
              AND (c.book_id = @p_book_id OR c.media_id = @p_media_id)
            ORDER BY c.copy_id
        );
    IF @v_copy_id IS NULL
        THROW 51011, 'No copy is available right now. Place a hold to join the queue.', 1;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_due date = DATEADD(day, @v_days, @v_today);

    BEGIN TRANSACTION;

    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    VALUES (@p_user_id, @v_copy_id, @v_today, @v_due);
    DECLARE @v_loan_id int = CAST(SCOPE_IDENTITY() AS int);

    UPDATE dbo.waitlist
    SET status = 'fulfilled', held_copy_id = NULL
    WHERE user_id = @p_user_id
      AND status IN ('waiting', 'ready')
      AND (book_id = @p_book_id OR media_id = @p_media_id);

    COMMIT TRANSACTION;

    SELECT @v_loan_id AS loan_id, CONVERT(char(10), @v_due, 23) AS due_date;
END;
GO

CREATE   PROCEDURE dbo.expire_holds
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_expired TABLE (hold_id int);

    UPDATE dbo.waitlist
    SET status = 'expired'
    OUTPUT inserted.waitlist_id INTO @v_expired (hold_id)
    WHERE status = 'ready' AND expiration_date < @v_today;

    SELECT COUNT(*) AS expired FROM @v_expired;
END;
GO

CREATE   PROCEDURE dbo.pay_fine
    @p_fine_id int,
    @p_method nvarchar(4),
    @p_staff_id int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_owed decimal(8,2), @v_user_id int;
    SELECT @v_owed = fs.amount - fs.total_paid, @v_user_id = l.user_id
    FROM dbo.fine_status AS fs
    JOIN dbo.loan AS l ON l.loan_id = fs.loan_id
    WHERE fs.fine_id = @p_fine_id;

    IF @v_user_id IS NULL
        THROW 51013, 'Fine not found', 1;
    IF @v_owed <= 0
        THROW 51014, 'This fine is already paid', 1;

    BEGIN TRANSACTION;

    INSERT INTO dbo.payments (fine_id, user_id, amount_paid, payment_method, staff_id)
    VALUES (@p_fine_id, @v_user_id, @v_owed, LOWER(@p_method), @p_staff_id);
    DECLARE @v_payment_id int = CAST(SCOPE_IDENTITY() AS int);

    DECLARE @v_code nvarchar(50) = CONCAT('TXN-', CONVERT(char(8), SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time', 112), '-', RIGHT(CONCAT('0000', @v_payment_id), 4));
    INSERT INTO dbo.receipts (payment_id, transaction_code)
    VALUES (@v_payment_id, @v_code);
    DECLARE @v_receipt_id int = CAST(SCOPE_IDENTITY() AS int);

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    VALUES ('payment_recorded', 'payments',
            CONCAT('Payment ', @v_payment_id, ': fine ', @p_fine_id, ' paid; receipt ', @v_code, ' issued.'));

    COMMIT TRANSACTION;

    SELECT @v_receipt_id AS receipt_id, @v_owed AS amount_paid;
END;
GO

CREATE   PROCEDURE dbo.promote_next_hold
    @p_book_id int,
    @p_media_id int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_copy_id int = (
        SELECT TOP 1 copy_id
        FROM dbo.copies
        WHERE is_active = 1 AND is_available = 1
          AND (book_id = @p_book_id OR media_id = @p_media_id)
        ORDER BY copy_id
    );
    DECLARE @v_hold_id int, @v_user_id int;
    SELECT TOP 1 @v_hold_id = waitlist_id, @v_user_id = user_id
    FROM dbo.waitlist
    WHERE status = 'waiting' AND (book_id = @p_book_id OR media_id = @p_media_id)
    ORDER BY request_time, waitlist_id;

    IF @v_copy_id IS NULL OR @v_hold_id IS NULL
        RETURN;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_expires date = DATEADD(day, 3, @v_today);
    DECLARE @v_title nvarchar(150) = COALESCE(
        (SELECT title FROM dbo.book WHERE book_id = @p_book_id),
        (SELECT title FROM dbo.media WHERE media_id = @p_media_id));

    BEGIN TRANSACTION;

    UPDATE dbo.waitlist
    SET status = 'ready', ready_date = @v_today, expiration_date = @v_expires, held_copy_id = @v_copy_id
    WHERE waitlist_id = @v_hold_id;

    UPDATE dbo.copies SET is_available = 0 WHERE copy_id = @v_copy_id;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    VALUES ('sp_promote_next_hold', 'waitlist',
            CONCAT('Hold ', @v_hold_id, ' is ready for user ', @v_user_id, '; pick up by ', CONVERT(char(10), @v_expires, 23)));

    INSERT INTO dbo.notification (user_id, source, message)
    VALUES (@v_user_id, 'sp_promote_next_hold',
            CONCAT('Your hold on "', @v_title, '" is ready. Pick it up at the desk by ', CONVERT(char(10), @v_expires, 110), '.'));

    COMMIT TRANSACTION;
END;
GO

CREATE   PROCEDURE dbo.release_hold
    @p_hold_id int,
    @p_status nvarchar(9)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_status nvarchar(9), @v_copy_id int, @v_book_id int, @v_media_id int;
    SELECT @v_status = status, @v_copy_id = held_copy_id, @v_book_id = book_id, @v_media_id = media_id
    FROM dbo.waitlist
    WHERE waitlist_id = @p_hold_id;

    IF @v_status IS NULL
        THROW 51015, 'Hold not found.', 1;
    IF @v_status NOT IN ('waiting', 'ready')
        THROW 51016, 'This hold is no longer active.', 1;

    UPDATE dbo.waitlist SET status = @p_status, held_copy_id = NULL WHERE waitlist_id = @p_hold_id;

    IF @v_copy_id IS NOT NULL
    BEGIN
        UPDATE dbo.copies SET is_available = 1 WHERE copy_id = @v_copy_id;
        EXEC dbo.promote_next_hold @v_book_id, @v_media_id;
    END;
END;
GO

CREATE   PROCEDURE dbo.return_loan
    @p_loan_id int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.loan WHERE loan_id = @p_loan_id AND return_date IS NULL)
        THROW 51012, 'This item was already returned', 1;

    UPDATE dbo.loan
    SET return_date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date)
    WHERE loan_id = @p_loan_id;

    SELECT fine_id, loan_id, amount
    FROM dbo.fine
    WHERE loan_id = @p_loan_id;
END;
GO

CREATE   PROCEDURE dbo.save_room_reservation
    @p_reservation_id int,
    @p_user_id int,
    @p_room_id int,
    @p_start datetime2(0),
    @p_end datetime2(0)
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT <> 0
        THROW 50001, 'Call this procedure outside an existing transaction', 1;
    SET XACT_ABORT ON;
    IF @p_start IS NULL OR @p_end IS NULL OR @p_end <= @p_start
        THROW 50002, 'End time must be after start time', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @v_room int = NULL, @v_existing int = NULL;
        SELECT @v_room = room_id
        FROM dbo.room WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id = @p_room_id;
        IF @v_room IS NULL
            THROW 50003, 'Room does not exist', 1;
        IF EXISTS (SELECT 1 FROM dbo.room WHERE room_id = @p_room_id AND is_active = 0)
            THROW 50006, 'This room is archived', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.[user] WHERE user_id = @p_user_id AND is_active = 1)
            THROW 50007, 'This member is deactivated or does not exist', 1;
        IF @p_start < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS datetime2(0))
            THROW 50008, 'You cannot book a time in the past', 1;

        IF @p_reservation_id IS NOT NULL
        BEGIN
            SELECT @v_existing = reservation_id
            FROM dbo.room_reservations WITH (UPDLOCK, HOLDLOCK)
            WHERE reservation_id = @p_reservation_id;
            IF @v_existing IS NULL
                THROW 50004, 'Reservation does not exist', 1;
        END;

        IF EXISTS (
            SELECT 1 FROM dbo.room_reservations WITH (UPDLOCK, HOLDLOCK)
            WHERE room_id = @p_room_id
              AND is_active = 1
              AND start_time < @p_end
              AND end_time > @p_start
              AND (@p_reservation_id IS NULL OR reservation_id <> @p_reservation_id)
        )
            THROW 50005, 'Room is already booked during that time', 1;

        IF @p_reservation_id IS NULL
            INSERT INTO dbo.room_reservations (user_id, room_id, start_time, end_time)
            VALUES (@p_user_id, @p_room_id, @p_start, @p_end);
        ELSE
            UPDATE dbo.room_reservations
            SET user_id = @p_user_id, room_id = @p_room_id,
                start_time = @p_start, end_time = @p_end
            WHERE reservation_id = @p_reservation_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE   PROCEDURE dbo.send_due_reminders
    @p_user_id int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_sent TABLE (user_id int, message nvarchar(300));

    BEGIN TRANSACTION;

    INSERT INTO dbo.notification (user_id, source, message)
    OUTPUT inserted.user_id, inserted.message INTO @v_sent (user_id, message)
    SELECT r.user_id, 'sp_send_due_reminders', r.message
    FROM (
        SELECT l.user_id,
               LEFT(CONCAT('"', COALESCE(b.title, m.title), '" must be returned in 2 days (due ',
                           CONVERT(char(10), l.due_date, 110), ').'), 300) AS message
        FROM dbo.loan AS l
        JOIN dbo.copies AS c ON c.copy_id = l.copy_id
        LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
        LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
        WHERE l.return_date IS NULL
          AND l.due_date = DATEADD(day, 2, @v_today)
          AND (@p_user_id IS NULL OR l.user_id = @p_user_id)
    ) AS r
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.notification AS n WITH (UPDLOCK, HOLDLOCK)
        WHERE n.user_id = r.user_id AND n.source = 'sp_send_due_reminders' AND n.message = r.message
    );

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'sp_send_due_reminders', 'notification', LEFT(CONCAT('Due reminder sent to user ', user_id, ': ', message), 300)
    FROM @v_sent;

    COMMIT TRANSACTION;
END;
GO

CREATE   PROCEDURE dbo.update_overdue_fines
    @p_user_id int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_changed TABLE (loan_id int, amount decimal(8,2));

    BEGIN TRANSACTION;

    UPDATE f
    SET amount = 5 + DATEDIFF(day, l.due_date, @v_today) / 7
    OUTPUT inserted.loan_id, inserted.amount INTO @v_changed (loan_id, amount)
    FROM dbo.fine AS f
    JOIN dbo.loan AS l ON l.loan_id = f.loan_id
    WHERE l.return_date IS NULL
      AND l.due_date < @v_today
      AND (@p_user_id IS NULL OR l.user_id = @p_user_id)
      AND f.amount < 5 + DATEDIFF(day, l.due_date, @v_today) / 7;

    INSERT INTO dbo.fine (loan_id, amount)
    OUTPUT inserted.loan_id, inserted.amount INTO @v_changed (loan_id, amount)
    SELECT l.loan_id, 5 + DATEDIFF(day, l.due_date, @v_today) / 7
    FROM dbo.loan AS l
    WHERE l.return_date IS NULL
      AND l.due_date < @v_today
      AND (@p_user_id IS NULL OR l.user_id = @p_user_id)
      AND NOT EXISTS (SELECT 1 FROM dbo.fine AS f WITH (UPDLOCK, HOLDLOCK) WHERE f.loan_id = l.loan_id);

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT l.user_id, 'sp_update_overdue_fines',
           LEFT(CONCAT('Your fine on "', COALESCE(b.title, m.title), '" is now $', CAST(ch.amount AS int),
                       '. It goes up $1 each week until you return it.'), 300)
    FROM @v_changed AS ch
    JOIN dbo.loan AS l ON l.loan_id = ch.loan_id
    JOIN dbo.copies AS c ON c.copy_id = l.copy_id
    LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
    LEFT JOIN dbo.media AS m ON m.media_id = c.media_id;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'sp_update_overdue_fines', 'fine',
           LEFT(CONCAT('Loan ', l.loan_id, ': ', DATEDIFF(day, l.due_date, @v_today),
                       ' days late, fine is now $', CAST(ch.amount AS int)), 300)
    FROM @v_changed AS ch
    JOIN dbo.loan AS l ON l.loan_id = ch.loan_id;

    COMMIT TRANSACTION;
END;
GO

CREATE   TRIGGER dbo.trg_hold_expired
ON dbo.[waitlist]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @v_expired TABLE (n int IDENTITY(1,1), hold_id int, user_id int, copy_id int, book_id int, media_id int);

    INSERT INTO @v_expired (hold_id, user_id, copy_id, book_id, media_id)
    SELECT i.waitlist_id, i.user_id, d.held_copy_id, i.book_id, i.media_id
    FROM inserted AS i
    JOIN deleted AS d ON d.waitlist_id = i.waitlist_id
    WHERE d.status = 'ready' AND i.status = 'expired'
    ORDER BY i.waitlist_id;

    IF NOT EXISTS (SELECT 1 FROM @v_expired)
        RETURN;

    UPDATE dbo.waitlist
    SET held_copy_id = NULL
    WHERE waitlist_id IN (SELECT hold_id FROM @v_expired);

    UPDATE c
    SET is_available = 1
    FROM dbo.copies AS c
    WHERE c.copy_id IN (SELECT copy_id FROM @v_expired)
      AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL);

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'trg_hold_expired', 'waitlist',
           CONCAT('Hold ', e.hold_id, ' expired, not picked up in 3 days')
    FROM @v_expired AS e;

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT e.user_id, 'trg_hold_expired',
           CONCAT('Your hold on "', COALESCE(b.title, m.title), '" expired because it was not picked up in 3 days.')
    FROM @v_expired AS e
    LEFT JOIN dbo.book AS b ON b.book_id = e.book_id
    LEFT JOIN dbo.media AS m ON m.media_id = e.media_id;

    DECLARE @n int = 1, @v_book_id int, @v_media_id int;
    WHILE @n <= (SELECT MAX(n) FROM @v_expired)
    BEGIN
        SELECT @v_book_id = book_id, @v_media_id = media_id FROM @v_expired WHERE n = @n;
        EXEC dbo.promote_next_hold @v_book_id, @v_media_id;
        SET @n += 1;
    END;
END;
GO

CREATE   TRIGGER dbo.trg_hold_queue
ON dbo.[loan]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @v_returned TABLE (n int IDENTITY(1,1), copy_id int, book_id int, media_id int);

    INSERT INTO @v_returned (copy_id, book_id, media_id)
    SELECT i.copy_id, c.book_id, c.media_id
    FROM inserted AS i
    JOIN deleted AS d ON d.loan_id = i.loan_id
    JOIN dbo.copies AS c ON c.copy_id = i.copy_id
    WHERE d.return_date IS NULL
      AND i.return_date IS NOT NULL
      AND c.is_active = 1
    ORDER BY i.loan_id;

    IF NOT EXISTS (SELECT 1 FROM @v_returned)
        RETURN;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_pickup_by date = DATEADD(day, 3, @v_today);
    DECLARE @n int = 1, @v_copy_id int, @v_book_id int, @v_media_id int, @v_hold_id int, @v_user_id int;

    WHILE @n <= (SELECT MAX(n) FROM @v_returned)
    BEGIN
        SELECT @v_copy_id = copy_id, @v_book_id = book_id, @v_media_id = media_id
        FROM @v_returned
        WHERE n = @n;

        SET @v_hold_id = NULL;
        SELECT TOP 1 @v_hold_id = waitlist_id, @v_user_id = user_id
        FROM dbo.waitlist
        WHERE status = 'waiting'
          AND (book_id = @v_book_id OR media_id = @v_media_id)
        ORDER BY request_time, waitlist_id;

        IF @v_hold_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM dbo.loan WHERE copy_id = @v_copy_id AND return_date IS NULL)
        BEGIN
            UPDATE dbo.waitlist
            SET status = 'ready', ready_date = @v_today, expiration_date = @v_pickup_by, held_copy_id = @v_copy_id
            WHERE waitlist_id = @v_hold_id;

            UPDATE dbo.copies
            SET is_available = 0
            WHERE copy_id = @v_copy_id;

            INSERT INTO dbo.audit_log (trigger_name, table_name, message)
            VALUES ('trg_hold_queue', 'waitlist',
                    CONCAT('Copy ', @v_copy_id, ' was returned and given to hold ', @v_hold_id, ', first in line'));

            INSERT INTO dbo.notification (user_id, source, message)
            SELECT @v_user_id, 'trg_hold_queue',
                   LEFT(CONCAT('Your book "', COALESCE(b.title, m.title), '" is available. You are first in line. Pick it up at the desk by ',
                               CONVERT(char(10), @v_pickup_by, 110), '.'), 300)
            FROM (SELECT 1 AS one) AS x
            LEFT JOIN dbo.book AS b ON b.book_id = @v_book_id
            LEFT JOIN dbo.media AS m ON m.media_id = @v_media_id;
        END;

        SET @n += 1;
    END;
END;
GO

CREATE   TRIGGER dbo.trg_loan_checkout
ON dbo.[loan]
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted WHERE return_date IS NULL)
        RETURN;

    IF EXISTS (
        SELECT 1 FROM inserted AS i
        JOIN dbo.[user] AS u ON u.user_id = i.user_id
        WHERE i.return_date IS NULL AND u.is_active = 0
    )
        THROW 51001, 'This account is deactivated and cannot borrow items', 1;

    IF EXISTS (
        SELECT 1 FROM inserted AS i
        JOIN dbo.copies AS c ON c.copy_id = i.copy_id
        WHERE i.return_date IS NULL AND c.is_active = 0
    )
        THROW 51002, 'This copy has been withdrawn and cannot be borrowed', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.loan AS l
        JOIN dbo.[user] AS u ON u.user_id = l.user_id
        JOIN dbo.borrow_policy AS bp ON bp.is_faculty = u.is_faculty
        WHERE l.return_date IS NULL
          AND l.user_id IN (SELECT i.user_id FROM inserted AS i WHERE i.return_date IS NULL)
        GROUP BY l.user_id, bp.max_items
        HAVING COUNT(*) > bp.max_items
    )
        THROW 51003, 'Trying to borrow more books? Return one today and experience another book''s world!', 1;

    UPDATE c
    SET is_available = 0
    FROM dbo.copies AS c
    JOIN inserted AS i ON i.copy_id = c.copy_id
    WHERE i.return_date IS NULL;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'trg_loan_checkout', 'loan',
           CONCAT('Loan ', i.loan_id, ': copy ', i.copy_id, ' checked out to user ', i.user_id,
                  ', due ', CONVERT(char(10), i.due_date, 23))
    FROM inserted AS i
    WHERE i.return_date IS NULL;

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT i.user_id, 'trg_loan_checkout',
           CONCAT('You borrowed "', COALESCE(b.title, m.title), '". It is due ',
                  CONVERT(char(10), i.due_date, 101), '.')
    FROM inserted AS i
    JOIN dbo.copies AS c ON c.copy_id = i.copy_id
    LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
    LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
    WHERE i.return_date IS NULL;
END;
GO

CREATE   TRIGGER dbo.trg_loan_return
ON dbo.[loan]
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE f
    SET amount = 5 + DATEDIFF(day, i.due_date, i.return_date) / 7
    FROM dbo.fine AS f
    JOIN inserted AS i ON i.loan_id = f.loan_id
    JOIN deleted AS d ON d.loan_id = i.loan_id
    WHERE d.return_date IS NULL
      AND i.return_date > i.due_date;

    INSERT INTO dbo.fine (loan_id, amount)
    SELECT i.loan_id, 5 + DATEDIFF(day, i.due_date, i.return_date) / 7
    FROM inserted AS i
    JOIN deleted AS d ON d.loan_id = i.loan_id
    WHERE d.return_date IS NULL
      AND i.return_date > i.due_date
      AND NOT EXISTS (SELECT 1 FROM dbo.fine AS f WHERE f.loan_id = i.loan_id);

    UPDATE c
    SET is_available = CASE WHEN EXISTS (
            SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL
        ) OR EXISTS (
            SELECT 1 FROM dbo.waitlist AS w WHERE w.held_copy_id = c.copy_id AND w.status = 'ready'
        ) THEN 0 ELSE 1 END
    FROM dbo.copies AS c
    WHERE c.copy_id IN (SELECT copy_id FROM inserted UNION SELECT copy_id FROM deleted);

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'trg_loan_return', 'loan',
           CONCAT('Loan ', i.loan_id, ': copy ', i.copy_id, ' returned',
                  CASE WHEN f.fine_id IS NOT NULL THEN CONCAT(', final fine $', CAST(f.amount AS int)) ELSE '' END)
    FROM inserted AS i
    JOIN deleted AS d ON d.loan_id = i.loan_id
    LEFT JOIN dbo.fine AS f ON f.loan_id = i.loan_id
    WHERE d.return_date IS NULL AND i.return_date IS NOT NULL;

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT i.user_id, 'trg_loan_return',
           CONCAT('You returned "', COALESCE(b.title, m.title), '".',
                  CASE WHEN f.fine_id IS NOT NULL
                       THEN CONCAT(' It was ', DATEDIFF(day, i.due_date, i.return_date),
                                   ' days late, so your final fine is $', CAST(f.amount AS int), '.')
                       ELSE '' END)
    FROM inserted AS i
    JOIN deleted AS d ON d.loan_id = i.loan_id
    JOIN dbo.copies AS c ON c.copy_id = i.copy_id
    LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
    LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
    LEFT JOIN dbo.fine AS f ON f.loan_id = i.loan_id
    WHERE d.return_date IS NULL AND i.return_date IS NOT NULL;
END;
GO

CREATE   TRIGGER dbo.trg_room_reservations_overlap
ON dbo.[room_reservations]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted AS i
        JOIN dbo.room_reservations AS r
          ON r.room_id = i.room_id
         AND r.reservation_id <> i.reservation_id
         AND r.start_time < i.end_time
         AND r.end_time > i.start_time
        WHERE i.is_active = 1
          AND r.is_active = 1
    )
        THROW 51004, 'Room is already booked during that time', 1;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'trg_room_reservations_overlap', 'room_reservations',
           CASE WHEN i.is_active = 1
                THEN CONCAT('Reservation ', i.reservation_id, ': room ', i.room_id,
                            ' booked by user ', i.user_id, ', no overlap')
                ELSE CONCAT('Reservation ', i.reservation_id, ': cancelled')
           END
    FROM inserted AS i;

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT i.user_id, 'trg_room_reservations_overlap',
           CASE WHEN i.is_active = 1
                THEN CONCAT('Room ', r.room_number, ' is booked for you on ',
                            CONVERT(char(16), i.start_time, 120), '.')
                ELSE CONCAT('Your booking for room ', r.room_number, ' on ',
                            CONVERT(char(16), i.start_time, 120), ' was cancelled.')
           END
    FROM inserted AS i
    JOIN dbo.room AS r ON r.room_id = i.room_id;
END;
GO
