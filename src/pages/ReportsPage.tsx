import { useEffect, useState } from 'react';
import { REPORTS, runReport } from '../api/analytics';
import { Alert, Card, DataTable, PageHeader, Tabs } from '../components/ui';
import { money } from '../utils/dates';
import type { ReportResult } from '../types';

export default function ReportsPage() {
  const [id, setId] = useState(REPORTS[0].id);
  const [data, setData] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');
  const def = REPORTS.find((r) => r.id === id)!;

  useEffect(() => {
    setData(null);
    runReport(id).then(setData).catch((e: Error) => setError(e.message));
  }, [id]);

  const max = Math.max(1, ...(data?.chart?.values ?? [0]));

  return (
    <>
      <PageHeader title="Reports" subtitle="Aggregate reports for library staff." actions={<button className="btn" onClick={() => window.print()}>Print</button>} />
      <Tabs value={id} onChange={setId} tabs={REPORTS.map((r) => ({ id: r.id, label: r.title }))} />
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
                    <span className="bar-label">{l}</span>
                    <div className="bar-track"><div className="bar" style={{ width: `${(data.chart!.values[i] / max) * 100}%` }} /></div>
                    <span className="bar-value">{data.chart!.format === 'money' ? money(data.chart!.values[i]) : data.chart!.values[i]}</span>
                  </div>
                ))}
              </div>
            )}
            <DataTable rows={data.rows} empty="No data yet."
              columns={data.columns.map((c, i) => ({ header: c, cell: (r: (string | number)[]) => r[i] }))} />
          </>
        )}
        <details>
          <summary>SQL for this report</summary>
          <pre className="sql">{def.sql}</pre>
        </details>
      </Card>
    </>
  );
}
