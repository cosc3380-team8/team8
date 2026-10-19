export const pad = (n: number) => String(n).padStart(2, '0');

const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function today(): string {
  return toIso(new Date());
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** Whole days from a to b (positive when b is after a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

/** Display format used in the schema draft: MM-DD-YYYY. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${m}-${d}-${y}`;
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${iso.slice(11, 16)}`;
}

export const money = (n: number) => `$${n.toFixed(2)}`;

export const monthKey = (iso: string) => iso.slice(0, 7);
