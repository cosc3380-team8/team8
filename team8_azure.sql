-- Team 8: Azure SQL Database version of the supplied MySQL schema.
-- Connect directly to an EMPTY project database, not master. Run this file once.
-- No rows are included. GO separates batches; run with DataGrip's script runner.
-- Use dbo.save_room_reservation for bookings; direct writes bypass its check.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

CREATE TABLE dbo.[user] (
    [user_id] int IDENTITY(1,1) NOT NULL,
    [first_name] nvarchar(30) NOT NULL,
    [last_name] nvarchar(30) NOT NULL,
    [email] nvarchar(100) NOT NULL,
    [password] nvarchar(255) NOT NULL,
    [is_faculty] bit NOT NULL,
    PRIMARY KEY ([user_id]),
    CONSTRAINT [uq_user_email] UNIQUE ([email])
);

CREATE TABLE dbo.[staff] (
    [staff_id] int IDENTITY(1,1) NOT NULL,
    [first_name] nvarchar(30) NOT NULL,
    [last_name] nvarchar(30) NOT NULL,
    [email] nvarchar(100) NOT NULL,
    [password] nvarchar(255) NOT NULL,
    [is_admin] bit NOT NULL,
    PRIMARY KEY ([staff_id]),
    CONSTRAINT [uq_staff_email] UNIQUE ([email])
);

CREATE TABLE dbo.[author] (
    [author_id] int IDENTITY(1,1) NOT NULL,
    [first_name] nvarchar(50) NOT NULL,
    [last_name] nvarchar(50) NOT NULL,
    PRIMARY KEY ([author_id])
);

CREATE TABLE dbo.[book] (
    [book_id] int IDENTITY(1,1) NOT NULL,
    [title] nvarchar(150) NOT NULL,
    [publisher] nvarchar(100) NULL DEFAULT NULL,
    [isbn] nvarchar(13) NULL DEFAULT NULL,
    [publish_year] int NULL DEFAULT NULL,
    PRIMARY KEY ([book_id])
);

CREATE TABLE dbo.[media] (
    [media_id] int IDENTITY(1,1) NOT NULL,
    [title] nvarchar(150) NOT NULL,
    [is_dvd] bit NOT NULL,
    PRIMARY KEY ([media_id])
);

CREATE TABLE dbo.[room] (
    [room_id] int IDENTITY(1,1) NOT NULL,
    [room_number] nvarchar(10) NOT NULL,
    [capacity] int NOT NULL,
    PRIMARY KEY ([room_id]),
    CONSTRAINT [uq_room_room_number] UNIQUE ([room_number]),
    CONSTRAINT [room_chk_1] CHECK (([capacity] > 0))
);

CREATE TABLE dbo.[book_author] (
    [book_id] int NOT NULL,
    [author_id] int NOT NULL,
    PRIMARY KEY ([book_id],[author_id]),
    CONSTRAINT [book_author_ibfk_1] FOREIGN KEY ([book_id]) REFERENCES dbo.[book] ([book_id]),
    CONSTRAINT [book_author_ibfk_2] FOREIGN KEY ([author_id]) REFERENCES dbo.[author] ([author_id])
);

CREATE TABLE dbo.[copies] (
    [copy_id] int IDENTITY(1,1) NOT NULL,
    [book_id] int NULL DEFAULT NULL,
    [is_available] bit NOT NULL DEFAULT 1,
    [media_id] int NULL DEFAULT NULL,
    PRIMARY KEY ([copy_id]),
    CONSTRAINT [copies_ibfk_1] FOREIGN KEY ([book_id]) REFERENCES dbo.[book] ([book_id]),
    CONSTRAINT [copies_ibfk_2] FOREIGN KEY ([media_id]) REFERENCES dbo.[media] ([media_id]),
    CONSTRAINT [copies_chk_1] CHECK (((([book_id] is not null) and ([media_id] is null)) or (([book_id] is null) and ([media_id] is not null))))
);

CREATE TABLE dbo.[room_reservations] (
    [reservation_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [room_id] int NOT NULL,
    [start_time] datetime2(0) NOT NULL,
    [end_time] datetime2(0) NOT NULL,
    PRIMARY KEY ([reservation_id]),
    CONSTRAINT [room_reservations_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES dbo.[user] ([user_id]),
    CONSTRAINT [room_reservations_ibfk_2] FOREIGN KEY ([room_id]) REFERENCES dbo.[room] ([room_id]),
    CONSTRAINT [room_reservations_chk_1] CHECK (([end_time] > [start_time]))
);

CREATE TABLE dbo.[loan] (
    [loan_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [copy_id] int NOT NULL,
    [borrow_date] date NOT NULL,
    [due_date] date NOT NULL,
    [return_date] date NULL DEFAULT NULL,
    [active_copy_id] AS (CASE WHEN [return_date] IS NULL THEN [copy_id] ELSE NULL END),
    PRIMARY KEY ([loan_id]),
    CONSTRAINT [loan_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES dbo.[user] ([user_id]),
    CONSTRAINT [loan_ibfk_2] FOREIGN KEY ([copy_id]) REFERENCES dbo.[copies] ([copy_id]),
    CONSTRAINT [loan_chk_1] CHECK (([due_date] > [borrow_date])),
    CONSTRAINT [loan_chk_2] CHECK ((([return_date] is null) or ([return_date] >= [borrow_date])))
);

CREATE TABLE dbo.[waitlist] (
    [waitlist_id] int IDENTITY(1,1) NOT NULL,
    [user_id] int NOT NULL,
    [book_id] int NULL DEFAULT NULL,
    [media_id] int NULL DEFAULT NULL,
    [request_time] datetime2(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [status] nvarchar(9) NOT NULL DEFAULT 'waiting' CHECK ([status] IN (N'waiting', N'fulfilled', N'cancelled')),
    PRIMARY KEY ([waitlist_id]),
    CONSTRAINT [waitlist_ibfk_1] FOREIGN KEY ([user_id]) REFERENCES dbo.[user] ([user_id]),
    CONSTRAINT [waitlist_ibfk_2] FOREIGN KEY ([book_id]) REFERENCES dbo.[book] ([book_id]),
    CONSTRAINT [waitlist_ibfk_3] FOREIGN KEY ([media_id]) REFERENCES dbo.[media] ([media_id]),
    CONSTRAINT [waitlist_chk_1] CHECK (((([book_id] is not null) and ([media_id] is null)) or (([book_id] is null) and ([media_id] is not null))))
);

CREATE TABLE dbo.[fine] (
    [fine_id] int IDENTITY(1,1) NOT NULL,
    [loan_id] int NOT NULL,
    [amount] decimal(8,2) NOT NULL,
    PRIMARY KEY ([fine_id]),
    CONSTRAINT [uq_fine_loan_id] UNIQUE ([loan_id]),
    CONSTRAINT [fine_ibfk_1] FOREIGN KEY ([loan_id]) REFERENCES dbo.[loan] ([loan_id]),
    CONSTRAINT [fine_chk_1] CHECK (([amount] > 0))
);

CREATE TABLE dbo.[payments] (
    [payment_id] int IDENTITY(1,1) NOT NULL,
    [fine_id] int NOT NULL,
    [user_id] int NOT NULL,
    [amount_paid] decimal(8,2) NOT NULL,
    [payment_date] datetime2(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [payment_method] nvarchar(4) NOT NULL CHECK ([payment_method] IN (N'cash', N'card')),
    PRIMARY KEY ([payment_id]),
    CONSTRAINT [payments_ibfk_1] FOREIGN KEY ([fine_id]) REFERENCES dbo.[fine] ([fine_id]),
    CONSTRAINT [payments_ibfk_2] FOREIGN KEY ([user_id]) REFERENCES dbo.[user] ([user_id]),
    CONSTRAINT [payments_chk_1] CHECK (([amount_paid] > 0))
);

CREATE TABLE dbo.[receipts] (
    [receipt_id] int IDENTITY(1,1) NOT NULL,
    [payment_id] int NOT NULL,
    [issue_date] datetime2(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [transaction_code] nvarchar(50) NOT NULL,
    PRIMARY KEY ([receipt_id]),
    CONSTRAINT [uq_receipts_payment_id] UNIQUE ([payment_id]),
    CONSTRAINT [uq_receipts_transaction_code] UNIQUE ([transaction_code]),
    CONSTRAINT [receipts_ibfk_1] FOREIGN KEY ([payment_id]) REFERENCES dbo.[payments] ([payment_id])
);

CREATE UNIQUE INDEX [isbn] ON dbo.[book] ([isbn]) WHERE [isbn] IS NOT NULL;
CREATE INDEX [ix_book_author_author_id] ON dbo.[book_author] (author_id);
CREATE INDEX [ix_copies_book_id] ON dbo.[copies] (book_id);
CREATE INDEX [ix_copies_media_id] ON dbo.[copies] (media_id);
CREATE INDEX [ix_room_reservations_user_id] ON dbo.[room_reservations] (user_id);
CREATE INDEX [ix_room_reservations_room_id] ON dbo.[room_reservations] (room_id);
CREATE INDEX [ix_loan_user_id] ON dbo.[loan] (user_id);
CREATE INDEX [ix_loan_copy_id] ON dbo.[loan] (copy_id);
CREATE INDEX [ix_waitlist_user_id] ON dbo.[waitlist] (user_id);
CREATE INDEX [ix_waitlist_book_id] ON dbo.[waitlist] (book_id);
CREATE INDEX [ix_waitlist_media_id] ON dbo.[waitlist] (media_id);
CREATE INDEX [ix_payments_fine_id] ON dbo.[payments] (fine_id);
CREATE INDEX [ix_payments_user_id] ON dbo.[payments] (user_id);
CREATE UNIQUE INDEX [one_active_loan_per_copy] ON dbo.[loan] ([copy_id]) WHERE [return_date] IS NULL;
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

CREATE PROCEDURE dbo.save_room_reservation
    @p_reservation_id int,
    @p_user_id int,
    @p_room_id int,
    @p_start datetime2(0),
    @p_end datetime2(0)
AS
BEGIN
    SET NOCOUNT ON;
    -- This procedure owns its transaction; call it with autocommit enabled.
    IF @@TRANCOUNT <> 0
        THROW 50001, 'Call this procedure outside an existing transaction', 1;
    SET XACT_ABORT ON;
    IF @p_start IS NULL OR @p_end IS NULL OR @p_end <= @p_start
        THROW 50002, 'End time must be after start time', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @v_room int = NULL, @v_existing int = NULL;
        -- Every caller locks the target room before checking bookings.
        -- HOLDLOCK keeps the lock until commit, including on Azure with RCSI.
        SELECT @v_room = room_id
        FROM dbo.room WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id = @p_room_id;
        IF @v_room IS NULL
            THROW 50003, 'Room does not exist', 1;

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
