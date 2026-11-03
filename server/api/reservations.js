import sql from 'mssql'

export async function listReservations(database, user_id) {
    if (user_id !== undefined) {
        if (isNaN(user_id)) {
            const error = new Error('Invalid user_id query parameter');
            error.statusCode = 400;
            throw error;
        }

        const result = await database
            .request()
            .input('user_id', sql.Int, user_id)
            .query(`
                SELECT
                    rr.reservation_id,
                    rr.user_id,
                    rr.room_id,
                    rr.start_time,
                    rr.end_time,
                    r.room_number AS room_number,
                    CONCAT(u.first_name, ' ', u.last_name) AS member_name
                    CASE WHEN rr.is_active = 0 THEN CASE(1 as bit) ELSE CASE(0 as bit) END AS archived
                FROM room_reservations AS rr
                JOIN room AS r ON rr.room_id = r.room_id
                JOIN user AS u ON rr.user_id = u.user_id
                WHERE rr.user_id = @user_id
                ORDER BY rr.start_time DESC
            `);
        
        return result.recordset;
    } else {
        const result = await database
            .request()
            .query(`
                SELECT
                    rr.reservation_id,
                    rr.user_id,
                    rr.room_id,
                    rr.start_time,
                    rr.end_time,
                    r.room_number AS room_number,
                    CONCAT(u.first_name, ' ', u.last_name) AS member_name
                    CASE WHEN rr.is_active = 0 THEN CASE(1 as bit) ELSE CASE(0 as bit) END AS archived
                FROM room_reservations AS rr
                JOIN room AS r ON rr.room_id = r.room_id
                JOIN user AS u ON rr.user_id = u.user_id
                ORDER BY rr.start_time DESC
            `);
            
        return result.recordset;
    }
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