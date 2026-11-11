import sql from 'mssql';

export async function listAuthors(database, search = '') {
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
                        a.author_id,
                        a.first_name,
                        a.middle_name, 
                        a.last_name,
                        (SELECT STRING_AGG(b.isbn, N', ')
                         FROM book_author AS ba
                         JOIN book AS b ON b.book_id = ba.book_id
                         WHERE ba.author_id = a.author_id AND b.isbn IS NOT NULL) AS isbns

                    FROM author AS a
                    WHERE (a.first_name LIKE N'%' + @search + N'%'
                        OR a.middle_name LIKE N'%' + @search + N'%'
                        OR a.last_name LIKE N'%' + @search + N'%')
                    ORDER BY a.last_name, a.first_name, a.middle_name

                `);
    
        return result.recordset;
}

/*export async function saveAuthor(database, author) {
    const { first_name, last_name } = author;

    try {
        const existingAuthor = await database
            .request()
            .input('first_name', sql.NVarChar(50), first_name)
            .input('last_name', sql.NVarChar(50), last_name)
            .query(`
                SELECT COUNT(*) AS count
                FROM author
                WHERE first_name = @first_name AND last_name = @last_name
            `);
        if (existingAuthor.recordset[0].count > 0) {
            const error = new Error('Author already exists');
            error.statusCode = 400;
            throw error;
        }

        const result = await database
            .request()
            .input('first_name', sql.NVarChar(50), first_name)
            .input('last_name', sql.NVarChar(50), last_name)
            .query(`
                INSERT INTO author (first_name, last_name)
                VALUES (@first_name, @last_name)
            `);

        return result;
    } catch (error) {
        console.error('Error saving author:', error);
        throw error;
    }
}*/
    // cuz author can share a same name 
export async function saveAuthor(database, author) {
    const { first_name, last_name } = author;
    const middle_name = author.middle_name?.trim() || null;

    // different authors can share a name, so duplicates are allowed
    try {
        const result = await database
            .request()
            .input('first_name', sql.NVarChar(50), first_name)
            .input('middle_name', sql.NVarChar(50), middle_name)
            .input('last_name', sql.NVarChar(50), last_name)
            .query(`
                INSERT INTO author (first_name, middle_name, last_name)
                VALUES (@first_name, @middle_name, @last_name)
            `);

        return result;
    } catch (error) {
        console.error('Error saving author:', error);
        throw error;
    }
}

export async function updateAuthor(database, author_id, author) {
    /*const { first_name, last_name } = author;

    try {
        const result = await database
            .request()
            .input('author_id', sql.Int, author_id)
            .input('first_name', sql.NVarChar(50), first_name)
            .input('last_name', sql.NVarChar(50), last_name)
            .query(`
                UPDATE author
                SET first_name = @first_name, last_name = @last_name
                WHERE author_id = @author_id */
          const { first_name, last_name } = author;
          const middle_name = author.middle_name?.trim() || null;

     try {
        const result = await database
            .request()
            .input('author_id', sql.Int, author_id)
            .input('first_name', sql.NVarChar(50), first_name)
            .input('middle_name', sql.NVarChar(50), middle_name)
            .input('last_name', sql.NVarChar(50), last_name)
            .query(`
                UPDATE author
                SET first_name = @first_name, middle_name = @middle_name, last_name = @last_name
                WHERE author_id = @author_id
            `); 
    

        if (result.rowsAffected[0] === 0) {
            const error = new Error('Author not found');
            error.statusCode = 404;
            throw error;
        }
    } catch (error) {
        console.error('Error updating author:', error);
        throw error;
    }
}

export async function deleteAuthor(database, author_id) {
    try {
        const result = await database
            .request()
            .input('author_id', sql.Int, author_id)
            .query(`
                SELECT COUNT(*) AS count
                FROM book_author
                WHERE author_id = @author_id
            `);
        
        const count = result.recordset[0].count;
        if (count > 0) {
            const error = new Error('Author is associated with books and cannot be deleted');
            error.statusCode = 409;
            throw error;
        } else {
            const deleteResult = await database
                .request()
                .input('author_id', sql.Int, author_id)
                .query(`
                    DELETE FROM author
                    WHERE author_id = @author_id
                `);

            if (deleteResult.rowsAffected[0] === 0) {
                const error = new Error('Author not found');
                error.statusCode = 404;
                throw error;
            }
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}
