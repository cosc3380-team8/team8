import { FormEvent, useState } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Card, DataTable, PageHeader, useAction, useLoad } from '../components/ui';
import { addDays, fmtDateTime, today } from '../utils/dates';

export default function RoomsPage() {
  const { session, isStaff } = useAuth();
  const rooms = useLoad(api.listRooms);
  const members = useLoad(api.listMembers);
  const res = useLoad(() => api.listReservations(isStaff ? undefined : session!.id), [isStaff, session?.id]);
  const { run, banner } = useAction();

  const tomorrow = addDays(today(), 1);
  const [roomId, setRoomId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [start, setStart] = useState(`${tomorrow}T10:00`);
  const [end, setEnd] = useState(`${tomorrow}T11:00`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const uid = isStaff ? Number(memberId) : session!.id;
    run(() => api.doReserveRoom(uid, Number(roomId), start, end), 'Room reserved.', res.reload);
  };

  return (
    <>
      <PageHeader title="Study Rooms" subtitle="Reserve a room. The same room cannot be booked for overlapping times." />
      {banner}
      <Card title="New reservation">
        <form className="form inline" onSubmit={submit}>
          <label><span>Room</span>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
              <option value="" disabled>Select…</option>
              {(rooms.data ?? []).filter((r) => r.is_active).map((r) => (
                <option key={r.room_id} value={r.room_id}>Room {r.room_number} · level {r.room_level} · seats {r.capacity}</option>
              ))}
            </select>
          </label>
          {isStaff && (
            <label><span>Member</span>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="" disabled>Select…</option>
                {(members.data ?? []).filter((m) => m.is_active).map((m) => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </label>
          )}
          <label><span>Start</span><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
          <label><span>End</span><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
          <button className="btn primary">Reserve</button>
        </form>
      </Card>
      <Card title={isStaff ? 'All reservations' : 'My reservations'}>
        <DataTable rows={res.data ?? []} empty="No reservations."
          columns={[
            { header: 'Room', cell: (r) => r.room_number },
            { header: 'Member', cell: (r) => r.member_name },
            { header: 'From', cell: (r) => fmtDateTime(r.start_time) },
            { header: 'To', cell: (r) => fmtDateTime(r.end_time) },
            { header: '', cell: (r) => <button className="btn small danger" onClick={() => run(() => api.cancelReservation(r.reservation_id), 'Reservation cancelled.', res.reload)}>Cancel</button> },
          ]} />
      </Card>
    </>
  );
}
