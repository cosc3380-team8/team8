IF COL_LENGTH('dbo.room_reservations', 'is_active') IS NULL
    ALTER TABLE dbo.[room_reservations] ADD [is_active] bit NULL;
GO

DISABLE TRIGGER dbo.trg_room_reservations_overlap ON dbo.[room_reservations];
UPDATE dbo.[room_reservations] SET [is_active] = 1 WHERE [is_active] IS NULL;
ENABLE TRIGGER dbo.trg_room_reservations_overlap ON dbo.[room_reservations];
GO

ALTER TABLE dbo.[room_reservations] ALTER COLUMN [is_active] bit NOT NULL;
ALTER TABLE dbo.[room_reservations] ADD CONSTRAINT [df_room_reservations_is_active] DEFAULT 1 FOR [is_active];
GO

CREATE OR ALTER TRIGGER dbo.trg_room_reservations_overlap
ON dbo.[room_reservations]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted AS i
        JOIN dbo.room_reservations AS r
          ON r.room_id = i.room_id
         AND r.reservation_id <> i.reservation_id
         AND r.start_time < i.end_time
         AND r.end_time > i.start_time
        WHERE i.is_active = 1
          AND r.is_active = 1
    )
        THROW 51004, 'Room is already booked during that time', 1;

    INSERT INTO dbo.audit_log (trigger_name, table_name, message)
    SELECT 'trg_room_reservations_overlap', 'room_reservations',
           CASE WHEN i.is_active = 1
                THEN CONCAT('Reservation ', i.reservation_id, ': room ', i.room_id,
                            ' booked by user ', i.user_id, ', no overlap')
                ELSE CONCAT('Reservation ', i.reservation_id, ': cancelled')
           END
    FROM inserted AS i;

    INSERT INTO dbo.notification (user_id, source, message)
    SELECT i.user_id, 'trg_room_reservations_overlap',
           CASE WHEN i.is_active = 1
                THEN CONCAT('Room ', r.room_number, ' is booked for you on ',
                            CONVERT(char(16), i.start_time, 120), '.')
                ELSE CONCAT('Your booking for room ', r.room_number, ' on ',
                            CONVERT(char(16), i.start_time, 120), ' was cancelled.')
           END
    FROM inserted AS i
    JOIN dbo.room AS r ON r.room_id = i.room_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.save_room_reservation
    @p_reservation_id int,
    @p_user_id int,
    @p_room_id int,
    @p_start datetime2(0),
    @p_end datetime2(0)
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT <> 0
        THROW 50001, 'Call this procedure outside an existing transaction', 1;
    SET XACT_ABORT ON;
    IF @p_start IS NULL OR @p_end IS NULL OR @p_end <= @p_start
        THROW 50002, 'End time must be after start time', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @v_room int = NULL, @v_existing int = NULL;
        SELECT @v_room = room_id
        FROM dbo.room WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id = @p_room_id;
        IF @v_room IS NULL
            THROW 50003, 'Room does not exist', 1;

        IF @p_reservation_id IS NOT NULL
        BEGIN
            SELECT @v_existing = reservation_id
            FROM dbo.room_reservations WITH (UPDLOCK, HOLDLOCK)
            WHERE reservation_id = @p_reservation_id;
            IF @v_existing IS NULL
                THROW 50004, 'Reservation does not exist', 1;
        END;

        IF EXISTS (
            SELECT 1 FROM dbo.room_reservations WITH (UPDLOCK, HOLDLOCK)
            WHERE room_id = @p_room_id
              AND is_active = 1
              AND start_time < @p_end
              AND end_time > @p_start
              AND (@p_reservation_id IS NULL OR reservation_id <> @p_reservation_id)
        )
            THROW 50005, 'Room is already booked during that time', 1;

        IF @p_reservation_id IS NULL
            INSERT INTO dbo.room_reservations (user_id, room_id, start_time, end_time)
            VALUES (@p_user_id, @p_room_id, @p_start, @p_end);
        ELSE
            UPDATE dbo.room_reservations
            SET user_id = @p_user_id, room_id = @p_room_id,
                start_time = @p_start, end_time = @p_end
            WHERE reservation_id = @p_reservation_id;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

SELECT IS_NULLABLE, COLUMN_DEFAULT,
       (SELECT COUNT(*) FROM dbo.room_reservations WHERE is_active IS NULL) AS null_rows
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'room_reservations' AND COLUMN_NAME = 'is_active';
