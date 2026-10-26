import sql from 'mssql';

export async function listLoans(
  database,
  { userId, activeOnly = false } = {}
) {
  const result = await database
    .request()
    .input('userId', sql.Int, userId ?? null)
    .input('activeOnly', sql.Bit, activeOnly)
    .query(`
      SELECT
        l.loan_id,
        l.user_id,
        CASE WHEN c.book_id IS NOT NULL THEN l.copy_id END AS book_copy_id,
        CASE WHEN c.media_id IS NOT NULL THEN l.copy_id END AS media_copy_id,
        CONVERT(char(10), l.borrow_date, 23) AS borrow_date,
        CONVERT(char(10), l.due_date, 23) AS due_date,
        CONVERT(char(10), l.return_date, 23) AS return_date,
        CONCAT(m.first_name, ' ', m.last_name) AS member_name,
        COALESCE(b.title, mi.title) AS title,
        CASE WHEN c.book_id IS NOT NULL
          THEN 'book' ELSE 'media'
        END AS kind,
        CASE
          WHEN l.return_date IS NOT NULL THEN 'returned'
          WHEN d.days_until_due < 0 THEN 'overdue'
          WHEN d.days_until_due <= 2 THEN 'due-soon'
          ELSE 'active'
        END AS status,
        CASE WHEN l.return_date IS NULL
          THEN d.days_until_due ELSE NULL
        END AS days_until_due,
        f.amount AS fine_amount
      FROM dbo.[loan] AS l
      JOIN dbo.[user] AS m ON m.user_id = l.user_id
      JOIN dbo.[copies] AS c ON c.copy_id = l.copy_id
      LEFT JOIN dbo.[book] AS b ON b.book_id = c.book_id
      LEFT JOIN dbo.[media] AS mi ON mi.media_id = c.media_id
      LEFT JOIN dbo.[fine] AS f ON f.loan_id = l.loan_id
      CROSS APPLY (
        SELECT DATEDIFF(
          DAY, CAST(GETDATE() AS date), l.due_date
        ) AS days_until_due
      ) AS d
      WHERE (@userId IS NULL OR l.user_id = @userId)
        AND (@activeOnly = 0 OR l.return_date IS NULL)
      ORDER BY l.loan_id DESC
    `);

  return result.recordset;
}
