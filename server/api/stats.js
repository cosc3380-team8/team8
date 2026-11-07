export async function dashboardStats(database) {
    const result = await database
        .request()
        .query(`
            SELECT
                (SELECT COUNT(*) FROM book WHERE is_active = 1) AS books,
                (SELECT COUNT(*) FROM media WHERE is_active = 1) AS media,
                (SELECT COUNT(*) FROM [user] WHERE is_active = 1) AS members,
                (SELECT COUNT(*) FROM loan WHERE return_date IS NULL) AS activeLoans,
                (SELECT COUNT(*) FROM loan WHERE return_date IS NULL AND due_date < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date)) AS overdue,
                (SELECT COUNT(*) FROM waitlist WHERE status = 'ready') AS readyHolds,
                (SELECT COALESCE(SUM(amount - total_paid), 0) FROM fine_status WHERE paid_status = 0) AS unpaidTotal
        `);

    return result.recordset[0];
}
