/*import sql from 'mssql'

export const LOCAL_NOW = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time' AS datetime2(0))";

export async function listReservations(database, user_id) {
    if (user_id !== undefined && isNaN(user_id)) {
        const error = new Error('Invalid user_id query parameter');
        error.statusCode = 400;
        throw error;
    }

    const result = await database
        .request()
        .input('user_id', sql.Int, user_id ?? null)
        .query(`
            SELECT
                rr.reservation_id,
                rr.user_id,
                rr.room_id,
                rr.start_time,
                rr.end_time,
                rr.is_active,
                r.room_number AS room_number,
                CONCAT(u.first_name, ' ', u.last_name) AS member_name,
                CASE
                    WHEN rr.end_time < ${LOCAL_NOW} OR rr.is_active = 0 THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS archived
            FROM room_reservations AS rr
            JOIN room AS r ON rr.room_id = r.room_id
            JOIN [user] AS u ON rr.user_id = u.user_id
            WHERE (@user_id IS NULL OR rr.user_id = @user_id)
            ORDER BY rr.start_time
        `);

    return result.recordset;
}

export async function saveRoomReservation(database, input) {
    return database
        .request()
        .input('p_reservation_id', sql.Int, input.reservation_id ?? null)
        .input('p_user_id', sql.Int, input.userId)
        .input('p_room_id', sql.Int, input.roomId)
        .input('p_start', sql.DateTime2(0), input.start)
        .input('p_end', sql.DateTime2(0), input.end)
        .execute('dbo.save_room_reservation');
}

export async function cancelRoomReservation(database, reservationId) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservationId)
        .query(`
            UPDATE room_reservations
            SET is_active = 0
            WHERE reservation_id = @reservation_id
        `);
    
    if (result.rowsAffected[0] === 0) {
        const error = new Error('Reservation not found');
        error.statusCode = 404;
        throw error;
    }
}
export async function reservationOwner(database, reservationId) {
    const result = await database
        .request()
        .input('reservation_id', sql.Int, reservationId)
        .query(`SELECT user_id FROM room_reservations WHERE reservation_id = @reservation_id`);

    return result.recordset[0]?.user_id;
} */
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
  password: string;
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
  middle_name?: string | null;
  books?: string | null;
  last_name: string;
}

export interface Book {
  book_id: number;
  title: string;
  isbn: string;
  publisher: string;
  is_active: boolean;
}

export interface BookAuthor {
  book_id: number;
  author_id: number;
  author_order: number;
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

// one taken time on the study room booking grid ("YYYY-MM-DDTHH:MM", library time)
export interface RoomBooking {
  room_id: number;
  start_time: string;
  end_time: string;
  mine: boolean;
  member_name: string | null;
}

export interface RoomAvailability {
  now: string;
  bookings: RoomBooking[];
}

export interface Loan {
  loan_id: number;
  user_id: number;
  book_copy_id: number | null;
  media_copy_id: number | null;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
}

export interface Fine {
  fine_id: number;
  loan_id: number;
  amount: number;
  paid_status: 'unpaid' | 'paid';
  paid_date: string | null;
}

export type HoldStatus = 'waiting' | 'ready' | 'fulfilled' | 'expired' | 'cancelled';

export interface Hold {
  hold_id: number;
  user_id: number;
  book_id: number | null;
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
  staff_id: number | null;
}

export interface Receipt {
  receipt_id: number;
  payment_id: number;
  transaction_code: string;
  issued_date: string;
}

export interface Notification {
  notification_id: number;
  user_id: number;
  created_at: string;
  source: string;
  message: string;
  is_read: boolean;
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
  token: string;
}

export interface BookView extends Book {
  author_name: string;
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
  total_paid?: number;
  amount_owed?: number;
}

export interface ReservationView extends RoomReservation {
  room_number: string;
  member_name: string;
  archived: boolean;
  is_active?: boolean;
}

export interface ReceiptView {
  receipt_id: number;
  transaction_code: string;
  issued_date: string;
  payment_id: number;
  payment_method: string;
  amount_paid: number;
  received_by: string;
  fine_id: number;
  loan_id: number;
  user_id: number;
  member_name: string;
  member_email: string;
  title: string;
  isbn: string | null;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
}

export interface TableResult {
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportDetails extends TableResult {
  source: string;
}

export interface ReportResult extends TableResult {
  stats: { label: string; value: string }[];
  chart?: { title: string; labels: string[]; values: number[]; format?: 'number' | 'money' };
  details?: ReportDetails;
}

