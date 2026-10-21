import { loadState } from './store';
import type { DBState } from './state';
import { fineAmount, holdItem, itemTitle, loanItem } from './rules';
import { daysBetween, fmtDate, money, monthKey, today } from '../utils/dates';
import type { ReportResult, TableResult } from '../types';

export interface ParamDef { name: string; label: string; kind: 'member' | 'item' | 'text' }
export interface QueryDef {
  id: string; title: string; description: string; sql: string; params: ParamDef[];
}
export interface ReportDef { id: string; title: string; description: string; sql: string }

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

export const REPORTS: ReportDef[] = [
  {
    id: 'popular',
    title: 'Most borrowed titles',
    description: 'Top 10 books and media by number of loans.',
    sql: `SELECT TOP 10 COALESCE(b.title, mi.title) AS title,
       CASE WHEN l.book_copy_id IS NOT NULL THEN 'Book' ELSE 'Media' END AS item_type,
       COUNT(*) AS times_borrowed
${LOAN_ITEM_JOIN}
GROUP BY COALESCE(b.title, mi.title), CASE WHEN l.book_copy_id IS NOT NULL THEN 'Book' ELSE 'Media' END
ORDER BY times_borrowed DESC;`,
  },
  {
    id: 'fines',
    title: 'Fines by month',
    description: 'Fines assessed, collected and still outstanding, grouped by the month the item came back.',
    sql: `SELECT FORMAT(l.return_date, 'yyyy-MM') AS month,
       COUNT(f.fine_id) AS fines_issued,
       SUM(f.amount) AS assessed,
       SUM(CASE WHEN f.paid_status = 'paid'   THEN f.amount ELSE 0 END) AS collected,
       SUM(CASE WHEN f.paid_status = 'unpaid' THEN f.amount ELSE 0 END) AS outstanding
FROM fines f
JOIN loans l ON l.loan_id = f.loan_id
GROUP BY FORMAT(l.return_date, 'yyyy-MM')
ORDER BY month;`,
  },
  {
    id: 'activity',
    title: 'Borrowing activity by member role',
    description: 'Compares students and faculty: loan volume, current loans, overdue items and average loans per member.',
    sql: `SELECT u.role,
       COUNT(DISTINCT u.user_id) AS members,
       COUNT(l.loan_id) AS total_loans,
       SUM(CASE WHEN l.return_date IS NULL THEN 1 ELSE 0 END) AS active_loans,
       SUM(CASE WHEN l.return_date IS NULL AND l.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS overdue_now,
       CAST(COUNT(l.loan_id) AS FLOAT) / COUNT(DISTINCT u.user_id) AS avg_loans_per_member
FROM members u
LEFT JOIN loans l ON l.user_id = u.user_id
WHERE u.is_active = 1
GROUP BY u.role;`,
  },
  {
    id: 'inventory',
    title: 'Inventory status',
    description: 'Copies per title broken down by status (available, on loan, held for pickup).',
    sql: `SELECT b.title, 'Book' AS item_type, COUNT(*) AS total,
       SUM(CASE WHEN c.status = 'available' THEN 1 ELSE 0 END) AS available,
       SUM(CASE WHEN c.status = 'loaned'    THEN 1 ELSE 0 END) AS on_loan,
       SUM(CASE WHEN c.status = 'held'      THEN 1 ELSE 0 END) AS held
FROM books b JOIN book_copies c ON c.book_id = b.book_id
WHERE b.is_active = 1
GROUP BY b.title
UNION ALL
SELECT mi.title, 'Media', COUNT(*), 0, 0, 0
FROM media_items mi JOIN media_copies mc ON mc.media_id = mi.media_id
WHERE mi.is_active = 1 GROUP BY mi.title;`,
  },
];

type Params = Record<string, string>;

export async function runQuery(id: string, p: Params): Promise<TableResult> {
  const s = loadState();
  switch (id) {
    case 'member-items': return qMemberItems(s, Number(p.userId));
    case 'overdue': return qOverdue(s);
    case 'availability': return qAvailability(s, (p.search ?? '').trim().toLowerCase());
    case 'hold-queue': return qHoldQueue(s, p.item);
    default: throw new Error('Unknown query.');
  }
}

export async function runReport(id: string): Promise<ReportResult> {
  const s = loadState();
  switch (id) {
    case 'popular': return rPopular(s);
    case 'fines': return rFines(s);
    case 'activity': return rActivity(s);
    case 'inventory': return rInventory(s);
    default: throw new Error('Unknown report.');
  }
}

const name = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

function qMemberItems(s: DBState, userId: number): TableResult {
  if (!userId) throw new Error('Choose a member.');
  const t = today();
  return {
    columns: ['Loan #', 'Title', 'Type', 'Borrowed', 'Due', 'Status'],
    rows: s.loans
      .filter((l) => l.user_id === userId && l.return_date === null)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map((l) => {
        const i = loanItem(s, l);
        return [l.loan_id, i.title, i.kind === 'book' ? 'Book' : 'Media', fmtDate(l.borrow_date), fmtDate(l.due_date), l.due_date < t ? 'Overdue' : 'On time'];
      }),
  };
}

function qOverdue(s: DBState): TableResult {
  const t = today();
  return {
    columns: ['Loan #', 'Member', 'Role', 'Title', 'Due', 'Days overdue', 'Projected fine'],
    rows: s.loans
      .filter((l) => l.return_date === null && l.due_date < t)
      .map((l) => ({ l, d: daysBetween(l.due_date, t) }))
      .sort((a, b) => b.d - a.d)
      .map(({ l, d }) => {
        const m = s.members.find((x) => x.user_id === l.user_id)!;
        return [l.loan_id, name(m), m.role, loanItem(s, l).title, fmtDate(l.due_date), d, money(fineAmount(d))];
      }),
  };
}

function qAvailability(s: DBState, q: string): TableResult {
  const rows: (string | number)[][] = [];
  s.books.filter((b) => b.is_active).forEach((b) => {
    const authors = s.bookAuthors
      .filter((ba) => ba.book_id === b.book_id)
      .sort((x, y) => x.author_order - y.author_order)
      .map((ba) => s.authors.find((a) => a.author_id === ba.author_id))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map(name);
    if (q && !b.title.toLowerCase().includes(q) && !authors.some((n) => n.toLowerCase().includes(q))) return;
    const cs = s.bookCopies.filter((c) => c.book_id === b.book_id);
    rows.push([b.title, 'Book', authors.length ? authors.join(' and ') : '—', cs.length, cs.filter((c) => c.status === 'available').length]);
  });
  s.media.filter((m) => m.is_active).forEach((m) => {
    if (q && !m.title.toLowerCase().includes(q) && !m.media_type.toLowerCase().includes(q)) return;
    const cs = s.mediaCopies.filter((c) => c.media_id === m.media_id);
    rows.push([m.title, m.media_type, '—', cs.length, cs.filter((c) => c.status === 'available').length]);
  });
  return { columns: ['Title', 'Type', 'Author', 'Total copies', 'Available'], rows };
}

function qHoldQueue(s: DBState, item: string): TableResult {
  if (!item) throw new Error('Choose an item.');
  const [kind, idStr] = item.split(':');
  const id = Number(idStr);
  const matches = s.holds.filter((h) => {
    const i = holdItem(h);
    return i.kind === kind && i.itemId === id && (h.status === 'waiting' || h.status === 'ready');
  });
  const ordered = [...matches].sort((a, b) =>
    (a.status === 'ready' ? 0 : 1) - (b.status === 'ready' ? 0 : 1) ||
    a.request_date.localeCompare(b.request_date) || a.hold_id - b.hold_id);
  let pos = 0;
  return {
    columns: ['Position', 'Member', 'Requested', 'Status', 'Pick up by'],
    rows: ordered.map((h) => {
      const m = s.members.find((x) => x.user_id === h.user_id)!;
      return [h.status === 'ready' ? 'Ready' : ++pos, name(m), fmtDate(h.request_date), h.status, fmtDate(h.expiration_date)];
    }),
  };
}

function rPopular(s: DBState): ReportResult {
  const counts = new Map<string, { type: string; n: number }>();
  s.loans.forEach((l) => {
    const i = loanItem(s, l);
    const key = `${i.kind}:${i.itemId}`;
    const cur = counts.get(key) ?? { type: i.kind === 'book' ? 'Book' : 'Media', n: 0 };
    cur.n++;
    counts.set(key, cur);
  });
  const top = [...counts.entries()]
    .map(([key, v]) => {
      const [kind, id] = key.split(':');
      return { title: itemTitle(s, kind as 'book' | 'media', Number(id)), ...v };
    })
    .sort((a, b) => b.n - a.n || a.title.localeCompare(b.title))
    .slice(0, 10);
  return {
    columns: ['Title', 'Type', 'Times borrowed'],
    rows: top.map((x) => [x.title, x.type, x.n]),
    stats: [
      { label: 'Total loans', value: String(s.loans.length) },
      { label: 'Distinct titles borrowed', value: String(counts.size) },
    ],
    chart: { title: 'Times borrowed', labels: top.map((x) => x.title), values: top.map((x) => x.n) },
  };
}

function rFines(s: DBState): ReportResult {
  const byMonth = new Map<string, { n: number; assessed: number; paid: number }>();
  s.fines.forEach((f) => {
    const loan = s.loans.find((l) => l.loan_id === f.loan_id)!;
    const k = monthKey(loan.return_date ?? today());
    const cur = byMonth.get(k) ?? { n: 0, assessed: 0, paid: 0 };
    cur.n++;
    cur.assessed += f.amount;
    if (f.paid_status === 'paid') cur.paid += f.amount;
    byMonth.set(k, cur);
  });
  const months = [...byMonth.keys()].sort();
  const total = s.fines.reduce((a, f) => a + f.amount, 0);
  const paid = s.fines.filter((f) => f.paid_status === 'paid').reduce((a, f) => a + f.amount, 0);
  return {
    columns: ['Month', 'Fines issued', 'Assessed', 'Collected', 'Outstanding'],
    rows: months.map((m) => {
      const v = byMonth.get(m)!;
      return [m, v.n, money(v.assessed), money(v.paid), money(v.assessed - v.paid)];
    }),
    stats: [
      { label: 'Total assessed', value: money(total) },
      { label: 'Collected', value: money(paid) },
      { label: 'Outstanding', value: money(total - paid) },
    ],
    chart: { title: 'Fines assessed per month', labels: months, values: months.map((m) => byMonth.get(m)!.assessed), format: 'money' },
  };
}

function rActivity(s: DBState): ReportResult {
  const t = today();
  const roles = ['student', 'faculty'] as const;
  const data = roles.map((role) => {
    const members = s.members.filter((m) => m.role === role && m.is_active);
    const ids = new Set(members.map((m) => m.user_id));
    const loans = s.loans.filter((l) => ids.has(l.user_id));
    return {
      role,
      members: members.length,
      total: loans.length,
      active: loans.filter((l) => l.return_date === null).length,
      overdue: loans.filter((l) => l.return_date === null && l.due_date < t).length,
      avg: members.length ? loans.length / members.length : 0,
    };
  });
  return {
    columns: ['Role', 'Members', 'Total loans', 'Active loans', 'Overdue now', 'Avg loans / member'],
    rows: data.map((d) => [d.role, d.members, d.total, d.active, d.overdue, d.avg.toFixed(1)]),
    stats: [
      { label: 'Active members', value: String(data.reduce((a, d) => a + d.members, 0)) },
      { label: 'Items overdue now', value: String(data.reduce((a, d) => a + d.overdue, 0)) },
    ],
    chart: { title: 'Total loans by role', labels: data.map((d) => d.role), values: data.map((d) => d.total) },
  };
}

function rInventory(s: DBState): ReportResult {
  const rows: (string | number)[][] = [];
  let total = 0;
  let avail = 0;
  const add = (title: string, type: string, statuses: string[]) => {
    const c = (st: string) => statuses.filter((x) => x === st).length;
    rows.push([title, type, statuses.length, c('available'), c('loaned'), c('held')]);
    total += statuses.length;
    avail += c('available');
  };
  s.books.filter((b) => b.is_active).forEach((b) =>
    add(b.title, 'Book', s.bookCopies.filter((c) => c.book_id === b.book_id).map((c) => c.status)));
  s.media.filter((m) => m.is_active).forEach((m) =>
    add(m.title, m.media_type, s.mediaCopies.filter((c) => c.media_id === m.media_id).map((c) => c.status)));
  return {
    columns: ['Title', 'Type', 'Total copies', 'Available', 'On loan', 'Held for pickup'],
    rows,
    stats: [
      { label: 'Total copies', value: String(total) },
      { label: 'On the shelf', value: total ? `${Math.round((avail / total) * 100)}%` : '0%' },
    ],
    chart: { title: 'Copies available per title', labels: rows.map((r) => String(r[0])), values: rows.map((r) => Number(r[3])) },
  };
}
