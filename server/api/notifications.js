import sql from 'mssql';

export async function listNotifications(database, userId) {
    const result = await database
        .request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT notification_id, user_id, created_at, source, message, is_read
            FROM notification
            WHERE user_id = @userId
            ORDER BY created_at DESC, notification_id DESC
        `);

    return result.recordset;
}

export async function unreadCount(database, userId) {
    const result = await database
        .request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT COUNT(*) AS unread
            FROM notification
            WHERE user_id = @userId AND is_read = 0
        `);

    return result.recordset[0].unread;
}

export async function markRead(database, userId) {
    await database
        .request()
        .input('userId', sql.Int, userId)
        .query(`
            UPDATE notification
            SET is_read = 1
            WHERE user_id = @userId AND is_read = 0
        `);
}
