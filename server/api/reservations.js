import sql from 'mssql'

export async function listReservations(database, user_id) {
    if (user_id !== null) {
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
    } else {
        const result = await database
            .request()
            .query(`
                SELECT
                    rr.reservation_id,
                    rr.room_id,
                    rr.user_id,
                    rr.start_time,
                    rr.end_time,
                FROM room_reservations AS rr
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