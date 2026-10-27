import sql from 'mssql'
import bcrypt from 'bcryptjs'

// Login and signup against the user and staff tables. Passwords are stored as bcrypt hashes.

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

export async function login(database, email, password) {
    const e = String(email || '').trim();
    if (!e || !password) {
        throw badRequest('Enter your email and password.');
    }

    const result = await database
        .request()
        .input('email', sql.NVarChar(100), e)
        .query(`
            SELECT u.user_id AS id, u.first_name, u.last_name, u.email, u.password,
                   CASE WHEN u.is_faculty = 1 THEN 'faculty' ELSE 'student' END AS role
            FROM [user] AS u
            WHERE u.email = @email AND u.is_active = 1
            UNION ALL
            SELECT s.staff_id, s.first_name, s.last_name, s.email, s.password,
                   CASE WHEN s.is_admin = 1 THEN 'admin' ELSE 'employee' END
            FROM staff AS s
            WHERE s.email = @email AND s.is_active = 1
        `);

    const account = result.recordset[0];
    if (!account || !(await bcrypt.compare(String(password), account.password))) {
        throw badRequest('Invalid email or password.');
    }

    return {
        id: account.id,
        name: `${account.first_name} ${account.last_name}`,
        email: account.email,
        role: account.role,
    };
}

export async function signup(database, input) {
    const first_name = String(input.first_name || '').trim();
    const last_name = String(input.last_name || '').trim();
    const email = String(input.email || '').trim();
    const password = String(input.password || '');
    const role = input.role === 'faculty' ? 'faculty' : 'student';

    if (!first_name || !last_name || !email || !password) {
        throw badRequest('Fill in every field.');
    }
    if (first_name.length > 30 || last_name.length > 30) {
        throw badRequest('Names can be at most 30 characters.');
    }
    if (email.length > 100 || !/^\S+@\S+\.\S+$/.test(email)) {
        throw badRequest('Enter a valid email address.');
    }
    if (password.length < 6) {
        throw badRequest('Password must be at least 6 characters.');
    }

    const taken = await database
        .request()
        .input('email', sql.NVarChar(100), email)
        .query(`
            SELECT 1 AS taken FROM [user] WHERE email = @email
            UNION ALL
            SELECT 1 FROM staff WHERE email = @email
        `);
    if (taken.recordset.length > 0) {
        throw badRequest('That email address is already in use.');
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await database
        .request()
        .input('first_name', sql.NVarChar(30), first_name)
        .input('last_name', sql.NVarChar(30), last_name)
        .input('email', sql.NVarChar(100), email)
        .input('password', sql.NVarChar(255), hash)
        .input('is_faculty', sql.Bit, role === 'faculty' ? 1 : 0)
        .query(`
            INSERT INTO [user] (first_name, last_name, email, password, is_faculty)
            VALUES (@first_name, @last_name, @email, @password, @is_faculty);
            SELECT CAST(SCOPE_IDENTITY() AS int) AS user_id;
        `);

    return {
        id: result.recordset[0].user_id,
        name: `${first_name} ${last_name}`,
        email,
        role,
    };
}
