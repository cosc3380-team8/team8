import { useEffect, useState } from 'react';
import * as api from '../api/api';
import { REPORTS, ReportFilters, runReport } from '../api/analytics';
import { Alert, Card, DataTable, PageHeader, Tabs, useLoad } from '../components/ui';
import { addDays, fmtDate, money, today } from '../utils/dates';
import type { ReportResult } from '../types';

const PRESETS: { label: string; days: number | null }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: null },
];

export default function ReportsPage() {
  const [id, setId] = useState(REPORTS[0].id);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [data, setData] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');
  const members = useLoad(api.listServerMembers);
  const authors = useLoad(api.listServerAuthors);
  const def = REPORTS.find((r) => r.id === id)!;
  const has = (k: keyof ReportFilters) => def.filters.includes(k);
  const set = (k: keyof ReportFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  useEffect(() => {
    setError('');
    runReport(id, filters).then(setData).catch((e: Error) => { setData(null); setError(e.message); });
  }, [id, filters]);

  const max = Math.max(1, ...(data?.chart?.values ?? [0]));
  const active = def.filters.filter((k) => filters[k]);
  const describe = (k: keyof ReportFilters): string => {
    const v = filters[k]!;
    if (k === 'from') return `from ${fmtDate(v)}`;
    if (k === 'to') return `to ${fmtDate(v)}`;
    if (k === 'userId') { const m = members.data?.find((x) => x.user_id === Number(v)); return m ? `member: ${m.first_name} ${m.last_name}` : 'member'; }
    if (k === 'authorId') { const a = authors.data?.find((x) => x.author_id === Number(v)); return a ? `author: ${a.first_name} ${a.last_name}` : 'author'; }
    if (k === 'keyword') return `title contains “${v}”`;
    if (k === 'kind') return v === 'book' ? 'books only' : 'media only';
    return `${k}: ${v}`;
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Library reports you can narrow down by date, member, author, title keyword and more." actions={<button className="btn" onClick={() => window.print()}>Print</button>} />
      <Tabs value={id} onChange={setId} tabs={REPORTS.map((r) => ({ id: r.id, label: r.title }))} />

      <Card title="Filters" actions={active.length > 0 && <button className="btn small" onClick={() => setFilters({})}>Clear filters</button>}>
        {(has('from') || has('to')) && (
          <div className="row wrap" style={{ marginBottom: '.7rem' }}>
            <span className="muted">{def.dateLabel ?? 'Date'}:</span>
            {PRESETS.map((p) => (
              <button key={p.label} className="btn small" onClick={() => setFilters((f) => ({
                ...f, from: p.days === null ? undefined : addDays(today(), -p.days), to: p.days === null ? undefined : today(),
              }))}>{p.label}</button>
            ))}
          </div>
        )}
        <div className="filters">
          {has('from') && <label><span>{def.dateLabel ?? 'Date'} from</span><input type="date" value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} /></label>}
          {has('to') && <label><span>{def.dateLabel ?? 'Date'} to</span><input type="date" value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} /></label>}
          {has('userId') && (
            <label><span>Member (personal report)</span>
              <select value={filters.userId ?? ''} onChange={(e) => set('userId', e.target.value)}>
                <option value="">All members</option>
                {(members.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name} ({m.role})</option>)}
              </select>
            </label>
          )}
          {has('role') && (
            <label><span>Member role</span>
              <select value={filters.role ?? ''} onChange={(e) => set('role', e.target.value)}>
                <option value="">Students and faculty</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
              </select>
            </label>
          )}
          {has('authorId') && (
            <label><span>Author</span>
              <select value={filters.authorId ?? ''} onChange={(e) => set('authorId', e.target.value)}>
                <option value="">Any author</option>
                {(authors.data ?? []).map((a) => <option key={a.author_id} value={a.author_id}>{a.first_name} {a.last_name}</option>)}
              </select>
            </label>
          )}
          {has('keyword') && <label><span>Title contains word</span><input value={filters.keyword ?? ''} onChange={(e) => set('keyword', e.target.value)} placeholder="e.g. night" /></label>}
          {has('kind') && (
            <label><span>Item type</span>
              <select value={filters.kind ?? ''} onChange={(e) => set('kind', e.target.value)}>
                <option value="">Books and media</option>
                <option value="book">Books</option>
                <option value="media">Media &amp; devices</option>
              </select>
            </label>
          )}
        </div>
        {active.length > 0 && <p className="muted">Showing: {active.map(describe).join(' · ')}</p>}
      </Card>

      <Card title={def.title}>
        <p className="muted">{def.description}</p>
        {error && <Alert kind="error">{error}</Alert>}
        {data && (
          <>
            <div className="tiles">
              {data.stats.map((s) => <div key={s.label} className="tile"><div className="tile-value">{s.value}</div><div className="muted">{s.label}</div></div>)}
            </div>
            {data.chart && data.chart.labels.length > 0 && (
              <div className="bars" aria-label={data.chart.title}>
                <h3>{data.chart.title}</h3>
                {data.chart.labels.map((l, i) => (
                  <div key={l} className="bar-row">
                    <span className="bar-label" title={l}>{l}</span>
                    <div className="bar-track"><div className="bar" style={{ width: `${(data.chart!.values[i] / max) * 100}%` }} /></div>
                    <span className="bar-value">{data.chart!.format === 'money' ? money(data.chart!.values[i]) : data.chart!.values[i]}</span>
                  </div>
                ))}
              </div>
            )}
            <DataTable rows={data.rows} empty="No data matches these filters."
              columns={data.columns.map((c, i) => ({ header: c, cell: (r: (string | number)[]) => r[i] }))} />
          </>
        )}
      </Card>
    </>
  );
}
