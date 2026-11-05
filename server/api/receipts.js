import sql from 'mssql';

const RECEIPT_SELECT = `
    SELECT
        r.receipt_id,
        r.transaction_code,
        CONVERT(char(10), r.issue_date, 23) AS issued_date,
        p.payment_id,
        UPPER(LEFT(p.payment_method, 1)) + SUBSTRING(p.payment_method, 2, 4) AS payment_method,
        p.amount_paid,
        COALESCE(s.first_name + N' ' + s.last_name, N'Front desk') AS received_by,
        p.fine_id,
        l.loan_id,
        l.user_id,
        u.first_name + N' ' + u.last_name AS member_name,
        u.email AS member_email,
        COALESCE(b.title, m.title) AS title,
        b.isbn,
        CONVERT(char(10), l.borrow_date, 23) AS borrow_date,
        CONVERT(char(10), l.due_date, 23) AS due_date,
        CONVERT(char(10), l.return_date, 23) AS return_date
    FROM receipts AS r
    JOIN payments AS p ON p.payment_id = r.payment_id
    JOIN fine AS f ON f.fine_id = p.fine_id
    JOIN loan AS l ON l.loan_id = f.loan_id
    JOIN [user] AS u ON u.user_id = l.user_id
    JOIN copies AS c ON c.copy_id = l.copy_id
    LEFT JOIN book AS b ON b.book_id = c.book_id
    LEFT JOIN media AS m ON m.media_id = c.media_id
    LEFT JOIN staff AS s ON s.staff_id = p.staff_id
`;

export async function listReceipts(database, { userId, search = '' } = {}) {
    const term = String(search).trim();
    const isbn = term.replace(/[^0-9Xx]/g, '').toUpperCase();

    if (term.length > 100) {
        const error = new Error('Search query is too long');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
        .request()
        .input('userId', sql.Int, userId ?? null)
        .input('search', sql.NVarChar(100), term)
        .input('isbn', sql.NVarChar(13), isbn.length >= 3 ? isbn.slice(0, 13) : null)
        .query(`${RECEIPT_SELECT}
            WHERE (@userId IS NULL OR l.user_id = @userId)
                AND (@search = N''
                    OR r.transaction_code LIKE N'%' + @search + N'%'
                    OR COALESCE(b.title, m.title) LIKE N'%' + @search + N'%'
                    OR u.first_name + N' ' + u.last_name LIKE N'%' + @search + N'%'
                    OR b.isbn LIKE N'%' + @isbn + N'%')
            ORDER BY r.receipt_id DESC
        `);

    return result.recordset;
}

export async function getReceipt(database, receiptId) {
    const result = await database
        .request()
        .input('receiptId', sql.Int, receiptId)
        .query(`${RECEIPT_SELECT} WHERE r.receipt_id = @receiptId`);

    return result.recordset[0];
}
