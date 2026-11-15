/*import sql from 'mssql'

export const LOCAL_NOW = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS datetime2(0))";

export async function listReservations(database, user_id) {
    if (user_id !== undefined && isNaN(user_id)) {
        const error = new Error('Invalid user_id query parameter');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
        .request()
        .input('user_id', sql.Int, user_id ?? null)
        .query(`
            SELECT
                rr.reservation_id,
                rr.user_id,
                rr.room_id,
                rr.start_time,
                rr.end_time,
                rr.is_active,
                r.room_number AS room_number,
                CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                CASE
                    WHEN rr.end_time < ${LOCAL_NOW} OR rr.is_active = 0 THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS archived
            FROM room_reservations AS rr
            JOIN room AS r ON rr.room_id = r.room_id
            JOIN [user] AS u ON rr.user_id = u.user_id
            WHERE (@user_id IS NULL OR rr.user_id = @user_id)
            ORDER BY rr.start_time
        `);

    return result.recordset;
}

export async function saveRoomReservation(database, input) {
    return database
        .request()
        .input('p_reservation_id', sql.Int, input.reservation_id ?? null)
        .input('p_user_id', sql.Int, input.userId)
        .input('p_room_id', sql.Int, input.roomId)
        .input('p_start', sql.DateTime2(0), input.start)
        .input('p_end', sql.DateTime2(0), input.end)
        .execute('dbo.save_room_reservation');
}

export async function cancelRoomReservation(database, reservationId) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservationId)
        .query(`
            UPDATE room_reservations
            SET is_active = 0
            WHERE reservation_id = @reservation_id
        `);
    
    if (result.rowsAffected[0] === 0) {
        const error = new Error('Reservation not found');
        error.statusCode = 404;
        throw error;
    }
}
export async function reservationOwner(database, reservationId) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservationId)
        .query(`SELECT user_id FROM room_reservations WHERE reservation_id = @reservation_id`);

    return result.recordset[0]?.user_id;
} */

import sql from 'mssql'

export const LOCAL_NOW = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS datetime2(0))";

export async function listReservations(database, user_id) {
    if (user_id !== undefined && isNaN(user_id)) {
        const error = new Error('Invalid user_id query parameter');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
        .request()
        .input('user_id', sql.Int, user_id ?? null)
        .query(`
            SELECT
                rr.reservation_id,
                rr.user_id,
                rr.room_id,
                rr.start_time,
                rr.end_time,
                rr.is_active,
                r.room_number AS room_number,
                CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                CASE
                    WHEN rr.end_time < ${LOCAL_NOW} OR rr.is_active = 0 THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS archived
            FROM room_reservations AS rr
            JOIN room AS r ON rr.room_id = r.room_id
            JOIN [user] AS u ON rr.user_id = u.user_id
            WHERE (@user_id IS NULL OR rr.user_id = @user_id)
            ORDER BY rr.start_time
        `);

    return result.recordset;
}

// library hours are 8 AM - 10 PM. Rooms are booked in fixed 2-hour blocks
// (8-10, 10-12, 12-2, 2-4, 4-6, 6-8, 8-10 PM), and a member can book one room per day.
const OPEN_HOUR = 8;
const CLOSE_HOUR = 22;
const BLOCK_HOURS = 2;

function badRequest(message) {
    return Object.assign(new Error(message), { statusCode: 400 });
}

// "YYYY-MM-DDTHH:MM" -> minutes, compared as clock time (no time zone)
function toMinutes(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? ''));
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000;
}

function checkBookingLength(start, end) {
    const from = toMinutes(start);
    const to = toMinutes(end);
    if (from === null || to === null) throw badRequest('Choose a date and time.');
    const startHour = Number(String(start).slice(11, 13));
    const onBlock = String(start).slice(14, 16) === '00'
        && startHour >= OPEN_HOUR
        && startHour + BLOCK_HOURS <= CLOSE_HOUR
        && (startHour - OPEN_HOUR) % BLOCK_HOURS === 0;
    if (!onBlock || to - from !== BLOCK_HOURS * 60) {
        throw badRequest('Study rooms are booked in 2-hour blocks: 8-10 AM, 10-12, 12-2, 2-4, 4-6, 6-8 or 8-10 PM.');
    }
}

// one room booking per member per day (cancelled bookings do not count)
async function checkDailyLimit(database, input) {
    const result = await database
        .request()
        .input('user_id', sql.Int, input.userId)
        .input('day', sql.Date, String(input.start).slice(0, 10))
        .input('reservation_id', sql.Int, input.reservation_id ?? null)
        .query(`
            SELECT COUNT(*) AS bookings
            FROM room_reservations
            WHERE user_id = @user_id
              AND is_active = 1
              AND CAST(start_time AS date) = @day
              AND (@reservation_id IS NULL OR reservation_id <> @reservation_id)
        `);

    if (result.recordset[0].bookings > 0) {
        throw badRequest('You have reached your room booking limit for that day.');
    }
}

// every active booking on one day, so the website can grey out taken times.
// members only see which times are taken; staff also see who booked them.
export async function listRoomAvailability(database, date, user) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ''))) {
        throw badRequest('Choose a date.');
    }
    const isStaff = user.role === 'employee' || user.role === 'admin';

    const result = await database
        .request()
        .input('day', sql.Date, date)
        .input('user_id', sql.Int, isStaff ? null : user.id)
        .query(`
            SELECT
                rr.room_id,
                CONVERT(char(16), rr.start_time, 126) AS start_time,
                CONVERT(char(16), rr.end_time, 126) AS end_time,
                CASE WHEN rr.user_id = @user_id THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS mine,
                ${isStaff ? "CONCAT(u.first_name, ' ', u.last_name)" : 'NULL'} AS member_name
            FROM room_reservations AS rr
            JOIN [user] AS u ON u.user_id = rr.user_id
            WHERE rr.is_active = 1
              AND rr.start_time < DATEADD(day, 1, CAST(@day AS datetime2(0)))
              AND rr.end_time > CAST(@day AS datetime2(0))
            ORDER BY rr.room_id, rr.start_time
        `);

    const now = await database.request().query(`SELECT CONVERT(char(16), ${LOCAL_NOW}, 126) AS now`);

    return { now: now.recordset[0].now, bookings: result.recordset };
}

export async function saveRoomReservation(database, input) {
    checkBookingLength(input.start, input.end);
    await checkDailyLimit(database, input);
    return database
        .request()
        .input('p_reservation_id', sql.Int, input.reservation_id ?? null)
        .input('p_user_id', sql.Int, input.userId)
        .input('p_room_id', sql.Int, input.roomId)
        .input('p_start', sql.DateTime2(0), input.start)
        .input('p_end', sql.DateTime2(0), input.end)
        .execute('dbo.save_room_reservation');
}

export async function cancelRoomReservation(database, reservationId) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservationId)
        .query(`
            UPDATE room_reservations
            SET is_active = 0
            WHERE reservation_id = @reservation_id
        `);
    
    if (result.rowsAffected[0] === 0) {
        const error = new Error('Reservation not found');
        error.statusCode = 404;
        throw error;
    }
}
export async function reservationOwner(database, reservationId) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservationId)
        .query(`SELECT user_id FROM room_reservations WHERE reservation_id = @reservation_id`);

    return result.recordset[0]?.user_id;
}
