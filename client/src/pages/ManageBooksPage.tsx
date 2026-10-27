import * as api from '../api/api';
import EntityManager from '../components/EntityManager';
import { PageHeader, useLoad } from '../components/ui';
import type { Author, Book } from '../types';

export default function ManageBooksPage() {
  const books = useLoad(api.listBooks);
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
        defaults={{ title: '', isbn: '', publisher: '', author_ids: [], add_copies: 1, is_active: true }}
        fields={[
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'author_ids', label: 'Authors', type: 'multiselect', required: true,
            options: (authors.data ?? []).map((a) => ({ value: a.author_id, label: `${a.first_name} ${a.last_name}` })),
            hint: 'Tick one or more. Authors are listed in the order you tick them.',
            render: (r) => r.author_name },
          { key: 'isbn', label: 'ISBN', type: 'text', hint: '10 or 13 digits. Dashes are ignored.' },
          { key: 'publisher', label: 'Publisher', type: 'text' },
          { key: 'add_copies', label: 'Copies to add', type: 'number', formOnly: true, hint: 'Each physical copy gets its own copy ID and loan history.' },
          { key: 'copies', label: 'Copies (available / total)', type: 'text', tableOnly: true, render: (r) => `${r.available_copies} / ${r.total_copies}` },
          { key: 'is_active', label: 'Active', type: 'checkbox' },
        ]}
        onSave={(r) => api.saveBook(r as Partial<Book>, Number(r.add_copies || 0))}
        onDelete={(r) => api.deleteBook(r.book_id)}
      />
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
}
