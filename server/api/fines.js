import sql from 'mssql';
import { getReceipt } from './receipts.js';

export async function listFines(database, { userId } = {}) {
    try {
        // today's fine for late items still out, so the list never shows an old amount (migration 7)
        await database.request().execute('dbo.update_overdue_fines').catch((error) => console.error('Error updating overdue fines:', error));
        const result = await database
            .request()
        .input('userId', sql.Int, userId ?? null)
        .query(`
            SELECT
                f.fine_id,
                f.loan_id,
                f.amount,
                CASE WHEN fs.paid_status = 1 THEN 'paid' ELSE 'unpaid' END AS paid_status,
                fs.total_paid,
                f.amount - fs.total_paid AS amount_owed,
                CASE WHEN fs.paid_date IS NOT NULL THEN (SELECT CONVERT(char(10), CAST(MAX(p2.payment_date) AS datetimeoffset) AT TIME ZONE 'Central Standard Time', 23) FROM dbo.[payments] AS p2 WHERE p2.fine_id = f.fine_id) END AS paid_date,
                l.user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                COALESCE(b.title, m.title) AS title,
                CONVERT(char(10), l.due_date, 23) AS due_date,
                CONVERT(char(10), l.return_date, 23) AS return_date,
                pay.payment_method,
                pay.receipt_code
            FROM dbo.[fine] AS f
            JOIN dbo.[fine_status] AS fs ON fs.fine_id = f.fine_id
            JOIN dbo.[loan] AS l ON l.loan_id = f.loan_id
            JOIN dbo.[user] AS u ON u.user_id = l.user_id
            JOIN dbo.[copies] AS c ON c.copy_id = l.copy_id
            LEFT JOIN dbo.[book] AS b ON b.book_id = c.book_id
            LEFT JOIN dbo.[media] AS m ON m.media_id = c.media_id
            OUTER APPLY (
                SELECT TOP 1
                    UPPER(LEFT(p.payment_method, 1)) + SUBSTRING(p.payment_method, 2, 4) AS payment_method,
                    r.transaction_code AS receipt_code
                FROM dbo.[payments] AS p
                LEFT JOIN dbo.[receipts] AS r ON r.payment_id = p.payment_id
                WHERE p.fine_id = f.fine_id
                ORDER BY p.payment_date DESC, p.payment_id DESC
            ) AS pay
            WHERE (@userId IS NULL OR l.user_id = @userId)
            ORDER BY f.fine_id DESC
        `);

    return result.recordset;
    } catch (error) {
        console.error('Error listing fines:', error);
        throw error;
    }
}

export async function payFine(database, fineId, { method, staffId }) {
    if (!['cash', 'card'].includes(String(method).toLowerCase())) {
        const error = new Error('Choose Cash or Card.');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
        .request()
        .input('p_fine_id', sql.Int, fineId)
        .input('p_method', sql.NVarChar(4), method)
        .input('p_staff_id', sql.Int, staffId ?? null)
        .execute('dbo.pay_fine');

    return getReceipt(database, result.recordset[0].receipt_id);
}
