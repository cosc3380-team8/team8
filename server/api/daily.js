import sql from 'mssql';

// Vercel runs this every morning (see vercel.json). expire_holds marks old holds expired,
// which fires trg_hold_expired. Running it twice in a day changes nothing.
export async function runDailyJobs(database) {
    const start = await database.request()
        .query('SELECT ISNULL(MAX(log_id), 0) AS last_id FROM dbo.audit_log');
    const lastId = start.recordset[0].last_id;

    const holds = await database.request().execute('dbo.expire_holds');
    await database.request().execute('dbo.send_due_reminders');
    await database.request().execute('dbo.update_overdue_fines');

    // what changed, written to the audit log so it can be shown in DataGrip
    const result = await database.request()
        .input('lastId', sql.Int, lastId)
        .input('expired', sql.Int, holds.recordset?.[0]?.expired ?? 0)
        .query(`
            DECLARE @fines int = (SELECT COUNT(*) FROM dbo.audit_log
                                  WHERE log_id > @lastId AND trigger_name = 'sp_update_overdue_fines');
            INSERT INTO dbo.audit_log (trigger_name, table_name, message)
            VALUES ('daily_job', 'fine',
                    CONCAT('Daily job ran by itself: ', @fines, ' late fine(s) went up, ',
                           @expired, ' hold(s) expired.'));
            SELECT @fines AS fines_went_up, @expired AS holds_expired,
                   CONVERT(varchar(19), SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time', 120) AS ran_at_houston;
        `);

    return result.recordset[0];
}
