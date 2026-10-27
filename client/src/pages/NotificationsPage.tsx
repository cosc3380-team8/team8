import { useEffect } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, DataTable, PageHeader, useLoad } from '../components/ui';
import type { Notification } from '../types';

const LABELS: Record<string, string> = {
  trg_loans_after_insert: 'Checked out',
  trg_loans_after_return: 'Returned',
  sp_promote_next_hold: 'Hold ready',
};

export default function NotificationsPage() {
  const { session } = useAuth();
  const uid = session!.id;
  const list = useLoad(() => api.listNotifications(uid), [uid]);

  // mark all read on open
  useEffect(() => {
    if (list.data?.some((n) => !n.is_read)) {
      api.markNotificationsRead(uid).then(() => window.dispatchEvent(new Event('notifications-changed')));
    }
  }, [list.data, uid]);

  return (
    <>
      <PageHeader title="Notifications" subtitle="Messages sent to you when you borrow an item, return it, or when a hold is ready to pick up." />
      <Card>
        <DataTable<Notification> rows={list.data ?? []} empty="No notifications yet."
          columns={[
            { header: 'When', cell: (n) => new Date(n.created_at).toLocaleString() },
            { header: 'Type', cell: (n) => <Badge tone={n.source === 'sp_promote_next_hold' ? 'green' : n.message.includes('fine') ? 'red' : 'blue'}>{LABELS[n.source] ?? n.source}</Badge> },
            { header: 'Message', cell: (n) => n.is_read ? n.message : <strong>{n.message}</strong> },
          ]} />
      </Card>
    </>
  );
}
