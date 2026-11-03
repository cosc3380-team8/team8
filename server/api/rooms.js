/***import sql from 'mssql'

export async function listRooms(database, search = '') {
    const term = String(search).trim();
    if (term.length > 100) {
        const error = new Error('Search query is too long');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
        .request()
        .input('search', sql.NVarChar(100), term)
        .query(`
            SELECT
                r.room_id,
                r.room_number,
                r.capacity,
                r.is_active,
                r.room_level
            FROM room AS r
            WHERE r.room_number LIKE N'%' + @search + N'%' AND r.is_active = 1
            ORDER BY r.room_number
        `);

    return result.recordset;
}

export async function saveRoom(database, room) {
    const { room_id, room_number, capacity } = room

    try{
        const result = await database.poolconnection
            .request()
            .input('room_id', sql.Int, room_id)
            .input('room_number', sql.NVarChar(10), room_number)
            .input('capacity', sql.Int, capacity)
            .query(`
                INSERT INTO room (room_id, room_number, capacity)
                VALUES (@room_id, @room_number, @capacity)
            `);
        return result;
    }catch(error){
        console.error(error);
        throw error;
    }
}

export async function updateRoom(database, room) {
    const { room_id, room_number, capacity } = room

    try{
        const result = await database.poolconnection
            .request()
            .input('room_id', sql.Int, room_id)
            .input('room_number', sql.NVarChar(10), room_number)
            .input('capacity', sql.Int, capacity)
            .query(`
                UPDATE room
                SET room_number = @room_number,
                    capacity = @capacity
                WHERE room_id = @room_id
            `);
        return result;
    }catch(error){
        console.error(error);
        throw error;
    }
}

export async function deleteRoom(database, room_id) {
    try{
        const result = await database.poolconnection
            .request()
            .input('room_id', sql.Int, room_id)
            .query(`
                UPDATE room
                SET is_active = 0
                WHERE room_id = @room_id
            `);
        return result;
    }catch(error){
        console.error(error);
        throw error;
    }
}
***/
import sql from 'mssql'

const MAX_HOURS = 2;
const MAX_MS = MAX_HOURS * 60 * 60 * 1000;

// small helper so every error carries the right HTTP status
function httpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// checks the times before we even touch the database
function checkTimes(start_time, end_time) {
    const start = new Date(start_time);
    const end = new Date(end_time);

    if (isNaN(start) || isNaN(end)) {
        throw httpError('Start and end time are required and must be valid dates', 400);
    }
    if (end <= start) {
        throw httpError('End time has to be after start time', 400);
    }
    if (end - start > MAX_MS) {
        throw httpError(`You can only reserve a room for up to ${MAX_HOURS} hours`, 400);
    }
    if (start < new Date()) {
        throw httpError('You cannot reserve a time in the past', 400);
    }

    return { start, end };
}

export async function createReservation(database, reservation) {
    const { room_id, user_id, start_time, end_time } = reservation;

    if (!room_id || !user_id) {
        throw httpError('room_id and user_id are required', 400);
    }

    const { start, end } = checkTimes(start_time, end_time);

    // 1. make sure the room exists and is active
    const roomResult = await database
        .request()
        .input('room_id', sql.Int, room_id)
        .query(`SELECT room_id FROM room WHERE room_id = @room_id AND is_active = 1`);

    if (roomResult.recordset.length === 0) {
        throw httpError('Room not found', 404);
    }

    // 2. insert ONLY if nobody else has the room during that time
    //    (the check and the insert happen together so two people can't grab the same slot)
    const result = await database
        .request()
        .input('room_id', sql.Int, room_id)
        .input('user_id', sql.Int, user_id)
        .input('start_time', sql.DateTime2, start)
        .input('end_time', sql.DateTime2, end)
        .query(`
            INSERT INTO reservation (room_id, user_id, start_time, end_time)
            OUTPUT INSERTED.reservation_id, INSERTED.room_id, INSERTED.user_id,
                   INSERTED.start_time, INSERTED.end_time, INSERTED.status
            SELECT @room_id, @user_id, @start_time, @end_time
            WHERE NOT EXISTS (
                SELECT 1
                FROM reservation WITH (UPDLOCK, HOLDLOCK)
                WHERE room_id = @room_id
                  AND status = 'active'
                  AND start_time < @end_time
                  AND end_time > @start_time
            )
        `);

    if (result.recordset.length === 0) {
        throw httpError('That room is already booked during that time', 409);
    }

    return result.recordset[0];
}

export async function listReservationsForRoom(database, room_id) {
    const result = await database
        .request()
        .input('room_id', sql.Int, room_id)
        .query(`
            SELECT reservation_id, room_id, user_id, start_time, end_time, status
            FROM reservation
            WHERE room_id = @room_id
              AND status = 'active'
              AND end_time > SYSUTCDATETIME()
            ORDER BY start_time
        `);

    return result.recordset;
}

export async function cancelReservation(database, reservation_id) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservation_id)
        .query(`
            UPDATE reservation
            SET status = 'cancelled'
            WHERE reservation_id = @reservation_id AND status = 'active'
        `);

    if (result.rowsAffected[0] === 0) {
        throw httpError('Reservation not found', 404);
    }

    return { reservation_id: Number(reservation_id), status: 'cancelled' };
}
