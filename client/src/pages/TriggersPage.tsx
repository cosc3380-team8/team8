import { useState } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Alert, Card, DataTable, PageHeader, useLoad } from '../components/ui';

const TRIGGERS = [
  { kind: 'Trigger', name: 'trg_loans_after_insert', on: 'loans · AFTER INSERT', does: 'Marks the borrowed copy as loaned and fulfils the member’s ready hold.', notice: 'Member is told what they borrowed and the due date.' },
  { kind: 'Trigger', name: 'trg_loans_after_return', on: 'loans · AFTER UPDATE (return_date)', does: 'Marks the copy available, creates a fine ($5 + $1 per full week late) if overdue, then calls sp_promote_next_hold.', notice: 'Member is told the item was returned, and about any fine.' },
  { kind: 'Procedure', name: 'sp_promote_next_hold', on: 'called by trigger / procedures', does: 'When a copy frees up, the earliest waiting hold becomes ready for 3 days.', notice: 'Member is told their hold is ready and the pick-up deadline.' },
];

export default function TriggersPage() {
  const { isAdmin } = useAuth();
  const audit = useLoad(api.listAudit);
  const [done, setDone] = useState('');

  return (
    <div className="triggers-page">
      <PageHeader title="Triggers & Audit Log" subtitle="These run automatically in the database, and each one sends the member a notification. Perform actions in Circulation and watch entries appear here."
        actions={<button className="btn" onClick={audit.reload}>Refresh</button>} />
      <Card title="Triggers">
        <DataTable rows={TRIGGERS} columns={[
          { header: 'Type', cell: (t) => t.kind },
          { header: 'Name', cell: (t) => <code>{t.name}</code> },
          { header: 'Fires on', cell: (t) => t.on },
          { header: 'What it does', cell: (t) => t.does },
          { header: 'Notification sent', cell: (t) => t.notice },
        ]} />
        <p className="muted">The T-SQL for these is in <code>sql/triggers.sql</code>. In this prototype the same logic runs in <code>src/api/rules.ts</code>, so the audit log below shows what the database would do.</p>
      </Card>
      <Card title="Audit log (latest first)">
        <DataTable rows={audit.data ?? []} empty="No trigger activity yet." columns={[
          { header: 'Time', cell: (a) => new Date(a.logged_at).toLocaleString() },
          { header: 'Source', cell: (a) => <code>{a.trigger_name}</code> },
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
    </div>
  );
}
