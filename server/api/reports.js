import sql from 'mssql'

const DATE_COLUMNS = new Set(['Borrowed', 'Due', 'Returned', 'Requested', 'Pick up by']);
const MONEY_COLUMNS = new Set(['Projected fine', 'Fine', 'Amount paid', 'Assessed', 'Collected', 'Outstanding']);

function formatCell(column, value) {
    if (value === null || value === undefined) {
        return '—';
    }
    if (DATE_COLUMNS.has(column)) {
        const [y, m, d] = String(value).split('-');
        return `${m}-${d}-${y}`;
    }
    return MONEY_COLUMNS.has(column) ? money(value) : value;
}

function toTable(recordset) {
    const columns = Object.keys(recordset.columns);
    const rows = recordset.map((row) => columns.map((column) => formatCell(column, row[column])));
    return { columns, rows };
}

function toDetails(recordset, source, keep = () => true) {
    const columns = Object.keys(recordset.columns);
    const rows = recordset.filter(keep).map((row) => columns.map((column) => formatCell(column, row[column])));
    return { columns, rows, source };
}

const localTime = (column) =>
    `FORMAT(${column} AT TIME ZONE 'UTC' AT TIME ZONE 'Central Standard Time', 'MM-dd-yyyy hh:mm tt')`;

const auditTime = (trigger) => `(
                    SELECT TOP 1 ${localTime('al.logged_at')}
                    FROM audit_log AS al
                    WHERE al.trigger_name = '${trigger}'
                      AND al.message LIKE CONCAT('Loan ', l.loan_id, ':%')
                    ORDER BY al.log_id DESC
                )`;

const MEMBER_COLUMNS = `
                       u.user_id AS [Member ID],
                       u.first_name + N' ' + u.last_name AS [Member],
                       u.email AS [Email],
                       CASE WHEN u.is_faculty = 1 THEN N'Faculty' ELSE N'Student' END AS [Role]`;

const LOAN_COLUMNS = `
                       l.loan_id AS [Loan #],
                       l.copy_id AS [Copy #],
                       COALESCE(b.title, m.title) AS [Title],
                       CASE WHEN c.book_id IS NOT NULL THEN N'Book' WHEN c.media_id IS NOT NULL THEN N'Media' END AS [Type],
                       b.isbn AS [ISBN],
                       CONVERT(char(10), l.borrow_date, 23) AS [Borrowed],
                       ${auditTime('trg_loan_checkout')} AS [Checked out at],
                       CONVERT(char(10), l.due_date, 23) AS [Due],
                       CONVERT(char(10), l.return_date, 23) AS [Returned],
                       ${auditTime('trg_loan_return')} AS [Returned at],
                       CASE WHEN l.loan_id IS NULL THEN NULL
                            WHEN l.return_date IS NULL AND l.due_date < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date) THEN N'Overdue'
                            WHEN l.return_date IS NULL THEN N'On loan'
                            WHEN l.return_date > l.due_date THEN N'Returned late'
                            ELSE N'Returned on time' END AS [Outcome],
                       fn.amount AS [Fine]`;

const LOAN_SOURCE = 'loan, user, copies, book, media, fine, audit_log';

async function loanDetails(database, f, keep) {
    const result = await withFilters(database.request(), f)
        .query(`
                SELECT${LOAN_COLUMNS},${MEMBER_COLUMNS}
                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN fine AS fn ON fn.loan_id = l.loan_id
                WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                ORDER BY l.borrow_date DESC, l.loan_id DESC
            `);

    return toDetails(result.recordset, LOAN_SOURCE, keep);
}

async function fineDetails(database, f) {
    const result = await withFilters(database.request(), f)
        .query(`
                SELECT fs.fine_id AS [Fine #],
                       fs.amount AS [Fine],
                       DATEDIFF(day, l.due_date, l.return_date) AS [Days late],
                       CASE WHEN fs.paid_status = 1 THEN N'Paid'
                            WHEN fs.total_paid > 0 THEN N'Partly paid'
                            ELSE N'Unpaid' END AS [Status],
                       p.payment_id AS [Payment #],
                       p.amount_paid AS [Amount paid],
                       ${localTime('p.payment_date')} AS [Paid at],
                       p.payment_method AS [Method],
                       s.first_name + N' ' + s.last_name AS [Received by],
                       r.transaction_code AS [Receipt],
                       ${localTime('r.issue_date')} AS [Receipt issued at],
                       l.loan_id AS [Loan #],
                       l.copy_id AS [Copy #],
                       COALESCE(b.title, m.title) AS [Title],
                       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE N'Media' END AS [Type],
                       CONVERT(char(10), l.due_date, 23) AS [Due],
                       CONVERT(char(10), l.return_date, 23) AS [Returned],${MEMBER_COLUMNS}
                FROM fine_status AS fs
                JOIN loan AS l ON l.loan_id = fs.loan_id
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN payments AS p ON p.fine_id = fs.fine_id
                LEFT JOIN receipts AS r ON r.payment_id = p.payment_id
                LEFT JOIN staff AS s ON s.staff_id = p.staff_id
                WHERE l.return_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                ORDER BY l.return_date DESC, fs.fine_id DESC, p.payment_id
            `);

    return toDetails(result.recordset, 'fine_status, fine, payments, receipts, staff, loan, user, copies, book, media');
}

async function activityDetails(database, f) {
    const result = await withFilters(database.request(), f)
        .query(`
                SELECT${MEMBER_COLUMNS},${LOAN_COLUMNS}
                FROM [user] AS u
                LEFT JOIN (
                    SELECT l.loan_id, l.user_id, l.copy_id, l.borrow_date, l.due_date, l.return_date
                    FROM loan AS l
                    JOIN copies AS c ON c.copy_id = l.copy_id
                    LEFT JOIN book AS b ON b.book_id = c.book_id
                    LEFT JOIN media AS m ON m.media_id = c.media_id
                    WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + ITEM_FILTERS + `
                ) AS l ON l.user_id = u.user_id
                LEFT JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN fine AS fn ON fn.loan_id = l.loan_id
                WHERE 1 = 1` + MEMBER_FILTERS + `
                ORDER BY u.last_name, u.first_name, l.borrow_date DESC, l.loan_id DESC
            `);

    return toDetails(result.recordset, LOAN_SOURCE);
}

async function authorDetails(database, f) {
    const result = await withFilters(database.request(), f)
        .query(`
                SELECT a.author_id AS [Author ID],
                       
                        CONCAT_WS(N' ', a.first_name, a.middle_name, a.last_name) AS [Author],${LOAN_COLUMNS},${MEMBER_COLUMNS}

                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN fine AS fn ON fn.loan_id = l.loan_id
                JOIN book_author AS ba ON ba.book_id = b.book_id
                JOIN author AS a ON a.author_id = ba.author_id
                WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                ORDER BY [Author], l.borrow_date DESC, l.loan_id DESC
            `);

    return toDetails(result.recordset, `${LOAN_SOURCE}, author, book_author`);
}

async function inventoryDetails(database, f) {
    const result = await withFilters(database.request(), f)
        .query(`
                SELECT c.copy_id AS [Copy #],
                       COALESCE(b.title, m.title) AS [Title],
                       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE m.media_type END AS [Type],
                       b.isbn AS [ISBN],
                       CASE WHEN l.loan_id IS NOT NULL THEN N'On loan'
                            WHEN c.is_available = 1 THEN N'Available'
                            WHEN w.waitlist_id IS NOT NULL THEN N'On hold'
                            ELSE N'Unavailable' END AS [Status],
                       l.loan_id AS [Loan #],
                       COALESCE(u.user_id, hu.user_id) AS [Member ID],
                       COALESCE(u.first_name + N' ' + u.last_name, hu.first_name + N' ' + hu.last_name) AS [Member],
                       COALESCE(u.email, hu.email) AS [Email],
                       CONVERT(char(10), l.borrow_date, 23) AS [Borrowed],
                       ${auditTime('trg_loan_checkout')} AS [Checked out at],
                       CONVERT(char(10), l.due_date, 23) AS [Due],
                       w.waitlist_id AS [Hold #],
                       CONVERT(char(10), w.expiration_date, 23) AS [Pick up by]
                FROM copies AS c
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN loan AS l ON l.copy_id = c.copy_id AND l.return_date IS NULL
                LEFT JOIN [user] AS u ON u.user_id = l.user_id
                LEFT JOIN waitlist AS w ON w.held_copy_id = c.copy_id AND w.status = 'ready'
                LEFT JOIN [user] AS hu ON hu.user_id = w.user_id
                WHERE c.is_active = 1
                  AND COALESCE(b.is_active, m.is_active) = 1` + ITEM_FILTERS + `
                ORDER BY [Title], c.copy_id
            `);

    return toDetails(result.recordset, 'copies, book, media, loan, user, waitlist, audit_log');
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))
        || new Date(value).toISOString().slice(0, 10) !== value) {
        throw badRequest('Dates must look like 2026-10-01');
    }
    return value;
}

const likeSafe = (s) => (s ? String(s).replace(/[[%_]/g, '[$&]') : s);

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
                       CASE WHEN l.due_date < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date) THEN N'Overdue'
                            WHEN DATEDIFF(day, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date), l.due_date) <= 2 THEN N'Due soon'
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
                       DATEDIFF(day, l.due_date, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date)) AS [Days overdue],
                       CAST(5 + DATEDIFF(day, l.due_date, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date)) / 7 AS decimal(8,2)) AS [Projected fine]
                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                WHERE l.return_date IS NULL
                  AND l.due_date < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date)
                ORDER BY [Days overdue] DESC, [Loan #]
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
            .input('search', sql.NVarChar(100), likeSafe(term))
            .query(`
                SELECT b.title AS [Title],
                       N'Book' AS [Type],
                
                         (SELECT STRING_AGG(CONCAT_WS(N' ', a.first_name, a.middle_name, a.last_name), N', ') WITHIN GROUP (ORDER BY a.author_id)

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
                                     AND CONCAT_WS(N' ', a.first_name, a.middle_name, a.last_name) LIKE N'%' + @search + N'%'))

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

    if (id === 'hold-queue') {
        const [kind, rawId] = String(params.item || '').split(':');
        const itemId = Number(rawId);
        if ((kind !== 'book' && kind !== 'media') || !Number.isInteger(itemId)) {
            throw badRequest('Choose a book or media item.');
        }

        const result = await database
            .request()
            .input('book_id', sql.Int, kind === 'book' ? itemId : null)
            .input('media_id', sql.Int, kind === 'media' ? itemId : null)
            .query(`
                SELECT ROW_NUMBER() OVER (ORDER BY CASE w.status WHEN 'ready' THEN 0 ELSE 1 END, w.request_time, w.waitlist_id) AS [Position],
                       u.first_name + N' ' + u.last_name AS [Member],
                       CONVERT(char(10), CAST(w.request_time AS datetimeoffset) AT TIME ZONE 'Central Standard Time', 23) AS [Requested],
                       CASE w.status WHEN 'ready' THEN N'Ready' ELSE N'Waiting' END AS [Status],
                      
                                              
                       CASE WHEN w.status = 'ready'
                            THEN CONVERT(char(10), DATEADD(day, 3, COALESCE(w.ready_date,
                                 CAST(CAST(w.request_time AS datetimeoffset) AT TIME ZONE 'Central Standard Time' AS date))), 23)
                       END AS [Pick up by]

                FROM waitlist AS w
                JOIN [user] AS u ON u.user_id = w.user_id
                WHERE w.status IN ('waiting', 'ready')
                  AND ((@book_id IS NOT NULL AND w.book_id = @book_id)
                    OR (@media_id IS NOT NULL AND w.media_id = @media_id))
                ORDER BY CASE w.status WHEN 'ready' THEN 0 ELSE 1 END, w.request_time, w.waitlist_id
            `);

        return toTable(result.recordset);
    }

    throw badRequest('Unknown query.');
}

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
        .input('keyword', sql.NVarChar(100), likeSafe(f.keyword));
}

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
            SELECT a.author_id, a.first_name, a.middle_name, a.last_name,
                   (SELECT STRING_AGG(b.isbn, N', ')
                    FROM book_author AS ba
                    JOIN book AS b ON b.book_id = ba.book_id
                    WHERE ba.author_id = a.author_id AND b.isbn IS NOT NULL) AS isbns
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
        const titles = new Set(rows.map((r) => `${r['Type']}:${r['Title']}`));
        return {
            ...table,
            details: await loanDetails(database, f, (r) => titles.has(`${r['Type']}:${r['Title']}`)),
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
            details: await fineDetails(database, f),
            stats: [
                { label: 'Assessed', value: money(total('Assessed')) },
                { label: 'Collected', value: money(total('Collected')) },
                { label: 'Outstanding', value: money(total('Outstanding')) },
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
        const result = await withFilters(database.request(), f)
            .query(`
                SELECT CASE WHEN u.is_faculty = 1 THEN N'Faculty' ELSE N'Student' END AS [Role],
                       COUNT(DISTINCT u.user_id) AS [Members],
                       COUNT(l.loan_id) AS [Total loans],
                       SUM(CASE WHEN l.loan_id IS NOT NULL AND l.return_date IS NULL THEN 1 ELSE 0 END) AS [Active loans],
                       SUM(CASE WHEN l.return_date IS NULL AND l.due_date < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date) THEN 1 ELSE 0 END) AS [Overdue now],
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
                WHERE u.is_active = 1` + MEMBER_FILTERS + `
                GROUP BY u.is_faculty
                ORDER BY [Role] DESC
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        return {
            ...table,
            details: await activityDetails(database, f),
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

    if (id === 'history') {
        const result = await withFilters(database.request(), f)
            .query(`
                SELECT l.loan_id AS [Loan #],
                       u.first_name + N' ' + u.last_name AS [Member],
                       COALESCE(b.title, m.title) AS [Title],
                       b.isbn AS [ISBN],
                       CONVERT(char(10), l.borrow_date, 23) AS [Borrowed],
                       CONVERT(char(10), l.due_date, 23) AS [Due],
                       CONVERT(char(10), l.return_date, 23) AS [Returned],
                       CASE WHEN l.return_date IS NULL AND l.due_date < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS date) THEN N'Overdue'
                            WHEN l.return_date IS NULL THEN N'On loan'
                            WHEN l.return_date > l.due_date THEN N'Returned late'
                            ELSE N'Returned on time' END AS [Outcome],
                       fn.amount AS [Fine]
                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN fine AS fn ON fn.loan_id = l.loan_id
                WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                ORDER BY l.borrow_date DESC, l.loan_id DESC
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        const late = rows.filter((r) => r['Outcome'] === 'Overdue' || r['Outcome'] === 'Returned late').length;
        return {
            ...table,
            details: await loanDetails(database, f),
            stats: [
                { label: 'Loans', value: String(rows.length) },
                { label: 'Late or overdue', value: String(late) },
                { label: 'Fines from these loans', value: money(rows.reduce((sum, r) => sum + Number(r['Fine'] || 0), 0)) },
            ],
        };
    }

    if (id === 'authors') {
        const result = await withFilters(database.request(), { ...f, kind: 'book', authorId: null })
            .query(`
                SELECT CONCAT_WS(N' ', a.first_name, a.middle_name, a.last_name) AS [Author],
                       COUNT(*) AS [Loans],
                       COUNT(DISTINCT b.book_id) AS [Titles borrowed]
                FROM loan AS l
                JOIN [user] AS u ON u.user_id = l.user_id
                JOIN copies AS c ON c.copy_id = l.copy_id
                JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                JOIN book_author AS ba ON ba.book_id = b.book_id
                JOIN author AS a ON a.author_id = ba.author_id
                WHERE l.borrow_date BETWEEN CAST(@from AS date) AND CAST(@to AS date)` + MEMBER_FILTERS + ITEM_FILTERS + `
                GROUP BY a.author_id, a.first_name, a.middle_name, a.last_name
                ORDER BY [Loans] DESC, [Author]
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        const top = rows.slice(0, 10);
        return {
            ...table,
            details: await authorDetails(database, { ...f, kind: 'book', authorId: null }),
            stats: [
                { label: 'Authors borrowed', value: String(rows.length) },
                { label: 'Most borrowed author', value: rows.length ? rows[0]['Author'] : '-' },
            ],
            chart: {
                title: 'Loans per author',
                labels: top.map((r) => r['Author']),
                values: top.map((r) => r['Loans']),
            },
        };
    }

    if (id === 'inventory') {
        const result = await withFilters(database.request(), f)
            .query(`
                SELECT COALESCE(b.title, m.title) AS [Title],
                       CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE m.media_type END AS [Type],
                       COUNT(*) AS [Total copies],
                       SUM(CASE WHEN c.is_available = 1 THEN 1 ELSE 0 END) AS [Available],
                       SUM(CASE WHEN ol.copy_id IS NOT NULL THEN 1 ELSE 0 END) AS [On loan],
                       SUM(CASE WHEN hc.held_copy_id IS NOT NULL THEN 1 ELSE 0 END) AS [Held for pickup]
                FROM copies AS c
                LEFT JOIN book AS b ON b.book_id = c.book_id
                LEFT JOIN media AS m ON m.media_id = c.media_id
                LEFT JOIN (SELECT DISTINCT copy_id FROM loan WHERE return_date IS NULL) AS ol ON ol.copy_id = c.copy_id
                LEFT JOIN (SELECT DISTINCT held_copy_id FROM waitlist WHERE status = 'ready') AS hc ON hc.held_copy_id = c.copy_id
                WHERE c.is_active = 1
                  AND COALESCE(b.is_active, m.is_active) = 1` + ITEM_FILTERS + `
                GROUP BY COALESCE(b.title, m.title), CASE WHEN c.book_id IS NOT NULL THEN N'Book' ELSE m.media_type END
                ORDER BY [Title]
            `);

        const table = toTable(result.recordset);
        const rows = result.recordset;
        const total = rows.reduce((sum, r) => sum + r['Total copies'], 0);
        const available = rows.reduce((sum, r) => sum + r['Available'], 0);
        return {
            ...table,
            details: await inventoryDetails(database, f),
            stats: [
                { label: 'Total copies', value: String(total) },
                { label: 'On the shelf', value: total ? `${Math.round((available / total) * 100)}%` : '0%' },
            ],
            chart: {
                title: 'Copies available per title',
                labels: rows.map((r) => r['Title']),
                values: rows.map((r) => r['Available']),
            },
        };
    }

    throw badRequest('Unknown report.');
}
