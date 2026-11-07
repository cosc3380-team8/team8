-- team8_azure_migration_6.sql: the 2-day due reminder.
-- Checkpoint 1 rule: a member is told "(book name) must be returned in 2 days".
-- Run after team8_azure_migration_5.sql. Safe to run again.
--
-- Azure SQL Database has no job scheduler (no SQL Agent), so nothing can run this at a set time.
-- Instead the server runs it each time a member's notifications are loaded (server/api/notifications.js).
-- The NOT EXISTS check makes sure each loan gets the reminder only once.
-- To send reminders to everyone by hand: EXEC dbo.send_due_reminders;

CREATE OR ALTER PROCEDURE dbo.send_due_reminders
    @p_user_id int = NULL   -- NULL = every member
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- "today" in Houston, not the server's UTC date
    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @v_sent TABLE (user_id int, message nvarchar(300));

    BEGIN TRANSACTION;

    -- one reminder per open loan that is due exactly 2 days from today
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
    -- skip loans that already got this reminder (the lock stops two page loads from both sending it)
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

-- the website's server logs in as [Vercel], which can only run procedures it was given one by one
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'Vercel')
    GRANT EXECUTE ON dbo.send_due_reminders TO [Vercel];
GO

-- check: both should show 1
SELECT
    (SELECT COUNT(*) FROM sys.procedures WHERE name = 'send_due_reminders') AS reminder_procedure_expect_1,
    (SELECT COUNT(*) FROM sys.database_permissions pe JOIN sys.database_principals p ON p.principal_id = pe.grantee_principal_id
     WHERE p.name = 'Vercel' AND pe.permission_name = 'EXECUTE' AND pe.major_id = OBJECT_ID('dbo.send_due_reminders')) AS vercel_can_run_it_expect_1;
