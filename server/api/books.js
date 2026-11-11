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
                SELECT STRING_AGG(CONCAT_WS(' ', a.first_name, a.middle_name, a.last_name), ', ')
                FROM book_author AS ba
                JOIN author AS a ON a.author_id = ba.author_id
                WHERE ba.book_id = b.book_id
                ) AS author_name,
                (
                SELECT STRING_AGG(ba.author_id, ',')
                FROM book_author AS ba
                WHERE ba.book_id = b.book_id
                ) AS author_ids,
                (
                SELECT COUNT(*)
                FROM copies AS c
                WHERE c.book_id = b.book_id
                    AND c.is_active = 1
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
            WHERE b.title LIKE N'%' + @search + N'%'
            ORDER BY b.title
        `);

    return result.recordset.map((book) => ({
        ...book,
        author_ids: book.author_ids ? book.author_ids.split(',').map(Number) : [],
    }));
}

export async function addBook(database, book) {
    const { 
        title, 
        publisher, 
        isbn, 
        is_active, 
        author_ids = [], 
        addCopies = 1
    } = book;

    if (isbn && !/^(\d{10}|\d{13})$/.test(String(isbn))) {
        throw Object.assign(new Error('ISBN must be 10 or 13 digits.'), { statusCode: 400 });
    }

    const authorIds = [...new Set(author_ids.map(Number))];
    const transaction = new sql.Transaction(database);

    try {
        await transaction.begin();

        const result = await new sql.Request(transaction)
            .input('title', sql.NVarChar(150), title.trim())
            .input('publisher', sql.NVarChar(100), publisher)
            .input('isbn', sql.NVarChar(13), isbn || null)
            .input('is_active', sql.Bit, is_active)
            .query(`
                INSERT INTO book (title, publisher, isbn, is_active)
                OUTPUT INSERTED.book_id AS book_id
                VALUES (@title, @publisher, @isbn, @is_active)
            `);

        const bookId = result.recordset[0].book_id;
        
        for (const authorId of authorIds) {
            await new sql.Request(transaction)
                .input('book_id', sql.Int, bookId)
                .input('author_id', sql.Int, authorId)
                .query(`
                    INSERT INTO book_author (book_id, author_id)
                    VALUES (@book_id, @author_id)
                `);
        }

        for (let i = 0; i < addCopies; i++) {
            await new sql.Request(transaction)
                .input('book_id', sql.Int, bookId)
                .input('is_available', sql.Bit, true)
                .input('is_active', sql.Bit, is_active)
                .query(`
                    INSERT INTO copies (book_id, is_available, is_active)
                    VALUES (@book_id, @is_available, @is_active)
                `);
        }
        
        await transaction.commit();
        return { book_id: bookId };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {}
        
        console.error('Error adding book:', error);

        throw error;
    }
}

export async function updateBook(database, book) {
    const { 
        book_id,
        title, 
        publisher, 
        isbn, 
        is_active, 
        author_ids = [], 
        addCopies,
        total_copies
    } = book;

    const totalCopies = total_copies === undefined ? undefined : total_copies === null || total_copies === '' ? NaN : Number(total_copies);
    if (totalCopies !== undefined && (!Number.isInteger(totalCopies) || totalCopies < 0 || totalCopies > 1000)) {
        throw Object.assign(new Error('Total copies must be a whole number from 0 to 1000.'), { statusCode: 400 });
    }

    if (isbn && !/^(\d{10}|\d{13})$/.test(String(isbn))) {
        throw Object.assign(new Error('ISBN must be 10 or 13 digits.'), { statusCode: 400 });
    }

    const authorIds = [...new Set(author_ids.map(Number))];
    const transaction = new sql.Transaction(database);

    
    try {
        await transaction.begin();

        if (!is_active) {
            const out = await new sql.Request(transaction)
                .input('book_id', sql.Int, book_id)
                .query(`
                    SELECT COUNT(*) AS count
                    FROM copies
                    WHERE book_id = @book_id AND is_active = 1 AND is_available = 0
                      AND EXISTS (SELECT 1 FROM book WHERE book_id = @book_id AND is_active = 1)
                `);
            if (out.recordset[0].count > 0) {
                throw Object.assign(new Error('Cannot archive: copies are on loan or held.'), { statusCode: 400 });
            }
        }

        const sameBook = await new sql.Request(transaction)
            .input('isbn', sql.NVarChar, isbn)
            .input('book_id', sql.Int, book_id)
            .query(`
                SELECT TOP 1 book_id
                FROM book
                WHERE isbn = @isbn
                    AND book_id <> @book_id
            `);

            if (sameBook.recordset.length > 0) {
                throw Object.assign(new Error('A book with that ISBN already exists.'), 
                { statusCode: 409 }
            );
        }

        const result = await new sql.Request(transaction)
        .input('book_id', sql.Int, book_id)
        .input('title', sql.NVarChar(150), title)
        .input('publisher', sql.NVarChar(100), publisher)
        .input('isbn', sql.NVarChar(13), isbn || null)
        .input('is_active', sql.Bit, is_active)
        .query(`
            UPDATE book
            SET title = @title,
                publisher = @publisher,
                isbn = @isbn,
                is_active = @is_active
            WHERE book_id = @book_id
        `);

        if (result.rowsAffected[0] === 0) {
            throw Object.assign(new Error("Book not found."), 
            { statusCode: 404 }
            );
        }

        const authorResults = await new sql.Request(transaction)
            .input('book_id', sql.Int, book_id)
            .query(`
                SELECT author_id
                FROM book_author
                WHERE book_id = @book_id
            `);
        
        const currAuthorIds = authorResults.recordset
                .map(row => Number(row.author_id))
                .sort((a, b) => a - b);
            
        const selectAuthorIds = [...authorIds].sort((a, b) => a - b);

        const authorsChanged = 
            currAuthorIds.length !== selectAuthorIds.length ||
            currAuthorIds.some((id, index) => id !== selectAuthorIds[index]);

        if (authorsChanged) {
            await new sql.Request(transaction)
                .input('book_id', sql.Int, book_id)
                .query(`
                    DELETE FROM book_author
                    WHERE book_id = @book_id
                `);

            for (const authorId of authorIds) {
                await new sql.Request(transaction)
                    .input('book_id', sql.Int, book_id)
                    .input('author_id', sql.Int, authorId)
                    .query(`
                        INSERT INTO book_author (book_id, author_id)
                        VALUES (@book_id, @author_id)
                    `);
            }
        }
        
        let copiesToAdd = addCopies;
        if (totalCopies !== undefined) {
            const current = await new sql.Request(transaction)
                .input('book_id', sql.Int, book_id)
                .query(`
                    SELECT COUNT(*) AS total,
                           COALESCE(SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END), 0) AS unavailable
                    FROM copies WITH (UPDLOCK, HOLDLOCK)
                    WHERE book_id = @book_id AND is_active = 1
                `);
            const { total, unavailable } = current.recordset[0];

            if (totalCopies < unavailable) {
                throw Object.assign(
                    new Error(`${unavailable} ${unavailable === 1 ? 'copy is' : 'copies are'} on loan or on hold, so the total can't be less than ${unavailable}.`),
                    { statusCode: 400 }
                );
            }

            copiesToAdd = Math.max(0, totalCopies - total);

            if (totalCopies < total) {
                await new sql.Request(transaction)
                    .input('book_id', sql.Int, book_id)
                    .input('remove', sql.Int, total - totalCopies)
                    .query(`
                        UPDATE TOP (@remove) copies
                        SET is_active = 0
                        WHERE book_id = @book_id AND is_active = 1 AND is_available = 1
                    `);
            }
        }

        if (copiesToAdd > 0) {
            for (let i = 0; i < copiesToAdd; i++) {
                await new sql.Request(transaction)
                    .input('book_id', sql.Int, book_id)
                    .input('is_available', sql.Bit, true)
                    .input('is_active', sql.Bit, totalCopies !== undefined ? true : is_active)
                    .query(`
                        INSERT INTO copies (book_id, is_available, is_active)
                        VALUES (@book_id, @is_available, @is_active)
                    `);
            }
        }

        if (copiesToAdd > 0 && is_active) {
            for (let i = 0; i < copiesToAdd; i++) {
                await new sql.Request(transaction)
                    .input('book_id', sql.Int, book_id)
                    .query(`EXEC dbo.promote_next_hold @book_id, NULL`);
            }
        }

        await transaction.commit();
    } catch (error) {
        try {
            await transaction.rollback()
        } catch {}

        console.error('Error updating book:', error);
        throw error;
    }
}

export async function deleteBook(database, bookId) {
    try {
        const copies = await database
            .request()
            .input('book_id', sql.Int, bookId)
            .query(`
                SELECT COUNT(*) AS count
                FROM copies
                WHERE book_id = @book_id AND is_active = 1 AND is_available = 0
            `);

        if (copies.recordset[0].count > 0) {
            throw Object.assign(new Error('Cannot archive: copies are on loan or held.'), { statusCode: 400 });
        }

        const result = await database
        .request()
        .input('book_id', sql.Int, bookId)
        .query(`
            UPDATE book
            SET is_active = 0
            WHERE book_id = @book_id
        `);

        if (result.rowsAffected[0] === 0) {
            throw Object.assign(new Error("Book not found."), 
            { statusCode: 404 }
            );
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        throw error;
    }
}
