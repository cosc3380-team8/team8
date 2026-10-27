import { useState } from 'react';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, DataTable, PageHeader, Tabs, useAction, useLoad } from '../components/ui';

export default function CatalogPage() {
  const { session, isPatron } = useAuth();
  const [tab, setTab] = useState<'books' | 'media'>('books');
  const [q, setQ] = useState('');
  const books = useLoad(api.listBooks);
  const media = useLoad(api.listMedia);
  const { run, banner } = useAction();
  const reload = () => { books.reload(); media.reload(); };
  const needle = q.trim().toLowerCase();
  const isbnNeedle = q.replace(/[^0-9Xx]/g, '').toUpperCase();

  const holdButton = (kind: 'book' | 'media', id: number, available: number) =>
    isPatron && (
      <button className="btn small" onClick={() => run(() => api.doPlaceHold(session!.id, kind, id),
        available > 0 ? 'Hold placed — it is ready for pickup for 3 days.' : 'You are in the hold queue.', reload)}>
        {available > 0 ? 'Hold for pickup' : 'Join hold queue'}
      </button>
    );

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
              || (isbnNeedle.length >= 3 && b.isbn.includes(isbnNeedle))))}
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
