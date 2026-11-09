CREATE OR ALTER PROCEDURE dbo.send_due_reminders
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

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'Vercel')
    GRANT EXECUTE ON dbo.send_due_reminders TO [Vercel];
GO

SELECT
    (SELECT COUNT(*) FROM sys.procedures WHERE name = 'send_due_reminders') AS reminder_procedure_expect_1,
    (SELECT COUNT(*) FROM sys.database_permissions pe JOIN sys.database_principals p ON p.principal_id = pe.grantee_principal_id
     WHERE p.name = 'Vercel' AND pe.permission_name = 'EXECUTE' AND pe.major_id = OBJECT_ID('dbo.send_due_reminders')) AS vercel_can_run_it_expect_1;
