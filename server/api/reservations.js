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
                        WHEN rr.end_time < GETDATE() OR rr.is_active = 0 THEN CAST(1 AS BIT)
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
                        WHEN rr.end_time < GETDATE() OR rr.is_active = 0 THEN CAST(1 AS BIT)
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