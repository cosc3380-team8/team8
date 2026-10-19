import { FormEvent, useState } from 'react';
import * as api from '../api/api';
import { Badge, Card, DataTable, PageHeader, Tabs, useAction, useLoad } from '../components/ui';
import { fmtDate, money } from '../utils/dates';
import type { ItemKind } from '../types';

type Tab = 'checkout' | 'loans' | 'holds' | 'fines';

export default function CirculationPage() {
  const [tab, setTab] = useState<Tab>('checkout');
  const members = useLoad(api.listMembers);
  const books = useLoad(api.listBooks);
  const media = useLoad(api.listMedia);
  const loans = useLoad(() => api.listLoans({ activeOnly: true }));
  const holds = useLoad(() => api.listHolds({ activeOnly: true }));
  const fines = useLoad(() => api.listFines());
  const { run, banner } = useAction();
  const [memberId, setMemberId] = useState('');
  const [item, setItem] = useState('');
  const [method, setMethod] = useState('Cash');

  const reloadAll = () => { members.reload(); books.reload(); media.reload(); loans.reload(); holds.reload(); fines.reload(); };

  const submitCheckout = (e: FormEvent) => {
    e.preventDefault();
    const [kind, id] = item.split(':');
    run(() => api.doCheckout(Number(memberId), kind as ItemKind, Number(id)), 'Checked out. Due date was set from the member’s role.', reloadAll);
  };

  const activeMembers = (members.data ?? []).filter((m) => m.is_active);

  return (
    <>
      <PageHeader title="Circulation" subtitle="Check items out and in, manage holds, and record fine payments." />
      {banner}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'checkout', label: 'Check out' }, { id: 'loans', label: `Return (${loans.data?.length ?? 0})` },
        { id: 'holds', label: `Holds (${holds.data?.length ?? 0})` }, { id: 'fines', label: 'Fines & payments' },
      ]} />

      {tab === 'checkout' && (
        <Card title="Check out an item">
          <p className="muted">Students: 3 items for 20 days. Faculty: 6 items for 30 days. A member with a ready hold can take the held copy.</p>
          <form className="form inline" onSubmit={submitCheckout}>
            <label><span>Member</span>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="" disabled>Select…</option>
                {activeMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name} ({m.role})</option>)}
              </select>
            </label>
            <label><span>Item</span>
              <select value={item} onChange={(e) => setItem(e.target.value)} required>
                <option value="" disabled>Select…</option>
                <optgroup label="Books">
                  {(books.data ?? []).filter((b) => b.is_active).map((b) => (
                    <option key={b.book_id} value={`book:${b.book_id}`}>{b.title} — {b.available_copies}/{b.total_copies} available</option>
                  ))}
                </optgroup>
                <optgroup label="Media & devices">
                  {(media.data ?? []).filter((m) => m.is_active).map((m) => (
                    <option key={m.media_id} value={`media:${m.media_id}`}>{m.title} — {m.available_copies}/{m.total_copies} available</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button className="btn primary">Check out</button>
          </form>
        </Card>
      )}

      {tab === 'loans' && (
        <Card title="Items on loan">
          <DataTable rows={loans.data ?? []} empty="Nothing is on loan."
            columns={[
              { header: 'Loan #', cell: (l) => l.loan_id },
              { header: 'Member', cell: (l) => l.member_name },
              { header: 'Title', cell: (l) => l.title },
              { header: 'Due', cell: (l) => fmtDate(l.due_date) },
              { header: 'Status', cell: (l) => l.status === 'overdue' ? <Badge tone="red">Overdue</Badge> : l.status === 'due-soon' ? <Badge tone="amber">Due soon</Badge> : <Badge tone="green">On loan</Badge> },
              { header: '', cell: (l) => <button className="btn small primary" onClick={() => run(async () => {
                  const r = await api.doReturn(l.loan_id);
                  if (r.fine) throw new Error(`Returned late. A fine of ${money(r.fine.amount)} was created automatically.`);
                }, `“${l.title}” returned.`, reloadAll)}>Return</button> },
            ]} />
        </Card>
      )}

      {tab === 'holds' && (
        <Card title="Active holds" actions={
          <button className="btn small" onClick={() => run(async () => { const n = await api.runMaintenance(); if (n === 0) throw new Error('No holds needed to expire.'); }, 'Expired holds released.', reloadAll)}>
            Run hold-expiry job
          </button>}>
          <DataTable rows={holds.data ?? []} empty="No active holds."
            columns={[
              { header: 'Title', cell: (h) => h.title },
              { header: 'Member', cell: (h) => h.member_name },
              { header: 'Requested', cell: (h) => fmtDate(h.request_date) },
              { header: 'Status', cell: (h) => h.status === 'ready' ? <Badge tone="green">Ready · expires {fmtDate(h.expiration_date)}</Badge> : <Badge tone="amber">Queue #{h.queue_position}</Badge> },
              { header: '', cell: (h) => <button className="btn small danger" onClick={() => run(() => api.doCancelHold(h.hold_id), 'Hold cancelled.', reloadAll)}>Cancel</button> },
            ]} />
        </Card>
      )}

      {tab === 'fines' && (
        <Card title="Fines" actions={
          <label className="row gap"><span className="muted">Payment method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Cash</option><option>Card</option><option>Check</option>
            </select>
          </label>}>
          <DataTable rows={fines.data ?? []} empty="No fines have been issued."
            columns={[
              { header: 'Fine #', cell: (f) => f.fine_id },
              { header: 'Member', cell: (f) => f.member_name },
              { header: 'Item', cell: (f) => f.title },
              { header: 'Due / returned', cell: (f) => `${fmtDate(f.due_date)} / ${fmtDate(f.return_date)}` },
              { header: 'Amount', cell: (f) => money(f.amount) },
              { header: 'Status', cell: (f) => f.paid_status === 'paid' ? <Badge tone="green">Paid {fmtDate(f.paid_date)} · {f.receipt_code}</Badge> : <Badge tone="red">Unpaid</Badge> },
              { header: '', cell: (f) => f.paid_status === 'unpaid' && <button className="btn small primary" onClick={() => run(() => api.doPayFine(f.fine_id, method), 'Payment recorded and receipt issued.', reloadAll)}>Record payment</button> },
            ]} />
        </Card>
      )}
    </>
  );
}
