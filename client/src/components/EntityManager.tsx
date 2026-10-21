import { FormEvent, ReactNode, useState } from 'react';
import { Badge, Card, DataTable, Modal, useAction } from './ui';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'multiselect';
  options?: { value: string | number; label: string }[];
  required?: boolean;
  hint?: string;

  formOnly?: boolean;

  createOnly?: boolean;

  tableOnly?: boolean;

  render?: (row: Record<string, any>) => ReactNode;
}

interface Props {
  title: string;
  noun: string;
  rows: Record<string, any>[];
  idKey: string;
  fields: FieldDef[];
  defaults: Record<string, any>;
  onSave: (record: Record<string, any>) => Promise<unknown>;
  onDelete?: (row: Record<string, any>) => Promise<unknown>;
  reload: () => void;
  deleteLabel?: string;

  note?: string;
}

export default function EntityManager({ title, noun, rows, idKey, fields, defaults, onSave, onDelete, reload, deleteLabel = 'Archive', note }: Props) {
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formError, setFormError] = useState('');
  const { run, banner } = useAction();

  const open = (row?: Record<string, any>) => {
    setIsNew(!row);
    setEditing(row ? { ...row, ...(fields.some((f) => f.type === 'password') ? { password: '' } : {}) } : { ...defaults });
    setFormError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const rec: Record<string, any> = { ...editing };
    fields.forEach((f) => {
      if (f.type === 'number' || (f.type === 'select' && f.options && typeof f.options[0]?.value === 'number')) {
        if (rec[f.key] !== '' && rec[f.key] !== undefined) rec[f.key] = Number(rec[f.key]);
      }
    });
    try {
      await onSave(rec);
      setEditing(null);
      run(async () => undefined, `${noun} ${isNew ? 'added' : 'updated'}.`, reload);
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const columns = [
    ...fields.filter((f) => !f.formOnly && f.type !== 'password').map((f) => ({
      header: f.label,
      cell: (r: Record<string, any>) => {
        if (f.render) return f.render(r);
        const v = r[f.key];
        if (f.type === 'checkbox') return v ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>;
        if (f.type === 'select') return f.options?.find((o) => String(o.value) === String(v))?.label ?? String(v);
        if (f.type === 'multiselect') return (v as (string | number)[] | undefined ?? []).map((x) => f.options?.find((o) => String(o.value) === String(x))?.label ?? String(x)).join(' and ');
        return String(v ?? '');
      },
    })),
    {
      header: 'Actions',
      cell: (r: Record<string, any>) => (
        <div className="row gap">
          <button className="btn small" onClick={() => open(r)}>Edit</button>
          {onDelete && r.is_active !== false && (
            <button
              className="btn small danger"
              onClick={() => {
                if (window.confirm(`${deleteLabel} this ${noun.toLowerCase()}?`)) run(() => onDelete(r), `${noun} ${deleteLabel.toLowerCase()}d.`, reload);
              }}
            >
              {deleteLabel}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card title={title} actions={<button className="btn primary" onClick={() => open()}>+ Add {noun.toLowerCase()}</button>}>
      {note && <p className="muted">{note}</p>}
      {banner}
      <DataTable columns={columns} rows={rows} empty={`No ${noun.toLowerCase()} records yet.`} />
      {editing && (
        <Modal title={`${isNew ? 'Add' : 'Edit'} ${noun.toLowerCase()}`} onClose={() => setEditing(null)}>
          <form onSubmit={submit} className="form">
            {fields.filter((f) => !f.tableOnly && !(f.createOnly && !isNew)).map((f) => f.type === 'multiselect' ? (
              <fieldset key={f.key} className="multi">
                <legend>{f.label}{f.required && ' *'}</legend>
                {f.options?.map((o) => {
                  const chosen: (string | number)[] = editing[f.key] ?? [];
                  const on = chosen.some((x) => String(x) === String(o.value));
                  return (
                    <label key={o.value} className="check">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setEditing({ ...editing, [f.key]: on ? chosen.filter((x) => String(x) !== String(o.value)) : [...chosen, o.value] })}
                      />
                      <span>{o.label}</span>
                    </label>
                  );
                })}
                {f.hint && <small className="muted">{f.hint}</small>}
              </fieldset>
            ) : (
              <label key={f.key} className={f.type === 'checkbox' ? 'check' : ''}>
                <span>{f.label}{f.required && ' *'}</span>
                {f.type === 'select' ? (
                  <select value={editing[f.key] ?? ''} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} required={f.required}>
                    <option value="" disabled>Select…</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!editing[f.key]} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })} />
                ) : (
                  <input
                    type={f.type}
                    value={editing[f.key] ?? ''}
                    required={f.required && !(f.type === 'password' && !isNew)}
                    min={f.type === 'number' ? 0 : undefined}
                    placeholder={f.type === 'password' && !isNew ? 'Leave blank to keep current' : undefined}
                    onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  />
                )}
                {f.hint && <small className="muted">{f.hint}</small>}
              </label>
            ))}
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="row gap end">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
