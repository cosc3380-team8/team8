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
                    CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                    CASE
                        WHEN rr.end_time < GETDATE() THEN CAST(1 AS BIT)
                        ELSE CAST(0 AS BIT)
                    END AS archived
                FROM room_reservations AS rr
                JOIN room AS r ON rr.room_id = r.room_id
                JOIN [user] AS u ON rr.user_id = u.user_id
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
                    CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                    CASE
                        WHEN rr.end_time < GETDATE() THEN CAST(1 AS BIT)
                        ELSE CAST(0 AS BIT)
                    END AS archived
                FROM room_reservations AS rr
                JOIN room AS r ON rr.room_id = r.room_id
                JOIN [user] AS u ON rr.user_id = u.user_id
                ORDER BY rr.start_time DESC
            `);
            
        return result.recordset;
    }
}

export async function saveRoomReservation(database, input) {
    const result = await database
        .request()
        .input('p_reservation_id', sql.Int, input.reservation_id ?? null)
        .input('p_user_id', sql.Int, input.userId)
        .input('p_room_id', sql.Int, input.roomId)
        .input('p_start', sql.DateTime2(0), input.start)
        .input('p_end', sql.DateTime2(0), input.end)
        .execute('dbo.save_room_reservation');

    return result.recordset[0];
}