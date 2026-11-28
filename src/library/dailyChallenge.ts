import type { StorageLike } from './discLibrary';
import { isDateKey } from '../model/daily';
import type { DailyBook, DailyResult } from '../model/daily';

/** Daily Challenge results: `{ v: 1, days: { 'YYYY-MM-DD': { [discId]: { score, timeMs } } } }`. */
export const DAILY_KEY = 'disclore97.dailyChallenge';

const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_TIME_MS = 24 * 60 * 60 * 1000;

function cleanResult(v: unknown): DailyResult | null {
  if (typeof v !== 'object' || v === null) return null;
  const { score, timeMs } = v as { score?: unknown; timeMs?: unknown };
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return null;
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs < 0 || timeMs > MAX_TIME_MS) return null;
  return { score, timeMs };
}

/** Reads the saved Daily Challenge results. Malformed days, discs, or runs are dropped. Never throws. */
export function loadDailyBook(storage: StorageLike | undefined): DailyBook {
  if (!storage) return {};
  try {
    const raw = storage.getItem(DAILY_KEY);
    if (typeof raw !== 'string') return {};
    const p: unknown = JSON.parse(raw);
    const days = typeof p === 'object' && p !== null ? (p as { days?: unknown }).days : undefined;
    if (typeof days !== 'object' || days === null || Array.isArray(days)) return {};
    const out: DailyBook = {};
    for (const [day, discs] of Object.entries(days as Record<string, unknown>)) {
      if (!isDateKey(day) || typeof discs !== 'object' || discs === null) continue;
      const kept: Record<string, DailyResult> = {};
      for (const [id, run] of Object.entries(discs as Record<string, unknown>)) {
        const r = ID.test(id) ? cleanResult(run) : null;
        if (r) kept[id] = r;
      }
      if (Object.keys(kept).length > 0) out[day] = kept;
    }
    return out;
  } catch {
    return {};
  }
}

/** Writes the Daily Challenge results. Returns false when storage is missing or refuses. */
export function saveDailyBook(storage: StorageLike | undefined, book: DailyBook): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DAILY_KEY, JSON.stringify({ v: 1, days: book }));
    return true;
  } catch {
    return false;
  }
}
