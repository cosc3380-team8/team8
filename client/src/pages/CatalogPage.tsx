

import { useState } from 'react';
import * as api from '../api/api';
import { LIMITS } from '../api/rules';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, DataTable, PageHeader, Tabs, useAction, useLoad } from '../components/ui';
import { fmtDate } from '../utils/dates';

export default function CatalogPage() {
  const { session, isPatron } = useAuth();
  const [tab, setTab] = useState<'books' | 'media'>('books');
  const [q, setQ] = useState('');
  const books = useLoad(api.listBooks);
  const media = useLoad(api.listMedia);
  const uid = isPatron && session ? session.id : null;
  const myHolds = useLoad(() => (uid ? api.listHolds({ userId: uid, activeOnly: true }) : Promise.resolve([])), [uid]);
  const { run, banner } = useAction();
  const reload = () => { books.reload(); media.reload(); myHolds.reload(); };
  const activeHolds = (myHolds.data ?? []).filter((h) => h.status === 'waiting' || h.status === 'ready');
  const holdLimit = LIMITS[session?.role === 'faculty' ? 'faculty' : 'student'].maxHolds;
  const atLimit = activeHolds.length >= holdLimit;
  const needle = q.trim().toLowerCase();
  const isbnNeedle = q.replace(/[^0-9Xx]/g, '').toUpperCase();

  const holdButton = (kind: 'book' | 'media', id: number, available: number) => {
    if (!isPatron) return null;
    const mine = activeHolds.find((h) => (kind === 'book' ? h.book_id : h.media_id) === id);
    if (mine) return mine.status === 'ready'
      ? <Badge tone="green">Ready · pick up by {fmtDate(mine.expiration_date)}</Badge>
      : <Badge tone="amber">On hold · queue #{mine.queue_position ?? '?'}</Badge>;
    if (available > 0) return <span className="muted">On the shelf, ask at the desk</span>;
    if (atLimit) return <span className="muted">Hold limit ({holdLimit}) reached</span>;
    return (
      <button className="btn small" onClick={() => run(() => api.doPlaceHold(session!.id, kind, id),
        'You are in the hold queue. We will tell you when it is your turn.', reload)}>
        Join hold queue
      </button>
    );
  };

  const avail = (a: number, t: number) => (a > 0 ? <Badge tone="green">{a} of {t} available</Badge> : <Badge tone="red">All {t} out</Badge>);

  return (
    <>
      <PageHeader title="Catalog" subtitle="Browse books and media. Holds can be placed online; borrowing happens in person." />
      {banner}
      <Card>
        <div className="row between wrap">
          <Tabs tabs={[{ id: 'books', label: 'Books' }, { id: 'media', label: 'Media & devices' }]} value={tab} onChange={setTab} />
          <input className="search" placeholder="Search title, author, ISBN, type…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {tab === 'books' ? (
          <DataTable
            rows={(books.data ?? []).filter((b) => b.is_active && (
              `${b.title} ${b.author_name} ${b.publisher}`.toLowerCase().includes(needle)
              || (isbnNeedle.length >= 3 && (b.isbn ?? '').includes(isbnNeedle))))}
            empty="No books match."
            columns={[
              { header: 'Title', cell: (b) => <strong>{b.title}</strong> },
              { header: 'Author', cell: (b) => b.author_name },
              { header: 'ISBN', cell: (b) => b.isbn || '—' },
              { header: 'Publisher', cell: (b) => b.publisher },
              { header: 'Availability', cell: (b) => avail(b.available_copies, b.total_copies) },
              { header: '', cell: (b) => holdButton('book', b.book_id, b.available_copies) },
            ]} />
        ) : (
          <DataTable
            rows={(media.data ?? []).filter((m) => m.is_active && `${m.title} ${m.media_type}`.toLowerCase().includes(needle))}
            empty="No media match."
            columns={[
              { header: 'Title', cell: (m) => <strong>{m.title}</strong> },
              { header: 'Type', cell: (m) => m.media_type },
              { header: 'Availability', cell: (m) => avail(m.available_copies, m.total_copies) },
              { header: '', cell: (m) => holdButton('media', m.media_id, m.available_copies) },
            ]} />
        )}
      </Card>
    </>
  );
}

