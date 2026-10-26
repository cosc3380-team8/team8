import sql from 'mssql';

export async function listWaitlist(database, { userId, activeOnly = false } = {}) {
  const result = await database
    .request()
    .input('userId', sql.Int, userId ?? null)
    .input('activeOnly', sql.Bit, activeOnly)
    .query(`
      SELECT
        w.waitlist_id AS hold_id,
        w.user_id,
        c.book_id,
        c.media_id,
        CONVERT(char(10), w.request_date, 23) AS request_date,
        'waiting' AS status,
        CAST(NULL AS date) AS ready_date,
        CAST(NULL AS date) AS expiration_date,
        ROW_NUMBER() OVER (
            PARTITION BY w.copy_id
            ORDER BY w.request_date, w.waitlist_id
        ) AS queue_position,
        CONCAT(m.first_name, ' ', m.last_name) AS member_name,
        COALESCE(b.title, mi.title) AS title,
        CASE WHEN c.book_id IS NOT NULL
        THEN 'book' ELSE 'media'
        END AS kind
    `);

  return result.recordset;
}