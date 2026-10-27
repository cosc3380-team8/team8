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
        w.book_id,
        w.media_id,
        CONVERT(char(10), w.request_time, 23) AS request_date,
        'waiting' AS status,
        CAST(NULL AS date) AS ready_date,
        CAST(NULL AS date) AS expiration_date,
        ROW_NUMBER() OVER (
            PARTITION BY w.book_id, w.media_id
            ORDER BY w.request_time, w.waitlist_id
        ) AS queue_position,
        CONCAT(u.first_name, ' ', u.last_name) AS member_name,
        COALESCE(b.title, m.title) AS title,
        CASE WHEN w.book_id IS NOT NULL
        THEN 'book' ELSE 'media'
        END AS kind
      FROM
        waitlist AS w
      LEFT JOIN dbo.[user] AS u ON w.user_id = u.user_id
      LEFT JOIN book AS b ON w.book_id = b.book_id
      LEFT JOIN media AS m ON w.media_id = m.media_id
      WHERE
        (@userId IS NULL OR w.user_id = @userId)
        AND (@activeOnly = 0)
      ORDER BY
        w.request_time, w.waitlist_id
    `);

  return result.recordset;
}
