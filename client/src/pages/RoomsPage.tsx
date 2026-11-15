 import { FormEvent, useState } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, DataTable, PageHeader, useAction, useConfirm, useLoad } from '../components/ui';
import { addDays, fmtDateTime, pad, today } from '../utils/dates';

const OPEN_HOUR = 8;
const CLOSE_HOUR = 22;
const BLOCK_HOURS = 2;
const BLOCKS = Array.from({ length: (CLOSE_HOUR - OPEN_HOUR) / BLOCK_HOURS }, (_, i) => OPEN_HOUR + i * BLOCK_HOURS);
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
const blockLabel = (h: number) => `${hourLabel(h)} – ${hourLabel(h + BLOCK_HOURS)}`;

export default function RoomsPage() {
  const { session, isStaff } = useAuth();
  const rooms = useLoad(api.listRooms);
  const members = useLoad(() => (isStaff ? api.listMembers() : Promise.resolve([])), [isStaff]);
  const res = useLoad(() => api.listReservations(isStaff ? undefined : session!.id), [isStaff, session?.id]);
  const { run, banner } = useAction();
  const { confirm, dialog } = useConfirm();

  const tomorrow = addDays(today(), 1);
  const [roomId, setRoomId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [day, setDay] = useState(tomorrow);
  const [block, setBlock] = useState(String(OPEN_HOUR));
  const startHour = Number(block);
  const start = `${day}T${pad(startHour)}:00`;
  const end = `${day}T${pad(startHour + BLOCK_HOURS)}:00`;

  const all = res.data ?? [];
  const upcoming = all.filter((r) => !r.archived);
  const archived = all.filter((r) => r.archived).reverse();

  const times = useLoad(() => api.listRoomAvailability(day), [day]);
  const isFree = (id: number) => !(times.data?.bookings ?? []).some(
    (b) => b.room_id === id && b.start_time < end && b.end_time > start);
  // blocks that have already started today can't be booked
  const isPastBlock = (h: number) => !!times.data && `${day}T${pad(h)}:00` < times.data.now;
  const freeRooms = (rooms.data ?? []).filter((r) => r.is_active && isFree(r.room_id));
  const pickedRoom = freeRooms.some((r) => String(r.room_id) === roomId) ? roomId : '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const uid = isStaff ? Number(memberId) : session!.id;
    const bookedThatDay = all.some((r) => r.user_id === uid && r.is_active !== false && r.start_time.slice(0, 10) === day);
    run(async () => {
      if (isPastBlock(startHour)) throw new Error('That time has already started. Choose a later time.');
      if (bookedThatDay) throw new Error('You have reached your room booking limit for that day.');
      await api.doReserveRoom(uid, Number(pickedRoom), start, end);
    }, 'Room reserved.', () => { res.reload(); times.reload(); });
  };

  return (
    <>
      <PageHeader title="Study Rooms" subtitle="Reserve a room. The same room cannot be booked for overlapping times." />
      {banner}
      {dialog}
      <Card title="New reservation">
        <form className="form inline" onSubmit={submit}>
          <label><span>Room</span>
            <select value={pickedRoom} onChange={(e) => setRoomId(e.target.value)} required>
              <option value="" disabled>{freeRooms.length ? 'Select…' : 'No rooms free at this time'}</option>
              {freeRooms.map((r) => (
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
          <label><span>Date</span><input type="date" value={day} min={today()} onChange={(e) => e.target.value && setDay(e.target.value)} required /></label>
          <label><span>Time (2 hours)</span>
            <select value={block} onChange={(e) => setBlock(e.target.value)} required>
              {BLOCKS.map((h) => (
                <option key={h} value={h} disabled={isPastBlock(h)}>{blockLabel(h)}{isPastBlock(h) ? ' (past)' : ''}</option>
              ))}
            </select>
          </label>
          <button className="btn primary">Reserve</button>
        </form>
      </Card>
      <Card title={isStaff ? 'Upcoming reservations' : 'My upcoming reservations'}>
        <DataTable rows={upcoming} empty="No upcoming reservations."
          columns={[
            { header: 'Room', cell: (r) => r.room_number },
            { header: 'Member', cell: (r) => r.member_name },
            { header: 'From', cell: (r) => fmtDateTime(r.start_time) },
            { header: 'To', cell: (r) => fmtDateTime(r.end_time) },
            { header: '', cell: (r) => <button className="btn small danger" onClick={() => confirm(`Cancel the booking for room ${r.room_number}?`, () => run(() => api.cancelReservation(r.reservation_id), 'Reservation cancelled.', () => { res.reload(); times.reload(); }), 'Cancel booking')}>Cancel</button> },
          ]} />
      </Card>
      <Card title={`Archived reservations (${archived.length})`}>
        <details>
          <summary>Show past and cancelled reservations</summary>
          <DataTable rows={archived} empty="No past reservations."
            columns={[
              { header: 'Room', cell: (r) => r.room_number },
              { header: 'Member', cell: (r) => r.member_name },
              { header: 'From', cell: (r) => fmtDateTime(r.start_time) },
              { header: 'To', cell: (r) => fmtDateTime(r.end_time) },
              { header: 'Status', cell: (r) => r.is_active === false ? <Badge tone="red">Cancelled</Badge> : <Badge tone="gray">Completed</Badge> },
            ]} />
        </details>
      </Card>
    </>
  );
}
