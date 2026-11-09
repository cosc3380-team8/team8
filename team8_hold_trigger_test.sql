SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

IF @@TRANCOUNT = 0 SET NOEXEC ON;
GO

CREATE OR ALTER PROCEDURE dbo.expire_holds
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

IF @@TRANCOUNT = 0 SET NOEXEC ON;
GO

CREATE OR ALTER TRIGGER dbo.trg_hold_expired
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

IF @@TRANCOUNT = 0 SET NOEXEC ON;
GO

CREATE PROCEDURE #hold_test
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @book int, @copy int, @copy2 int, @title nvarchar(150), @u1 int, @u2 int, @h1 int, @h2 int;
    DECLARE @n0 int, @n1 int, @a0 int;
    DECLARE @r TABLE (step int IDENTITY(1,1), what nvarchar(200), expected nvarchar(60), got nvarchar(60));

    SELECT TOP 1 @book = b.book_id, @copy = c.copy_id, @title = b.title
    FROM dbo.book AS b
    JOIN dbo.copies AS c ON c.book_id = b.book_id
    WHERE b.is_active = 1 AND c.is_active = 1 AND c.is_available = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL)
      AND NOT EXISTS (SELECT 1 FROM dbo.waitlist AS w WHERE w.book_id = b.book_id AND w.status IN ('waiting', 'ready'))
    ORDER BY c.copy_id;

    SELECT TOP 1 @u1 = user_id FROM dbo.[user] WHERE is_active = 1 ORDER BY user_id;
    SELECT TOP 1 @u2 = user_id FROM dbo.[user] WHERE is_active = 1 AND user_id > @u1 ORDER BY user_id;

    IF @book IS NULL OR @u2 IS NULL
        THROW 50999, 'The test needs a book with a free copy and nobody waiting, and 2 members.', 1;

    INSERT INTO dbo.waitlist (user_id, book_id, request_time, status, ready_date, expiration_date, held_copy_id)
    VALUES (@u1, @book, DATEADD(day, -6, SYSDATETIME()), 'ready', DATEADD(day, -4, @today), DATEADD(day, -1, @today), @copy);
    SET @h1 = CAST(SCOPE_IDENTITY() AS int);
    UPDATE dbo.copies SET is_available = 0 WHERE copy_id = @copy;

    INSERT INTO dbo.waitlist (user_id, book_id, request_time, status)
    VALUES (@u2, @book, DATEADD(day, -5, SYSDATETIME()), 'waiting');
    SET @h2 = CAST(SCOPE_IDENTITY() AS int);

    SET @n0 = (SELECT ISNULL(MAX(notification_id), 0) FROM dbo.notification);
    SET @a0 = (SELECT ISNULL(MAX(log_id), 0) FROM dbo.audit_log);

    EXEC dbo.expire_holds;
    INSERT INTO @r (what, expected, got) VALUES
        ('Hold 1 ran out yesterday: status', 'expired', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h1)),
        ('Hold 1: copy is no longer held for them', 'none', ISNULL((SELECT CAST(held_copy_id AS nvarchar(60)) FROM dbo.waitlist WHERE waitlist_id = @h1), 'none')),
        ('Hold 1: member is told it expired', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @u1 AND source = 'trg_hold_expired' AND message LIKE '%' + @title + '%') THEN 'yes' ELSE 'no' END),
        ('Hold 1: trigger wrote to audit_log', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.audit_log WHERE log_id > @a0 AND trigger_name = 'trg_hold_expired' AND message LIKE CONCAT('Hold ', @h1, ' %')) THEN 'yes' ELSE 'no' END),
        ('Hold 2 (next in line): status', 'ready', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h2)),
        ('Hold 2: pick up by', CONVERT(nvarchar(60), DATEADD(day, 3, @today), 23), (SELECT CONVERT(nvarchar(60), expiration_date, 23) FROM dbo.waitlist WHERE waitlist_id = @h2)),
        ('Hold 2: member is told it is ready', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @u2 AND source = 'sp_promote_next_hold' AND message LIKE '%' + @title + '%') THEN 'yes' ELSE 'no' END);

    SET @n1 = (SELECT ISNULL(MAX(notification_id), 0) FROM dbo.notification);
    EXEC dbo.expire_holds;
    INSERT INTO @r (what, expected, got) VALUES
        ('Runs again same day: hold 2 is still', 'ready', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h2)),
        ('Runs again same day: new messages', '0', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n1 AND user_id IN (@u1, @u2)) AS nvarchar(60)));

    SET @copy2 = (SELECT held_copy_id FROM dbo.waitlist WHERE waitlist_id = @h2);
    UPDATE dbo.waitlist SET expiration_date = DATEADD(day, -1, @today) WHERE waitlist_id = @h2;
    EXEC dbo.expire_holds;
    INSERT INTO @r (what, expected, got) VALUES
        ('Hold 2 ran out too: status', 'expired', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h2)),
        ('Nobody waiting: copy is back on the shelf', 'yes', CASE WHEN (SELECT is_available FROM dbo.copies WHERE copy_id = @copy2) = 1 THEN 'yes' ELSE 'no' END);

    SELECT step, what, expected, got,
           CASE WHEN expected = got THEN 'PASS' ELSE 'FAIL' END AS result
    FROM @r ORDER BY step;

    SELECT notification_id, user_id, source, message
    FROM dbo.notification
    WHERE notification_id > @n0 AND user_id IN (@u1, @u2) AND source IN ('trg_hold_expired', 'sp_promote_next_hold')
    ORDER BY notification_id;
END;
GO

EXEC #hold_test;
GO

IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
GO

SET NOEXEC OFF;
GO
SET XACT_ABORT OFF;
GO

SELECT @@TRANCOUNT AS open_transactions_expect_0,
       (SELECT COUNT(*) FROM sys.triggers WHERE name = 'trg_hold_expired') AS trigger_saved_expect_0;
