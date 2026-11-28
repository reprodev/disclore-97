import { loadIdList, saveIdList } from './bookmarks';
import type { StorageLike } from './discLibrary';
import type { LastVisit } from '../model/mastery';

/** Flashcards mastered on one disc, under their own key per disc, like bookmarks and visited articles. */
export const MASTERED_PREFIX = 'disclore97.mastered.';
export const MAX_MASTERED = 200;
/** KeepMaze victories across every disc: `{ v: 1, wins: { [discId]: count } }`. */
export const VICTORIES_KEY = 'disclore97.victories';
/** Where the reader left off: `{ v: 1, discId, sectionId? }`. */
export const LAST_VISIT_KEY = 'disclore97.lastVisit';

const ID = /^[A-Za-z0-9._:-]{1,160}$/;

/** Reads the flashcard ids mastered on one disc. Never throws. */
export function loadMastered(storage: StorageLike | undefined, discId: string): string[] {
  return loadIdList(storage, MASTERED_PREFIX, discId, MAX_MASTERED);
}

/** Adds newly mastered card ids to one disc's saved list (it only ever grows). Never throws. */
export function addMastered(storage: StorageLike | undefined, discId: string, ids: readonly string[]): boolean {
  const prev = loadMastered(storage, discId);
  const next = [...prev, ...ids.filter((id) => typeof id === 'string' && ID.test(id) && !prev.includes(id))];
  if (next.length === prev.length) return true;
  return saveIdList(storage, MASTERED_PREFIX, discId, next.slice(-MAX_MASTERED), MAX_MASTERED);
}

/** Reads every disc's KeepMaze victory count. Bad entries are dropped. Never throws. */
export function loadVictories(storage: StorageLike | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!storage) return out;
  try {
    const raw = storage.getItem(VICTORIES_KEY);
    if (typeof raw !== 'string') return out;
    const p: unknown = JSON.parse(raw);
    const wins = typeof p === 'object' && p !== null ? (p as { wins?: unknown }).wins : undefined;
    if (typeof wins !== 'object' || wins === null || Array.isArray(wins)) return out;
    for (const [id, n] of Object.entries(wins as Record<string, unknown>)) {
      if (ID.test(id) && typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 1e6) out.set(id, n);
    }
    return out;
  } catch {
    return out;
  }
}

/** Counts one more KeepMaze victory on a disc. Returns false when storage is missing or refuses. */
export function addVictory(storage: StorageLike | undefined, discId: string): boolean {
  if (!storage || !ID.test(discId)) return false;
  const wins = loadVictories(storage);
  wins.set(discId, (wins.get(discId) ?? 0) + 1);
  try {
    storage.setItem(VICTORIES_KEY, JSON.stringify({ v: 1, wins: Object.fromEntries(wins) }));
    return true;
  } catch {
    return false;
  }
}

/** Reads where the reader left off, or null. Never throws. */
export function loadLastVisit(storage: StorageLike | undefined): LastVisit | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_VISIT_KEY);
    if (typeof raw !== 'string') return null;
    const p: unknown = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return null;
    const { discId, sectionId } = p as { discId?: unknown; sectionId?: unknown };
    if (typeof discId !== 'string' || !ID.test(discId)) return null;
    return typeof sectionId === 'string' && ID.test(sectionId) ? { discId, sectionId } : { discId };
  } catch {
    return null;
  }
}

/** Saves where the reader is. Returns false when storage is missing or refuses. */
export function saveLastVisit(storage: StorageLike | undefined, visit: LastVisit): boolean {
  if (!storage || !ID.test(visit.discId)) return false;
  try {
    const body = visit.sectionId && ID.test(visit.sectionId) ? { v: 1, discId: visit.discId, sectionId: visit.sectionId } : { v: 1, discId: visit.discId };
    storage.setItem(LAST_VISIT_KEY, JSON.stringify(body));
    return true;
  } catch {
    return false;
  }
}

/** Clears the saved place, for example when its disc is removed. Never throws. */
export function clearLastVisit(storage: StorageLike | undefined): void {
  try {
    storage?.removeItem(LAST_VISIT_KEY);
  } catch {
    /* ignore */
  }
}
