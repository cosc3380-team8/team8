import type {
  AuditEntry, Author, Book, BookView, FineView, HoldView, ItemKind, LoanView, Media,
  MediaView, Member, Notification, ReceiptView, ReservationView, Room, Session, Staff,
} from '../types';

const API = 'https://umas-library-server.vercel.app';
const SESSION_KEY = 'library_session';

function authHeader(): Record<string, string> {
  try {
    const token = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// every server call goes through here; the server sends { error } on failure
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { ...authHeader(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (response.status === 401 && path !== '/login') {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.assign('/login');
  }
  if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status}).`);
  return data as T;
}

const query = (values: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== false) q.set(key, String(value)); });
  const text = q.toString();
  return text ? `?${text}` : '';
};

export const login = (email: string, password: string): Promise<Session> =>
  request<Session>('/login', 'POST', { email, password });

export const listBooks = () => request<BookView[]>('/books');
export const listMedia = () => request<MediaView[]>('/media');
export const listAuthors = () => request<Author[]>('/authors');
export const listReportAuthors = () => request<Author[]>('/report-authors');
export const listRooms = () => request<Room[]>('/rooms');
export const listMembers = () => request<Member[]>('/members');
export const listStaff = () => request<Staff[]>('/staff');
export const listAudit = () => request<AuditEntry[]>('/audit');

export const listLoans = (opts: { userId?: number; activeOnly?: boolean } = {}) =>
  request<LoanView[]>(`/loans${query({ user_id: opts.userId, active_only: opts.activeOnly })}`);

export const listHolds = (opts: { userId?: number; activeOnly?: boolean } = {}) =>
  request<HoldView[]>(`/holds${query({ user_id: opts.userId, active_only: opts.activeOnly })}`);

export const listFines = (userId?: number) => request<FineView[]>(`/fines${query({ user_id: userId })}`);

// archive reservations past end time
export const listReservations = (userId?: number) =>
  request<ReservationView[]>(`/reservations${query({ user_id: userId })}`);

export const listNotifications = (userId: number) =>
  request<Notification[]>(`/notifications${query({ user_id: userId })}`);

export const unreadNotificationCount = (userId: number) =>
  request<number>(`/notifications/unread${query({ user_id: userId })}`);

export const markNotificationsRead = (userId: number) =>
  request<void>('/notifications/read', 'POST', { userId });

const digitsOnly = (v: string) => v.replace(/[^0-9Xx]/g, '').toUpperCase();

// receipts + transactions (members see only their own)
export const listReceipts = (opts: { userId?: number; search?: string } = {}) =>
  request<ReceiptView[]>(`/receipts${query({ user_id: opts.userId, search: opts.search?.trim() || undefined })}`);

export interface DashboardStats {
  books: number;
  media: number;
  members: number;
  activeLoans: number;
  overdue: number;
  readyHolds: number;
  unpaidTotal: number;
}

export const dashboardStats = () => request<DashboardStats>('/stats');

export const saveAuthor = async (a: Partial<Author>): Promise<void> => {
  if (!a.first_name?.trim()) throw new Error('First name is required.');
  if (!a.last_name?.trim()) throw new Error('Last name is required.');

  const updating = a.author_id != null;
  await request(updating ? `/authors/${a.author_id}` : '/authors', updating ? 'PUT' : 'POST', {
    first_name: a.first_name.trim(),
    last_name: a.last_name.trim(),
  });
};

export const deleteAuthor = (id: number) => request<void>(`/authors/${id}`, 'DELETE');

export const saveBook = async (b: Partial<Book> & { author_ids?: number[]; total_copies?: number }): Promise<void> => {
  if (!b.title?.trim()) throw new Error('Title is required.');

  const isbn = digitsOnly(b.isbn ?? '');
  if (isbn && isbn.length !== 10 && isbn.length !== 13) {
    throw new Error('ISBN must have 10 or 13 digits.');
  }

  const author_ids = [...new Set((b.author_ids ?? []).map(Number))];
  if (author_ids.length === 0) throw new Error('Choose at least one author.');

  const updating = b.book_id != null;
  await request(updating ? `/books/${b.book_id}` : '/books', updating ? 'PUT' : 'POST', {
    title: b.title.trim(),
    isbn,
    publisher: b.publisher ?? '',
    is_active: b.is_active,
    author_ids,
    ...(updating ? { total_copies: b.total_copies } : { addCopies: Math.max(1, b.total_copies ?? 1) }),
  });
};

export const deleteBook = (id: number) => request<void>(`/books/${id}`, 'PATCH');

export const saveMedia = async (m: Partial<Media>, addCopies = 0): Promise<void> => {
  if (!m.title?.trim()) throw new Error('Title is required.');
  if (!m.media_type) throw new Error('Media type is required.');

  const updating = m.media_id != null;
  await request(updating ? `/media/${m.media_id}` : '/media', updating ? 'PUT' : 'POST', {
    title: m.title.trim(),
    media_type: m.media_type,
    is_active: m.is_active,
    addCopies: updating ? Math.max(0, addCopies) : Math.max(1, addCopies),
  });
};

export const deleteMedia = (id: number) => request<void>(`/media/${id}`, 'PATCH');

export const saveRoom = async (r: Partial<Room>): Promise<void> => {
  if (!r.room_number?.trim()) throw new Error('Room number is required.');

  const updating = r.room_id != null;
  await request(updating ? `/rooms/${r.room_id}` : '/rooms', updating ? 'PUT' : 'POST', {
    room_number: r.room_number.trim(),
    room_level: Number(r.room_level) || 1,
    capacity: Number(r.capacity) || 1,
    is_active: r.is_active,
  });
};

export const deleteRoom = (id: number) => request<void>(`/rooms/${id}`, 'PATCH');

export const saveMember = async (m: Partial<Member>): Promise<void> => {
  if (!m.first_name?.trim()) throw new Error('First name is required.');
  if (!m.last_name?.trim()) throw new Error('Last name is required.');
  if (!m.email?.trim()) throw new Error('Email is required.');
  if (!/^\S+@\S+\.\S+$/.test(m.email)) throw new Error('Enter a valid email address.');

  const updating = m.user_id != null;
  if (!updating && !m.password) throw new Error('Password is required.');

  await request(updating ? `/members/${m.user_id}` : '/members', updating ? 'PUT' : 'POST', {
    first_name: m.first_name.trim(),
    last_name: m.last_name.trim(),
    email: m.email.trim(),
    password: m.password || undefined,
    role: m.role === 'faculty' ? 'faculty' : 'student',
    is_active: m.is_active,
  });
};

export const deleteMember = (id: number) => request<void>(`/members/${id}`, 'PATCH');

export const saveStaff = async (m: Partial<Staff>): Promise<void> => {
  if (!m.first_name?.trim()) throw new Error('First name is required.');
  if (!m.last_name?.trim()) throw new Error('Last name is required.');
  if (!m.email?.trim()) throw new Error('Email is required.');
  if (!/^\S+@\S+\.\S+$/.test(m.email)) throw new Error('Enter a valid email address.');

  const updating = m.staff_id != null;
  if (!updating && !m.password) throw new Error('Password is required.');

  await request(updating ? `/staff/${m.staff_id}` : '/staff', updating ? 'PUT' : 'POST', {
    first_name: m.first_name.trim(),
    last_name: m.last_name.trim(),
    email: m.email.trim(),
    password: m.password || undefined,
    is_admin: !!m.is_admin,
    is_active: m.is_active,
  });
};

export const deleteStaff = (id: number) => request<void>(`/staff/${id}`, 'PATCH');

export const doCheckout = (userId: number, kind: ItemKind, itemId: number) =>
  request<{ loan_id: number; due_date: string }>('/loans', 'POST', { userId, kind, itemId });

export const doReturn = (loanId: number) =>
  request<{ fine: { fine_id: number; amount: number } | null }>(`/loans/${loanId}/return`, 'POST');

export const doPlaceHold = (userId: number, kind: ItemKind, itemId: number) =>
  request<{ hold_id: number }>('/holds', 'POST', { userId, kind, itemId });

export const doCancelHold = (holdId: number) =>
  request<{ hold_id: number }>(`/holds/${holdId}/cancel`, 'POST');

export const doPayFine = (fineId: number, method: string) =>
  request<ReceiptView>(`/fines/${fineId}/pay`, 'POST', { method });

export const doReserveRoom = (userId: number, roomId: number, start: string, end: string) =>
  request<void>('/reservations', 'POST', { userId, roomId, start, end });

export const cancelReservation = (id: number) => request<void>(`/reservations/${id}`, 'PATCH');

export const runMaintenance = () => request<number>('/holds/expire', 'POST');

// admin only: delete all activity and put the same demo state back (team8_azure_migration_8.sql)
export interface ResetResult { accounts: number; items_out: number; items_late: number; fines: number; holds: number; room_bookings: number }
export const resetDemoData = () => request<ResetResult>('/admin/reset-demo', 'POST');


