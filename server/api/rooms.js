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
    const { 
        room_number,
        room_level,
        capacity,
        is_active
    } = room;

    if (room_number.length > 10) {
        const error = new Error('Room number is too long');
        error.statusCode = 400;
        throw error;
    }

    if (room_level < 0 || room_level > 10) {
        const error = new Error('Room level must be between 0 and 10');
        error.statusCode = 400;
        throw error;
    }

    if (capacity < 1 || capacity > 100) {
        const error = new Error('Capacity must be between 1 and 100');
        error.statusCode = 400;
        throw error;
    }

    if (typeof is_active !== 'boolean') {
        const error = new Error('Invalid is_active value');
        error.statusCode = 400;
        throw error;
    }

    try {
        const result = await database
            .request()
            .input('room_number', sql.NVarChar(10), room_number)
            .input('room_level', sql.Int, room_level)
            .input('capacity', sql.Int, capacity)
            .input('is_active', sql.Int, is_active)
            .query(`
                INSERT INTO room (room_number, room_level, capacity, is_active)
                OUTPUT INSERTED.room_id AS room_id
                VALUES (@room_number, @room_level, @capacity, @is_active)
            `);

            const roomId = result.recordset[0].room_id;

        return { room_id: roomId };
    } catch(error) {
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