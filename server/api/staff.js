/* import sql from 'mssql';

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
*/

import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { assertEmailFree } from './auth.js';

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function readStaff(staff) {
    const first_name = String(staff.first_name || '').trim();
    const last_name = String(staff.last_name || '').trim();
    const email = String(staff.email || '').trim();

    if (!first_name || !last_name || !email) {
        throw badRequest('Fill in every field.');
    }
    if (first_name.length > 30 || last_name.length > 30) {
        throw badRequest('Names can be at most 30 characters.');
    }
    if (email.length > 100 || !/^\S+@\S+\.\S+$/.test(email)) {
        throw badRequest('Enter a valid email address.');
    }
    if (staff.password && String(staff.password).length < 6) {
        throw badRequest('Password must be at least 6 characters.');
    }

    return { first_name, last_name, email };
}

async function assertAnotherAdmin(database, staffId) {
    const result = await database
        .request()
        .input('staffId', sql.Int, staffId)
        .query(`
            SELECT
                (SELECT COUNT(*) FROM staff WHERE staff_id = @staffId AND is_admin = 1 AND is_active = 1) AS is_admin,
                (SELECT COUNT(*) FROM staff WHERE staff_id <> @staffId AND is_admin = 1 AND is_active = 1) AS others
        `);

    const { is_admin, others } = result.recordset[0];
    if (is_admin && !others) {
        throw badRequest('At least one active administrator is required.');
    }
}

export async function listStaff(database) {
    const result = await database
        .request()
        .query(`
                SELECT
                s.staff_id,
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
    const { first_name, last_name, email } = readStaff(staff);
    if (!staff.password) {
        throw badRequest('Password is required.');
    }

    await assertEmailFree(database, email);

    const hash = await bcrypt.hash(String(staff.password), 10);
    const result = await database
        .request()
        .input('first_name', sql.NVarChar(30), first_name)
        .input('last_name', sql.NVarChar(30), last_name)
        .input('email', sql.NVarChar(100), email)
        .input('password', sql.NVarChar(255), hash)
        .input('is_active', sql.Bit, staff.is_active !== false)
        .input('is_admin', sql.Bit, !!staff.is_admin)
        .query(`
            INSERT INTO staff (first_name, last_name, email, password, is_active, is_admin)
            VALUES (@first_name, @last_name, @email, @password, @is_active, @is_admin);
            SELECT CAST(SCOPE_IDENTITY() AS int) AS staff_id;
        `);
    return { staff_id: result.recordset[0].staff_id };
}

export async function updateStaff(database, staffId, staff) {
    const { first_name, last_name, email } = readStaff(staff);

    await assertEmailFree(database, email, { table: 'staff', id: staffId });

    if (staff.is_active === false || !staff.is_admin) {
        await assertAnotherAdmin(database, staffId);
    }

    const hash = staff.password ? await bcrypt.hash(String(staff.password), 10) : null;
    const result = await database
        .request()
        .input('staffId', sql.Int, staffId)
        .input('first_name', sql.NVarChar(30), first_name)
        .input('last_name', sql.NVarChar(30), last_name)
        .input('email', sql.NVarChar(100), email)
        .input('password', sql.NVarChar(255), hash)
        .input('is_active', sql.Bit, staff.is_active !== false)
        .input('is_admin', sql.Bit, !!staff.is_admin)
        .query(`
            UPDATE staff
            SET first_name = @first_name,
                last_name = @last_name,
                email = @email,
                password = COALESCE(@password, password),
                is_active = @is_active,
                is_admin = @is_admin
            WHERE staff_id = @staffId
        `);

    if (result.rowsAffected[0] === 0) {
        throw Object.assign(new Error('Staff member not found.'), { statusCode: 404 });
    }
}

export async function deleteStaff(database, staffId) {
    await assertAnotherAdmin(database, staffId);

    const result = await database
        .request()
        .input('staffId', sql.Int, staffId)
        .query(`
            UPDATE staff
            SET is_active = 0
            WHERE staff_id = @staffId;
        `);

    if (result.rowsAffected[0] === 0) {
        throw Object.assign(new Error('Staff member not found.'), { statusCode: 404 });
    }
}
