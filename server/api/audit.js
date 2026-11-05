export async function listAudit(database) {
    const result = await database
        .request()
        .query(`
            SELECT TOP 300 log_id, logged_at, trigger_name, table_name, message
            FROM audit_log
            ORDER BY logged_at DESC, log_id DESC
        `);

    return result.recordset;
}
