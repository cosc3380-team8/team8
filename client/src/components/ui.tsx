import { ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export function PageHeader({ title, subtitle, actions, titleAside }: { title: string; subtitle?: string; actions?: ReactNode; titleAside?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <div className="title-row"><h1>{title}</h1>{titleAside}</div>
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
  const { pending } = useLoadStatus();
  if (rows.length === 0) return <p className="muted empty">{pending > 0 ? 'Loading…' : empty}</p>;
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

// Shared load state: tables say "Loading…" instead of "Nothing to show" while data is on the way,
// and Layout shows load errors (pages used to stay empty with no message).
let pendingLoads = 0;
let nextLoadId = 0;
const loadErrors = new Map<number, string>();
const loadListeners = new Set<() => void>();
let loadSnapshot = { pending: 0, errors: [] as string[] };
function emitLoad() {
  loadSnapshot = { pending: pendingLoads, errors: [...new Set(loadErrors.values())] };
  loadListeners.forEach((l) => l());
}
function subscribeLoad(l: () => void) {
  loadListeners.add(l);
  return () => { loadListeners.delete(l); };
}
export const useLoadStatus = () => useSyncExternalStore(subscribeLoad, () => loadSnapshot);

export function LoadErrors() {
  const { errors } = useLoadStatus();
  if (errors.length === 0) return null;
  return <Alert kind="error">Some data could not load: {errors.map((e) => e.replace(/\.$/, '')).join(' · ')}. Try refreshing the page.</Alert>;
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState('');
  const id = useRef(0);
  if (id.current === 0) id.current = ++nextLoadId;

  const load = useCallback(() => {
    pendingLoads++; emitLoad();
    fn()
      .then((d) => { setData(d); setError(''); loadErrors.delete(id.current); })
      .catch((e: Error) => { setError(e.message); loadErrors.set(id.current, e.message); })
      .finally(() => { pendingLoads--; emitLoad(); });
  }, deps);
  useEffect(load, [load]);
  useEffect(() => () => { loadErrors.delete(id.current); emitLoad(); }, []);
  return { data, error, reload: load };
}

export function useAction() {
  const [msg, setMsg] = useState<{ kind: 'success' | 'error' | 'warning'; text: string } | null>(null);
  // fn can return a string to replace the success text, or { warning } for an amber note
  const run = async (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'warning' in r) setMsg({ kind: 'warning', text: String((r as { warning: string }).warning) });
      else setMsg({ kind: 'success', text: typeof r === 'string' ? r : success });
      after?.();
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
      after?.();
    }
  };
  const banner = msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>;
  return { run, banner, setMsg };
}
