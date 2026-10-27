import { Modal } from './ui';
import { fmtDate, money } from '../utils/dates';
import type { ReceiptView } from '../types';

export default function ReceiptModal({ receipt, onClose }: { receipt: ReceiptView; onClose: () => void }) {
  const r = receipt;
  const rows: [string, string][] = [
    ['Receipt #', String(r.receipt_id)],
    ['Transaction code', r.transaction_code],
    ['Date issued', fmtDate(r.issued_date)],
    ['Member', `${r.member_name} (${r.member_email})`],
    ['Item', r.title],
    ['ISBN', r.isbn ?? '—'],
    ['Borrowed / due / returned', `${fmtDate(r.borrow_date)} / ${fmtDate(r.due_date)} / ${fmtDate(r.return_date)}`],
    ['Fine #', String(r.fine_id)],
    ['Paid in person by', r.payment_method],
    ['Received by', r.received_by],
  ];
  return (
    <Modal title="Payment receipt" onClose={onClose}>
      <div className="receipt">
        <div className="receipt-head">
          <strong>Uma’s Library</strong>
          <span className="muted">Library fine payment — paid in person</span>
        </div>
        <dl>
          {rows.map(([k, v]) => (
            <div key={k} className="receipt-row"><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className="receipt-total"><span>Amount paid</span><strong>{money(r.amount_paid)}</strong></div>
      </div>
      <div className="row gap end">
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={() => window.print()}>Print receipt</button>
      </div>
    </Modal>
  );
}
