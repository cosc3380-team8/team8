-- Triggers and procedures for the library database (T-SQL / Azure SQL). Run after schema.sql.
-- SQL Server has no BEFORE triggers, so the two "reject" rules are AFTER triggers that THROW;
-- the THROW rolls the statement back, which has the same effect.
-- Names match the entries the front end shows on its "Triggers & Audit Log" page.

------------------------------------------------------------------------------------------------
-- Procedure: serve the earliest waiting hold when a copy becomes free (3-day pickup window)
------------------------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_promote_next_hold @book_id INT = NULL, @media_id INT = NULL AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @hold_id INT, @copy_id INT, @today DATE = CAST(GETDATE() AS DATE);

  SELECT TOP 1 @hold_id = hold_id FROM holds
  WHERE status = 'waiting'
    AND ((@book_id IS NOT NULL AND book_id = @book_id) OR (@media_id IS NOT NULL AND media_id = @media_id))
  ORDER BY request_date, hold_id;
  IF @hold_id IS NULL RETURN;

  IF @book_id IS NOT NULL
  BEGIN
    SELECT TOP 1 @copy_id = copy_id FROM book_copies WHERE book_id = @book_id AND status = 'available' ORDER BY copy_id;
    IF @copy_id IS NULL RETURN;
    UPDATE book_copies SET status = 'held' WHERE copy_id = @copy_id;
  END
  ELSE
  BEGIN
    SELECT TOP 1 @copy_id = media_copy_id FROM media_copies WHERE media_id = @media_id AND status = 'available' ORDER BY media_copy_id;
    IF @copy_id IS NULL RETURN;
    UPDATE media_copies SET status = 'held' WHERE media_copy_id = @copy_id;
  END

  UPDATE holds SET status = 'ready', ready_date = @today, expiration_date = DATEADD(DAY, 3, @today)
  WHERE hold_id = @hold_id;
  INSERT audit_log (trigger_name, table_name, message)
  VALUES ('sp_promote_next_hold', 'holds', CONCAT('Hold ', @hold_id, ' is ready for pickup.'));
END;
GO

------------------------------------------------------------------------------------------------
-- TRIGGER 1: enforce borrowing limits (students 3 items, faculty 6)
------------------------------------------------------------------------------------------------
CREATE OR ALTER TRIGGER trg_loans_enforce_limit ON loans AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN members u ON u.user_id = i.user_id
    WHERE (SELECT COUNT(*) FROM loans l WHERE l.user_id = i.user_id AND l.return_date IS NULL)
          > CASE u.role WHEN 'student' THEN 3 ELSE 6 END)
  BEGIN
    INSERT audit_log (trigger_name, table_name, message)
    SELECT 'trg_loans_enforce_limit', 'loans', CONCAT('Blocked checkout for member ', i.user_id) FROM inserted i;
    THROW 50001, N'Trying to borrow more books? Return one today and experience another book''s world!', 1;
  END
END;
GO

------------------------------------------------------------------------------------------------
-- TRIGGER 2: a new loan marks its copy as loaned and fulfils the member's ready hold
------------------------------------------------------------------------------------------------
CREATE OR ALTER TRIGGER trg_loans_after_insert ON loans AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  UPDATE bc SET status = 'loaned' FROM book_copies bc  JOIN inserted i ON i.book_copy_id  = bc.copy_id;
  UPDATE mc SET status = 'loaned' FROM media_copies mc JOIN inserted i ON i.media_copy_id = mc.media_copy_id;

  UPDATE h SET status = 'fulfilled'
  FROM holds h
  JOIN inserted i ON i.user_id = h.user_id
  LEFT JOIN book_copies bc  ON bc.copy_id = i.book_copy_id
  LEFT JOIN media_copies mc ON mc.media_copy_id = i.media_copy_id
  WHERE h.status = 'ready' AND (h.book_id = bc.book_id OR h.media_id = mc.media_id);

  INSERT audit_log (trigger_name, table_name, message)
  SELECT 'trg_loans_after_insert', 'loans', CONCAT('Loan ', loan_id, ' created; copy marked loaned.') FROM inserted;
END;
GO

------------------------------------------------------------------------------------------------
-- TRIGGER 3: returning an item frees the copy, creates the fine if late, then serves the hold queue
--            Fine = $5 base + $1 per full week overdue.
------------------------------------------------------------------------------------------------
CREATE OR ALTER TRIGGER trg_loans_after_return ON loans AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  IF NOT UPDATE(return_date) RETURN;

  SELECT i.loan_id, i.book_copy_id, i.media_copy_id, i.due_date, i.return_date
  INTO #returned
  FROM inserted i JOIN deleted d ON d.loan_id = i.loan_id
  WHERE d.return_date IS NULL AND i.return_date IS NOT NULL;

  UPDATE bc SET status = 'available' FROM book_copies bc  JOIN #returned r ON r.book_copy_id  = bc.copy_id;
  UPDATE mc SET status = 'available' FROM media_copies mc JOIN #returned r ON r.media_copy_id = mc.media_copy_id;

  INSERT INTO fines (loan_id, amount, paid_status)
  SELECT loan_id, 5 + DATEDIFF(DAY, due_date, return_date) / 7, 'unpaid'
  FROM #returned WHERE return_date > due_date;

  INSERT audit_log (trigger_name, table_name, message)
  SELECT 'trg_loans_after_return', 'loans',
         CONCAT('Loan ', loan_id, ' returned', CASE WHEN return_date > due_date THEN '; fine created.' ELSE '.' END)
  FROM #returned;

  DECLARE @b INT, @m INT;
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT bc.book_id, mc.media_id FROM #returned r
    LEFT JOIN book_copies bc  ON bc.copy_id = r.book_copy_id
    LEFT JOIN media_copies mc ON mc.media_copy_id = r.media_copy_id;
  OPEN c; FETCH NEXT FROM c INTO @b, @m;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC sp_promote_next_hold @book_id = @b, @media_id = @m;
    FETCH NEXT FROM c INTO @b, @m;
  END
  CLOSE c; DEALLOCATE c;
END;
GO

------------------------------------------------------------------------------------------------
-- TRIGGER 4: a payment marks its fine paid and issues the receipt
------------------------------------------------------------------------------------------------
CREATE OR ALTER TRIGGER trg_payments_after_insert ON payments AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  UPDATE f SET paid_status = 'paid', paid_date = p.payment_date
  FROM fines f JOIN inserted p ON p.fine_id = f.fine_id;

  INSERT INTO receipts (payment_id, transaction_code, issued_date)
  SELECT payment_id, CONCAT('TXN-', FORMAT(payment_date, 'yyyyMMdd'), '-', FORMAT(payment_id, '0000')), payment_date
  FROM inserted;

  INSERT audit_log (trigger_name, table_name, message)
  SELECT 'trg_payments_after_insert', 'payments', CONCAT('Payment ', payment_id, ': fine ', fine_id, ' paid, receipt issued.') FROM inserted;
END;
GO

------------------------------------------------------------------------------------------------
-- TRIGGER 5: the same room cannot have overlapping reservations
------------------------------------------------------------------------------------------------
CREATE OR ALTER TRIGGER trg_reservations_no_overlap ON room_reservations AFTER INSERT, UPDATE AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN room_reservations r ON r.room_id = i.room_id AND r.reservation_id <> i.reservation_id
    WHERE i.start_time < r.end_time AND i.end_time > r.start_time)
  BEGIN
    THROW 50002, N'This room is already reserved for an overlapping time.', 1;
  END
END;
GO

------------------------------------------------------------------------------------------------
-- Scheduled job (Azure SQL elastic job / Java @Scheduled): expire holds not picked up in 3 days
------------------------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_expire_holds AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @id INT, @b INT, @m INT;
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT hold_id, book_id, media_id FROM holds
    WHERE status = 'ready' AND expiration_date < CAST(GETDATE() AS DATE);
  OPEN c; FETCH NEXT FROM c INTO @id, @b, @m;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    UPDATE holds SET status = 'expired' WHERE hold_id = @id;
    IF @b IS NOT NULL
      UPDATE book_copies SET status = 'available'
      WHERE copy_id = (SELECT TOP 1 copy_id FROM book_copies WHERE book_id = @b AND status = 'held' ORDER BY copy_id);
    ELSE
      UPDATE media_copies SET status = 'available'
      WHERE media_copy_id = (SELECT TOP 1 media_copy_id FROM media_copies WHERE media_id = @m AND status = 'held' ORDER BY media_copy_id);
    INSERT audit_log (trigger_name, table_name, message) VALUES ('sp_expire_holds', 'holds', CONCAT('Hold ', @id, ' expired.'));
    EXEC sp_promote_next_hold @book_id = @b, @media_id = @m;
    FETCH NEXT FROM c INTO @id, @b, @m;
  END
  CLOSE c; DEALLOCATE c;
END;
GO
