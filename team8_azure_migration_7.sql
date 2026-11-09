CREATE OR ALTER PROCEDURE dbo.update_overdue_fines
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

CREATE OR ALTER TRIGGER dbo.trg_loan_return
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

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'Vercel')
    GRANT EXECUTE ON dbo.update_overdue_fines TO [Vercel];
GO

SELECT
    (SELECT COUNT(*) FROM sys.procedures WHERE name = 'update_overdue_fines') AS fines_procedure_expect_1,
    (SELECT COUNT(*) FROM sys.database_permissions pe JOIN sys.database_principals p ON p.principal_id = pe.grantee_principal_id
     WHERE p.name = 'Vercel' AND pe.permission_name = 'EXECUTE' AND pe.major_id = OBJECT_ID('dbo.update_overdue_fines')) AS vercel_can_run_it_expect_1,
    (SELECT COUNT(*) FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.trg_loan_return')
       AND definition LIKE '%final fine is%') AS new_return_trigger_expect_1;
