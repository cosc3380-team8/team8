import { archiveCopy, listCopies } from '../api/copies';
import { fmtDate } from '../utils/dates';
import { Badge, DataTable, Modal, useAction, useLoad } from './ui';

interface Props {
  kind: 'book' | 'media';
  id: number;
  title: string;
  onClose: () => void;
  onChange: () => void;
}

export default function CopiesModal({ kind, id, title, onClose, onChange }: Props) {
  const copies = useLoad(() => listCopies(kind, id), [kind, id]);
  const { run, banner } = useAction();
  const active = (copies.data ?? []).filter((c) => c.status !== 'archived').length;

  const archive = (copyId: number) => {
    if (!window.confirm(`Archive copy #${copyId}? It will not be lent out again.`)) return;
    run(() => archiveCopy(copyId), `Copy #${copyId} archived.`, () => { copies.reload(); onChange(); });
  };

  return (
    <Modal title={`Copies of “${title}”`} onClose={onClose}>
      <p className="muted">{active} active cop{active === 1 ? 'y' : 'ies'}. Archive a copy that is lost or damaged. A copy that is checked out or held for a member can't be archived.</p>
      {banner}
      <DataTable rows={copies.data ?? []} empty="No copies."
        columns={[
          { header: 'Copy ID', cell: (c) => `#${c.copy_id}` },
          { header: 'Status', cell: (c) =>
            c.status === 'on shelf' ? <Badge tone="green">On shelf</Badge>
            : c.status === 'checked out' ? <Badge tone="amber">Checked out · {c.member_name} · due {fmtDate(c.due_date ?? '')}</Badge>
            : c.status === 'held' ? <Badge tone="blue">Held for {c.member_name}</Badge>
            : <Badge>Archived</Badge> },
          { header: '', cell: (c) => c.status === 'on shelf' && <button className="btn small danger" onClick={() => archive(c.copy_id)}>Archive</button> },
        ]} />
    </Modal>
  );
}
