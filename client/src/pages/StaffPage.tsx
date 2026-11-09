import { useState } from 'react';
import * as api from '../api/api';
import EntityManager from '../components/EntityManager';
import { Card, PageHeader, useAction, useLoad } from '../components/ui';
import type { Staff } from '../types';

export default function StaffPage() {
  const staff = useLoad(api.listStaff);
  const { run, banner } = useAction();
  const [busy, setBusy] = useState(false);

  // puts the library back to the same demo state (team8_azure_migration_8.sql)
  const resetDemo = () => {
    if (!window.confirm('This deletes ALL loans, fines, holds, room bookings and messages, and every account except the 5 demo accounts. Books stay. Reset the demo data now?')) return;
    setBusy(true);
    run(async () => {
      const r = await api.resetDemoData();
      return `Demo data reset: ${r.accounts} accounts, ${r.items_out} items out (${r.items_late} late), ${r.holds} holds, ${r.room_bookings} room bookings.`;
    }, 'Demo data reset.', () => { setBusy(false); staff.reload(); });
  };

  return (
    <>
      <PageHeader title="Staff records" subtitle="Visible to administrators only." />
      {banner}
      <EntityManager
        title="Employees & administrators"
        noun="Staff member"
        idKey="staff_id"
        rows={staff.data ?? []}
        reload={staff.reload}
        archivedLabel = "Inactive staff"
        deleteLabel="Deactivate"
        defaults={{ first_name: '', last_name: '', email: '', password: '', is_admin: false, is_active: true }}
        fields={[
          { key: 'first_name', label: 'First name', type: 'text', required: true },
          { key: 'last_name', label: 'Last name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'password', label: 'Password', type: 'password', required: true, formOnly: true },
          { key: 'is_admin', label: 'Administrator', type: 'checkbox' },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveStaff(r as Partial<Staff>)}
        onDelete={(r) => api.deleteStaff(r.staff_id)}
      />
      <Card title="Demo data">
        <p className="muted">
          Puts the library back to the same demo state: only the 5 demo accounts stay (azael, clark, esther, ben, dan)
          with their loans, late fines, holds and room bookings. Every other account, loan, fine, hold, booking and
          message is deleted. Books, media and rooms stay.
        </p>
        <button className="btn danger" disabled={busy} onClick={resetDemo}>{busy ? 'Resetting…' : 'Reset demo data'}</button>
      </Card>
    </>
  );
}
