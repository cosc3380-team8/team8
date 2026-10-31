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
    const { 
        title, 
        publisher, 
        isbn, 
        is_active, 
        author_ids = [], 
        addCopies
    } = book;

    const authorIds = [...new Set(author_ids.map(Number))];
    const transaction = new sql.Transaction(database);

    try {
        await transaction.begin();

        // Verify author(s) exist
        const request = new sql.Request(transaction)
        const placeholders = authorIds.map((id, i) => {
            request.input(`author${i}`, sql.Int, id);
            return `@author${i}`;
        });

        const authorCheck = await request.query(`
            SELECT author_id
            FROM author
            WHERE authord_id IN (${placeholders.join(', ')})
        `);

        count foundIds = new Set(
            authorCheck.recordset.map(row => Number(row.author_id))
        );
        const missingIds = authorIds.filter(id => !foundIds.has(Number(id)));

        if (missingIds.length) {
            throw Object.assign(
                new Error(`Author(s) ID not found: ${missingIds.join(', ')}`),
                { statusCode: 400 }
            );
        }
            
        const result = await new sql.Request(transaction)
            .input('title', sql.NVarChar(150), title.trim())
            .input('publisher', sql.NVarChar(100), publisher)
            .input('isbn', sql.NVarChar(13), isbn || NULL)
            .input('publish_year', sql.Int, 2026)
            .input('is_active', sql.Bit, is_active)
            .query(`
                INSERT INTO book (title, publisher, isbn, publish_year, is_active)
                OUTPUT INSERTED.book_id AS book_id
                VALUES (@title, @publisher, @isbn, @publish_year, @is_active)
            `);

        const bookId = result.recordset[0].book_id;

        const check = await database.request()
            .input('authorId', sql.Int, 6)
            .query(`
                SELECT DB_NAME() AS database_name,
                   @@SERVERNAME AS server_name,
                   author_id
                FROM dbo.author
                WHERE author_id = @authorId
            `);

        console.log(check.recordset);
        
        // Link the book to its author(s)
        for (const [authorId] of authorIds.entries()) {
            await new sql.Request(transaction)
                .input('book_id', sql.Int, bookId)
                .input('author_id', sql.Int, authorId)
                .query(`
                    INSERT INTO book_author (book_id, author_id)
                    VALUES (@book_id, @author_id)
                `);
        }

        // Add number of copies
        for (let i = 0; i < addCopies; i++) {
            await new sql.Request(transaction)
                .input('book_id', sql.Int, bookId)
                .query(`
                    INSERT INTO copies (book_id, is_available, is_active)
                    VALUES (@book_id, 'true', @is_active)
                `);
        }
        
        await transaction.commit();
        return { book_id: bookId };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {}
        
        console.error('Error adding book:', error);

        if (error.number === 2601 || error.number === 2627) {
            throw Object.assign(
                new Error('Another book already has that ISBN.'),
                { statusCode: 409 }
            );
        }

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
