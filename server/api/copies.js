import sql from 'mssql';

function badRequest(message) {
    return Object.assign(new Error(message), { statusCode: 400 });
}

export async function listCopies(database, kind, itemId) {
    if ((kind !== 'book' && kind !== 'media') || !Number.isInteger(itemId)) {
        throw badRequest('Choose a book or media item.');
    }
    const col = kind === 'book' ? 'book_id' : 'media_id';

    const result = await database.request()
        .input('itemId', sql.Int, itemId)
        .query(`
            SELECT c.copy_id,
                   CASE WHEN c.is_active = 0 THEN 'archived'
                        WHEN l.loan_id IS NOT NULL THEN 'checked out'
                        WHEN w.waitlist_id IS NOT NULL THEN 'held'
                        ELSE 'on shelf' END AS status,
                   CASE WHEN u.user_id IS NOT NULL THEN CONCAT(u.first_name, ' ', u.last_name) END AS member_name,
                   CONVERT(char(10), l.due_date, 23) AS due_date
            FROM copies AS c
            LEFT JOIN loan AS l ON l.copy_id = c.copy_id AND l.return_date IS NULL
            LEFT JOIN waitlist AS w ON w.held_copy_id = c.copy_id AND w.status = 'ready'
            LEFT JOIN [user] AS u ON u.user_id = COALESCE(l.user_id, w.user_id)
            WHERE c.${col} = @itemId
            ORDER BY c.is_active DESC, c.copy_id
        `);

    return result.recordset;
}

export async function archiveCopy(database, copyId) {
    const result = await database.request()
        .input('copyId', sql.Int, copyId)
        .query(`
            UPDATE copies
            SET is_active = 0
            WHERE copy_id = @copyId
              AND is_active = 1
              AND NOT EXISTS (SELECT 1 FROM loan WHERE copy_id = @copyId AND return_date IS NULL)
              AND NOT EXISTS (SELECT 1 FROM waitlist WHERE held_copy_id = @copyId AND status = 'ready');
            SELECT @@ROWCOUNT AS changed;
        `);

    if (result.recordset[0].changed === 0) {
        throw badRequest('This copy is checked out, held for a member, or already archived.');
    }
    return { copy_id: copyId };
}
