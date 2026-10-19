import { ReactNode, useCallback, useEffect, useState } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row gap">{actions}</div>}
    </div>
  );
}

export function Alert({ kind = 'info', children, onClose }: { kind?: 'info' | 'success' | 'error' | 'warning'; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {onClose && <button className="link" onClick={onClose} aria-label="Dismiss">×</button>}
    </div>
  );
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, empty = 'Nothing to show.' }: { columns: Column<T>[]; rows: T[]; empty?: string }) {
  if (rows.length === 0) return <p className="muted empty">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c.header}>{c.cell(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="link" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="row between card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'tab active' : 'tab'} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Loads data from the API and exposes a reload() to call after a mutation. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    fn().then((d) => { setData(d); setError(''); }).catch((e: Error) => setError(e.message));
  }, deps);
  useEffect(load, [load]);
  return { data, error, reload: load };
}

/** Runs an async action, reporting success / failure through a message state. */
export function useAction() {
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    try {
      await fn();
      setMsg({ kind: 'success', text: success });
      after?.();
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
      after?.();
    }
  };
  const banner = msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>;
  return { run, banner, setMsg };
}
