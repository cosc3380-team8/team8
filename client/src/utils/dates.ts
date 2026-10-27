export const pad = (n: number) => String(n).padStart(2, '0');

const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function today(): string {
  return toIso(new Date());
}

// now for today, else a random time in library hours (9am-7pm) on that day
export function stampFor(iso: string): string {
  if (iso >= today()) return new Date().toISOString();
  const d = parseIso(iso);
  d.setHours(9, 0, 0, 0);
  d.setMinutes(Math.floor(Math.random() * 10 * 60));
  return d.toISOString();
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

export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

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
