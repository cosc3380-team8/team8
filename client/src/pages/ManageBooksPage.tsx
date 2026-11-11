/*import * as api from '../api/api';
import { useState } from 'react';
import CopiesModal from '../components/CopiesModal';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Author, Book } from '../types';

export default function ManageBooksPage() {
  const books = useLoad(api.listBooks);
  const [copiesOf, setCopiesOf] = useState<Record<string, any> | null>(null);
  const authors = useLoad(api.listAuthors);

  return (
    <>
      <PageHeader title="Manage Books" subtitle="Add titles and copies, edit details, and archive titles (archived titles keep their loan history)." />
      <EntityManager
        title="Books"
        noun="Book"
        idKey="book_id"
        rows={books.data ?? []}
        reload={books.reload}
        archivedLabel="Archived books"
        defaults={{ title: '', isbn: '', publisher: '', author_ids: [], total_copies: 1, is_active: true }}
        fields={[
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'author_ids', label: 'Authors', type: 'multiselect', required: true,
            options: (authors.data ?? []).map((a) => ({ value: a.author_id, label: `${a.first_name} ${a.last_name}` })),
            hint: 'Tick one or more. Authors are listed in the order you tick them.',
            render: (r) => r.author_name },
          { key: 'isbn', label: 'ISBN', type: 'text', hint: '10 or 13 digits. Dashes are ignored.' },
          { key: 'publisher', label: 'Publisher', type: 'text' },
          { key: 'total_copies', label: 'Total copies', type: 'number', required: true, formOnly: true, hint: 'Enter the new total to add or remove copies. Copies on loan or on hold cannot be removed.' },
          { key: 'copies', label: 'Copies (available / total)', type: 'text', tableOnly: true, render: (r) => `${r.available_copies} / ${r.total_copies}` },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveBook(r as Partial<Book> & { total_copies: number })}
        onDelete={(r) => api.deleteBook(r.book_id)}
        rowActions={(r) => <button className="btn small" onClick={() => setCopiesOf(r)}>Copies</button>}
      />
      {copiesOf && <CopiesModal kind="book" id={copiesOf.book_id} title={copiesOf.title} onClose={() => setCopiesOf(null)} onChange={books.reload} />}
      <EntityManager
        title="Authors"
        noun="Author"
        idKey="author_id"
        rows={authors.data ?? []}
        reload={() => { authors.reload(); books.reload(); }}
        defaults={{ first_name: '', last_name: '' }}
        deleteLabel="Delete"
        fields={[
          { key: 'first_name', label: 'First name', type: 'text', required: true },
          { key: 'last_name', label: 'Last name', type: 'text', required: true },
        ]}
        onSave={(r) => api.saveAuthor(r as Partial<Author>)}
        onDelete={(r) => api.deleteAuthor(r.author_id)}
        note="Books and authors are many-to-many (book_authors table): one book can have several authors, and one author can have several books. An author linked to a book cannot be deleted."
      />
    </>
  );
} */ 
import * as api from '../api/api';
import { useState } from 'react';
import CopiesModal from '../components/CopiesModal';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Author, Book } from '../types';

// authors can share a name, so show the middle name and the ISBNs of their books (or their ID)
const fullName = (a: Author) => [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' ');
const authorLabel = (a: Author) =>
  a.isbns ? `${fullName(a)} (ISBN ${a.isbns})` : `${fullName(a)} (ID ${a.author_id}, no books yet)`;

export default function ManageBooksPage() {
  const books = useLoad(api.listBooks);
  const [copiesOf, setCopiesOf] = useState<Record<string, any> | null>(null);
  const authors = useLoad(api.listAuthors);

  return (
    <>
      <PageHeader title="Manage Books" subtitle="Add titles and copies, edit details, and archive titles (archived titles keep their loan history)." />
      <EntityManager
        title="Books"
        noun="Book"
        idKey="book_id"
        rows={books.data ?? []}
        reload={books.reload}
        archivedLabel="Archived books"
        defaults={{ title: '', isbn: '', publisher: '', author_ids: [], total_copies: 1, is_active: true }}
        fields={[
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'author_ids', label: 'Authors', type: 'multiselect', required: true,
            options: (authors.data ?? []).map((a) => ({ value: a.author_id, label: authorLabel(a) })),
            hint: 'Tick one or more. Authors are listed in the order you tick them.',
            render: (r) => r.author_name },
          { key: 'isbn', label: 'ISBN', type: 'text', hint: '10 or 13 digits. Dashes are ignored.' },
          { key: 'publisher', label: 'Publisher', type: 'text' },
          { key: 'total_copies', label: 'Total copies', type: 'number', required: true, formOnly: true, hint: 'Enter the new total to add or remove copies. Copies on loan or on hold cannot be removed.' },
          { key: 'copies', label: 'Copies (available / total)', type: 'text', tableOnly: true, render: (r) => `${r.available_copies} / ${r.total_copies}` },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveBook(r as Partial<Book> & { total_copies: number })}
        onDelete={(r) => api.deleteBook(r.book_id)}
        rowActions={(r) => <button className="btn small" onClick={() => setCopiesOf(r)}>Copies</button>}
      />
      {copiesOf && <CopiesModal kind="book" id={copiesOf.book_id} title={copiesOf.title} onClose={() => setCopiesOf(null)} onChange={books.reload} />}
      <EntityManager
        title="Authors"
        noun="Author"
        idKey="author_id"
        rows={authors.data ?? []}
        reload={() => { authors.reload(); books.reload(); }}
        defaults={{ first_name: '', middle_name: '', last_name: '' }}
        deleteLabel="Delete"
        fields={[
          { key: 'first_name', label: 'First name', type: 'text', required: true },
          { key: 'middle_name', label: 'Middle name', type: 'text', hint: 'Optional. Helps tell apart authors with the same name.' },
          { key: 'last_name', label: 'Last name', type: 'text', required: true },
          { key: 'isbns', label: 'Books (ISBN)', type: 'text', tableOnly: true, render: (r) => r.isbns || `No books yet · ID ${r.author_id}` },
        ]}
        onSave={(r) => api.saveAuthor(r as Partial<Author>)}
        onDelete={(r) => api.deleteAuthor(r.author_id)}
        note="Books and authors are many-to-many (book_authors table): one book can have several authors, and one author can have several books. An author linked to a book cannot be deleted."
      />
    </>
  );
}

