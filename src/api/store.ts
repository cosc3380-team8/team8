import type { DBState } from './state';
import { buildSeed } from './seed';

// The "database" for the prototype lives in localStorage.
// Replace src/api/api.ts with fetch() calls to the Java back end when it is ready.
const KEY = 'library_db_v6';

export function loadState(): DBState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DBState;
  } catch {
    /* fall through to reseed */
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
