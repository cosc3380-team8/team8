// Types mirror the improved relational schema (see docs/SCHEMA_CHANGES.md).
// Dates are ISO strings (YYYY-MM-DD); room times are YYYY-MM-DDTHH:MM.

export type PatronRole = 'student' | 'faculty';
export type Role = PatronRole | 'employee' | 'admin';
export type ItemKind = 'book' | 'media';
export type CopyStatus = 'available' | 'loaned' | 'held' | 'lost';
export type MediaType = 'DVD' | 'Audiobook' | 'Device' | 'Other';

export interface Member {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string; // prototype only; the real DB stores a BCrypt hash in password_hash VARCHAR(255)
  role: PatronRole;
  is_active: boolean;
}

export interface Staff {
  staff_id: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  is_admin: boolean;
  is_active: boolean;
}

export interface Author {
  author_id: number;
  first_name: string;
  last_name: string;
}

export interface Book {
  book_id: number;
  title: string;
  publisher: string;
  is_active: boolean;
}

/** Junction table: a book can have many authors and an author can have many books. */
export interface BookAuthor {
  book_id: number;
  author_id: number;
  author_order: number; // 1 = first author
}

export interface BookCopy {
  copy_id: number;
  book_id: number;
  status: CopyStatus;
}

export interface Media {
  media_id: number;
  title: string;
  media_type: MediaType;
  is_active: boolean;
}

export interface MediaCopy {
  media_copy_id: number;
  media_id: number;
  status: CopyStatus;
}

export interface Room {
  room_id: number;
  room_number: string;
  room_level: number;
  capacity: number;
  is_active: boolean;
}

export interface RoomReservation {
  reservation_id: number;
  room_id: number;
  user_id: number;
  start_time: string;
  end_time: string;
}

export interface Loan {
  loan_id: number;
  user_id: number;
  book_copy_id: number | null; // exactly one of these two is set
  media_copy_id: number | null;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
}

export interface Fine {
  fine_id: number;
  loan_id: number; // UNIQUE: one fine per loan
  amount: number;
  paid_status: 'unpaid' | 'paid';
  paid_date: string | null;
}

export type HoldStatus = 'waiting' | 'ready' | 'fulfilled' | 'expired' | 'cancelled';

export interface Hold {
  hold_id: number;
  user_id: number;
  book_id: number | null; // exactly one of these two is set
  media_id: number | null;
  request_date: string;
  status: HoldStatus;
  ready_date: string | null;
  expiration_date: string | null;
}

export interface Payment {
  payment_id: number;
  fine_id: number;
  user_id: number;
  amount_paid: number;
  payment_method: string;
  payment_date: string;
}

export interface Receipt {
  receipt_id: number;
  payment_id: number; // UNIQUE: one receipt per payment
  transaction_code: string;
  issued_date: string;
}

export interface AuditEntry {
  log_id: number;
  logged_at: string;
  trigger_name: string;
  table_name: string;
  message: string;
}

export interface Session {
  id: number;
  name: string;
  email: string;
  role: Role;
}

// ---- View models returned by the API (joined / derived data) ----
export interface BookView extends Book {
  author_name: string; // all authors, in order
  author_ids: number[];
  total_copies: number;
  available_copies: number;
}

export interface MediaView extends Media {
  total_copies: number;
  available_copies: number;
}

export interface LoanView extends Loan {
  member_name: string;
  title: string;
  kind: ItemKind;
  status: 'active' | 'due-soon' | 'overdue' | 'returned';
  days_until_due: number | null;
  fine_amount: number | null;
}

export interface HoldView extends Hold {
  member_name: string;
  title: string;
  kind: ItemKind;
  queue_position: number | null;
}

export interface FineView extends Fine {
  user_id: number;
  member_name: string;
  title: string;
  due_date: string;
  return_date: string | null;
  payment_method: string | null;
  receipt_code: string | null;
}

export interface ReservationView extends RoomReservation {
  room_number: string;
  member_name: string;
}

export interface TableResult {
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportResult extends TableResult {
  stats: { label: string; value: string }[];
  chart?: { title: string; labels: string[]; values: number[]; format?: 'number' | 'money' };
}
