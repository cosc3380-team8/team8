import type { DBState } from './state';
import { nextId } from './state';
import { loadState, resetState, saveState } from './store';
import * as rules from './rules';
import { daysBetween, today } from '../utils/dates';
import type {
  AuditEntry, Author, Book, BookView, FineView, HoldView, ItemKind, LoanView, Media,
  MediaView, Member, Notification, ReceiptView, ReservationView, Room, Session, Staff,
} from '../types';

const API = 'https://umas-library-server.vercel.app';

async function run<T>(fn: (s: DBState) => T): Promise<T> {
  const s = loadState();
  try {
    const result = fn(s);
    saveState(s);
    return result;
  } catch (e) {
    saveState(s);
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

export const login = async (email: string, password: string): Promise<Session> => {
  const response = await fetch('https://umas-library-server.vercel.app/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data as Session;
};

const authorsOf = (s: DBState, bookId: number): Author[] =>
  s.bookAuthors
    .filter((ba) => ba.book_id === bookId)
    .sort((a, b) => a.author_order - b.author_order)
    .map((ba) => s.authors.find((a) => a.author_id === ba.author_id))
    .filter((a): a is Author => !!a);

const joinNames = (names: string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

// List all books
export const listBooks = async (): Promise<BookView[]> => {
  const response = await fetch('https://umas-library-server.vercel.app/books');
  if (!response.ok) {
    throw new Error('Failed to fetch books');
  }

  return response.json() as Promise<BookView[]>;
}

// List all media
export const listMedia = async (): Promise<MediaView[]> => {
  const response = await fetch('https://umas-library-server.vercel.app/media');
  if (!response.ok) {
    throw new Error('Failed to fetch media');
  }
  return response.json() as Promise<MediaView[]>;
}

// List all authors
export const listAuthors = async (): Promise<Author[]> => {
  // run((s) => s.authors);
  const response = await fetch('https://umas-library-server.vercel.app/authors');
  if (!response.ok) {
    throw new Error('Failed to fetch authors');
  }
  return response.json() as Promise<Author[]>;
}

// List all rooms
export const listRooms = async (): Promise<Room[]> => {
  // run((s) => s.rooms);
  const response = await fetch('https://umas-library-server.vercel.app/rooms');
  if (!response.ok) {
    throw new Error('Failed to fetch rooms');
  }
  return response.json() as Promise<Room[]>;
}

// List all members
export const listMembers = async (): Promise<Member[]> => {
  // run((s) => s.members);
  const response = await fetch('https://umas-library-server.vercel.app/members');
  if (!response.ok) {
    throw new Error('Failed to fetch members');
  }
  return response.json() as Promise<Member[]>;
}

// List all staff
export const listStaff = async (): Promise<Staff[]> => {
  // run((s) => s.staff);
  const response = await fetch('https://umas-library-server.vercel.app/staff');
  if (!response.ok) {
    throw new Error('Failed to fetch authors');
  }
  return response.json() as Promise<Staff[]>;
}

export const listAudit = async (): Promise<AuditEntry[]> => {
   const response = await fetch(`${API}/audit`);
  if (!response.ok) {
    throw new Error('Failed to fetch audit log');
  }
  return response.json() as Promise<AuditEntry[]>;
}
  
export const listLoans = async (opts: { userId?: number; activeOnly?: boolean } = {}): Promise<LoanView[]> => {
  const q = new URLSearchParams();
  if (opts.userId !== undefined) q.set('user_id', String(opts.userId));
  if (opts.activeOnly) q.set('active_only', 'true');
  const response = await fetch(`${API}/loans?${q}`);
  if (!response.ok) {
    throw new Error('Failed to fetch loans');
  }
  return response.json() as Promise<LoanView[]>;
}

export const listHolds = async (opts: { userId?: number; activeOnly?: boolean } = {}): Promise<HoldView[]> => {
  const q = new URLSearchParams();
  if (opts.userId !== undefined) q.set('user_id', String(opts.userId));
  if (opts.activeOnly) q.set('active_only', 'true');
  const res = await fetch(`${API}/holds?${q}`);
  if (!res.ok) throw new Error('Failed to fetch holds');
  return res.json();
};

export const listFines = async (userId?: number): Promise<FineView[]> => {
  const q = new URLSearchParams();
  if (userId !== undefined) q.set('user_id', String(userId));
  const response = await fetch(`${API}/fines?${q}`);
  if (!response.ok) {
    throw new Error('Failed to fetch fines');
  }
  return response.json() as Promise<FineView[]>;
}

// archive reservations past end time
export const listReservations = async (userId?: number): Promise<ReservationView[]> => {
  const q = new URLSearchParams();
  if (userId !== undefined) q.set('user_id', String(userId));
  const response = await fetch(`${API}/reservations?${q}`);
  if (!response.ok) {
    throw new Error('Failed to fetch reservations');
  }
  return response.json() as Promise<ReservationView[]>;
}

export const listNotifications = async (userId: number): Promise<Notification[]> => {
  const response = await fetch(`${API}/notifications?user_id=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }
  return response.json() as Promise<Notification[]>;
}
 
export const unreadNotificationCount = async (userId: number): Promise<number> => {
  const response = await fetch(`${API}/notifications/unread?user_id=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch notification count');
  }
  return response.json() as Promise<number>;
}

export const markNotificationsRead = async (userId: number): Promise<void> => {
  const response = await fetch(`${API}/notifications/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw new Error('Could not mark notifications as read');
  }
}

const digitsOnly = (v: string) => v.replace(/[^0-9Xx]/g, '').toUpperCase();

function receiptView(s: DBState, receiptId: number): ReceiptView {
  const r = s.receipts.find((x) => x.receipt_id === receiptId);
  if (!r) throw new Error('Receipt not found.');
  const pay = s.payments.find((p) => p.payment_id === r.payment_id)!;
  const fine = s.fines.find((f) => f.fine_id === pay.fine_id)!;
  const loan = s.loans.find((l) => l.loan_id === fine.loan_id)!;
  const m = s.members.find((x) => x.user_id === loan.user_id)!;
  const info = rules.loanItem(s, loan);
  const staff = pay.staff_id !== null ? s.staff.find((x) => x.staff_id === pay.staff_id) : undefined;
  return {
    receipt_id: r.receipt_id,
    transaction_code: r.transaction_code,
    issued_date: r.issued_date,
    payment_id: pay.payment_id,
    payment_method: pay.payment_method,
    amount_paid: pay.amount_paid,
    received_by: staff ? fullName(staff) : 'Front desk',
    fine_id: fine.fine_id,
    loan_id: loan.loan_id,
    user_id: m.user_id,
    member_name: fullName(m),
    member_email: m.email,
    title: info.title,
    isbn: info.kind === 'book' ? s.books.find((b) => b.book_id === info.itemId)?.isbn || null : null,
    borrow_date: loan.borrow_date,
    due_date: loan.due_date,
    return_date: loan.return_date,
  };
}

// receipts + transactions (members see only their own)
export const listReceipts = async (opts: { userId?: number; search?: string } = {}): Promise<ReceiptView[]> => {
  const q = new URLSearchParams();
  if (opts.userId !== undefined) q.set('user_id', String(opts.userId));
  if (opts.search?.trim()) q.set('search', opts.search.trim());
  const response = await fetch(`${API}/receipts?${q}`);
  if (!response.ok) {
    throw new Error('Failed to fetch receipts');
  }
  return response.json() as Promise<ReceiptView[]>;
}

export interface DashboardStats {
  books: number;
  media: number;
  members: number;
  activeLoans: number;
  overdue: number;
  readyHolds: number;
  unpaidTotal: number;
}
 
export const dashboardStats = async (): Promise<DashboardStats> => {
  const response = await fetch(`${API}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }
  return response.json() as Promise<DashboardStats>;
}
  
export const saveAuthor = async (a: Partial<Author>): Promise<void> => {
  if (!a.first_name?.trim()) throw new Error('First name is required.');
  if (!a.last_name?.trim()) throw new Error('Last name is required.');

  const updating = a.author_id != null;
  const url = updating
    ? `https://umas-library-server.vercel.app/authors/${a.author_id}` 
    : 'https://umas-library-server.vercel.app/authors';

  const response = await fetch(url, {
    method: updating ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: a.first_name.trim(),
      last_name: a.last_name.trim()
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not save author (${response.status}).`);
  }
}


export const deleteAuthor = async (id: number): Promise<void> => {
  const url = `https://umas-library-server.vercel.app/authors/${id}`;

  const response = await fetch(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Could not delete author (${response.status}).`);
  }
}


export const saveBook = async (b: Partial<Book> & { author_ids?: number[] }, addCopies = 0): Promise<void> => {
  if (!b.title?.trim()) throw new Error('Title is required.');

  const isbn = digitsOnly(b.isbn ?? '');
  if (isbn && isbn.length !== 10 && isbn.length !== 13) {
    throw new Error('ISBN must have 10 or 13 digits.');
  }
  
  const author_ids = [...new Set((b.author_ids ?? []).map(Number))];
  if (author_ids.length === 0) throw new Error('Choose at least one author.');

  const updating = b.book_id != null;
  const url = updating 
    ? `https://umas-library-server.vercel.app/books/${b.book_id}` 
    : 'https://umas-library-server.vercel.app/books';

  const response = await fetch(url, {
    method: updating ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: b.title.trim(),
      isbn,
      publisher: b.publisher ?? '',
      is_active: b.is_active,
      author_ids,
      addCopies: updating ? Math.max(0, addCopies) : Math.max(1, addCopies)
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not save book (${response.status}).`);
  }
}
 
export const deleteBook = async (id: number): Promise<void> => {
  const url =`https://umas-library-server.vercel.app/books/${id}`;

  const response = await fetch(url, {
    method: 'PATCH',
  });

  if (!response.ok) {
    throw new Error(`Could not delete book (${response.status}).`);
  }
}


export const saveMedia = async (m: Partial<Media>, addCopies = 0): Promise<void> => {
  if (!m.title?.trim()) throw new Error('Title is required.');
  if (!m.media_type) throw new Error('Media type is required.');
 
  const updating = m.media_id != null;
  const url = updating
    ? `${API}/media/${m.media_id}`
    : `${API}/media`;
 
  const response = await fetch(url, {
    method: updating ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: m.title.trim(),
      media_type: m.media_type,
      is_active: m.is_active,
      addCopies: updating ? Math.max(0, addCopies) : Math.max(1, addCopies)
    })
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not save media (${response.status}).`);
  }
}

export const deleteMedia = async (id: number): Promise<void> => {
  const response = await fetch(`${API}/media/${id}`, {
    method: 'PATCH',
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not archive media (${response.status}).`);
  }
}
 
export const saveRoom = async (r: Partial<Room>): Promise<void> => {
if (!r.room_number?.trim()) throw new Error('Room number is required.');
 
  const updating = r.room_id != null;
  const url = updating
    ? `${API}/rooms/${r.room_id}`
    : `${API}/rooms`;
 
  const response = await fetch(url, {
    method: updating ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_number: r.room_number.trim(),
      room_level: Number(r.room_level) || 1,
      capacity: Number(r.capacity) || 1,
      is_active: r.is_active
    })
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not save room (${response.status}).`);
  }
}

export const deleteRoom = async (id: number): Promise<void> => {
  const response = await fetch(`${API}/rooms/${id}`, {
    method: 'PATCH',
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not archive room (${response.status}).`);
  }
}
  
export const saveMember = async (m: Partial<Member>): Promise<void> => {
if (!m.first_name?.trim()) throw new Error('First name is required.');
  if (!m.last_name?.trim()) throw new Error('Last name is required.');
  if (!m.email?.trim()) throw new Error('Email is required.');
  if (!/^\S+@\S+\.\S+$/.test(m.email)) throw new Error('Enter a valid email address.');
 
  const updating = m.user_id != null;
  if (!updating && !m.password) throw new Error('Password is required.');
  const url = updating
    ? `${API}/members/${m.user_id}`
    : `${API}/members`;
 
  const response = await fetch(url, {
    method: updating ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: m.first_name.trim(),
      last_name: m.last_name.trim(),
      email: m.email.trim(),
      password: m.password || undefined,
      role: m.role === 'faculty' ? 'faculty' : 'student',
      is_active: m.is_active
    })
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not save member (${response.status}).`);
  }
}
 
export const deleteMember = async (id: number): Promise<void> => {
  const response = await fetch(`${API}/members/${id}`, {
    method: 'PATCH',
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not deactivate member (${response.status}).`);
  }
}

export const saveStaff = async (m: Partial<Staff>): Promise<void> => {
   if (!m.first_name?.trim()) throw new Error('First name is required.');
  if (!m.last_name?.trim()) throw new Error('Last name is required.');
  if (!m.email?.trim()) throw new Error('Email is required.');
  if (!/^\S+@\S+\.\S+$/.test(m.email)) throw new Error('Enter a valid email address.');
 
  const updating = m.staff_id != null;
  if (!updating && !m.password) throw new Error('Password is required.');
  const url = updating
    ? `${API}/staff/${m.staff_id}`
    : `${API}/staff`;
 
  const response = await fetch(url, {
    method: updating ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: m.first_name.trim(),
      last_name: m.last_name.trim(),
      email: m.email.trim(),
      password: m.password || undefined,
      is_admin: !!m.is_admin,
      is_active: m.is_active
    })
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not save staff member (${response.status}).`);
  }
}

export const deleteStaff = async (id: number): Promise<void> => {
 const response = await fetch(`${API}/staff/${id}`, {
    method: 'PATCH',
  });
 
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `Could not deactivate staff member (${response.status}).`);
  }
}
 
export const doCheckout = async (userId: number, kind: ItemKind, itemId: number) => {
  const res = await fetch(`${API}/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, kind, itemId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not check out item');
  return data;
};
  
export const doReturn = async (loanId: number): Promise<{ fine: { fine_id: number; amount: number } | null }> => {
  const res = await fetch(`${API}/loans/${loanId}/return`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not return item');
  return data;
};
 
export const doPlaceHold = async (userId: number, kind: ItemKind, itemId: number) => {
  const res = await fetch(`${API}/holds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, kind, itemId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not place hold');
  return data;
};

export const doCancelHold = async (holdId: number, userId?: number) => {
  const res = await fetch(`${API}/holds/${holdId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not cancel hold');
  return data;
};
 
export const doPayFine = async (fineId: number, method: string, staffId: number): Promise<ReceiptView> => {
  const res = await fetch(`${API}/fines/${fineId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, staffId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not record payment');
  return data as ReceiptView;
};
 
export const doReserveRoom = async (userId: number, roomId: number, start: string, end: string) => {
  const res = await fetch(`${API}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roomId, start, end }),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(data.error || 'Could not reserve room');
  
  return data;
};
 
export const cancelReservation = async (id: number): Promise<void> => {
  const res = await fetch(`${API}/reservations/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? 'Could not cancel reservation');
  }
};
 
export const runMaintenance = async (): Promise<number> => {
  const res = await fetch(`${API}/holds/expire`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not run hold expiry');
  return data;
};
export const resetDemoData = async () => { resetState(); loadState(); };
