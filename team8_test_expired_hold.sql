SET XACT_ABORT ON;   -- any error undoes everything
BEGIN TRANSACTION;

DECLARE @today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date);

-- a book with a copy on the shelf (not on loan, not held) and nobody in its queue
DECLARE @book int = (
    SELECT TOP 1 b.book_id FROM dbo.book AS b
    WHERE b.is_active = 1
      AND EXISTS (SELECT 1 FROM dbo.copies AS c
                  WHERE c.book_id = b.book_id AND c.is_active = 1 AND c.is_available = 1
                    AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL))
      AND NOT EXISTS (SELECT 1 FROM dbo.waitlist AS w WHERE w.book_id = b.book_id AND w.status IN ('waiting', 'ready'))
    ORDER BY b.book_id);
DECLARE @copy int = (
    SELECT MIN(c.copy_id) FROM dbo.copies AS c
    WHERE c.book_id = @book AND c.is_active = 1 AND c.is_available = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.loan AS l WHERE l.copy_id = c.copy_id AND l.return_date IS NULL));

DECLARE @memberA int = (
    SELECT TOP 1 user_id FROM dbo.[user] WHERE is_active = 1
    ORDER BY CASE WHEN email = N'esther@uni.edu' THEN 0 ELSE 1 END, user_id);
DECLARE @memberB int = (
    SELECT TOP 1 user_id FROM dbo.[user] WHERE is_active = 1 AND user_id <> @memberA
    ORDER BY CASE WHEN email = N'ben@uni.edu' THEN 0 ELSE 1 END, user_id);

IF @book IS NULL OR @copy IS NULL THROW 50990, 'Need a book with a copy on the shelf and nobody waiting for it.', 1;
IF @memberA IS NULL OR @memberB IS NULL THROW 50991, 'Need 2 active members.', 1;

-- Member A: became ready 4 days ago, pick up by yesterday, never picked up
INSERT INTO dbo.waitlist (user_id, book_id, request_time, status, ready_date, expiration_date, held_copy_id)
VALUES (@memberA, @book, DATEADD(day, -6, SYSDATETIME()), 'ready',
        DATEADD(day, -4, @today), DATEADD(day, -1, @today), @copy);

-- the copy is saved for Member A, so it is off the shelf
UPDATE dbo.copies SET is_available = 0 WHERE copy_id = @copy;

-- Member B: joined the queue after A
INSERT INTO dbo.waitlist (user_id, book_id, request_time, status)
VALUES (@memberB, @book, DATEADD(day, -5, SYSDATETIME()), 'waiting');

COMMIT TRANSACTION;

-- what was made
SELECT w.waitlist_id AS [Hold #], u.first_name + N' ' + u.last_name AS [Member], u.email AS [Email],
       b.title AS [Book], w.status AS [Status],
       CONVERT(char(10), w.expiration_date, 23) AS [Pick up by], w.held_copy_id AS [Copy saved]
FROM dbo.waitlist AS w
JOIN dbo.[user] AS u ON u.user_id = w.user_id
JOIN dbo.book AS b ON b.book_id = w.book_id
WHERE w.book_id = @book AND w.status IN ('waiting', 'ready')
ORDER BY w.request_time;
