import { FormEvent, useState } from 'react';
import * as api from '../api/api';
import { QUERIES, runQuery } from '../api/analytics';
import { Alert, Card, DataTable, PageHeader, useLoad } from '../components/ui';
import type { TableResult } from '../types';

export default function QueriesPage() {
  const [selected, setSelected] = useState(QUERIES[0].id);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TableResult | null>(null);
  const [error, setError] = useState('');
  const [showSql, setShowSql] = useState(true);
  const members = useLoad(api.listServerMembers);
  const books = useLoad(api.listBooks);
  const media = useLoad(api.listMedia);

  const def = QUERIES.find((q) => q.id === selected)!;

  const pick = (id: string) => { setSelected(id); setParams({}); setResult(null); setError(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setResult(await runQuery(selected, params));
      setError('');
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Data Queries" subtitle="Parameterised lookups. Each one shows the T-SQL that the Java back end will run against Azure SQL." />
      <div className="grid-2">
        <Card title="Choose a query">
          <div className="list">
            {QUERIES.map((q) => (
              <button key={q.id} className={q.id === selected ? 'list-item active' : 'list-item'} onClick={() => pick(q.id)}>
                <strong>{q.title}</strong>
                <span className="muted">{q.description}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title={def.title}>
          <p className="muted">{def.description}</p>
          <form className="form inline" onSubmit={submit}>
            {def.params.map((p) => (
              <label key={p.name}><span>{p.label}</span>
                {p.kind === 'member' ? (
                  <select value={params[p.name] ?? ''} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })} required>
                    <option value="" disabled>Select…</option>
                    {(members.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name} ({m.role})</option>)}
                  </select>
                ) : p.kind === 'item' ? (
                  <select value={params[p.name] ?? ''} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })} required>
                    <option value="" disabled>Select…</option>
                    <optgroup label="Books">{(books.data ?? []).map((b) => <option key={b.book_id} value={`book:${b.book_id}`}>{b.title}</option>)}</optgroup>
                    <optgroup label="Media">{(media.data ?? []).map((m) => <option key={m.media_id} value={`media:${m.media_id}`}>{m.title}</option>)}</optgroup>
                  </select>
                ) : (
                  <input value={params[p.name] ?? ''} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })} placeholder="Leave blank for everything" />
                )}
              </label>
            ))}
            <button className="btn primary">Run query</button>
          </form>
          {error && <Alert kind="error">{error}</Alert>}
          {result && (
            <>
              <p className="muted">{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</p>
              <DataTable rows={result.rows} empty="The query returned no rows."
                columns={result.columns.map((c, i) => ({ header: c, cell: (r: (string | number)[]) => r[i] }))} />
            </>
          )}
          <button className="link" onClick={() => setShowSql(!showSql)}>{showSql ? 'Hide' : 'Show'} SQL</button>
          {showSql && <pre className="sql">{def.sql}</pre>}
        </Card>
      </div>
    </>
  );
}
