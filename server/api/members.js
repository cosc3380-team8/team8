/* import sql from 'mssql'

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
*/

import sql from 'mssql'
import bcrypt from 'bcryptjs'
import { assertEmailFree, createMember } from './auth.js'

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

async function hasActiveLoans(database, userId) {
    const result = await database
        .request()
        .input('userId', sql.Int, userId)
        .query(`SELECT COUNT(*) AS count FROM loan WHERE user_id = @userId AND return_date IS NULL`);

    return result.recordset[0].count > 0;
}

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
            ORDER BY u.last_name, u.first_name
        `);

    return result.recordset;
}

export async function saveMember(database, member) {
    const session = await createMember(database, member);
    // the Add form has an Active box; new accounts are active unless it was unticked
    if (member.is_active === false) {
        await database.request()
            .input('userId', sql.Int, session.id)
            .query(`UPDATE [user] SET is_active = 0 WHERE user_id = @userId`);
    }
    return { user_id: session.id };
}

export async function updateMember(database, userId, member) {
    const first_name = String(member.first_name || '').trim();
    const last_name = String(member.last_name || '').trim();
    const email = String(member.email || '').trim();

    if (!first_name || !last_name || !email) {
        throw badRequest('Fill in every field.');
    }
    if (first_name.length > 30 || last_name.length > 30) {
        throw badRequest('Names can be at most 30 characters.');
    }
    if (email.length > 100 || !/^\S+@\S+\.\S+$/.test(email)) {
        throw badRequest('Enter a valid email address.');
    }
    if (member.password && String(member.password).length < 6) {
        throw badRequest('Password must be at least 6 characters.');
    }

    await assertEmailFree(database, email, { table: 'user', id: userId });

    if (member.is_active === false && await hasActiveLoans(database, userId)) {
        throw badRequest('Cannot deactivate: member has items on loan.');
    }

    const hash = member.password ? await bcrypt.hash(String(member.password), 10) : null;
    const result = await database
        .request()
        .input('userId', sql.Int, userId)
        .input('first_name', sql.NVarChar(30), first_name)
        .input('last_name', sql.NVarChar(30), last_name)
        .input('email', sql.NVarChar(100), email)
        .input('password', sql.NVarChar(255), hash)
        .input('is_faculty', sql.Bit, member.role === 'faculty' ? 1 : 0)
        .input('is_active', sql.Bit, member.is_active !== false)
        .query(`
            UPDATE [user]
            SET first_name = @first_name,
                last_name = @last_name,
                email = @email,
                password = COALESCE(@password, password),
                is_faculty = @is_faculty,
                is_active = @is_active
            WHERE user_id = @userId
        `);

    if (result.rowsAffected[0] === 0) {
        throw Object.assign(new Error('Member not found.'), { statusCode: 404 });
    }
    if (member.is_active === false) await cancelActiveHolds(database, userId);
}

// a deactivated member can't pick anything up, so their holds go to the next person
async function cancelActiveHolds(database, userId) {
    const holds = await database
        .request()
        .input('userId', sql.Int, userId)
        .query(`SELECT waitlist_id FROM waitlist WHERE user_id = @userId AND status IN ('waiting', 'ready')`);
    for (const { waitlist_id } of holds.recordset) {
        await database
            .request()
            .input('p_hold_id', sql.Int, waitlist_id)
            .input('p_status', sql.NVarChar(9), 'cancelled')
            .execute('dbo.release_hold');
    }
}

export async function deleteMember(database, userId) {
    if (await hasActiveLoans(database, userId)) {
        throw badRequest('Cannot deactivate: member has items on loan.');
    }

    const result = await database
        .request()
        .input('userId', sql.Int, userId)
        .query(`UPDATE [user] SET is_active = 0 WHERE user_id = @userId`);

    if (result.rowsAffected[0] === 0) {
        throw Object.assign(new Error('Member not found.'), { statusCode: 404 });
    }
    await cancelActiveHolds(database, userId);
}
