SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @r TABLE (step int IDENTITY(1,1), what nvarchar(200), expected nvarchar(60), got nvarchar(400));
DECLARE @today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);
DECLARE @book int, @copy int, @book2 int, @copy2 int, @u1 int, @u2 int, @u3 int;
DECLARE @loan int, @loan2 int, @loan3 int, @h2 int, @h3 int, @n0 int, @a0 int;

BEGIN TRANSACTION;

EXEC(N'CREATE OR ALTER TRIGGER dbo.trg_loan_return
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
            SELECT 1 FROM dbo.waitlist AS w WHERE w.held_copy_id = c.copy_id AND w.status = ''ready''
        ) THEN 0 ELSE 1 END
    FROM dbo.copies AS c
    WHERE c.copy_id IN (SELECT copy_id FROM inserted UNION SELECT copy_id FROM deleted);

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT ''trg_loan_return'', ''loan'',
           CONCAT(''Loan '', i.loan_id, '': copy '', i.copy_id, '' returned'',
                  CASE WHEN f.fine_id IS NOT NULL THEN CONCAT('', final fine $'', CAST(f.amount AS int)) ELSE '''' END)
    FROM inserted AS i
    JOIN deleted AS d ON d.loan_id = i.loan_id
    LEFT JOIN dbo.fine AS f ON f.loan_id = i.loan_id
    WHERE d.return_date IS NULL AND i.return_date IS NOT NULL;

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT i.user_id, ''trg_loan_return'',
           CONCAT(''You returned "'', COALESCE(b.title, m.title), ''".'',
                  CASE WHEN f.fine_id IS NOT NULL
                       THEN CONCAT('' It was '', DATEDIFF(day, i.due_date, i.return_date),
                                   '' days late, so your final fine is $'', CAST(f.amount AS int), ''.'')
                       ELSE '''' END)
    FROM inserted AS i
    JOIN deleted AS d ON d.loan_id = i.loan_id
    JOIN dbo.copies AS c ON c.copy_id = i.copy_id
    LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
    LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
    LEFT JOIN dbo.fine AS f ON f.loan_id = i.loan_id
    WHERE d.return_date IS NULL AND i.return_date IS NOT NULL;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.update_overdue_fines
    @p_user_id int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS date);
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
    SELECT l.user_id, ''sp_update_overdue_fines'',
           LEFT(CONCAT(''Your fine on "'', COALESCE(b.title, m.title), ''" is now $'', CAST(ch.amount AS int),
                       ''. It goes up $1 each week until you return it.''), 300)
    FROM @v_changed AS ch
    JOIN dbo.loan AS l ON l.loan_id = ch.loan_id
    JOIN dbo.copies AS c ON c.copy_id = l.copy_id
    LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
    LEFT JOIN dbo.media AS m ON m.media_id = c.media_id;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT ''sp_update_overdue_fines'', ''fine'',
           LEFT(CONCAT(''Loan '', l.loan_id, '': '', DATEDIFF(day, l.due_date, @v_today),
                       '' days late, fine is now $'', CAST(ch.amount AS int)), 300)
    FROM @v_changed AS ch
    JOIN dbo.loan AS l ON l.loan_id = ch.loan_id;

    COMMIT TRANSACTION;
END;');

EXEC(N'CREATE OR ALTER TRIGGER dbo.trg_hold_queue
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

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS date);
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
        WHERE status = ''waiting''
          AND (book_id = @v_book_id OR media_id = @v_media_id)
        ORDER BY request_time, waitlist_id;

        IF @v_hold_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM dbo.loan WHERE copy_id = @v_copy_id AND return_date IS NULL)
        BEGIN
            UPDATE dbo.waitlist
            SET status = ''ready'', ready_date = @v_today, expiration_date = @v_pickup_by, held_copy_id = @v_copy_id
            WHERE waitlist_id = @v_hold_id;

            UPDATE dbo.copies
            SET is_available = 0
            WHERE copy_id = @v_copy_id;

            INSERT INTO dbo.audit_log (trigger_name, table_name, message)
            VALUES (''trg_hold_queue'', ''waitlist'',
                    CONCAT(''Copy '', @v_copy_id, '' was returned and given to hold '', @v_hold_id, '', first in line''));

            INSERT INTO dbo.notification (user_id, source, message)
            SELECT @v_user_id, ''trg_hold_queue'',
                   LEFT(CONCAT(''Your book "'', COALESCE(b.title, m.title), ''" is available. You are first in line. Pick it up at the desk by '',
                               CONVERT(char(10), @v_pickup_by, 110), ''.''), 300)
            FROM (SELECT 1 AS one) AS x
            LEFT JOIN dbo.book AS b ON b.book_id = @v_book_id
            LEFT JOIN dbo.media AS m ON m.media_id = @v_media_id;
        END;

        SET @n += 1;
    END;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.return_loan
    @p_loan_id int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.loan WHERE loan_id = @p_loan_id AND return_date IS NULL)
        THROW 51012, ''This item was already returned'', 1;

    UPDATE dbo.loan
    SET return_date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS date)
    WHERE loan_id = @p_loan_id;

    SELECT fine_id, loan_id, amount
    FROM dbo.fine
    WHERE loan_id = @p_loan_id;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.save_room_reservation
    @p_reservation_id int,
    @p_user_id int,
    @p_room_id int,
    @p_start datetime2(0),
    @p_end datetime2(0)
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT <> 0
        THROW 50001, ''Call this procedure outside an existing transaction'', 1;
    SET XACT_ABORT ON;
    IF @p_start IS NULL OR @p_end IS NULL OR @p_end <= @p_start
        THROW 50002, ''End time must be after start time'', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @v_room int = NULL, @v_existing int = NULL;
        SELECT @v_room = room_id
        FROM dbo.room WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id = @p_room_id;
        IF @v_room IS NULL
            THROW 50003, ''Room does not exist'', 1;
        IF EXISTS (SELECT 1 FROM dbo.room WHERE room_id = @p_room_id AND is_active = 0)
            THROW 50006, ''This room is archived'', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.[user] WHERE user_id = @p_user_id AND is_active = 1)
            THROW 50007, ''This member is deactivated or does not exist'', 1;
        IF @p_start < CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS datetime2(0))
            THROW 50008, ''You cannot book a time in the past'', 1;

        IF @p_reservation_id IS NOT NULL
        BEGIN
            SELECT @v_existing = reservation_id
            FROM dbo.room_reservations WITH (UPDLOCK, HOLDLOCK)
            WHERE reservation_id = @p_reservation_id;
            IF @v_existing IS NULL
                THROW 50004, ''Reservation does not exist'', 1;
        END;

        IF EXISTS (
            SELECT 1 FROM dbo.room_reservations WITH (UPDLOCK, HOLDLOCK)
            WHERE room_id = @p_room_id
              AND is_active = 1
              AND start_time < @p_end
              AND end_time > @p_start
              AND (@p_reservation_id IS NULL OR reservation_id <> @p_reservation_id)
        )
            THROW 50005, ''Room is already booked during that time'', 1;

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
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.promote_next_hold
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
    WHERE status = ''waiting'' AND (book_id = @p_book_id OR media_id = @p_media_id)
    ORDER BY request_time, waitlist_id;

    IF @v_copy_id IS NULL OR @v_hold_id IS NULL
        RETURN;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS date);
    DECLARE @v_expires date = DATEADD(day, 3, @v_today);
    DECLARE @v_title nvarchar(150) = COALESCE(
        (SELECT title FROM dbo.book WHERE book_id = @p_book_id),
        (SELECT title FROM dbo.media WHERE media_id = @p_media_id));

    BEGIN TRANSACTION;

    UPDATE dbo.waitlist
    SET status = ''ready'', ready_date = @v_today, expiration_date = @v_expires, held_copy_id = @v_copy_id
    WHERE waitlist_id = @v_hold_id;

    UPDATE dbo.copies SET is_available = 0 WHERE copy_id = @v_copy_id;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    VALUES (''sp_promote_next_hold'', ''waitlist'',
            CONCAT(''Hold '', @v_hold_id, '' is ready for user '', @v_user_id, ''; pick up by '', CONVERT(char(10), @v_expires, 23)));

    INSERT INTO dbo.notification (user_id, source, message)
    VALUES (@v_user_id, ''sp_promote_next_hold'',
            CONCAT(''Your hold on "'', @v_title, ''" is ready. Pick it up at the desk by '', CONVERT(char(10), @v_expires, 110), ''.''));

    COMMIT TRANSACTION;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.release_hold
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
        THROW 51015, ''Hold not found.'', 1;
    IF @v_status NOT IN (''waiting'', ''ready'')
        THROW 51016, ''This hold is no longer active.'', 1;

    UPDATE dbo.waitlist SET status = @p_status, held_copy_id = NULL WHERE waitlist_id = @p_hold_id;

    IF @v_copy_id IS NOT NULL
    BEGIN
        UPDATE dbo.copies SET is_available = 1 WHERE copy_id = @v_copy_id;
        EXEC dbo.promote_next_hold @v_book_id, @v_media_id;
    END;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.checkout_item
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
        THROW 51010, ''Member not found'', 1;

    DECLARE @v_copy_id int = (
        SELECT TOP 1 held_copy_id
        FROM dbo.waitlist
        WHERE user_id = @p_user_id AND status = ''ready''
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
        THROW 51011, ''No copy is available right now. Place a hold to join the queue.'', 1;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS date);
    DECLARE @v_due date = DATEADD(day, @v_days, @v_today);

    BEGIN TRANSACTION;

    INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
    VALUES (@p_user_id, @v_copy_id, @v_today, @v_due);
    DECLARE @v_loan_id int = CAST(SCOPE_IDENTITY() AS int);

    UPDATE dbo.waitlist
    SET status = ''fulfilled'', held_copy_id = NULL
    WHERE user_id = @p_user_id
      AND status IN (''waiting'', ''ready'')
      AND (book_id = @p_book_id OR media_id = @p_media_id);

    COMMIT TRANSACTION;

    SELECT @v_loan_id AS loan_id, CONVERT(char(10), @v_due, 23) AS due_date;
END;');

EXEC(N'CREATE OR ALTER PROCEDURE dbo.send_due_reminders
    @p_user_id int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @v_today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE ''Central Standard Time'' AS date);
    DECLARE @v_sent TABLE (user_id int, message nvarchar(300));

    BEGIN TRANSACTION;

    INSERT INTO dbo.notification (user_id, source, message)
    OUTPUT inserted.user_id, inserted.message INTO @v_sent (user_id, message)
    SELECT r.user_id, ''sp_send_due_reminders'', r.message
    FROM (
        SELECT l.user_id,
               LEFT(CONCAT(''"'', COALESCE(b.title, m.title), ''" must be returned in 2 days (due '',
                           CONVERT(char(10), l.due_date, 110), '').''), 300) AS message
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
        WHERE n.user_id = r.user_id AND n.source = ''sp_send_due_reminders'' AND n.message = r.message
    );

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT ''sp_send_due_reminders'', ''notification'', LEFT(CONCAT(''Due reminder sent to user '', user_id, '': '', message), 300)
    FROM @v_sent;

    COMMIT TRANSACTION;
END;');

SELECT TOP 1 @book = b.book_id FROM dbo.book AS b
WHERE b.is_active = 1
  AND EXISTS (SELECT 1 FROM dbo.copies AS c WHERE c.book_id = b.book_id AND c.is_active = 1 AND c.is_available = 1
                AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL))
  AND NOT EXISTS (SELECT 1 FROM dbo.waitlist AS w WHERE w.book_id = b.book_id AND w.status IN ('waiting', 'ready'))
ORDER BY b.book_id;
SELECT @copy = MIN(c.copy_id) FROM dbo.copies AS c
WHERE c.book_id = @book AND c.is_active = 1 AND c.is_available = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL);

SELECT TOP 1 @book2 = b.book_id FROM dbo.book AS b
WHERE b.is_active = 1 AND b.book_id <> @book
  AND EXISTS (SELECT 1 FROM dbo.copies AS c WHERE c.book_id = b.book_id AND c.is_active = 1 AND c.is_available = 1
                AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL))
  AND NOT EXISTS (SELECT 1 FROM dbo.waitlist AS w WHERE w.book_id = b.book_id AND w.status IN ('waiting', 'ready'))
ORDER BY b.book_id;
SELECT @copy2 = MIN(c.copy_id) FROM dbo.copies AS c
WHERE c.book_id = @book2 AND c.is_active = 1 AND c.is_available = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL);

SELECT TOP 1 @u1 = u.user_id
FROM dbo.[user] AS u
JOIN dbo.borrow_policy AS bp ON bp.is_faculty = u.is_faculty
WHERE u.is_active = 1
  AND (SELECT COUNT(*) FROM dbo.loan AS l WHERE l.user_id = u.user_id AND l.return_date IS NULL) + 1 <= bp.max_items
ORDER BY u.user_id;
SELECT TOP 1 @u2 = user_id FROM dbo.[user] WHERE is_active = 1 AND user_id <> @u1 ORDER BY user_id;
SELECT TOP 1 @u3 = user_id FROM dbo.[user] WHERE is_active = 1 AND user_id NOT IN (@u1, @u2) ORDER BY user_id;

IF @copy IS NULL OR @copy2 IS NULL OR @u1 IS NULL OR @u3 IS NULL
    THROW 50999, 'The test needs 2 books with a free copy and nobody waiting, and 3 members.', 1;

INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
VALUES (@u1, @copy, DATEADD(day, -5, @today), DATEADD(day, 10, @today));
SET @loan = CAST(SCOPE_IDENTITY() AS int);

INSERT INTO dbo.waitlist (user_id, book_id, request_time, status)
VALUES (@u2, @book, DATEADD(hour, -2, SYSDATETIME()), 'waiting');
SET @h2 = CAST(SCOPE_IDENTITY() AS int);
INSERT INTO dbo.waitlist (user_id, book_id, request_time, status)
VALUES (@u3, @book, DATEADD(hour, -1, SYSDATETIME()), 'waiting');
SET @h3 = CAST(SCOPE_IDENTITY() AS int);

SET @n0 = (SELECT ISNULL(MAX(notification_id), 0) FROM dbo.notification);
SET @a0 = (SELECT ISNULL(MAX(log_id), 0) FROM dbo.audit_log);

EXEC dbo.return_loan @p_loan_id = @loan;
INSERT INTO @r (what, expected, got) VALUES
    ('1. Book returned: first in line is now', 'ready', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h2)),
    ('1. The returned copy is saved for them', CAST(@copy AS nvarchar(60)), (SELECT CAST(held_copy_id AS nvarchar(60)) FROM dbo.waitlist WHERE waitlist_id = @h2)),
    ('1. Pick up by is 3 days from today', CONVERT(nvarchar(60), DATEADD(day, 3, @today), 23), (SELECT CONVERT(nvarchar(60), expiration_date, 23) FROM dbo.waitlist WHERE waitlist_id = @h2)),
    ('1. The copy is held, not on the shelf', '0', (SELECT CAST(is_available AS nvarchar(60)) FROM dbo.copies WHERE copy_id = @copy)),
    ('1. Second in line is still waiting', 'waiting', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h3)),
    ('1. The trigger told them the book is available', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @u2 AND source = 'trg_hold_queue' AND message LIKE '%is available%') THEN 'yes' ELSE 'no' END),
    ('1. The trigger wrote audit_log', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.audit_log WHERE log_id > @a0 AND trigger_name = 'trg_hold_queue') THEN 'yes' ELSE 'no' END),
    ('1. The old procedure did not do it', '0', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n0 AND source = 'sp_promote_next_hold') AS nvarchar(60)));

UPDATE dbo.waitlist SET expiration_date = DATEADD(day, -1, @today) WHERE waitlist_id = @h2;
EXEC dbo.expire_holds;
INSERT INTO @r (what, expected, got) VALUES
    ('2. Not picked up in 3 days: first hold is', 'expired', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h2)),
    ('2. Next in line is now', 'ready', (SELECT status FROM dbo.waitlist WHERE waitlist_id = @h3)),
    ('2. Next in line has a copy saved', 'yes', CASE WHEN (SELECT held_copy_id FROM dbo.waitlist WHERE waitlist_id = @h3) IS NOT NULL THEN 'yes' ELSE 'no' END);

INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
VALUES (@u1, @copy2, DATEADD(day, -5, @today), DATEADD(day, 10, @today));
SET @loan2 = CAST(SCOPE_IDENTITY() AS int);
EXEC dbo.return_loan @p_loan_id = @loan2;
INSERT INTO @r (what, expected, got) VALUES
    ('3. Nobody waiting: copy back on the shelf', '1', (SELECT CAST(is_available AS nvarchar(60)) FROM dbo.copies WHERE copy_id = @copy2)),
    ('3. Nobody waiting: no new queue message', '1', CAST((SELECT COUNT(*) FROM dbo.notification WHERE notification_id > @n0 AND source = 'trg_hold_queue') AS nvarchar(60)));

INSERT INTO dbo.loan (user_id, copy_id, borrow_date, due_date)
VALUES (@u1, @copy2, DATEADD(day, -40, @today), DATEADD(day, -10, @today));
SET @loan3 = CAST(SCOPE_IDENTITY() AS int);
EXEC dbo.return_loan @p_loan_id = @loan3;
INSERT INTO @r (what, expected, got) VALUES
    ('4. Late return (10 days): fine still works', '$6', ISNULL((SELECT CONCAT('$', CAST(amount AS int)) FROM dbo.fine WHERE loan_id = @loan3), 'no fine')),
    ('4. Fine message', 'yes', CASE WHEN EXISTS (SELECT 1 FROM dbo.notification WHERE notification_id > @n0 AND user_id = @u1 AND source = 'trg_loan_return' AND message LIKE '%final fine is $6.%') THEN 'yes' ELSE 'no' END),
    ('5. Fine trigger saved without comments', '0', CAST((SELECT COUNT(*) FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.trg_loan_return') AND definition LIKE '%--%') AS nvarchar(60))),
    ('5. Objects that still have comments', 'none', LEFT(ISNULL((SELECT STRING_AGG(CAST(OBJECT_NAME(object_id) AS nvarchar(max)), ', ') FROM sys.sql_modules WHERE definition LIKE '%--%' OR definition LIKE '%/*%'), 'none'), 400));

ROLLBACK TRANSACTION;

INSERT INTO @r (what, expected, got) VALUES
    ('Nothing saved: open transactions', '0', CAST(@@TRANCOUNT AS nvarchar(60))),
    ('Nothing saved: queue trigger is gone', '0', CAST((SELECT COUNT(*) FROM sys.triggers WHERE name = 'trg_hold_queue') AS nvarchar(60))),
    ('Nothing saved: return_loan is the old one', '1', CAST((SELECT COUNT(*) FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.return_loan') AND definition LIKE '%promote_next_hold%') AS nvarchar(60)));

SELECT step, what, expected, got,
       CASE WHEN expected = got THEN 'PASS' ELSE 'FAIL' END AS result
FROM @r ORDER BY step;
