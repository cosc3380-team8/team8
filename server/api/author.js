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
                        a.last_name
                    FROM author AS a, book_author AS ba
                    WHERE a.author_id = ba.author_id
                        AND (a.first_name LIKE N'%' + @search + N'%'
                        OR a.last_name LIKE N'%' + @search + N'%')
                    ORDER BY a.last_name, a.first_name
                `);
    
        return result.recordset;
}

export async function saveAuthor(database, author, book_id) {
    const { author_id, first_name, last_name } = author;
    try{
        const result = await database.poolconnection
            .request()
            .input('author_id', sql.Int, author_id)
            .input('first_name', sql.NVarChar(50), first_name)
            .input('last_name', sql.NVarChar(50), last_name)
            .input('book_id', sql.Int, book_id)
            .query(`
                INSERT INTO authors (author_id, first_name, last_name)
                VALUES (@author_id, @first_name, @last_name);
                INSERT INTO book_author (book_id, author_id)
                VALUES (@book_id, @author_id)
            `);
        return result;
    }catch(error){
        console.error(error);
        throw error;
    }
}

export async function deleteAuthor(database, author_id) {
    try{
        const result = await database.poolconnection
            .request()
            .input('author_id', sql.Int, author_id)
            .query(`
                SELECT COUNT(*) AS count FROM authors AS a
                JOIN book_author AS ba ON a.author_id = ba.author_id
                WHERE a.author_id = ba.author_id
            `);
        const count = result.recordset[0].count;
        if (count > 0) {
            const error = new Error('Author is associated with books and cannot be deleted');
            error.statusCode = 400;
            throw error;
        }else{
            const deleteResult = await database.poolconnection
                .request()
                .input('author_id', sql.Int, author_id)
                .query(`
                    DELETE FROM authors
                    WHERE author_id = @author_id
                `);
            return deleteResult;
        }
    }catch(error){
        console.error(error);
        throw error;
    }
}
