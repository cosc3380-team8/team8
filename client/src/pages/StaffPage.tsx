import * as api from '../api/api';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Staff } from '../types';

export default function StaffPage() {
  const staff = useLoad(api.listStaff);
  return (
    <>
      <PageHeader title="Staff records" subtitle="Visible to administrators only." />
      <EntityManager
        title="Employees & administrators"
        noun="Staff member"
        idKey="staff_id"
        rows={staff.data ?? []}
        reload={staff.reload}
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
    </>
  );
}
