import sql from 'mssql'

export async function listMembers(database) {
    const result = await database
        .request()
        .query(`
            SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                CASE WHEN u.is_faculty = 1 THEN 'faculty' ELSE 'student' END AS role,
                u.is_active
            FROM [user] AS u
            WHERE u.is_active = 1
            ORDER BY u.last_name, u.first_name
        `);

    return result.recordset;
}
