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
