-- team8_azure_migration_9.sql: hold expiry is now a trigger (trg_hold_expired).
-- dbo.expire_holds only marks old ready holds as 'expired'. The daily job runs it every morning.
-- That change fires trg_hold_expired: it frees the copy, gives it to the next person in line,
-- tells the member and writes to audit_log.
-- Run after team8_azure_migration_7.sql (8 is the reset button, not needed). Safe to run again.
-- Test first with team8_hold_trigger_test.sql (it rolls everything back).

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

-- check: both should show 1
SELECT
    (SELECT COUNT(*) FROM sys.triggers WHERE name = 'trg_hold_expired') AS hold_trigger_expect_1,
    (SELECT COUNT(*) FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.expire_holds')
       AND definition LIKE '%OUTPUT inserted.waitlist_id%') AS new_expire_holds_expect_1;
