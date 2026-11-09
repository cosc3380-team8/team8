import sql from 'mssql';

export async function listMedia(database, search = '') {
    const term = String(search).trim();

    if (term.length > 100) {
        const error = new Error('Search query is too long');
        error.statusCode = 400;
        throw error;
    }

    try {
        const result = await database
        .request()
        .input('search', sql.NVarChar(100), term)
        .query(`
            SELECT
                m.media_id,
                m.title,
                m.is_active,
                m.media_type,
                (
                    SELECT COUNT(*)
                    FROM copies AS c
                    WHERE c.media_id = m.media_id
                        AND c.is_active = 1
                ) AS total_copies,
                (
                    SELECT COUNT(*)
                    FROM copies AS c
                    WHERE c.media_id = m.media_id
                        AND c.is_active = 1
                        AND c.is_available = 1
                ) AS available_copies
            FROM
                media m
            WHERE
                m.title LIKE N'%' + @search + N'%'
            ORDER BY
                m.title
        `);

    return result.recordset;
    } catch (error) {
        console.error('Error listing media:', error);
        throw error;
    }
}

export async function addMedia(database, media) {
    const {
        title, 
        media_type, 
        is_active,
        addCopies = 1
    } = media;

    if(title.length > 150) {
        const error = new Error('Title is too long');
        error.statusCode = 400;
        throw error;
    }

    const validMediaTypes = ['DVD', 'Audiobook', 'Device', 'Other'];
    if (!validMediaTypes.includes(media_type)) {
        const error = new Error('Invalid media type');
        error.statusCode = 400;
        throw error;
    }

    if (isNaN(addCopies) || addCopies < 0) {
        const error = new Error('Invalid addCopies value');
        error.statusCode = 400;
        throw error;
    }

    if (typeof is_active !== 'boolean') {
        const error = new Error('Invalid is_active value');
        error.statusCode = 400;
        throw error;
    }

    const transaction = new sql.Transaction(database);

    try {
        await transaction.begin();
        
        const result = await new sql.Request(transaction)
            .input('title', sql.NVarChar(150), title)
            .input('media_type', sql.NVarChar(100), media_type)
            .input('is_active', sql.Bit, is_active)
            .query(`
                INSERT INTO media (title, media_type, is_active)
                OUTPUT INSERTED.media_id AS media_id
                VALUES (@title, @media_type, @is_active)
            `);
        
        const mediaId = result.recordset[0].media_id;

        for (let i = 0; i < addCopies; i++) {
            await new sql.Request(transaction)
                .input('media_id', sql.Int, mediaId)
                .input('is_available', sql.Bit, true)
                .input('is_active', sql.Bit, is_active)
                .query(`
                    INSERT INTO copies (media_id, is_available, is_active)
                    VALUES (@media_id, @is_available, @is_active)
                `);
        }

        await transaction.commit();
        return { media_id: mediaId };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {}

        console.error('Error adding media:', error);
        throw error;
    }
}

export async function updateMedia(database, media_id, media) {
    const { 
        title, 
        media_type, 
        is_active,
        addCopies,
        total_copies
    } = media;

    const totalCopies = total_copies === undefined ? undefined : total_copies === null || total_copies === '' ? NaN : Number(total_copies);
    if (totalCopies !== undefined && (!Number.isInteger(totalCopies) || totalCopies < 0 || totalCopies > 1000)) {
        throw Object.assign(new Error('Total copies must be a whole number from 0 to 1000.'), { statusCode: 400 });
    }

    if (title.length > 150) {
        const error = new Error('Title is too long');
        error.statusCode = 400;
        throw error;
    }

    const validMediaTypes = ['DVD', 'Audiobook', 'Device', 'Other'];
    if (!validMediaTypes.includes(media_type)) {
        const error = new Error('Invalid media type');
        error.statusCode = 400;
        throw error;
    }

    if (addCopies !== undefined && (isNaN(addCopies) || addCopies < 0)) {
        const error = new Error('Invalid addCopies value');
        error.statusCode = 400;
        throw error;
    }

    if (typeof is_active !== 'boolean') {
        const error = new Error('Invalid is_active value');
        error.statusCode = 400;
        throw error;
    }

    const transaction = new sql.Transaction(database);

    try {
        await transaction.begin();

        if (!is_active) {
            const out = await new sql.Request(transaction)
                .input('media_id', sql.Int, media_id)
                .query(`
                    SELECT COUNT(*) AS count
                    FROM copies
                    WHERE media_id = @media_id AND is_active = 1 AND is_available = 0
                      AND EXISTS (SELECT 1 FROM media WHERE media_id = @media_id AND is_active = 1)
                `);
            if (out.recordset[0].count > 0) {
                throw Object.assign(new Error('Cannot archive: copies are on loan or held.'), { statusCode: 400 });
            }
        }

        const result = await new sql.Request(transaction)
            .input('media_id', sql.Int, media_id)
            .input('title', sql.NVarChar(150), title)
            .input('media_type', sql.NVarChar(100), media_type)
            .input('is_active', sql.Bit, is_active)
            .query(`
                UPDATE media
                SET title = @title,
                    media_type = @media_type,
                    is_active = @is_active
                WHERE media_id = @media_id
            `);

            if (result.rowsAffected[0] === 0) {
                const error = new Error('Media not found');
                error.statusCode = 404;
                throw error;
            }

        let copiesToAdd = addCopies;
        if (totalCopies !== undefined) {
            const current = await new sql.Request(transaction)
                .input('media_id', sql.Int, media_id)
                .query(`
                    SELECT COUNT(*) AS total,
                           COALESCE(SUM(CASE WHEN is_available = 0 THEN 1 ELSE 0 END), 0) AS unavailable
                    FROM copies WITH (UPDLOCK, HOLDLOCK)
                    WHERE media_id = @media_id AND is_active = 1
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
                    .input('media_id', sql.Int, media_id)
                    .input('remove', sql.Int, total - totalCopies)
                    .query(`
                        UPDATE TOP (@remove) copies
                        SET is_active = 0
                        WHERE media_id = @media_id AND is_active = 1 AND is_available = 1
                    `);
            }
        }

        if (copiesToAdd > 0) {
            for (let i = 0; i < copiesToAdd; i++) {
                await new sql.Request(transaction)
                    .input('media_id', sql.Int, media_id)
                    .input('is_available', sql.Bit, true)
                    .input('is_active', sql.Bit, totalCopies !== undefined ? true : is_active)
                    .query(`
                        INSERT INTO copies (media_id, is_available, is_active)
                        VALUES (@media_id, @is_available, @is_active)
                    `);
            }
        }

        if (copiesToAdd > 0 && is_active) {
            for (let i = 0; i < copiesToAdd; i++) {
                await new sql.Request(transaction)
                    .input('media_id', sql.Int, media_id)
                    .query(`EXEC dbo.promote_next_hold NULL, @media_id`);
            }
        }

        await transaction.commit();
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {}

        console.error('Error updating media:', error);
        throw error;
    }
}

export async function deleteMedia(database, media_id) {
    try {
        const copies = await database
            .request()
            .input('media_id', sql.Int, media_id)
            .query(`
                SELECT COUNT(*) AS count
                FROM copies
                WHERE media_id = @media_id AND is_active = 1 AND is_available = 0
            `);

        if (copies.recordset[0].count > 0) {
            const error = new Error('Cannot archive: copies are on loan or held.');
            error.statusCode = 400;
            throw error;
        }

        const result = await database
            .request()
            .input('media_id', sql.Int, media_id)
            .query(`
                UPDATE media
                SET is_active = 0
                WHERE media_id = @media_id
            `);
        
        if (result.rowsAffected[0] === 0) {
            const error = new Error('Media not found');
            error.statusCode = 404;
            throw error;
        }
    } catch (error) {
        console.error('Error deleting media:', error);
        throw error;
    }
}
