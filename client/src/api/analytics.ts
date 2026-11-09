import { request } from './api';
import type { ReportResult, TableResult } from '../types';

export interface ParamDef { name: string; label: string; kind: 'member' | 'item' | 'text' }
export interface QueryDef {
  id: string; title: string; description: string; sql: string; params: ParamDef[];
}


const LOAN_ITEM_JOIN = `FROM loans l
JOIN members u            ON u.user_id = l.user_id
LEFT JOIN book_copies bc  ON bc.copy_id = l.book_copy_id
LEFT JOIN books b         ON b.book_id = bc.book_id
LEFT JOIN media_copies mc ON mc.media_copy_id = l.media_copy_id
LEFT JOIN media_items mi  ON mi.media_id = mc.media_id`;

export const QUERIES: QueryDef[] = [
  {
    id: 'member-items',
    title: 'Items currently checked out by a member',
    description: 'Shows everything a chosen member has on loan, with due dates and status.',
    params: [{ name: 'userId', label: 'Member', kind: 'member' }],
    sql: `SELECT l.loan_id, COALESCE(b.title, mi.title) AS title,
       CASE WHEN l.book_copy_id IS NOT NULL THEN 'Book' ELSE 'Media' END AS item_type,
       l.borrow_date, l.due_date,
       CASE WHEN l.due_date < CAST(GETDATE() AS DATE) THEN 'Overdue' ELSE 'On time' END AS status
${LOAN_ITEM_JOIN}
WHERE l.user_id = @userId AND l.return_date IS NULL
ORDER BY l.due_date;`,
  },
  {
    id: 'overdue',
    title: 'Overdue loans and projected fines',
    description: 'All unreturned items past their due date, with the fine they would owe if returned today.',
    params: [],
    sql: `SELECT l.loan_id, u.first_name + ' ' + u.last_name AS member, u.role,
       COALESCE(b.title, mi.title) AS title, l.due_date,
       DATEDIFF(DAY, l.due_date, GETDATE()) AS days_overdue,
       5 + (DATEDIFF(DAY, l.due_date, GETDATE()) / 7) AS projected_fine
${LOAN_ITEM_JOIN}
WHERE l.return_date IS NULL AND l.due_date < CAST(GETDATE() AS DATE)
ORDER BY days_overdue DESC;`,
  },
  {
    id: 'availability',
    title: 'Search catalog availability',
    description: 'Find books or media by title or author and see how many copies are on the shelf.',
    params: [{ name: 'search', label: 'Title or author contains', kind: 'text' }],
    sql: `SELECT b.title,
       (SELECT STRING_AGG(a.first_name + ' ' + a.last_name, ' and ') WITHIN GROUP (ORDER BY ba.author_order)
          FROM book_authors ba JOIN authors a ON a.author_id = ba.author_id
         WHERE ba.book_id = b.book_id) AS author_or_type,
       (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.book_id) AS total_copies,
       (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.book_id AND c.status = 'available') AS available
FROM books b
WHERE b.is_active = 1
  AND (b.title LIKE '%' + @search + '%'
       OR EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.author_id = ba.author_id
                   WHERE ba.book_id = b.book_id
                     AND (a.first_name LIKE '%' + @search + '%' OR a.last_name LIKE '%' + @search + '%')))
UNION ALL
SELECT mi.title, mi.media_type, COUNT(mc.media_copy_id),
       SUM(CASE WHEN mc.status = 'available' THEN 1 ELSE 0 END)
FROM media_items mi LEFT JOIN media_copies mc ON mc.media_id = mi.media_id
WHERE mi.is_active = 1 AND mi.title LIKE '%' + @search + '%'
GROUP BY mi.title, mi.media_type;`,
  },
  {
    id: 'hold-queue',
    title: 'Hold queue for an item',
    description: 'Who is waiting for a title, in the order they requested it (ready holds first).',
    params: [{ name: 'item', label: 'Book or media item', kind: 'item' }],
    sql: `SELECT ROW_NUMBER() OVER (ORDER BY h.request_date, h.hold_id) AS position,
       u.first_name + ' ' + u.last_name AS member, h.request_date, h.status, h.expiration_date
FROM holds h
JOIN members u ON u.user_id = h.user_id
WHERE h.book_id = @bookId
  AND h.status IN ('waiting', 'ready')
ORDER BY CASE h.status WHEN 'ready' THEN 0 ELSE 1 END, h.request_date, h.hold_id;`,
  },
];

export type FilterKey = 'from' | 'to' | 'userId' | 'role' | 'authorId' | 'keyword' | 'kind';
export interface ReportFilters {
  from?: string; to?: string; userId?: string; role?: string; authorId?: string; keyword?: string; kind?: string;
}
export interface ReportDef {
  id: string; title: string; description: string; filters: FilterKey[];
  dateLabel?: string;
  sql: (f: ReportFilters) => string;
}

const LOAN_FILTERS: FilterKey[] = ['from', 'to', 'userId', 'role', 'authorId', 'keyword', 'kind'];

// where lines for active filters
function loanWhere(f: ReportFilters, dateCol: string, extra: string[] = []): string {
  const w = [...extra];
  if (f.from) w.push(`${dateCol} >= @from`);
  if (f.to) w.push(`${dateCol} <= @to`);
  if (f.userId) w.push('l.user_id = @userId');
  if (f.role) w.push('u.role = @role');
  if (f.kind === 'book') w.push('l.book_copy_id IS NOT NULL');
  if (f.kind === 'media') w.push('l.media_copy_id IS NOT NULL');
  if (f.keyword) w.push("COALESCE(b.title, mi.title) LIKE '%' + @keyword + '%'");
  if (f.authorId) w.push('EXISTS (SELECT 1 FROM book_authors ba WHERE ba.book_id = b.book_id AND ba.author_id = @authorId)');
  return w.length ? `WHERE ${w.join('\n  AND ')}` : '';
}

function itemWhere(f: ReportFilters, titleCol: string, isBook: boolean): string {
  const w: string[] = [`${isBook ? 'b' : 'mi'}.is_active = 1`];
  if (f.keyword) w.push(`${titleCol} LIKE '%' + @keyword + '%'`);
  if (isBook && f.authorId) w.push('EXISTS (SELECT 1 FROM book_authors ba WHERE ba.book_id = b.book_id AND ba.author_id = @authorId)');
  return `WHERE ${w.join('\n  AND ')}`;
}

export const REPORTS: ReportDef[] = [
  {
    id: 'popular',
    title: 'Most borrowed titles',
    description: 'Top 10 titles by number of loans. Pick an author to see their most borrowed books, or a keyword to see books with that word in the title.',
    filters: LOAN_FILTERS,
    dateLabel: 'Borrowed',
    sql: (f) => `SELECT TOP 10 COALESCE(b.title, mi.title) AS title,
       CASE WHEN l.book_copy_id IS NOT NULL THEN 'Book' ELSE 'Media' END AS item_type,
       COUNT(*) AS times_borrowed,
       COUNT(DISTINCT l.user_id) AS different_borrowers
${LOAN_ITEM_JOIN}
${loanWhere(f, 'l.borrow_date')}
GROUP BY COALESCE(b.title, mi.title), CASE WHEN l.book_copy_id IS NOT NULL THEN 'Book' ELSE 'Media' END
ORDER BY times_borrowed DESC;`,
  },
  {
    id: 'history',
    title: 'Personalized loan history',
    description: 'Every loan that matches the filters. Choose a member for their personal report.',
    filters: LOAN_FILTERS,
    dateLabel: 'Borrowed',
    sql: (f) => `SELECT l.loan_id, u.first_name + ' ' + u.last_name AS member, u.role,
       COALESCE(b.title, mi.title) AS title, b.isbn,
       l.borrow_date, l.due_date, l.return_date,
       CASE WHEN l.return_date IS NULL THEN 'On loan'
            WHEN l.return_date > l.due_date THEN 'Returned late' ELSE 'Returned on time' END AS outcome,
       f.amount AS fine
${LOAN_ITEM_JOIN}
LEFT JOIN fines f ON f.loan_id = l.loan_id
${loanWhere(f, 'l.borrow_date')}
ORDER BY l.borrow_date DESC;`,
  },
  {
    id: 'authors',
    title: 'Borrowing by author',
    description: 'Which authors are borrowed most, and how many of their titles were borrowed.',
    filters: ['from', 'to', 'userId', 'role', 'keyword'],
    dateLabel: 'Borrowed',
    sql: (f) => `SELECT a.first_name + ' ' + a.last_name AS author,
       COUNT(*) AS loans,
       COUNT(DISTINCT b.book_id) AS titles_borrowed
${LOAN_ITEM_JOIN}
JOIN book_authors ba ON ba.book_id = b.book_id
JOIN authors a       ON a.author_id = ba.author_id
${loanWhere({ ...f, kind: undefined, authorId: undefined }, 'l.borrow_date')}
GROUP BY a.author_id, a.first_name, a.last_name
ORDER BY loans DESC;`,
  },
  {
    id: 'fines',
    title: 'Fines by month',
    description: 'Fines assessed, collected and still outstanding, grouped by the month the item came back.',
    filters: LOAN_FILTERS,
    dateLabel: 'Returned',
    sql: (f) => `SELECT FORMAT(l.return_date, 'yyyy-MM') AS month,
       COUNT(f.fine_id) AS fines_issued,
       SUM(f.amount) AS assessed,
       SUM(CASE WHEN f.paid_status = 'paid'   THEN f.amount ELSE 0 END) AS collected,
       SUM(CASE WHEN f.paid_status = 'unpaid' THEN f.amount ELSE 0 END) AS outstanding
FROM fines f
JOIN loans l ON l.loan_id = f.loan_id
JOIN members u ON u.user_id = l.user_id
LEFT JOIN book_copies bc  ON bc.copy_id = l.book_copy_id
LEFT JOIN books b         ON b.book_id = bc.book_id
LEFT JOIN media_copies mc ON mc.media_copy_id = l.media_copy_id
LEFT JOIN media_items mi  ON mi.media_id = mc.media_id
${loanWhere(f, 'l.return_date')}
GROUP BY FORMAT(l.return_date, 'yyyy-MM')
ORDER BY month;`,
  },
  {
    id: 'activity',
    title: 'Borrowing activity by member role',
    description: 'Compares students and faculty: loan volume, current loans, overdue items and average loans per member.',
    filters: ['from', 'to', 'role', 'authorId', 'keyword', 'kind'],
    dateLabel: 'Borrowed',
    sql: (f) => `SELECT u.role,
       COUNT(DISTINCT u.user_id) AS members,
       COUNT(l.loan_id) AS total_loans,
       SUM(CASE WHEN l.return_date IS NULL THEN 1 ELSE 0 END) AS active_loans,
       SUM(CASE WHEN l.return_date IS NULL AND l.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS overdue_now,
       CAST(COUNT(l.loan_id) AS FLOAT) / COUNT(DISTINCT u.user_id) AS avg_loans_per_member
FROM members u
LEFT JOIN loans l ON l.user_id = u.user_id
LEFT JOIN book_copies bc  ON bc.copy_id = l.book_copy_id
LEFT JOIN books b         ON b.book_id = bc.book_id
LEFT JOIN media_copies mc ON mc.media_copy_id = l.media_copy_id
LEFT JOIN media_items mi  ON mi.media_id = mc.media_id
${loanWhere(f, 'l.borrow_date', ['u.is_active = 1'])}
GROUP BY u.role;`,
  },
  {
    id: 'inventory',
    title: 'Inventory status',
    description: 'Copies per title broken down by status (available, on loan, held for pickup).',
    filters: ['authorId', 'keyword', 'kind'],
    sql: (f) => {
      const books = `SELECT b.title, 'Book' AS item_type, COUNT(*) AS total,
       SUM(CASE WHEN c.status = 'available' THEN 1 ELSE 0 END) AS available,
       SUM(CASE WHEN c.status = 'loaned'    THEN 1 ELSE 0 END) AS on_loan,
       SUM(CASE WHEN c.status = 'held'      THEN 1 ELSE 0 END) AS held
FROM books b JOIN book_copies c ON c.book_id = b.book_id
${itemWhere(f, 'b.title', true)}
GROUP BY b.title`;
      const media = `SELECT mi.title, mi.media_type, COUNT(*),
       SUM(CASE WHEN mc.status = 'available' THEN 1 ELSE 0 END),
       SUM(CASE WHEN mc.status = 'loaned'    THEN 1 ELSE 0 END),
       SUM(CASE WHEN mc.status = 'held'      THEN 1 ELSE 0 END)
FROM media_items mi JOIN media_copies mc ON mc.media_id = mi.media_id
${itemWhere(f, 'mi.title', false)}
GROUP BY mi.title, mi.media_type`;
      if (f.kind === 'book' || f.authorId) return `${books};`;
      if (f.kind === 'media') return `${media};`;
      return `${books}\nUNION ALL\n${media};`;
    },
  },
];

type Params = Record<string, string>;

const toSearch = (values: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) search.set(key, value); });
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const runQuery = (id: string, p: Params) => request<TableResult>(`/queries/${id}${toSearch(p)}`);

export async function runReport(id: string, f: ReportFilters = {}): Promise<ReportResult> {
  const def = REPORTS.find((r) => r.id === id);
  if (!def) throw new Error('Unknown report.');
  if (f.from && f.to && f.from > f.to) throw new Error('The start date must be before the end date.');
  // skip unsupported filters
  const used: ReportFilters = {};
  def.filters.forEach((k) => { if (f[k]) used[k] = f[k]; });
  return request<ReportResult>(`/reports/${id}${toSearch({ ...used })}`);
}

