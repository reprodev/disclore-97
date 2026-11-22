import type { PersonalBest } from '../model/game';
import { SCHOLAR_RANKS } from '../model/game';
import type { StorageLike } from './discLibrary';

/** The best KeepMaze run of each disc, under its own key apart from bookmarks and visited sections. */
export const BEST_PREFIX = 'disclore97.best.';

/** Reads one disc's personal best. Anything unreadable or malformed gives null. Never throws. */
export function loadBest(storage: StorageLike | undefined, discId: string): PersonalBest | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(BEST_PREFIX + discId);
    if (typeof raw !== 'string') return null;
    const p: unknown = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return null;
    const { bestScore, bestRank } = p as { bestScore?: unknown; bestRank?: unknown };
    if (typeof bestScore !== 'number' || !Number.isFinite(bestScore) || bestScore < 0) return null;
    if (typeof bestRank !== 'string' || !(SCHOLAR_RANKS as readonly string[]).includes(bestRank)) return null;
    return { bestScore, bestRank };
  } catch {
    return null;
  }
}

/** Writes one disc's personal best. Returns false when storage is missing or refuses. */
export function saveBest(storage: StorageLike | undefined, discId: string, best: PersonalBest): boolean {
  if (!storage) return false;
  try {
    storage.setItem(BEST_PREFIX + discId, JSON.stringify({ v: 1, bestScore: best.bestScore, bestRank: best.bestRank }));
    return true;
  } catch {
    return false;
  }
}
