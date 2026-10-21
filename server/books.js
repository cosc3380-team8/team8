import sql from 'mssql';

export async function listBooks(database, search = '') {
    const term = String(search).trim();

    if (term.length > 100) {
        const error = new Error('Search query is too long');
        error.statusCode = 400;
        throw error;
    }

    const result = await database.poolconnection
        .request()
        .input('search', sql.NVarChar(100), term)
        .query(`
            SELECT
                b.book_id,
                b.title,
                b.publisher,
                b.isbn,
                b.publish_year,
                (
                SELECT STRING_AGG(CONCAT(a.first_name, ' ', a.last_name), ', ')
                FROM book_author AS ba
                JOIN author AS a ON a.author_id = ba.author_id
                WHERE ba.book_id = b.book_id
                ) AS author_name,
                (
                SELECT COUNT(*)
                FROM copies AS c
                WHERE c.book_id = b.book_id
                ) AS total_copies,
                (
                SELECT COUNT(*)
                FROM copies AS c
                WHERE c.book_id = b.book_id
                    AND c.is_active = 1
                    AND c.is_available = 1
                ) AS available_copies,
                b.is_active
            FROM book AS b
            WHERE b.is_active = 1
                AND b.title LIKE N'%' + @search + N'%'
            ORDER BY b.title
        `);

    return result.recordset;
}