import sql from 'mssql';

export async function listMedia(database, search = '') {
    const term = String(search).trim();

    if (term.length > 100) {
        const error = new Error('Search query is too long');
        error.statusCode = 400;
        throw error;
    }

    try {
        const result = await database.poolconnection
        .request()
        .input('search', sql.NVarChar(100), term)
        .query(`
            SELECT
                m.media_id,
                m.title,
                m.media_type,(
                    SELECT COUNT(*)
                    FROM copies AS c
                    WHERE c.media_id = m.media_id
                ) AS total_copies,
                m.is_active
            FROM
                media_items m
            WHERE
                m.title LIKE @search
        `);

    return result.recordset;
    } catch (error) {
        console.error('Error listing media:', error);
        throw error;
    }
}

export async function addMedia(database, media) {
    const { title, is_dvd, is_active } = media;

    if(title.length > 200) {
        const error = new Error('Title is too long');
        error.statusCode = 400;
        throw error;
    }

    try {
        const result = await database.poolconnection
            .request()
            .input('media_id', sql.Int, media_id)
            .input('title', sql.NVarChar(200), title)
            .input('is_dvd', sql.Bit, is_dvd)
            .input('is_active', sql.Bit, is_active)
            .query(`
                INSERT INTO media_items (media_id, title, is_dvd, is_active)
                VALUES (@media_id, @title, @is_dvd, @is_active)
            `);
        return result;
    } catch (error) {
        console.error('Error adding media:', error);
        throw error;
    }
}

export async function updateMedia(database, media) {
    const { media_id, title, media_type, is_active } = media;
    try {
        const result = await database.poolconnection
            .request()
            .input('media_id', sql.Int, media_id)
            .input('title', sql.NVarChar(200), title)
            .input('media_type', sql.NVarChar(100), media_type)
            .input('is_active', sql.Bit, is_active)
            .query(`
                UPDATE media_items
                SET title = @title,
                    media_type = @media_type,
                    is_active = @is_active
                WHERE media_id = @media_id
            `);
        return result;
    } catch (error) {
        console.error('Error updating media:', error);
        throw error;
    }
}

export async function deleteMedia(database, media_id) {
    try {
        const result = await database.poolconnection
            .request()
            .input('media_id', sql.Int, media_id)
            .query(`
                UPDATE media_items
                SET is_active = 0
                WHERE media_id = @media_id
            `);
        return result;
    } catch (error) {
        console.error('Error deleting media:', error);
        throw error;
    }
}