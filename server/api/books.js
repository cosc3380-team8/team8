import sql from 'mssql';

export async function listBooks(database, search = '') {
    const term = String(search).trim();

    if (term.length > 100) {
        const error = new Error('Search query is too long');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
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

export async function addBook(database, book) {
    const { book_id, title, publisher = null, isbn, is_active } = book;
    try {
        const result = await database.poolconnection
            .request()
            .input('book_id', sql.Int, book_id)
            .input('title', sql.NVarChar(150), title)
            .input('publisher', sql.NVarChar(100), publisher)
            .input('isbn', sql.NVarChar(13), isbn)
            .input('is_active', sql.Bit, is_active)
            .query(`
                INSERT INTO book (book_id, title, publisher, isbn, is_active)
                VALUES (@book_id, @title, @publisher, @isbn, @is_active)
            `);
        return result;
    } catch (error) {
        console.error('Error adding book:', error);
        throw error;
    }
}

export async function updateBook(database, book) {
    const { book_id, title, publisher, isbn, is_active } = book;
    try {
        const result = await database.poolconnection
        .request()
        .input('book_id', sql.Int, book_id)
        .input('title', sql.NVarChar(150), title)
        .input('publisher', sql.NVarChar(100), publisher)
        .input('isbn', sql.NVarChar(13), isbn)
        .input('is_active', sql.Bit, is_active)
        .query(`
            UPDATE book
            SET title = @title,
                publisher = @publisher,
                isbn = @isbn,
                is_active = @is_active
            WHERE book_id = @book_id
        `);
        return result;
    } catch (error) {
        console.error('Error updating book:', error);
        throw error;
    }
}

export async function deleteBook(database, bookId) {
    try {
        const result = await database.poolconnection
        .request()
        .input('book_id', sql.Int, bookId)
        .query(`
            UPDATE book
            SET is_active = 0
            WHERE book_id = @book_id
        `);
        return result;
    } catch (error) {
        console.error('Error deleting book:', error);
        throw error;
    }
}
