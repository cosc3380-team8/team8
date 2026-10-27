import type {
  Author, AuditEntry, Book, BookAuthor, BookCopy, Fine, Hold, Loan, Media, MediaCopy,
  Member, Notification, Payment, Receipt, Room, RoomReservation, Staff,
} from '../types';

export interface DBState {
  members: Member[];
  staff: Staff[];
  authors: Author[];
  books: Book[];
  bookAuthors: BookAuthor[];
  bookCopies: BookCopy[];
  media: Media[];
  mediaCopies: MediaCopy[];
  rooms: Room[];
  reservations: RoomReservation[];
  loans: Loan[];
  fines: Fine[];
  holds: Hold[];
  payments: Payment[];
  receipts: Receipt[];
  notifications: Notification[];
  audit: AuditEntry[];
  seq: Record<string, number>;
}

export function emptyState(): DBState {
  return {
    members: [], staff: [], authors: [], books: [], bookAuthors: [], bookCopies: [], media: [],
    mediaCopies: [], rooms: [], reservations: [], loans: [], fines: [], holds: [],
    payments: [], receipts: [], notifications: [], audit: [], seq: {},
  };
}

export function nextId(s: DBState, table: string): number {
  s.seq[table] = (s.seq[table] ?? 0) + 1;
  return s.seq[table];
}
