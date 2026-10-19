-- Library database: improved schema for Azure SQL Database (T-SQL).
-- Run this first, then triggers.sql. See docs/SCHEMA_CHANGES.md for what changed from Checkpoint 1.

CREATE TABLE members (
  user_id       INT IDENTITY(100,1) PRIMARY KEY,
  first_name    NVARCHAR(50)  NOT NULL,
  last_name     NVARCHAR(50)  NOT NULL,
  email         NVARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,            -- BCrypt hash, never plain text
  role          VARCHAR(7)    NOT NULL CHECK (role IN ('student', 'faculty')),
  is_active     BIT           NOT NULL DEFAULT 1
);

CREATE TABLE staff (
  staff_id      INT IDENTITY(1,1) PRIMARY KEY,
  first_name    NVARCHAR(50)  NOT NULL,
  last_name     NVARCHAR(50)  NOT NULL,
  email         NVARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  is_admin      BIT           NOT NULL DEFAULT 0,
  is_active     BIT           NOT NULL DEFAULT 1
);

CREATE TABLE authors (
  author_id  INT IDENTITY(1,1) PRIMARY KEY,
  first_name NVARCHAR(50) NOT NULL,
  last_name  NVARCHAR(50) NOT NULL
);

CREATE TABLE books (
  book_id   INT IDENTITY(1000,1) PRIMARY KEY,
  title     NVARCHAR(200) NOT NULL,
  publisher NVARCHAR(100) NULL,
  is_active BIT NOT NULL DEFAULT 1
);

-- many-to-many: a book can have several authors, an author can have several books
CREATE TABLE book_authors (
  book_id      INT NOT NULL REFERENCES books(book_id),
  author_id    INT NOT NULL REFERENCES authors(author_id),
  author_order INT NOT NULL DEFAULT 1,              -- 1 = first author
  CONSTRAINT pk_book_authors PRIMARY KEY (book_id, author_id)
);
CREATE INDEX ix_book_authors_author ON book_authors(author_id);

CREATE TABLE book_copies (
  copy_id INT IDENTITY(1,1) PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(book_id),
  status  VARCHAR(9) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'loaned', 'held', 'lost'))
);

CREATE TABLE media_items (
  media_id   INT IDENTITY(1,1) PRIMARY KEY,
  title      NVARCHAR(200) NOT NULL,
  media_type VARCHAR(10)   NOT NULL CHECK (media_type IN ('DVD', 'Audiobook', 'Device', 'Other')),
  is_active  BIT NOT NULL DEFAULT 1
);

CREATE TABLE media_copies (
  media_copy_id INT IDENTITY(1,1) PRIMARY KEY,
  media_id      INT NOT NULL REFERENCES media_items(media_id),
  status        VARCHAR(9) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'loaned', 'held', 'lost'))
);

CREATE TABLE rooms (
  room_id     INT IDENTITY(1,1) PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL UNIQUE,
  room_level  INT NOT NULL,
  capacity    INT NOT NULL CHECK (capacity > 0),
  is_active   BIT NOT NULL DEFAULT 1
);

CREATE TABLE room_reservations (
  reservation_id INT IDENTITY(1,1) PRIMARY KEY,
  room_id        INT NOT NULL REFERENCES rooms(room_id),
  user_id        INT NOT NULL REFERENCES members(user_id),
  start_time     DATETIME2(0) NOT NULL,
  end_time       DATETIME2(0) NOT NULL,
  CONSTRAINT ck_reservation_times CHECK (end_time > start_time)
);

CREATE TABLE loans (
  loan_id       INT IDENTITY(1,1) PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES members(user_id),
  book_copy_id  INT NULL REFERENCES book_copies(copy_id),
  media_copy_id INT NULL REFERENCES media_copies(media_copy_id),
  borrow_date   DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
  due_date      DATE NOT NULL,                      -- borrow_date + 20 (student) or + 30 (faculty), set by the back end
  return_date   DATE NULL,
  -- every loan references exactly one physical copy: a book copy OR a media copy
  CONSTRAINT ck_loan_one_item CHECK (
    (book_copy_id IS NOT NULL AND media_copy_id IS NULL) OR
    (book_copy_id IS NULL AND media_copy_id IS NOT NULL))
);
-- a physical copy can have at most one active (unreturned) loan
CREATE UNIQUE INDEX ux_loans_book_copy_active  ON loans(book_copy_id)  WHERE return_date IS NULL AND book_copy_id  IS NOT NULL;
CREATE UNIQUE INDEX ux_loans_media_copy_active ON loans(media_copy_id) WHERE return_date IS NULL AND media_copy_id IS NOT NULL;

CREATE TABLE fines (
  fine_id     INT IDENTITY(1,1) PRIMARY KEY,
  loan_id     INT NOT NULL UNIQUE REFERENCES loans(loan_id),   -- one fine per loan
  amount      DECIMAL(8,2) NOT NULL CHECK (amount >= 0),
  paid_status VARCHAR(6) NOT NULL DEFAULT 'unpaid' CHECK (paid_status IN ('unpaid', 'paid')),
  paid_date   DATE NULL
);

CREATE TABLE holds (
  hold_id         INT IDENTITY(1,1) PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES members(user_id),
  book_id         INT NULL REFERENCES books(book_id),
  media_id        INT NULL REFERENCES media_items(media_id),
  request_date    DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
  status          VARCHAR(9) NOT NULL DEFAULT 'waiting'
                  CHECK (status IN ('waiting', 'ready', 'fulfilled', 'expired', 'cancelled')),
  ready_date      DATE NULL,
  expiration_date DATE NULL,                         -- ready_date + 3 days
  CONSTRAINT ck_hold_one_item CHECK (
    (book_id IS NOT NULL AND media_id IS NULL) OR (book_id IS NULL AND media_id IS NOT NULL))
);

CREATE TABLE payments (
  payment_id     INT IDENTITY(1,1) PRIMARY KEY,
  fine_id        INT NOT NULL REFERENCES fines(fine_id),
  user_id        INT NOT NULL REFERENCES members(user_id),
  amount_paid    DECIMAL(8,2) NOT NULL CHECK (amount_paid > 0),
  payment_method VARCHAR(20) NOT NULL,
  payment_date   DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE)
);

CREATE TABLE receipts (
  receipt_id       INT IDENTITY(1,1) PRIMARY KEY,
  payment_id       INT NOT NULL UNIQUE REFERENCES payments(payment_id),  -- one receipt per payment
  transaction_code VARCHAR(30) NOT NULL UNIQUE,
  issued_date      DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE)
);

CREATE TABLE audit_log (
  log_id       INT IDENTITY(1,1) PRIMARY KEY,
  logged_at    DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  trigger_name VARCHAR(60)  NOT NULL,
  table_name   VARCHAR(60)  NOT NULL,
  message      NVARCHAR(400) NOT NULL
);
