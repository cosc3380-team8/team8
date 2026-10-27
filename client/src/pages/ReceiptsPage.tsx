import { useState } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import ReceiptModal from '../components/ReceiptModal';
import { Card, DataTable, PageHeader, useLoad } from '../components/ui';
import { fmtDate, money } from '../utils/dates';
import type { ReceiptView } from '../types';

export default function ReceiptsPage() {
  const { session, isStaff } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<ReceiptView | null>(null);
  const receipts = useLoad(
    () => api.listReceipts({ userId: isStaff ? undefined : session!.id, search: q }),
    [isStaff, session?.id, q],
  );
  const rows = receipts.data ?? [];
  const total = rows.reduce((a, r) => a + r.amount_paid, 0);

  return (
    <>
      <PageHeader
        title={isStaff ? 'Receipts & Transactions' : 'My Receipts & Transactions'}
        subtitle="Every fine payment made in person at the desk gets a receipt. Look one up by ISBN, receipt code or title." />
      <Card>
        <div className="row between wrap">
          <input className="search" placeholder={isStaff ? 'Search ISBN, receipt code, title or member…' : 'Search ISBN, receipt code or title…'}
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search receipts" />
          <span className="muted">{rows.length} transaction{rows.length === 1 ? '' : 's'} · {money(total)} total</span>
        </div>
        <DataTable rows={rows} empty={q ? 'No receipts match that search.' : 'No receipts yet. Fines are paid in person at the front desk.'}
          columns={[
            { header: 'Receipt code', cell: (r) => <code>{r.transaction_code}</code> },
            { header: 'Date', cell: (r) => fmtDate(r.issued_date) },
            ...(isStaff ? [{ header: 'Member', cell: (r: ReceiptView) => r.member_name }] : []),
            { header: 'Item', cell: (r) => r.title },
            { header: 'ISBN', cell: (r) => r.isbn ?? '—' },
            { header: 'Method', cell: (r) => r.payment_method },
            { header: 'Amount', cell: (r) => money(r.amount_paid) },
            { header: '', cell: (r) => <button className="btn small" onClick={() => setOpen(r)}>View receipt</button> },
          ]} />
      </Card>
      {open && <ReceiptModal receipt={open} onClose={() => setOpen(null)} />}
    </>
  );
}
