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
        SELECT TOP 1 c.copy_id
        FROM dbo.copies AS c
        WHERE c.is_active = 1
          AND c.is_available = 1
          AND (c.book_id = @p_book_id OR c.media_id = @p_media_id)
        ORDER BY c.copy_id
    );
    IF @v_copy_id IS NULL
        THROW 51011, 'No copy is available right now', 1;

    DECLARE @v_today date = CAST(GETDATE() AS date);
    DECLARE @v_due date = DATEADD(day, @v_days, @v_today);

    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    VALUES (@p_user_id, @v_copy_id, @v_today, @v_due);
    DECLARE @v_loan_id int = CAST(SCOPE_IDENTITY() AS int);

    UPDATE dbo.waitlist
    SET status = 'fulfilled'
    WHERE user_id = @p_user_id
      AND status = 'waiting'
      AND (book_id = @p_book_id OR media_id = @p_media_id);

    SELECT @v_loan_id AS loan_id, @v_due AS due_date;
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

    UPDATE dbo.loan
    SET return_date = CAST(GETDATE() AS date)
    WHERE loan_id = @p_loan_id;

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

    INSERT INTO dbo.receipts (payment_id, transaction_code)
    VALUES (@v_payment_id, CONCAT('TXN-', CONVERT(char(8), GETDATE(), 112), '-', RIGHT(CONCAT('0000', @v_payment_id), 4)));
    DECLARE @v_receipt_id int = CAST(SCOPE_IDENTITY() AS int);

    COMMIT TRANSACTION;

    SELECT @v_receipt_id AS receipt_id, @v_owed AS amount_paid;
END;
GO
