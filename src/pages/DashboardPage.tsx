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
  const { run, banner } = useAction();
  const reloadAll = () => { loans.reload(); holds.reload(); fines.reload(); rooms.reload(); };

  const active = loans.data ?? [];
  const atLimit = active.length >= limit.maxItems;

  return (
    <>
      <PageHeader title={`Welcome, ${session!.name.split(' ')[0]}`} subtitle={`${role === 'student' ? 'Student' : 'Faculty'} account · up to ${limit.maxItems} items for ${limit.days} days each`} />
      {banner}
      {active.filter((l) => l.status === 'overdue').map((l) => (
        <Alert key={l.loan_id} kind="error"><strong>{l.title}</strong> is overdue (due {fmtDate(l.due_date)}). Fines are $5 plus $1 for each full week late.</Alert>
      ))}
      {active.filter((l) => l.days_until_due !== null && l.days_until_due >= 0 && l.days_until_due <= 2).map((l) => (
        <Alert key={l.loan_id} kind="warning">
          {l.title} must be returned {l.days_until_due === 0 ? 'today' : `in ${l.days_until_due} day${l.days_until_due === 1 ? '' : 's'}`}.
        </Alert>
      ))}
      {atLimit && <Alert kind="info">{role === 'student' ? STUDENT_LIMIT_MESSAGE : `You have reached the faculty limit of ${limit.maxItems} items.`}</Alert>}

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
        <DataTable rows={fines.data ?? []} empty="No fines. 🎉"
          columns={[
            { header: 'Item', cell: (f) => f.title },
            { header: 'Returned', cell: (f) => fmtDate(f.return_date) },
            { header: 'Amount', cell: (f) => money(f.amount) },
            { header: 'Status', cell: (f) => f.paid_status === 'paid' ? <Badge tone="green">Paid · {f.receipt_code}</Badge> : <Badge tone="red">Unpaid</Badge> },
            { header: '', cell: (f) => f.paid_status === 'unpaid' && <button className="btn small primary" onClick={() => run(() => api.doPayFine(f.fine_id, 'Online card'), 'Payment received. Receipt issued.', reloadAll)}>Pay online</button> },
          ]} />
      </Card>

      <Card title="My room reservations">
        <DataTable rows={rooms.data ?? []} empty="No reservations. Book one on the Study Rooms page."
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
