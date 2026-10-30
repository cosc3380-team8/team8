import sql from 'mssql';

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

export async function placeHold(database, {userID, kind, itemID}){
  userID = Number(userID);
  itemID = Number(itemID);
  if(!userID || !itemID || (kind !=='book' && kind!=='media)){
    throw badRequest('Missing user, item, or item type.');
  }
  const col = kind == 'book' ? 'book_id' : 'media_id;

  const check = await database.request()
  .input('userId', sql.Int, userId)
  .input('itemId', sql.INT, itemId)
  .query('
    SELECT
      (SELECT COUNT(*) FROM dbo.[user] WHERE user_id = @userId AND is_active = 1) AS member_ok,
      (SELECT COUNT(*) FROM waitlist WHERE user_id = @userId AND status = 'waiting') AS active_holds,
      (SELECT COUNT(*) FROM waitlist WHERE user_id = @userId AND status - 'waiting' and 4[col} = @itemId) AS dup
    );
  const {member_ok, active_holds, dup } = check_recordset[0];
  if(!member_ok) throw badRequest('Member not found or account is inactive.');
  if(dub) throw badRequest('You already have a hold on this item.');
  if(active_holds >= 3) throw badRequest('You can have at most 3 active holds.');

  const result = await database.request()
  .input('userId', sql.Int, userId)
  .input('itemId', sql.Int, itemId)
    .query('
      INSERT INTO waitlist(user_id, ${col]) VALES (@user_Id,@itemId);
  SELECT CAST(SCOPE_IDENTITY() AS int) AS hold_id;
);
return {hold_id: result.recorddet[0].hold_if );
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
