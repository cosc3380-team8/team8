DECLARE @user_id int = 6;
DECLARE @today date = CAST(GETDATE() AS date);

SELECT l.loan_id AS [Loan #],
       COALESCE(b.title, m.title) AS [Title],
       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END AS [Type],
       l.borrow_date AS [Borrowed],
       l.due_date AS [Due],
       CASE WHEN l.due_date < @today THEN N'Overdue'
            WHEN DATEDIFF(day, @today, l.due_date) <= 2 THEN N'Due soon'
            ELSE N'On loan' END AS [Status]
FROM dbo.loan AS l
JOIN dbo.copies AS c ON c.copy_id = l.copy_id
LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
WHERE l.user_id = @user_id
  AND l.return_date IS NULL
ORDER BY l.due_date;
GO

DECLARE @today date = CAST(GETDATE() AS date);

SELECT l.loan_id AS [Loan #],
       u.first_name + N' ' + u.last_name AS [Member],
       CASE WHEN u.is_faculty = 1 THEN N'Faculty' ELSE N'Student' END AS [Role],
       COALESCE(b.title, m.title) AS [Title],
       l.due_date AS [Due],
       DATEDIFF(day, l.due_date, @today) AS [Days overdue],
       CAST(5 + DATEDIFF(day, l.due_date, @today) / 7 AS decimal(8,2)) AS [Projected fine]
FROM dbo.loan AS l
JOIN dbo.[user] AS u ON u.user_id = l.user_id
JOIN dbo.copies AS c ON c.copy_id = l.copy_id
LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
WHERE l.return_date IS NULL
  AND l.due_date < @today
ORDER BY [Days overdue] DESC;
GO

DECLARE @search nvarchar(100) = N'data';

SELECT b.title AS [Title],
       N'Book' AS [Type],
       (SELECT STRING_AGG(a.first_name + N' ' + a.last_name, N', ') WITHIN GROUP (ORDER BY a.author_id)
        FROM dbo.book_author AS ba
        JOIN dbo.author AS a ON a.author_id = ba.author_id
        WHERE ba.book_id = b.book_id) AS [Author],
       (SELECT COUNT(*) FROM dbo.copies AS c
        WHERE c.book_id = b.book_id AND c.is_active = 1) AS [Total copies],
       (SELECT COUNT(*) FROM dbo.copies AS c
        WHERE c.book_id = b.book_id AND c.is_active = 1 AND c.is_available = 1) AS [Available]
FROM dbo.book AS b
WHERE b.is_active = 1
  AND (b.title LIKE N'%' + @search + N'%'
       OR EXISTS (SELECT 1
                  FROM dbo.book_author AS ba
                  JOIN dbo.author AS a ON a.author_id = ba.author_id
                  WHERE ba.book_id = b.book_id
                    AND a.first_name + N' ' + a.last_name LIKE N'%' + @search + N'%'))
UNION ALL
SELECT m.title,
       m.media_type,
       NULL,
       (SELECT COUNT(*) FROM dbo.copies AS c
        WHERE c.media_id = m.media_id AND c.is_active = 1),
       (SELECT COUNT(*) FROM dbo.copies AS c
        WHERE c.media_id = m.media_id AND c.is_active = 1 AND c.is_available = 1)
FROM dbo.media AS m
WHERE m.is_active = 1
  AND m.title LIKE N'%' + @search + N'%'
ORDER BY [Title];
GO

DECLARE @from date = '2026-06-01';
DECLARE @to date = '2026-10-31';

SELECT TOP 10
       COALESCE(b.title, m.title) AS [Title],
       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END AS [Type],
       COUNT(*) AS [Times borrowed],
       SUM(CASE WHEN u.is_faculty = 0 THEN 1 ELSE 0 END) AS [By students],
       SUM(CASE WHEN u.is_faculty = 1 THEN 1 ELSE 0 END) AS [By faculty]
FROM dbo.loan AS l
JOIN dbo.[user] AS u ON u.user_id = l.user_id
JOIN dbo.copies AS c ON c.copy_id = l.copy_id
LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
WHERE l.borrow_date BETWEEN @from AND @to
GROUP BY COALESCE(b.title, m.title),
         CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END
ORDER BY [Times borrowed] DESC, [Title];
GO

DECLARE @from date = '2026-06-01';
DECLARE @to date = '2026-10-31';

SELECT FORMAT(l.return_date, 'yyyy-MM') AS [Month],
       COUNT(*) AS [Fines issued],
       SUM(fs.amount) AS [Assessed],
       SUM(fs.total_paid) AS [Collected],
       SUM(CASE WHEN fs.total_paid >= fs.amount THEN 0 ELSE fs.amount - fs.total_paid END) AS [Outstanding],
       SUM(CASE WHEN fs.paid_status = 1 THEN 1 ELSE 0 END) AS [Fully paid]
FROM dbo.fine_status AS fs
JOIN dbo.loan AS l ON l.loan_id = fs.loan_id
WHERE l.return_date BETWEEN @from AND @to
GROUP BY FORMAT(l.return_date, 'yyyy-MM')
ORDER BY [Month];
GO

DECLARE @from date = '2026-06-01';
DECLARE @to date = '2026-10-31';
DECLARE @today date = CAST(GETDATE() AS date);

SELECT CASE WHEN u.is_faculty = 1 THEN N'Faculty' ELSE N'Student' END AS [Role],
       COUNT(DISTINCT u.user_id) AS [Members],
       COUNT(l.loan_id) AS [Total loans],
       SUM(CASE WHEN l.loan_id IS NOT NULL AND l.return_date IS NULL THEN 1 ELSE 0 END) AS [Active loans],
       SUM(CASE WHEN l.return_date IS NULL AND l.due_date < @today THEN 1 ELSE 0 END) AS [Overdue now],
       SUM(CASE WHEN l.return_date > l.due_date THEN 1 ELSE 0 END) AS [Returned late],
       CAST(COUNT(l.loan_id) * 1.0 / COUNT(DISTINCT u.user_id) AS decimal(6,2)) AS [Avg loans / member]
FROM dbo.[user] AS u
LEFT JOIN dbo.loan AS l
       ON l.user_id = u.user_id
      AND l.borrow_date BETWEEN @from AND @to
GROUP BY u.is_faculty
ORDER BY [Role] DESC;
GO

-- hold queue for one item (Queries tab). Set one of the two ids, leave the other NULL.
DECLARE @book_id int = 1;
DECLARE @media_id int = NULL;

SELECT ROW_NUMBER() OVER (ORDER BY CASE w.status WHEN 'ready' THEN 0 ELSE 1 END, w.request_time, w.waitlist_id) AS [Position],
       u.first_name + N' ' + u.last_name AS [Member],
       CONVERT(char(10), w.request_time, 23) AS [Requested],
       w.status AS [Status],
       CONVERT(char(10), w.expiration_date, 23) AS [Pick up by]
FROM dbo.waitlist AS w
JOIN dbo.[user] AS u ON u.user_id = w.user_id
WHERE w.status IN ('waiting', 'ready')
  AND ((@book_id IS NOT NULL AND w.book_id = @book_id)
    OR (@media_id IS NOT NULL AND w.media_id = @media_id))
ORDER BY CASE w.status WHEN 'ready' THEN 0 ELSE 1 END, w.request_time, w.waitlist_id;
GO

-- personalized loan history (Reports tab). NULL filter = no filter.
DECLARE @from date = '2026-06-01';
DECLARE @to date = '2026-12-31';
DECLARE @user_id int = NULL;
DECLARE @role nvarchar(10) = NULL;      -- 'student', 'faculty' or NULL
DECLARE @author_id int = NULL;
DECLARE @keyword nvarchar(100) = NULL;
DECLARE @kind nvarchar(10) = NULL;      -- 'book', 'media' or NULL
DECLARE @today date = CAST(GETDATE() AS date);

SELECT l.loan_id AS [Loan #],
       u.first_name + N' ' + u.last_name AS [Member],
       COALESCE(b.title, m.title) AS [Title],
       b.isbn AS [ISBN],
       l.borrow_date AS [Borrowed],
       l.due_date AS [Due],
       l.return_date AS [Returned],
       CASE WHEN l.return_date IS NULL AND l.due_date < @today THEN N'Overdue'
            WHEN l.return_date IS NULL THEN N'On loan'
            WHEN l.return_date > l.due_date THEN N'Returned late'
            ELSE N'Returned on time' END AS [Outcome],
       fn.amount AS [Fine]
FROM dbo.loan AS l
JOIN dbo.[user] AS u ON u.user_id = l.user_id
JOIN dbo.copies AS c ON c.copy_id = l.copy_id
LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
LEFT JOIN dbo.fine AS fn ON fn.loan_id = l.loan_id
WHERE l.borrow_date BETWEEN @from AND @to
  AND (@user_id IS NULL OR u.user_id = @user_id)
  AND (@role IS NULL OR u.is_faculty = CASE WHEN @role = 'faculty' THEN 1 ELSE 0 END)
  AND (@author_id IS NULL OR EXISTS (SELECT 1 FROM dbo.book_author AS ba
                                     WHERE ba.book_id = c.book_id AND ba.author_id = @author_id))
  AND (@keyword IS NULL OR COALESCE(b.title, m.title) LIKE N'%' + @keyword + N'%')
  AND (@kind IS NULL OR (@kind = 'book' AND c.book_id IS NOT NULL)
                     OR (@kind = 'media' AND c.media_id IS NOT NULL))
ORDER BY l.borrow_date DESC, l.loan_id DESC;
GO

-- borrowing by author (Reports tab). Books only.
DECLARE @from date = '2026-06-01';
DECLARE @to date = '2026-12-31';
DECLARE @user_id int = NULL;
DECLARE @role nvarchar(10) = NULL;
DECLARE @keyword nvarchar(100) = NULL;

SELECT a.first_name + N' ' + a.last_name AS [Author],
       COUNT(*) AS [Loans],
       COUNT(DISTINCT b.book_id) AS [Titles borrowed]
FROM dbo.loan AS l
JOIN dbo.[user] AS u ON u.user_id = l.user_id
JOIN dbo.copies AS c ON c.copy_id = l.copy_id
JOIN dbo.book AS b ON b.book_id = c.book_id
JOIN dbo.book_author AS ba ON ba.book_id = b.book_id
JOIN dbo.author AS a ON a.author_id = ba.author_id
WHERE l.borrow_date BETWEEN @from AND @to
  AND (@user_id IS NULL OR u.user_id = @user_id)
  AND (@role IS NULL OR u.is_faculty = CASE WHEN @role = 'faculty' THEN 1 ELSE 0 END)
  AND (@keyword IS NULL OR b.title LIKE N'%' + @keyword + N'%')
GROUP BY a.author_id, a.first_name, a.last_name
ORDER BY [Loans] DESC, [Author];
GO

-- inventory status (Reports tab). Active titles and active copies only.
DECLARE @author_id int = NULL;
DECLARE @keyword nvarchar(100) = NULL;
DECLARE @kind nvarchar(10) = NULL;

SELECT COALESCE(b.title, m.title) AS [Title],
       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE m.media_type END AS [Type],
       COUNT(*) AS [Total copies],
       SUM(CASE WHEN c.is_available = 1 THEN 1 ELSE 0 END) AS [Available],
       SUM(CASE WHEN c.is_available = 0 THEN 1 ELSE 0 END) AS [On loan]
FROM dbo.copies AS c
LEFT JOIN dbo.book AS b ON b.book_id = c.book_id
LEFT JOIN dbo.media AS m ON m.media_id = c.media_id
WHERE c.is_active = 1
  AND COALESCE(b.is_active, m.is_active) = 1
  AND (@author_id IS NULL OR EXISTS (SELECT 1 FROM dbo.book_author AS ba
                                     WHERE ba.book_id = c.book_id AND ba.author_id = @author_id))
  AND (@keyword IS NULL OR COALESCE(b.title, m.title) LIKE N'%' + @keyword + N'%')
  AND (@kind IS NULL OR (@kind = 'book' AND c.book_id IS NOT NULL)
                     OR (@kind = 'media' AND c.media_id IS NOT NULL))
GROUP BY COALESCE(b.title, m.title), CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE m.media_type END
ORDER BY [Title];
GO
