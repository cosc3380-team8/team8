import sql from 'mssql';

export async function listStaff(database) {
    const result = await database
        .request()
        .query(`
                SELECT
                s.first_name,
                s.last_name,
                s.email,
                s.is_active,
                s.is_admin
            FROM 
                staff AS s
            ORDER BY s.staff_id DESC
        `);

    return result.recordset;
}

export async function saveStaff(database, staff) {
    const result = await database
        .request()
        .input('first_name', sql.NVarChar(30), staff.first_name)
        .input('last_name', sql.NVarChar(30), staff.last_name)
        .input('email', sql.NVarChar(100), staff.email)
        .input('is_active', sql.Bit, staff.is_active)
        .input('is_admin', sql.Bit, staff.is_admin)
        .query(`
            INSERT INTO staff (first_name, last_name, email, is_active, is_admin)
            VALUES (@first_name, @last_name, @email, @is_active, @is_admin);
            SELECT SCOPE_IDENTITY() AS staff_id;
        `);
    return result.recordset[0].staff_id;
}

export async function deleteStaff(database, staffId) {
    const result = await database
        .request()
        .input('staffId', sql.Int, staffId)
        .query(`
            UPDATE staff
            SET is_active = 0
            WHERE staff_id = @staffId;
        `);
    return result.rowsAffected[0] > 0;
}
