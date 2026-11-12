import sql from 'mssql';

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

export async function placeHold(database, { userId, kind, itemId }) {
  userId = Number(userId);
  itemId = Number(itemId);
  if (!userId || !itemId || (kind !== 'book' && kind !== 'media')) {
    throw badRequest('Missing user, item, or item type.');
  }
  const col = kind === 'book' ? 'book_id' : 'media_id';

  const check = await database.request()
    .input('userId', sql.Int, userId)
    .input('itemId', sql.Int, itemId)
    .query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.[user] WHERE user_id = @userId AND is_active = 1) AS member_ok,
        (SELECT COUNT(*) FROM waitlist WHERE user_id = @userId AND status IN ('waiting', 'ready')) AS active_holds,
        (SELECT CASE WHEN is_faculty = 1 THEN 6 ELSE 3 END FROM dbo.[user] WHERE user_id = @userId) AS hold_limit,
        (SELECT COUNT(*) FROM waitlist WHERE user_id = @userId AND status IN ('waiting', 'ready') AND ${col} = @itemId) AS dup,
        (SELECT COUNT(*) FROM ${kind === 'book' ? 'book' : 'media'} WHERE ${col} = @itemId AND is_active = 1) AS item_ok,
        (SELECT COUNT(*) FROM copies WHERE ${col} = @itemId AND is_active = 1 AND is_available = 1) AS on_shelf
    `);
  const { member_ok, active_holds, hold_limit, dup, item_ok, on_shelf } = check.recordset[0];
  if (!member_ok) throw badRequest('Member not found or account is inactive.');
  if (!item_ok) throw badRequest('This title is archived and cannot be held.');
  if (on_shelf > 0) throw badRequest('This title is on the shelf now. Ask at the desk to check it out.');
  if (dup) throw badRequest('You already have a hold on this item.');
  if (active_holds >= hold_limit) throw badRequest(`You can have at most ${hold_limit} active holds.`);

  const result = await database.request()
    .input('userId', sql.Int, userId)
    .input('itemId', sql.Int, itemId)
    .query(`
      INSERT INTO waitlist (user_id, ${col}) VALUES (@userId, @itemId);
      SELECT CAST(SCOPE_IDENTITY() AS int) AS hold_id;
    `);

  await database.request()
    .input('p_book_id', sql.Int, kind === 'book' ? itemId : null)
    .input('p_media_id', sql.Int, kind === 'media' ? itemId : null)
    .execute('dbo.promote_next_hold');

  return { hold_id: result.recordset[0].hold_id };
}

export async function cancelHold(database, holdId) {
  await database.request()
    .input('p_hold_id', sql.Int, holdId)
    .input('p_status', sql.NVarChar(9), 'cancelled')
    .execute('dbo.release_hold');

  return { hold_id: holdId };
}

export async function expireHolds(database) {
  const result = await database.request().execute('dbo.expire_holds');
  return result.recordset[0].expired;
}

export async function holdOwner(database, holdId) {
  const result = await database.request()
    .input('holdId', sql.Int, holdId)
    .query(`SELECT user_id FROM waitlist WHERE waitlist_id = @holdId`);

  return result.recordset[0]?.user_id;
}

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
        CONVERT(char(10), CAST(w.request_time AS datetimeoffset) AT TIME ZONE 'Central Standard Time', 23) AS request_date,
        w.status AS status,
        CONVERT(char(10), w.ready_date, 23) AS ready_date,
        CONVERT(char(10), w.expiration_date, 23) AS expiration_date,
        CASE WHEN w.status = 'waiting' THEN (
            SELECT COUNT(*)
            FROM waitlist AS q
            WHERE q.status = 'waiting'
              AND (q.book_id = w.book_id OR q.media_id = w.media_id)
              AND (q.request_time < w.request_time
                OR (q.request_time = w.request_time AND q.waitlist_id <= w.waitlist_id))
        ) END AS queue_position,
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
        AND (@activeOnly = 0 OR w.status IN ('waiting', 'ready'))
      ORDER BY
        w.waitlist_id DESC
    `);

  return result.recordset;
}
