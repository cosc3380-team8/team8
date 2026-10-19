import * as api from '../api/api';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Room } from '../types';

export default function ManageRoomsPage() {
  const rooms = useLoad(api.listRooms);
  return (
    <>
      <PageHeader title="Manage Study Rooms" subtitle="Each room is one row; availability comes from its reservations (no counters to keep in sync)." />
      <EntityManager
        title="Rooms"
        noun="Room"
        idKey="room_id"
        rows={rooms.data ?? []}
        reload={rooms.reload}
        defaults={{ room_number: '', room_level: 1, capacity: 4, is_active: true }}
        fields={[
          { key: 'room_number', label: 'Room number', type: 'text', required: true },
          { key: 'room_level', label: 'Level', type: 'number', required: true },
          { key: 'capacity', label: 'Capacity', type: 'number', required: true },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveRoom(r as Partial<Room>)}
        onDelete={(r) => api.deleteRoom(r.room_id)}
      />
    </>
  );
}
