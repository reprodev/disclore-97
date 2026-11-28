/**
 * KeepMaze Daily Challenge: pure helpers. The caller passes in the date and the clock readings,
 * so everything here is deterministic: the same day, disc, and dungeon always give the same run.
 */
import { fnv1a32, mulberry32 } from './compile/prng';

/** Today's key, in the visitor's own time zone, as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const isDateKey = (s: unknown): s is string => typeof s === 'string' && DATE_KEY.test(s);

/** The seed for one day's challenge on one dungeon. */
export function dailySeed(day: string, discId: string, dungeonId: string): number {
  return fnv1a32(`daily|${day}|${discId}|${dungeonId}`);
}

/** A fresh seeded generator for the day's run. Call it again to replay the same order from the start. */
export function dailyRng(day: string, discId: string, dungeonId: string): () => number {
  return mulberry32(dailySeed(day, discId, dungeonId));
}

/** Elapsed time as M:SS, or H:MM:SS past an hour. Negative or broken values read 0:00. */
export function formatElapsed(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** One finished Daily Challenge run, or the best one of the day. */
export interface DailyResult {
  score: number;
  timeMs: number;
}

/** Saved results: day, then disc id, then the best run. */
export type DailyBook = Record<string, Record<string, DailyResult>>;

/** Whether a run beats the day's best: a higher score, or the same score in less time. */
export function beatsDaily(prev: DailyResult | undefined, run: DailyResult): boolean {
  if (!prev) return true;
  return run.score > prev.score || (run.score === prev.score && run.timeMs < prev.timeMs);
}

/** How many days of results are kept. Older days are dropped when a new one is recorded. */
export const DAILY_KEEP_DAYS = 14;

/**
 * Records a finished run. Returns the new book (only the most recent DAILY_KEEP_DAYS days) and
 * whether the run set the day's best. The input book is never changed.
 */
export function recordDaily(
  book: DailyBook,
  day: string,
  discId: string,
  run: DailyResult,
): { book: DailyBook; best: DailyResult; newBest: boolean } {
  const prev = book[day]?.[discId];
  const newBest = beatsDaily(prev, run);
  const best = newBest ? { score: run.score, timeMs: run.timeMs } : prev!;
  const next: DailyBook = { ...book, [day]: { ...(book[day] ?? {}), [discId]: best } };
  const days = Object.keys(next).filter(isDateKey).sort().reverse().slice(0, DAILY_KEEP_DAYS);
  return { book: Object.fromEntries(days.map((d) => [d, next[d]!])), best, newBest };
}
