import sql from 'mssql'

// The 3 data queries and 3 data reports. Same SQL as team8_queries_reports.sql.
// Each one returns { columns, rows } so the Queries and Reports pages can show it as a table.

function toTable(recordset) {
    const columns = Object.keys(recordset.columns);
    const rows = recordset.map((row) => columns.map((column) => row[column]));
    return { columns, rows };
}

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function readDate(value, fallback) {
    if (!value) {
        return fallback;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw badRequest('Dates must look like 2026-10-01');
    }
    return value;
}

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export async function runQuery(database, id, params) {
    if (id === 'member-items') {
        const userId = Number(params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw badRequest('Choose a member.');
        }

        const result = await database
            .request()
            .input('user_id', sql.Int, userId)
            .query(`
                SELECT l.loan_id AS [Loan #],
                       COALESCE(b.title, m.title) AS [Title],
                       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END AS [Type],
                       CONVERT(char(10), l.borrow_date, 23) AS [Borrowed],
                       CONVERT(char(10), l.due_date, 23) AS [Due],
                       CASE WHEN l.due_date < CAST(GETDATE() AS date) THEN N'Overdue'
                            WHEN DATEDIFF(day, CAST(GETDATE() AS date), l.due_date) <= 2 THEN N'Due soon'
                            ELSE N'On loan' END AS [Status]
                FROM loan AS l
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                WHERE l.user_id = @user_id
                  AND l.return_date IS NULL
                ORDER BY l.due_date
            `);

        return toTable(result.recordset);
    }

    if (id === 'overdue') {
        const result = await database
            .request()
            .query(`
                SELECT l.loan_id AS [Loan #],
                       u.first_name + N' ' + u.last_name AS [Member],
                       CASE WHEN u.is_faculty = 1 THEN N'Faculty' ELSE N'Student' END AS [Role],
                       COALESCE(b.title, m.title) AS [Title],
                       CONVERT(char(10), l.due_date, 23) AS [Due],
                       DATEDIFF(day, l.due_date, CAST(GETDATE() AS date)) AS [Days overdue],
                       CAST(5 + DATEDIFF(day, l.due_date, CAST(GETDATE() AS date)) / 7 AS decimal(8,2)) AS [Projected fine]
                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                WHERE l.return_date IS NULL
                  AND l.due_date < CAST(GETDATE() AS date)
                ORDER BY [Days overdue] DESC
            `);

        return toTable(result.recordset);
    }

    if (id === 'availability') {
        const term = String(params.search || '').trim();
        if (term.length > 100) {
            throw badRequest('Search query is too long');
        }

        const result = await database
            .request()
            .input('search', sql.NVarChar(100), term)
            .query(`
                SELECT b.title AS [Title],
                       N'Book' AS [Type],
                       (SELECT STRING_AGG(a.first_name + N' ' + a.last_name, N', ') WITHIN GROUP (ORDER BY a.author_id)
                        FROM book_author AS ba
                        JOIN author AS a ON a.author_id = ba.author_id
                        WHERE ba.book_id = b.book_id) AS [Author],
                       (SELECT COUNT(*) FROM copies AS c
                        WHERE c.book_id = b.book_id AND c.is_active = 1) AS [Total copies],
                       (SELECT COUNT(*) FROM copies AS c
                        WHERE c.book_id = b.book_id AND c.is_active = 1 AND c.is_available = 1) AS [Available]
                FROM book AS b
                WHERE b.is_active = 1
                  AND (b.title LIKE N'%' + @search + N'%'
                       OR EXISTS (SELECT 1
                                  FROM book_author AS ba
                                  JOIN author AS a ON a.author_id = ba.author_id
                                  WHERE ba.book_id = b.book_id
                                    AND a.first_name + N' ' + a.last_name LIKE N'%' + @search + N'%'))
                UNION ALL
                SELECT m.title,
                       m.media_type,
                       NULL,
                       (SELECT COUNT(*) FROM copies AS c
                        WHERE c.media_id = m.media_id AND c.is_active = 1),
                       (SELECT COUNT(*) FROM copies AS c
                        WHERE c.media_id = m.media_id AND c.is_active = 1 AND c.is_available = 1)
                FROM media AS m
                WHERE m.is_active = 1
                  AND m.title LIKE N'%' + @search + N'%'
                ORDER BY [Title]
            `);

        return toTable(result.recordset);
    }

    throw badRequest('Unknown query.');
}

// Report filters from the Reports page. Empty ones are sent to SQL as NULL and skipped.
function readFilters(params) {
    const userId = params.userId ? Number(params.userId) : null;
    const authorId = params.authorId ? Number(params.authorId) : null;
    if ((userId !== null && !Number.isInteger(userId)) || (authorId !== null && !Number.isInteger(authorId))) {
        throw badRequest('Unknown member or author.');
    }
    const keyword = params.keyword ? String(params.keyword).trim() : '';
    if (keyword.length > 100) {
        throw badRequest('Search word is too long');
    }
    const filters = {
        from: readDate(params.from, '2000-01-01'),
        to: readDate(params.to, '2100-12-31'),
        userId,
        authorId,
        role: params.role === 'student' || params.role === 'faculty' ? params.role : null,
        kind: params.kind === 'book' || params.kind === 'media' ? params.kind : null,
        keyword: keyword || null,
    };
    if (filters.from > filters.to) {
        throw badRequest('The start date must be before the end date.');
    }
    return filters;
}

function withFilters(request, f) {
    return request
        .input('from', sql.NVarChar(10), f.from)
        .input('to', sql.NVarChar(10), f.to)
        .input('userId', sql.Int, f.userId)
        .input('authorId', sql.Int, f.authorId)
        .input('role', sql.NVarChar(10), f.role)
        .input('kind', sql.NVarChar(10), f.kind)
        .input('keyword', sql.NVarChar(100), f.keyword);
}

// Filters on the member (u) and on the item (c, b, m).
const MEMBER_FILTERS = `
                  AND (@userId IS NULL OR u.user_id = @userId)
                  AND (@role IS NULL OR u.is_faculty = CASE WHEN @role = 'faculty' THEN 1 ELSE 0 END)`;
const ITEM_FILTERS = `
                  AND (@authorId IS NULL OR EXISTS (SELECT 1 FROM book_author AS ba
                                                    WHERE ba.book_id = c.book_id AND ba.author_id = @authorId))
                  AND (@keyword IS NULL OR COALESCE(b.title, m.title) LIKE N'%' + @keyword + N'%')
                  AND (@kind IS NULL OR (@kind = 'book' AND c.book_id IS NOT NULL)
                                     OR (@kind = 'media' AND c.media_id IS NOT NULL))`;

export async function listReportAuthors(database) {
    const result = await database
        .request()
        .query(`
            SELECT a.author_id, a.first_name, a.last_name
            FROM author AS a
            WHERE EXISTS (SELECT 1 FROM book_author AS ba WHERE ba.author_id = a.author_id)
            ORDER BY a.last_name, a.first_name
        `);

    return result.recordset;
}

export async function runReport(database, id, params) {
    const f = readFilters(params);

    if (id === 'popular') {
        const result = await withFilters(database.request(), f)
            .query(`
                SELECT TOP 10
                       COALESCE(b.title, m.title) AS [Title],
                       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END AS [Type],
                       COUNT(*) AS [Times borrowed],
                       SUM(CASE WHEN u.is_faculty = 0 THEN 1 ELSE 0 END) AS [By students],
                       SUM(CASE WHEN u.is_faculty = 1 THEN 1 ELSE 0 END) AS [By faculty]
                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                GROUP BY COALESCE(b.title, m.title),
                         CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END
                ORDER BY [Times borrowed] DESC, [Title]
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        return {
            ...table,
            stats: [
                { label: 'Loans of these titles', value: String(rows.reduce((sum, r) => sum + r['Times borrowed'], 0)) },
                { label: 'Most borrowed', value: rows.length ? rows[0]['Title'] : '-' },
            ],
            chart: {
                title: 'Times borrowed',
                labels: rows.map((r) => r['Title']),
                values: rows.map((r) => r['Times borrowed']),
            },
        };
    }

    if (id === 'fines') {
        const result = await withFilters(database.request(), f)
            .query(`
                SELECT FORMAT(l.return_date, 'yyyy-MM') AS [Month],
                       COUNT(*) AS [Fines issued],
                       SUM(fs.amount) AS [Assessed],
                       SUM(fs.total_paid) AS [Collected],
                       SUM(CASE WHEN fs.total_paid >= fs.amount THEN 0 ELSE fs.amount - fs.total_paid END) AS [Outstanding],
                       SUM(CASE WHEN fs.paid_status = 1 THEN 1 ELSE 0 END) AS [Fully paid]
                FROM fine_status AS fs
                JOIN loan AS l ON l.loan_id = fs.loan_id
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                WHERE l.return_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                GROUP BY FORMAT(l.return_date, 'yyyy-MM')
                ORDER BY [Month]
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        const total = (column) => rows.reduce((sum, r) => sum + Number(r[column]), 0);
        return {
            ...table,
            stats: [
                { label: 'Assessed', value: money(total('Assessed')) },
                { label: 'Collected', value: money(total('Collected')) },
                { label: 'Still owed', value: money(total('Outstanding')) },
            ],
            chart: {
                title: 'Fines assessed per month',
                labels: rows.map((r) => r['Month']),
                values: rows.map((r) => Number(r['Assessed'])),
                format: 'money',
            },
        };
    }

    if (id === 'activity') {
        // Item filters go inside the loan subquery so members with no matching loans still count.
        const result = await withFilters(database.request(), f)
            .query(`
                SELECT CASE WHEN u.is_faculty = 1 THEN N'Faculty' ELSE N'Student' END AS [Role],
                       COUNT(DISTINCT u.user_id) AS [Members],
                       COUNT(l.loan_id) AS [Total loans],
                       SUM(CASE WHEN l.loan_id IS NOT NULL AND l.return_date IS NULL THEN 1 ELSE 0 END) AS [Active loans],
                       SUM(CASE WHEN l.return_date IS NULL AND l.due_date < CAST(GETDATE() AS date) THEN 1 ELSE 0 END) AS [Overdue now],
                       SUM(CASE WHEN l.return_date > l.due_date THEN 1 ELSE 0 END) AS [Returned late],
                       CAST(COUNT(l.loan_id) * 1.0 / COUNT(DISTINCT u.user_id) AS decimal(6,2)) AS [Avg loans / member]
                FROM [user] AS u
                LEFT JOIN (
                    SELECT l.loan_id, l.user_id, l.due_date, l.return_date
                    FROM loan AS l
                    JOIN copies AS c ON c.copy_id = l.copy_id
                    LEFT JOIN book AS b ON b.book_id = c.book_id
                    LEFT JOIN media AS m ON m.media_id = c.media_id
                    WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + ITEM_FILTERS + `
                ) AS l ON l.user_id = u.user_id
                WHERE 1 = 1` + MEMBER_FILTERS + `
                GROUP BY u.is_faculty
                ORDER BY [Role] DESC
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        return {
            ...table,
            stats: [
                { label: 'Total loans', value: String(rows.reduce((sum, r) => sum + r['Total loans'], 0)) },
                { label: 'Overdue now', value: String(rows.reduce((sum, r) => sum + r['Overdue now'], 0)) },
            ],
            chart: {
                title: 'Total loans by role',
                labels: rows.map((r) => r['Role']),
                values: rows.map((r) => r['Total loans']),
            },
        };
    }

    throw badRequest('Unknown report.');
}
