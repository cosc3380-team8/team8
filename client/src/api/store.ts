import type { DBState } from './state';
import { buildSeed } from './seed';

const KEY = 'library_db_v7';

export function loadState(): DBState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DBState;
  } catch {

  }
  const s = buildSeed();
  saveState(s);
  return s;
}

export function saveState(s: DBState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetState() {
  localStorage.removeItem(KEY);
}
