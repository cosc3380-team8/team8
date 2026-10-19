// API layer used by every page. Today it talks to the localStorage "database".
// To connect the Java back end, keep these function signatures and replace each body with
// a fetch() call (see docs/API_CONTRACT.md for the matching REST endpoints).

import type { DBState } from './state';
import { nextId } from './state';
import { loadState, resetState, saveState } from './store';
import * as rules from './rules';
import { daysBetween, today } from '../utils/dates';
import type {
  AuditEntry, Author, Book, BookView, FineView, HoldView, ItemKind, LoanView, Media,
  MediaView, Member, ReservationView, Room, Session, Staff,
} from '../types';

async function run<T>(fn: (s: DBState) => T): Promise<T> {
  const s = loadState();
  try {
    const result = fn(s);
    saveState(s);
    return result;
  } catch (e) {
    saveState(s); // keep audit entries for blocked actions (rules validate before they mutate)
    throw e;
  }
}

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
const need = (v: unknown, label: string) => {
  if (v === undefined || v === null || String(v).trim() === '') throw new Error(`${label} is required.`);
};

function assertEmailFree(s: DBState, email: string, own?: { table: 'members' | 'staff'; id: number }) {
  const e = email.trim().toLowerCase();
  const clash =
    s.members.some((m) => m.email.toLowerCase() === e && !(own?.table === 'members' && own.id === m.user_id)) ||
    s.staff.some((m) => m.email.toLowerCase() === e && !(own?.table === 'staff' && own.id === m.staff_id));
  if (clash) throw new Error('That email address is already in use.');
}

// ------------------------------------------------------------------ auth
export const login = (email: string, password: string): Promise<Session> =>
  run((s) => {
    rules.expireHolds(s); // stand-in for the nightly SQL Agent job
    const e = email.trim().toLowerCase();
    const m = s.members.find((x) => x.email.toLowerCase() === e);
    if (m && m.is_active && m.password === password) {
      return { id: m.user_id, name: fullName(m), email: m.email, role: m.role };
    }
    const st = s.staff.find((x) => x.email.toLowerCase() === e);
    if (st && st.is_active && st.password === password) {
      return { id: st.staff_id, name: fullName(st), email: st.email, role: st.is_admin ? 'admin' : 'employee' };
    }
    throw new Error('Invalid email or password.');
  });

// ------------------------------------------------------------------ reads
/** Authors of a book in author_order (the book_authors junction table). */
const authorsOf = (s: DBState, bookId: number): Author[] =>
  s.bookAuthors
    .filter((ba) => ba.book_id === bookId)
    .sort((a, b) => a.author_order - b.author_order)
    .map((ba) => s.authors.find((a) => a.author_id === ba.author_id))
    .filter((a): a is Author => !!a);

const joinNames = (names: string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

export const listBooks = (): Promise<BookView[]> =>
  run((s) =>
    s.books.map((b) => {
      const copies = s.bookCopies.filter((c) => c.book_id === b.book_id);
      const authors = authorsOf(s, b.book_id);
      return {
        ...b,
        author_name: authors.length ? joinNames(authors.map(fullName)) : 'Unknown',
        author_ids: authors.map((a) => a.author_id),
        total_copies: copies.length,
        available_copies: copies.filter((c) => c.status === 'available').length,
      };
    }),
  );

export const listMedia = (): Promise<MediaView[]> =>
  run((s) =>
    s.media.map((m) => {
      const copies = s.mediaCopies.filter((c) => c.media_id === m.media_id);
      return { ...m, total_copies: copies.length, available_copies: copies.filter((c) => c.status === 'available').length };
    }),
  );

export const listAuthors = (): Promise<Author[]> => run((s) => s.authors);
export const listRooms = (): Promise<Room[]> => run((s) => s.rooms);
export const listMembers = (): Promise<Member[]> => run((s) => s.members);
export const listStaff = (): Promise<Staff[]> => run((s) => s.staff);
export const listAudit = (): Promise<AuditEntry[]> => run((s) => s.audit.slice(0, 300));

export const listLoans = (opts: { userId?: number; activeOnly?: boolean } = {}): Promise<LoanView[]> =>
  run((s) =>
    s.loans
      .filter((l) => (opts.userId === undefined || l.user_id === opts.userId) && (!opts.activeOnly || l.return_date === null))
      .map((l): LoanView => {
        const m = s.members.find((x) => x.user_id === l.user_id)!;
        const info = rules.loanItem(s, l);
        let status: LoanView['status'] = 'returned';
        let days: number | null = null;
        if (l.return_date === null) {
          days = daysBetween(today(), l.due_date);
          status = days < 0 ? 'overdue' : days <= rules.WARNING_DAYS ? 'due-soon' : 'active';
        }
        return {
          ...l,
          member_name: fullName(m),
          title: info.title,
          kind: info.kind,
          status,
          days_until_due: days,
          fine_amount: s.fines.find((f) => f.loan_id === l.loan_id)?.amount ?? null,
        };
      })
      .sort((a, b) => b.loan_id - a.loan_id),
  );

export const listHolds = (opts: { userId?: number; activeOnly?: boolean } = {}): Promise<HoldView[]> =>
  run((s) => {
    const active = (h: { status: string }) => h.status === 'waiting' || h.status === 'ready';
    return s.holds
      .filter((h) => (opts.userId === undefined || h.user_id === opts.userId) && (!opts.activeOnly || active(h)))
      .map((h): HoldView => {
        const { kind, itemId } = rules.holdItem(h);
        const m = s.members.find((x) => x.user_id === h.user_id)!;
        let pos: number | null = null;
        if (h.status === 'waiting') {
          const queue = s.holds
            .filter((x) => x.status === 'waiting' && (kind === 'book' ? x.book_id === itemId : x.media_id === itemId))
            .sort((a, b) => a.request_date.localeCompare(b.request_date) || a.hold_id - b.hold_id);
          pos = queue.findIndex((x) => x.hold_id === h.hold_id) + 1;
        }
        return { ...h, member_name: fullName(m), title: rules.itemTitle(s, kind, itemId), kind, queue_position: pos };
      })
      .sort((a, b) => b.hold_id - a.hold_id);
  });

export const listFines = (userId?: number): Promise<FineView[]> =>
  run((s) =>
    s.fines
      .map((f): FineView => {
        const loan = s.loans.find((l) => l.loan_id === f.loan_id)!;
        const m = s.members.find((x) => x.user_id === loan.user_id)!;
        const pay = s.payments.find((p) => p.fine_id === f.fine_id);
        const rec = pay ? s.receipts.find((r) => r.payment_id === pay.payment_id) : undefined;
        return {
          ...f,
          user_id: loan.user_id,
          member_name: fullName(m),
          title: rules.loanItem(s, loan).title,
          due_date: loan.due_date,
          return_date: loan.return_date,
          payment_method: pay?.payment_method ?? null,
          receipt_code: rec?.transaction_code ?? null,
        };
      })
      .filter((f) => userId === undefined || f.user_id === userId)
      .sort((a, b) => b.fine_id - a.fine_id),
  );

export const listReservations = (userId?: number): Promise<ReservationView[]> =>
  run((s) =>
    s.reservations
      .filter((r) => userId === undefined || r.user_id === userId)
      .map((r) => ({
        ...r,
        room_number: s.rooms.find((x) => x.room_id === r.room_id)?.room_number ?? '?',
        member_name: fullName(s.members.find((x) => x.user_id === r.user_id)!),
      }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  );

export const dashboardStats = () =>
  run((s) => {
    const active = s.loans.filter((l) => l.return_date === null);
    const t = today();
    return {
      books: s.books.filter((b) => b.is_active).length,
      media: s.media.filter((m) => m.is_active).length,
      members: s.members.filter((m) => m.is_active).length,
      activeLoans: active.length,
      overdue: active.filter((l) => l.due_date < t).length,
      readyHolds: s.holds.filter((h) => h.status === 'ready').length,
      unpaidTotal: s.fines.filter((f) => f.paid_status === 'unpaid').reduce((a, f) => a + f.amount, 0),
    };
  });

// ------------------------------------------------------------------ data entry (create / update / soft-delete)
export const saveAuthor = (a: Partial<Author>): Promise<void> =>
  run((s) => {
    need(a.first_name, 'First name');
    need(a.last_name, 'Last name');
    if (a.author_id) Object.assign(s.authors.find((x) => x.author_id === a.author_id)!, a);
    else s.authors.push({ author_id: nextId(s, 'authors'), first_name: a.first_name!, last_name: a.last_name! });
  });

export const deleteAuthor = (id: number): Promise<void> =>
  run((s) => {
    if (s.bookAuthors.some((ba) => ba.author_id === id)) throw new Error('This author is linked to one or more books. Remove them from those books first.');
    s.authors = s.authors.filter((a) => a.author_id !== id); // authors have no history, so a hard delete is safe
  });

export const saveBook = (b: Partial<Book> & { author_ids?: number[] }, addCopies = 0): Promise<void> =>
  run((s) => {
    need(b.title, 'Title');
    const authorIds = [...new Set((b.author_ids ?? []).map(Number))];
    if (authorIds.length === 0) throw new Error('Choose at least one author.');
    if (authorIds.some((aid) => !s.authors.some((a) => a.author_id === aid))) throw new Error('Choose valid authors.');
    let id = b.book_id;
    if (id) {
      if (b.is_active === false && s.bookCopies.some((c) => c.book_id === id && (c.status === 'loaned' || c.status === 'held')))
        throw new Error('Cannot archive: copies are on loan or held.');
      const cur = s.books.find((x) => x.book_id === id)!;
      cur.title = b.title!;
      cur.publisher = b.publisher ?? '';
      if (b.is_active !== undefined) cur.is_active = b.is_active;
    } else {
      id = nextId(s, 'books');
      s.books.push({ book_id: id, title: b.title!, publisher: b.publisher ?? '', is_active: true });
      addCopies = Math.max(addCopies, 1);
    }
    // replace this book's rows in the book_authors junction table
    s.bookAuthors = s.bookAuthors.filter((ba) => ba.book_id !== id);
    authorIds.forEach((author_id, i) => s.bookAuthors.push({ book_id: id!, author_id, author_order: i + 1 }));
    for (let i = 0; i < addCopies; i++) s.bookCopies.push({ copy_id: nextId(s, 'bookCopies'), book_id: id, status: 'available' });
  });

export const deleteBook = (id: number): Promise<void> =>
  run((s) => {
    if (s.bookCopies.some((c) => c.book_id === id && (c.status === 'loaned' || c.status === 'held')))
      throw new Error('Cannot archive: copies are on loan or held.');
    s.books.find((b) => b.book_id === id)!.is_active = false; // soft delete keeps loan history intact
  });

export const saveMedia = (m: Partial<Media>, addCopies = 0): Promise<void> =>
  run((s) => {
    need(m.title, 'Title');
    need(m.media_type, 'Media type');
    let id = m.media_id;
    if (id) {
      if (m.is_active === false && s.mediaCopies.some((c) => c.media_id === id && (c.status === 'loaned' || c.status === 'held')))
        throw new Error('Cannot archive: copies are on loan or held.');
      Object.assign(s.media.find((x) => x.media_id === id)!, m);
    } else {
      id = nextId(s, 'media');
      s.media.push({ media_id: id, title: m.title!, media_type: m.media_type!, is_active: true });
      addCopies = Math.max(addCopies, 1);
    }
    for (let i = 0; i < addCopies; i++) s.mediaCopies.push({ media_copy_id: nextId(s, 'mediaCopies'), media_id: id, status: 'available' });
  });

export const deleteMedia = (id: number): Promise<void> =>
  run((s) => {
    if (s.mediaCopies.some((c) => c.media_id === id && (c.status === 'loaned' || c.status === 'held')))
      throw new Error('Cannot archive: copies are on loan or held.');
    s.media.find((m) => m.media_id === id)!.is_active = false;
  });

export const saveRoom = (r: Partial<Room>): Promise<void> =>
  run((s) => {
    need(r.room_number, 'Room number');
    const dup = s.rooms.some((x) => x.room_number === r.room_number && x.room_id !== r.room_id);
    if (dup) throw new Error('A room with that number already exists.');
    const rec = { ...r, room_level: Number(r.room_level), capacity: Number(r.capacity) };
    if (r.room_id) Object.assign(s.rooms.find((x) => x.room_id === r.room_id)!, rec);
    else s.rooms.push({ room_id: nextId(s, 'rooms'), room_number: r.room_number!, room_level: rec.room_level || 1, capacity: rec.capacity || 1, is_active: true });
  });

export const deleteRoom = (id: number): Promise<void> =>
  run((s) => {
    const now = new Date().toISOString().slice(0, 16);
    if (s.reservations.some((r) => r.room_id === id && r.end_time > now)) throw new Error('Cannot archive: room has upcoming reservations.');
    s.rooms.find((r) => r.room_id === id)!.is_active = false;
  });

export const saveMember = (m: Partial<Member>): Promise<void> =>
  run((s) => {
    need(m.first_name, 'First name');
    need(m.last_name, 'Last name');
    need(m.email, 'Email');
    if (!/^\S+@\S+\.\S+$/.test(m.email!)) throw new Error('Enter a valid email address.');
    assertEmailFree(s, m.email!, m.user_id ? { table: 'members', id: m.user_id } : undefined);
    if (m.user_id) {
      const cur = s.members.find((x) => x.user_id === m.user_id)!;
      if (m.is_active === false && s.loans.some((l) => l.user_id === cur.user_id && l.return_date === null))
        throw new Error('Cannot deactivate: member has items on loan.');
      Object.assign(cur, { ...m, password: m.password ? m.password : cur.password });
    } else {
      need(m.password, 'Password');
      s.members.push({
        user_id: nextId(s, 'members'), first_name: m.first_name!, last_name: m.last_name!,
        email: m.email!.trim(), password: m.password!, role: m.role === 'faculty' ? 'faculty' : 'student', is_active: true,
      });
    }
  });

export const deleteMember = (id: number): Promise<void> =>
  run((s) => {
    if (s.loans.some((l) => l.user_id === id && l.return_date === null)) throw new Error('Cannot deactivate: member has items on loan.');
    s.members.find((m) => m.user_id === id)!.is_active = false;
  });

export const saveStaff = (m: Partial<Staff>): Promise<void> =>
  run((s) => {
    need(m.first_name, 'First name');
    need(m.last_name, 'Last name');
    need(m.email, 'Email');
    if (!/^\S+@\S+\.\S+$/.test(m.email!)) throw new Error('Enter a valid email address.');
    assertEmailFree(s, m.email!, m.staff_id ? { table: 'staff', id: m.staff_id } : undefined);
    if (m.staff_id) {
      const cur = s.staff.find((x) => x.staff_id === m.staff_id)!;
      const next = { ...cur, ...m, password: m.password ? m.password : cur.password };
      const admins = s.staff.filter((x) => x.staff_id !== cur.staff_id && x.is_admin && x.is_active).length;
      if (admins === 0 && !(next.is_admin && next.is_active)) throw new Error('At least one active administrator is required.');
      Object.assign(cur, next);
    } else {
      need(m.password, 'Password');
      s.staff.push({
        staff_id: nextId(s, 'staff'), first_name: m.first_name!, last_name: m.last_name!, email: m.email!.trim(),
        password: m.password!, is_admin: !!m.is_admin, is_active: true,
      });
    }
  });

export const deleteStaff = (id: number): Promise<void> =>
  run((s) => {
    const cur = s.staff.find((x) => x.staff_id === id)!;
    const admins = s.staff.filter((x) => x.staff_id !== id && x.is_admin && x.is_active).length;
    if (cur.is_admin && admins === 0) throw new Error('At least one active administrator is required.');
    cur.is_active = false;
  });

// ------------------------------------------------------------------ circulation
export const doCheckout = (userId: number, kind: ItemKind, itemId: number) =>
  run((s) => rules.checkout(s, userId, kind, itemId));
export const doReturn = (loanId: number) => run((s) => rules.returnLoan(s, loanId));
export const doPlaceHold = (userId: number, kind: ItemKind, itemId: number) =>
  run((s) => rules.placeHold(s, userId, kind, itemId));
export const doCancelHold = (holdId: number) => run((s) => rules.cancelHold(s, holdId));
export const doPayFine = (fineId: number, method: string) => run((s) => rules.payFine(s, fineId, method));
export const doReserveRoom = (userId: number, roomId: number, start: string, end: string) =>
  run((s) => rules.reserveRoom(s, userId, roomId, start, end));
export const cancelReservation = (id: number): Promise<void> =>
  run((s) => { s.reservations = s.reservations.filter((r) => r.reservation_id !== id); });
export const runMaintenance = () => run((s) => rules.expireHolds(s));
export const resetDemoData = async () => { resetState(); loadState(); };
