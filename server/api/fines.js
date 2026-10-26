import sql from 'mssql';

export async function listFines(database, { userId, activeOnly = false } = {}) {
    try {
        const result = await database
            .request()
        .input('userId', sql.Int, userId ?? null)
        .input('activeOnly', sql.Bit, activeOnly)
        .query(`
            SELECT
                f.fine_id,
                f.loan_id,
                f.amount,
                l.user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                COALESCE(b.title, m.title) AS title,
                CONVERT(char(10), l.due_date, 23) AS due_date,
                CONVERT(char(10), l.return_date, 23) AS return_date,
                CAST(NULL AS varchar(20)) AS payment_method,
                CAST(NULL AS varchar(30)) AS receipt_code
            FROM dbo.[fine] AS f
            JOIN dbo.[loan] AS l ON l.loan_id = f.loan_id
            JOIN dbo.[user] AS u ON u.user_id = l.user_id
            JOIN dbo.[copies] AS c ON c.copy_id = l.copy_id
            LEFT JOIN dbo.[book] AS b ON b.book_id = c.book_id
            LEFT JOIN dbo.[media] AS m ON m.media_id = c.media_id
            WHERE (@userId IS NULL OR l.user_id = @userId)
                AND (@activeOnly = 0 OR l.return_date IS NULL)
            ORDER BY f.fine_id DESC
        `);

    return result.recordset;
    } catch (error) {
        console.error('Error listing fines:', error);
        throw error;
    }
}
