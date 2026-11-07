-- team8_fines_test.sql: tests team8_azure_migration_7.sql WITHOUT saving anything.
-- It runs the same code inside one transaction, makes test loans, checks every step, then ROLLBACK
-- undoes all of it: the new procedure, the trigger change and the test loans are all gone after.
--
-- How: open it in DataGrip on the Azure database and run the whole file. It takes a few seconds,
-- and the website waits for loans while it runs.
-- Read the result table: every row should say PASS. The last result must say open_transactions = 0
-- and procedure_saved = 0 (nothing was saved).
-- If anything turns red: run  ROLLBACK;  (or close this console). Nothing is saved.
--
-- The procedure and trigger below are copied from team8_azure_migration_7.sql, word for word.

SET XACT_ABORT ON;   -- any error undoes everything at once
BEGIN TRANSACTION;
GO

-- safety: if the transaction is not open, skip everything below (nothing runs, nothing is saved)
IF @@TRANCOUNT = 0 SET NOEXEC ON;
GO

CREATE OR ALTER PROCEDURE dbo.update_overdue_fines
    @p_user_id int = NULL   -- NULL = every member
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- "today" in Houston, not the server's UTC date
    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    -- the fines this run made or raised, so each member is told once
    DECLARE @v_changed TABLE (loan_id int, amount decimal(8,2));

    BEGIN TRANSACTION;

    -- 1. a late item that already has a fine: raise it when a new full week has passed (never lower it)
    UPDATE f
    SET amount = 5 + DATEDIFF(day, l.due_date, @v_today) / 7
    OUTPUT inserted.loan_id, inserted.amount INTO @v_changed (loan_id, amount)
    FROM dbo.fine AS f
    JOIN dbo.loan AS l ON l.loan_id = f.loan_id
    WHERE l.return_date IS NULL
      AND l.due_date < @v_today
      AND (@p_user_id IS NULL OR l.user_id = @p_user_id)
      AND f.amount < 5 + DATEDIFF(day, l.due_date, @v_today) / 7;

    -- 2. an item that just became late: its fine starts at $5 (the lock stops two logins from both adding it)
    INSERT INTO dbo.fine (loan_id, amount)
    OUTPUT inserted.loan_id, inserted.amount INTO @v_changed (loan_id, amount)
    SELECT l.loan_id, 5 + DATEDIFF(day, l.due_date, @v_today) / 7
    FROM dbo.loan AS l
    WHERE l.return_date IS NULL
      AND l.due_date < @v_today
      AND (@p_user_id IS NULL OR l.user_id = @p_user_id)
      AND NOT EXISTS (SELECT 1 FROM dbo.fine AS f WITH (UPDLOCK, HOLDLOCK) WHERE f.loan_id = l.loan_id);

    -- 3. tell the member, and log it
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

-- same trigger as team8_azure_migration.sql, with one new step: if the item already has a fine
-- (made by update_overdue_fines while it was late), set it to the final amount
CREATE OR ALTER TRIGGER dbo.trg_loan_return
ON dbo.[loan]
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- the final fine, from the real return date. A fine that grew while the item was out is set
    -- to this amount, and it never changes after this.
    UPDATE f
    SET amount = 5 + DATEDIFF(day, i.due_date, i.return_date) / 7
    FROM dbo.fine AS f
    JOIN inserted AS i ON i.loan_id = f.loan_id
    JOIN deleted AS d ON d.loan_id = i.loan_id
    WHERE d.return_date IS NULL
      AND i.return_date > i.due_date;

    -- late, but no fine yet (the member never logged in while it was late): add it
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


IF @@TRANCOUNT = 0 SET NOEXEC ON;
GO

-- the test, as a temporary procedure (it lives only in this console and is rolled back too)
CREATE PROCEDURE #fines_test
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
    DECLARE @user int, @a int, @b int, @c int, @d int, @n0 int, @n1 int;
    DECLARE @copies TABLE (n int, copy_id int);
    DECLARE @r TABLE (step int IDENTITY(1,1), what nvarchar(200), expected nvarchar(60), got nvarchar(60));

    -- a member with room for 3 more loans, and 4 copies on the shelf
    SELECT TOP 1 @user = u.user_id
    FROM dbo.[user] AS u
    JOIN dbo.borrow_policy AS bp ON bp.is_faculty = u.is_faculty
    WHERE u.is_active = 1
      AND (SELECT COUNT(*) FROM dbo.loan AS l WHERE l.user_id = u.user_id AND l.return_date IS NULL) + 3 <= bp.max_items
    ORDER BY u.user_id;

    INSERT INTO @copies (n, copy_id)
    SELECT TOP 4 ROW_NUMBER() OVER (ORDER BY c.copy_id), c.copy_id
    FROM dbo.copies AS c
    WHERE c.is_active = 1 AND c.is_available = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL)
    ORDER BY c.copy_id;

    IF @user IS NULL OR (SELECT COUNT(*) FROM @copies) < 4
        THROW 50999, 'The test needs a member with 3 free loan slots and 4 copies on the shelf.', 1;

    -- A: 17 days late. B: 3 days late. C: due tomorrow.
    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    SELECT @user, copy_id, DATEADD(day, -40, @today), DATEADD(day, -17, @today) FROM @copies WHERE n = 1;
    SET @a = CAST(SCOPE_IDENTITY() AS int);
    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    SELECT @user, copy_id, DATEADD(day, -40, @today), DATEADD(day, -3, @today) FROM @copies WHERE n = 2;
    SET @b = CAST(SCOPE_IDENTITY() AS int);
    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    SELECT @user, copy_id, DATEADD(day, -19, @today), DATEADD(day, 1, @today) FROM @copies WHERE n = 3;
    SET @c = CAST(SCOPE_IDENTITY() AS int);

    SET @n0 = (SELECT ISNULL(MAX(notification_id), 0) FROM dbo.notification);

    -- 1. first login
    EXEC dbo.update_overdue_fines @p_user_id = @user;
    INSERT INTO @r (what, expected, got) VALUES
        ('Login 1: 17 days late', '$7', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @a), 'no fine')),
        ('Login 1: 3 days late (fine starts right away)', '$5', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @b), 'no fine')),
        ('Login 1: due tomorrow', 'no fine', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @c), 'no fine')),
        ('Login 1: fine notifications sent', '2', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n0 AND source = 'sp_update_overdue_fines' AND user_id = @user) AS nvarchar(60))),
        ('Login 1: message says "is now $7."', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @user AND message LIKE '%is now $7.%') THEN 'yes' ELSE 'no' END);

    -- 2. log in again the same day: nothing changes, nobody is told twice
    EXEC dbo.update_overdue_fines @p_user_id = @user;
    INSERT INTO @r (what, expected, got) VALUES
        ('Login 2, same day: still', '$7', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @a), 'no fine')),
        ('Login 2, same day: fine notifications in total', '2', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n0 AND source = 'sp_update_overdue_fines' AND user_id = @user) AS nvarchar(60)));

    -- 3. a week later (move the due date back): the fine goes up and the member is told
    UPDATE dbo.loan SET due_date = DATEADD(day, -21, @today) WHERE loan_id = @a;
    EXEC dbo.update_overdue_fines @p_user_id = @user;
    INSERT INTO @r (what, expected, got) VALUES
        ('A week later (21 days late)', '$8', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @a), 'no fine')),
        ('A week later: fine notifications in total', '3', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n0 AND source = 'sp_update_overdue_fines' AND user_id = @user) AS nvarchar(60))),
        ('A week later: message says "is now $8."', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @user AND message LIKE '%is now $8.%') THEN 'yes' ELSE 'no' END);

    -- 4. returned today: the trigger locks the final fine
    UPDATE dbo.loan SET return_date = @today WHERE loan_id = @a;
    INSERT INTO @r (what, expected, got) VALUES
        ('Returned 21 days late: final fine', '$8', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @a), 'no fine')),
        ('Returned: message says "final fine is $8."', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @user AND source = 'trg_loan_return' AND message LIKE '%final fine is $8.%') THEN 'yes' ELSE 'no' END);

    -- 5. after the return, logins never change it again (even with an older due date)
    UPDATE dbo.loan SET due_date = DATEADD(day, -30, @today) WHERE loan_id = @a;
    EXEC dbo.update_overdue_fines @p_user_id = @user;
    INSERT INTO @r (what, expected, got) VALUES
        ('After return: login does not change it', '$8', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @a), 'no fine'));

    -- 6. B had $5, then nobody logged in for 2 weeks: the return still sets the right final fine
    UPDATE dbo.loan SET due_date = DATEADD(day, -15, @today) WHERE loan_id = @b;
    UPDATE dbo.loan SET return_date = @today WHERE loan_id = @b;
    INSERT INTO @r (what, expected, got) VALUES
        ('No login for 2 weeks, returned 15 days late', '$7', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @b), 'no fine'));

    -- 7. C never had a fine, returned 10 days late: the trigger adds it
    UPDATE dbo.loan SET due_date = DATEADD(day, -10, @today) WHERE loan_id = @c;
    UPDATE dbo.loan SET return_date = @today WHERE loan_id = @c;
    INSERT INTO @r (what, expected, got) VALUES
        ('No fine yet, returned 10 days late', '$6', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @c), 'no fine'));

    -- 8. D is returned early: no fine
    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    SELECT @user, copy_id, DATEADD(day, -10, @today), DATEADD(day, 5, @today) FROM @copies WHERE n = 4;
    SET @d = CAST(SCOPE_IDENTITY() AS int);
    UPDATE dbo.loan SET return_date = @today WHERE loan_id = @d;
    INSERT INTO @r (what, expected, got) VALUES
        ('Returned early', 'no fine', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @d), 'no fine'));

    -- 9. preview: the real members whose fine would be made or raised at the next login
    SET @n1 = (SELECT ISNULL(MAX(notification_id), 0) FROM dbo.notification);
    EXEC dbo.update_overdue_fines;
    INSERT INTO @r (what, expected, got) VALUES
        ('Preview: real late items that get a fine at the next login', 'info', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n1 AND source = 'sp_update_overdue_fines') AS nvarchar(60)));

    SELECT step, what, expected, got,
           CASE WHEN expected = 'info' THEN 'info' WHEN expected = got THEN 'PASS' ELSE 'FAIL' END AS result
    FROM @r ORDER BY step;

    -- the words the member sees (test loans first, then the preview for real members)
    SELECT notification_id, user_id, source, message
    FROM dbo.notification
    WHERE notification_id > @n0 AND source IN ('sp_update_overdue_fines', 'trg_loan_return')
    ORDER BY notification_id;
END;
GO

EXEC #fines_test;
GO

-- undo everything: the test loans, the fines, the messages, the new procedure and the trigger change
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
GO

SET NOEXEC OFF;
GO
SET XACT_ABORT OFF;
GO

-- must show 0 and 0: nothing was saved
SELECT @@TRANCOUNT AS open_transactions_expect_0,
       (SELECT COUNT(*) FROM sys.procedures WHERE name = 'update_overdue_fines') AS procedure_saved_expect_0;
