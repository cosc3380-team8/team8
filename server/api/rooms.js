import sql from 'mssql'

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

export async function listReservations(database, user_id) {
    const result = await database
        .request()
        .input('user_id', sql.Int, user_id)
        .query(`
            SELECT
                rr.reservation_id,
                rr.room_id,
                rr.user_id,
                rr.start_time,
                rr.end_time,
            FROM room_reservations AS rr
            WHERE rr.user_id = @user_id
            ORDER BY rr.start_time DESC
        `);

    return result.recordset;
}

export async function reserveRoom(database, room_id, user_id, start_time, end_time) {
    try {
        const result = await database
            .request()
            .input('room_id', sql.Int, room_id)
            .input('user_id', sql.Int, user_id)
            .input('start_time', sql.DateTime, start_time)
            .input('end_time', sql.DateTime, end_time)
            .query(`
                INSERT INTO room_reservations (room_id, user_id, start_time, end_time)
                VALUES (@room_id, @user_id, @start_time, @end_time)
            `);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}