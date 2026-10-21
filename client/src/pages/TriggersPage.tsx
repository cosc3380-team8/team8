import { useState } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Alert, Card, DataTable, PageHeader, useLoad } from '../components/ui';

const TRIGGERS = [
  { kind: 'Trigger', name: 'trg_loans_enforce_limit', on: 'loans · AFTER INSERT (rolls back)', does: 'Rejects a checkout when the member is over their limit (students 3, faculty 6).' },
  { kind: 'Trigger', name: 'trg_loans_after_insert', on: 'loans · AFTER INSERT', does: 'Marks the borrowed copy as loaned and fulfils the member’s ready hold.' },
  { kind: 'Trigger', name: 'trg_loans_after_return', on: 'loans · AFTER UPDATE (return_date)', does: 'Marks the copy available, creates a fine ($5 + $1 per full week late) if overdue, then calls sp_promote_next_hold.' },
  { kind: 'Trigger', name: 'trg_payments_after_insert', on: 'payments · AFTER INSERT', does: 'Marks the fine paid and creates the receipt with a transaction code.' },
  { kind: 'Trigger', name: 'trg_reservations_no_overlap', on: 'room_reservations · AFTER INSERT/UPDATE (rolls back)', does: 'Rejects a reservation that overlaps another one for the same room.' },
  { kind: 'Procedure', name: 'sp_promote_next_hold', on: 'called by trigger / procedures', does: 'When a copy frees up, the earliest waiting hold becomes ready for 3 days.' },
  { kind: 'Scheduled job', name: 'sp_expire_holds', on: 'holds · nightly', does: 'Expires ready holds not picked up within 3 days and serves the next person.' },
];

export default function TriggersPage() {
  const { isAdmin } = useAuth();
  const audit = useLoad(api.listAudit);
  const [done, setDone] = useState('');

  return (
    <>
      <PageHeader title="Triggers & Audit Log" subtitle="Every rule below runs automatically in the database. Perform actions in Circulation and watch entries appear here."
        actions={<button className="btn" onClick={audit.reload}>Refresh</button>} />
      <Card title="Triggers">
        <DataTable rows={TRIGGERS} columns={[
          { header: 'Type', cell: (t) => t.kind },
          { header: 'Name', cell: (t) => <code>{t.name}</code> },
          { header: 'Fires on', cell: (t) => t.on },
          { header: 'What it does', cell: (t) => t.does },
        ]} />
        <p className="muted">The T-SQL for these is in <code>sql/triggers.sql</code>. In this prototype the same logic runs in <code>src/api/rules.ts</code>, so the audit log below shows what the database would do.</p>
      </Card>
      <Card title="Audit log (latest first)">
        <DataTable rows={audit.data ?? []} empty="No trigger activity yet." columns={[
          { header: 'Time', cell: (a) => new Date(a.logged_at).toLocaleString() },
          { header: 'Trigger', cell: (a) => <code>{a.trigger_name}</code> },
          { header: 'Table', cell: (a) => a.table_name },
          { header: 'Details', cell: (a) => a.message },
        ]} />
      </Card>
      {isAdmin && (
        <Card title="Demo controls (admin)">
          {done && <Alert kind="success">{done}</Alert>}
          <button className="btn danger" onClick={async () => {
            if (!window.confirm('Reset ALL data back to the demo data?')) return;
            await api.resetDemoData();
            audit.reload();
            setDone('Demo data restored.');
          }}>Reset demo data</button>
        </Card>
      )}
    </>
  );
}
