DECLARE @waitlist_chk sysname = (
    SELECT name FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.waitlist') AND definition LIKE '%status%');
IF @waitlist_chk IS NOT NULL
    EXEC('ALTER TABLE dbo.[waitlist] DROP CONSTRAINT ' + @waitlist_chk);
GO

ALTER TABLE dbo.[waitlist] ADD CONSTRAINT [waitlist_chk_status]
    CHECK ([status] IN (N'waiting', N'ready', N'fulfilled', N'cancelled', N'expired'));
ALTER TABLE dbo.[waitlist] ADD
    [ready_date] date NULL,
    [expiration_date] date NULL,
    [held_copy_id] int NULL CONSTRAINT [waitlist_ibfk_4] FOREIGN KEY REFERENCES dbo.[copies] ([copy_id]);
GO

UPDATE dbo.[borrow_policy] SET [loan_days] = 30 WHERE [is_faculty] = 1;
GO

CREATE OR ALTER PROCEDURE dbo.promote_next_hold
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

    DECLARE @v_today date = CAST(GETDATE() AS date);
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

CREATE OR ALTER PROCEDURE dbo.release_hold
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

CREATE OR ALTER PROCEDURE dbo.expire_holds
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @v_count int = 0, @v_hold_id int;

    WHILE 1 = 1
    BEGIN
        SET @v_hold_id = NULL;
        SELECT TOP 1 @v_hold_id = waitlist_id
        FROM dbo.waitlist
        WHERE status = 'ready' AND expiration_date < CAST(GETDATE() AS date);
        IF @v_hold_id IS NULL BREAK;

        EXEC dbo.release_hold @v_hold_id, 'expired';
        INSERT INTO dbo.audit_log (trigger_name, table_name, message)
        VALUES ('hold_expiry', 'waitlist', CONCAT('Hold ', @v_hold_id, ' expired (not picked up in time).'));
        SET @v_count += 1;
    END;

    SELECT @v_count AS expired;
END;
GO

CREATE OR ALTER PROCEDURE dbo.checkout_item
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

    DECLARE @v_today date = CAST(GETDATE() AS date);
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

CREATE OR ALTER PROCEDURE dbo.return_loan
    @p_loan_id int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.loan WHERE loan_id = @p_loan_id AND return_date IS NULL)
        THROW 51012, 'This item was already returned', 1;

    DECLARE @v_book_id int, @v_media_id int;
    SELECT @v_book_id = c.book_id, @v_media_id = c.media_id
    FROM dbo.loan AS l
    JOIN dbo.copies AS c ON c.copy_id = l.copy_id
    WHERE l.loan_id = @p_loan_id;

    UPDATE dbo.loan
    SET return_date = CAST(GETDATE() AS date)
    WHERE loan_id = @p_loan_id;

    EXEC dbo.promote_next_hold @v_book_id, @v_media_id;

    SELECT fine_id, loan_id, amount
    FROM dbo.fine
    WHERE loan_id = @p_loan_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.pay_fine
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

    DECLARE @v_code nvarchar(50) = CONCAT('TXN-', CONVERT(char(8), GETDATE(), 112), '-', RIGHT(CONCAT('0000', @v_payment_id), 4));
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

SELECT
    (SELECT COUNT(*) FROM sys.tables WHERE name IN ('notification', 'audit_log')) AS tables_expect_2,
    (SELECT COUNT(*) FROM sys.procedures WHERE name IN ('promote_next_hold', 'release_hold', 'expire_holds', 'checkout_item', 'return_loan', 'pay_fine')) AS procedures_expect_6,
    (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payments') AND name = 'staff_id') AS staff_id_expect_1;
