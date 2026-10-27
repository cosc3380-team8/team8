import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Member } from '../types';

export default function MembersPage() {
  const { isAdmin } = useAuth();
  const members = useLoad(api.listMembers);
  return (
    <>
      <PageHeader title="Members" subtitle={`Students and faculty who can borrow items. Deactivating keeps their history.${isAdmin ? '' : ' Only an admin can create new accounts.'}`} />
      <EntityManager
        title="Student & faculty accounts"
        noun="Member"
        idKey="user_id"
        rows={members.data ?? []}
        reload={members.reload}
        deleteLabel="Deactivate"
        canAdd={isAdmin}
        defaults={{ first_name: '', last_name: '', email: '', password: '', role: 'student', is_active: true }}
        fields={[
          { key: 'first_name', label: 'First name', type: 'text', required: true },
          { key: 'last_name', label: 'Last name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'password', label: 'Password', type: 'password', required: true, formOnly: true },
          { key: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'student', label: 'Student (3 items / 20 days)' }, { value: 'faculty', label: 'Faculty (6 items / 30 days)' }] },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveMember(r as Partial<Member>)}
        onDelete={(r) => api.deleteMember(r.user_id)}
      />
    </>
  );
}
