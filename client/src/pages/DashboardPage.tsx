import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { LIMITS, STUDENT_LIMIT_MESSAGE } from '../api/rules';
import { Alert, Badge, Card, DataTable, PageHeader, useAction, useLoad } from '../components/ui';
import { fmtDate, fmtDateTime, money } from '../utils/dates';
import type { LoanView } from '../types';

const statusBadge = (l: LoanView) =>
  l.status === 'overdue' ? <Badge tone="red">Overdue</Badge>
  : l.status === 'due-soon' ? <Badge tone="amber">Due soon</Badge>
  : l.status === 'returned' ? <Badge>Returned</Badge>
  : <Badge tone="green">On loan</Badge>;

export default function DashboardPage() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffDashboard /> : <PatronDashboard />;
}

function PatronDashboard() {
  const { session } = useAuth();
  const uid = session!.id;
  const role = session!.role === 'faculty' ? 'faculty' : 'student';
  const limit = LIMITS[role];
  const loans = useLoad(() => api.listLoans({ userId: uid, activeOnly: true }), [uid]);
  const holds = useLoad(() => api.listHolds({ userId: uid, activeOnly: true }), [uid]);
  const fines = useLoad(() => api.listFines(uid), [uid]);
  const rooms = useLoad(() => api.listReservations(uid), [uid]);
  const notes = useLoad(() => api.listNotifications(uid), [uid]);
  const { run, banner } = useAction();
  const [showNotes, setShowNotes] = useState(() => {
    try { return localStorage.getItem('showNotes') !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('showNotes', String(showNotes)); } catch { /* ignore */ }
  }, [showNotes]);
  const navigate = useNavigate();
  // single click toggles alerts, double click opens notifications
  const clickTimer = useRef<number>();
  const onBellClick = () => {
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => setShowNotes((o) => !o), 250);
  };
  const onBellDoubleClick = () => {
    window.clearTimeout(clickTimer.current);
    navigate('/notifications');
  };
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);
  const reloadAll = () => { loans.reload(); holds.reload(); fines.reload(); rooms.reload(); };
  const unread = (notes.data ?? []).filter((n) => !n.is_read);
  const unpaid = (fines.data ?? []).filter((f) => f.paid_status === 'unpaid');

  const active = loans.data ?? [];
  const atLimit = active.length >= limit.maxItems;
  const overdue = active.filter((l) => l.status === 'overdue');
  const dueSoon = active.filter((l) => l.days_until_due !== null && l.days_until_due >= 0 && l.days_until_due <= 2);
  const alertCount = overdue.length + dueSoon.length + (unread.length > 0 ? 1 : 0) + (unpaid.length > 0 ? 1 : 0) + (atLimit ? 1 : 0);

  return (
    <>
      <PageHeader title={`Welcome, ${session!.name.split(' ')[0]}`}
        titleAside={
          <button className={showNotes ? 'bell-toggle' : 'bell-toggle off'} onClick={onBellClick} onDoubleClick={onBellDoubleClick}
            aria-label={showNotes ? 'Hide notifications' : 'Show notifications'} aria-pressed={showNotes}
            title={`${showNotes ? 'Hide' : 'Show'} notifications · double-click to open them all`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0-6 6v3.5L4.5 15a1 1 0 0 0 .9 1.5h13.2a1 1 0 0 0 .9-1.5L18 12.5V9a6 6 0 0 0-6-6z" />
              <circle cx="12" cy="19.5" r="2" />
              {!showNotes && <line x1="4" y1="3" x2="20" y2="21" />}
            </svg>
            {alertCount > 0 && <span className="bell-count">{alertCount}</span>}
          </button>
        }
        subtitle={`${role === 'student' ? 'Student' : 'Faculty'} account · up to ${limit.maxItems} items for ${limit.days} days each`} />
      {banner}
      {showNotes && (
        <div className="alert-stack">
          {overdue.map((l) => (
            <Alert key={l.loan_id} kind="error"><strong>{l.title}</strong> is overdue (due {fmtDate(l.due_date)}). Fines are $5 plus $1 for each full week late.</Alert>
          ))}
          {dueSoon.map((l) => (
            <Alert key={l.loan_id} kind="warning">
              {l.title} must be returned {l.days_until_due === 0 ? 'today' : `in ${l.days_until_due} day${l.days_until_due === 1 ? '' : 's'}`}.
            </Alert>
          ))}
          {unread.length > 0 && (
            <Alert kind="info">
              You have {unread.length} new notification{unread.length === 1 ? '' : 's'}: {unread[0].message}{' '}
              <Link to="/notifications">See all</Link>
            </Alert>
          )}
          {unpaid.length > 0 && (
            <Alert kind="warning">
              You owe {money(unpaid.reduce((a, f) => a + f.amount, 0))} in fines. Fines are paid in person at the front desk (cash, card or check), and you will get a receipt.
            </Alert>
          )}
          {atLimit && <Alert kind="info">{role === 'student' ? STUDENT_LIMIT_MESSAGE : `You have reached the faculty limit of ${limit.maxItems} items.`}</Alert>}
        </div>
      )}

      <Card title={`Items on loan (${active.length}/${limit.maxItems})`}>
        <DataTable rows={active} empty="You have nothing checked out. Items are borrowed in person at the desk."
          columns={[
            { header: 'Title', cell: (l) => l.title },
            { header: 'Borrowed', cell: (l) => fmtDate(l.borrow_date) },
            { header: 'Due', cell: (l) => fmtDate(l.due_date) },
            { header: 'Status', cell: statusBadge },
          ]} />
      </Card>

      <Card title="My holds">
        <p className="muted">A hold is kept for 3 days once the item is ready, then it is released to the next person.</p>
        <DataTable rows={holds.data ?? []} empty="No active holds."
          columns={[
            { header: 'Title', cell: (h) => h.title },
            { header: 'Requested', cell: (h) => fmtDate(h.request_date) },
            { header: 'Status', cell: (h) => h.status === 'ready' ? <Badge tone="green">Ready — pick up by {fmtDate(h.expiration_date)}</Badge> : <Badge tone="amber">In queue · #{h.queue_position}</Badge> },
            { header: '', cell: (h) => <button className="btn small" onClick={() => run(() => api.doCancelHold(h.hold_id), 'Hold cancelled.', reloadAll)}>Cancel</button> },
          ]} />
      </Card>

      <Card title="My fines">
        <DataTable rows={fines.data ?? []} empty="No fines."
          columns={[
            { header: 'Item', cell: (f) => f.title },
            { header: 'Returned', cell: (f) => fmtDate(f.return_date) },
            { header: 'Amount', cell: (f) => money(f.amount) },
            { header: 'Status', cell: (f) => f.paid_status === 'paid' ? <Badge tone="green">Paid · {f.receipt_code}</Badge> : <Badge tone="red">Unpaid · pay at the desk</Badge> },
            { header: '', cell: (f) => f.paid_status === 'paid' && <Link className="btn small" to="/receipts">View receipt</Link> },
          ]} />
      </Card>

      <Card title="My room reservations">
        <DataTable rows={(rooms.data ?? []).filter((r) => !r.archived)} empty="No upcoming reservations. Book one on the Study Rooms page."
          columns={[
            { header: 'Room', cell: (r) => r.room_number },
            { header: 'From', cell: (r) => fmtDateTime(r.start_time) },
            { header: 'To', cell: (r) => fmtDateTime(r.end_time) },
          ]} />
      </Card>
    </>
  );
}

function StaffDashboard() {
  const stats = useLoad(api.dashboardStats);
  const loans = useLoad(() => api.listLoans({ activeOnly: true }));
  const st = stats.data;
  const tiles: [string, string][] = st ? [
    ['Books (titles)', String(st.books)],
    ['Media items', String(st.media)],
    ['Active members', String(st.members)],
    ['Items on loan', String(st.activeLoans)],
    ['Overdue', String(st.overdue)],
    ['Holds ready', String(st.readyHolds)],
    ['Unpaid fines', money(st.unpaidTotal)],
  ] : [];
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Library activity at a glance" />
      <div className="tiles">
        {tiles.map(([label, value]) => (
          <div key={label} className="tile"><div className="tile-value">{value}</div><div className="muted">{label}</div></div>
        ))}
      </div>
      <Card title="Items currently on loan">
        <DataTable rows={loans.data ?? []} empty="Nothing is on loan."
          columns={[
            { header: 'Member', cell: (l) => l.member_name },
            { header: 'Title', cell: (l) => l.title },
            { header: 'Due', cell: (l) => fmtDate(l.due_date) },
            { header: 'Status', cell: statusBadge },
          ]} />
      </Card>
    </>
  );
}
