import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { castlesDisc } from '../../src/discs/castles';
import { retroDisc } from '../../src/discs/retro';
import { DAILY_KEY, loadDailyBook, saveDailyBook } from '../../src/library/dailyChallenge';
import type { StorageLike } from '../../src/library/discLibrary';
import {
  addMastered,
  addVictory,
  LAST_VISIT_KEY,
  loadLastVisit,
  loadMastered,
  loadVictories,
  saveLastVisit,
  VICTORIES_KEY,
} from '../../src/library/progress';
import { loadWallpaper, saveWallpaper, WALLPAPER_KEY } from '../../src/library/wallpaper';
import { DAILY_KEEP_DAYS, beatsDaily, dailyRng, dailySeed, dateKey, formatElapsed, recordDaily } from '../../src/model/daily';
import { buildFlashcards } from '../../src/model/flashcards';
import { continueTarget, masterySummary } from '../../src/model/mastery';
import { DEFAULT_WALLPAPER, toWallpaper, WALLPAPERS } from '../../src/model/wallpapers';

function memoryStorage(init: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(init));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
function throwingStorage(): StorageLike {
  const boom = () => {
    throw new Error('denied');
  };
  return {
    get length(): number {
      return boom();
    },
    key: boom,
    getItem: boom,
    setItem: boom,
    removeItem: boom,
  };
}

describe('Daily Challenge model', () => {
  it('keys a day as local YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dateKey(new Date(1997, 10, 23))).toBe('1997-11-23');
  });

  it('gives the same seed and the same generator stream for the same day, disc, and dungeon', () => {
    expect(dailySeed('2026-11-23', 'castles', 'keep')).toBe(dailySeed('2026-11-23', 'castles', 'keep'));
    const a = dailyRng('2026-11-23', 'castles', 'keep');
    const b = dailyRng('2026-11-23', 'castles', 'keep');
    const seqA = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(seqA);
    for (const x of seqA) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('changes with the day and the disc', () => {
    const seeds = new Set([
      dailySeed('2026-11-23', 'castles', 'keep'),
      dailySeed('2026-11-24', 'castles', 'keep'),
      dailySeed('2026-11-23', 'retro-dialup', 'keep'),
      dailySeed('2026-11-23', 'castles', 'other'),
    ]);
    expect(seeds.size).toBe(4);
  });

  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(95_400)).toBe('1:35');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatElapsed(-5)).toBe('0:00');
    expect(formatElapsed(Number.NaN)).toBe('0:00');
  });

  it('keeps the best run of the day: higher score, then less time', () => {
    expect(beatsDaily(undefined, { score: 0, timeMs: 1 })).toBe(true);
    expect(beatsDaily({ score: 200, timeMs: 9000 }, { score: 210, timeMs: 99000 })).toBe(true);
    expect(beatsDaily({ score: 200, timeMs: 9000 }, { score: 200, timeMs: 8000 })).toBe(true);
    expect(beatsDaily({ score: 200, timeMs: 9000 }, { score: 200, timeMs: 9000 })).toBe(false);
    expect(beatsDaily({ score: 200, timeMs: 9000 }, { score: 190, timeMs: 1000 })).toBe(false);
  });

  it('records without changing the input, and keeps only the most recent days', () => {
    const first = recordDaily({}, '2026-11-01', 'castles', { score: 100, timeMs: 5000 });
    expect(first.newBest).toBe(true);
    const frozen = JSON.stringify(first.book);
    const worse = recordDaily(first.book, '2026-11-01', 'castles', { score: 50, timeMs: 1000 });
    expect(worse.newBest).toBe(false);
    expect(worse.best).toEqual({ score: 100, timeMs: 5000 });
    expect(JSON.stringify(first.book)).toBe(frozen);
    let book = first.book;
    for (let d = 2; d <= 20; d++) book = recordDaily(book, `2026-11-${String(d).padStart(2, '0')}`, 'castles', { score: d, timeMs: d }).book;
    const days = Object.keys(book).sort();
    expect(days).toHaveLength(DAILY_KEEP_DAYS);
    expect(days[days.length - 1]).toBe('2026-11-20');
    expect(days).not.toContain('2026-11-01');
  });
});

describe('Study Mastery model', () => {
  const cards = buildFlashcards(castlesDisc).map((c) => c.id);

  it('sums read articles, mastered cards, and victories over the mounted discs, ignoring stale ids', () => {
    const s = masterySummary([castlesDisc, retroDisc], {
      read: new Map([
        ['castles', [castlesDisc.sections[0]!.section_id, castlesDisc.sections[1]!.section_id, 'gone']],
        ['retro-dialup', retroDisc.sections.map((x) => x.section_id)],
        ['not-mounted', ['a', 'b']],
      ]),
      mastered: new Map([['castles', [cards[0]!, cards[1]!, cards[2]!, 'f:nope:0']]]),
      wins: new Map([
        ['castles', 2],
        ['retro-dialup', 1],
        ['not-mounted', 9],
      ]),
    });
    expect(s.articlesRead).toBe(2 + retroDisc.sections.length);
    expect(s.articlesTotal).toBe(castlesDisc.sections.length + retroDisc.sections.length);
    expect(s.cardsMastered).toBe(3);
    expect(s.cardsTotal).toBe(cards.length + buildFlashcards(retroDisc).length);
    expect(s.victories).toBe(3);
    expect(s.discsCompleted).toBe(1);
  });

  it('continues at the last article, or the disc cover when the article is gone, or nowhere', () => {
    const sec = castlesDisc.sections[2]!;
    expect(continueTarget([castlesDisc], { discId: 'castles', sectionId: sec.section_id })).toEqual({
      discId: 'castles',
      sectionId: sec.section_id,
      label: `Ancient Castles & Keeps \u203a ${sec.title}`,
    });
    expect(continueTarget([castlesDisc], { discId: 'castles', sectionId: 'gone' })).toEqual({ discId: 'castles', label: 'Ancient Castles & Keeps' });
    expect(continueTarget([castlesDisc], { discId: 'retro-dialup' })).toBeNull();
    expect(continueTarget([castlesDisc], null)).toBeNull();
  });
});

describe('wallpaper model and storage', () => {
  it('offers six flat 1997 wallpapers, starting with the edition default', () => {
    expect(WALLPAPERS.map((w) => w.name)).toEqual([
      'Edition Default',
      'Classic Teal',
      'Midnight Slate',
      '1997 Crosshatch Tile',
      'Parchment Desk',
      'Blueprint Grid',
    ]);
    expect(DEFAULT_WALLPAPER).toBe('edition');
    for (const bad of [undefined, null, '', 'neon', 42, '__proto__']) expect(toWallpaper(bad)).toBe('edition');
  });

  it('saves the choice under disclore97.wallpaper, removes it for the default, and falls back safely', () => {
    const s = memoryStorage();
    expect(loadWallpaper(s)).toBe('edition');
    expect(saveWallpaper(s, 'blueprint')).toBe(true);
    expect(s.map.get(WALLPAPER_KEY)).toBe('blueprint');
    expect(loadWallpaper(s)).toBe('blueprint');
    saveWallpaper(s, 'edition');
    expect(s.map.has(WALLPAPER_KEY)).toBe(false);
    expect(loadWallpaper(memoryStorage({ [WALLPAPER_KEY]: '<script>' }))).toBe('edition');
    expect(loadWallpaper(throwingStorage())).toBe('edition');
    expect(saveWallpaper(throwingStorage(), 'slate')).toBe(false);
    expect(loadWallpaper(undefined)).toBe('edition');
  });

  it('defines every wallpaper colour once in the root tokens, with readable icon labels', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
    const root = css.slice(0, css.indexOf('}'));
    const rest = css.slice(css.indexOf('}'));
    const value = (name: string) => new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(root)?.[1];
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    for (const id of ['teal', 'slate', 'crosshatch', 'parchment', 'blueprint']) {
      const base = value(`--wallpaper-${id}`);
      const label = value(`--wallpaper-${id}-label`);
      expect(base, id).toBeTruthy();
      expect(label, id).toBeTruthy();
      const [hi, lo] = [lum(base!), lum(label!)].sort((a, b) => b - a);
      expect((hi! + 0.05) / (lo! + 0.05), `${id} label`).toBeGreaterThanOrEqual(4.5);
      expect(rest, `${id} is not overridden by an edition`).not.toContain(`--wallpaper-${id}:`);
    }
  });
});

describe('progress and Daily Challenge storage', () => {
  it('adds mastered cards per disc without duplicates', () => {
    const s = memoryStorage();
    addMastered(s, 'castles', ['t:q1', 'f:s1:0']);
    addMastered(s, 'castles', ['t:q1', 'f:s2:0', '<bad id>']);
    expect(loadMastered(s, 'castles')).toEqual(['t:q1', 'f:s1:0', 'f:s2:0']);
    expect(loadMastered(s, 'retro-dialup')).toEqual([]);
  });

  it('counts victories per disc and drops bad entries', () => {
    const s = memoryStorage({ [VICTORIES_KEY]: JSON.stringify({ v: 1, wins: { castles: 2, bad: -1, worse: 'x' } }) });
    expect(Object.fromEntries(loadVictories(s))).toEqual({ castles: 2 });
    addVictory(s, 'castles');
    addVictory(s, 'retro-dialup');
    expect(Object.fromEntries(loadVictories(s))).toEqual({ castles: 3, 'retro-dialup': 1 });
    expect(loadVictories(memoryStorage({ [VICTORIES_KEY]: '{oops' })).size).toBe(0);
    expect(addVictory(throwingStorage(), 'castles')).toBe(false);
  });

  it('remembers the last place read, and rejects junk', () => {
    const s = memoryStorage();
    saveLastVisit(s, { discId: 'castles', sectionId: 'moat' });
    expect(loadLastVisit(s)).toEqual({ discId: 'castles', sectionId: 'moat' });
    saveLastVisit(s, { discId: 'retro-dialup' });
    expect(loadLastVisit(s)).toEqual({ discId: 'retro-dialup' });
    expect(loadLastVisit(memoryStorage({ [LAST_VISIT_KEY]: JSON.stringify({ discId: '<x>' }) }))).toBeNull();
    expect(loadLastVisit(throwingStorage())).toBeNull();
  });

  it('reads the Daily Challenge book safely and round-trips it', () => {
    const s = memoryStorage({
      [DAILY_KEY]: JSON.stringify({
        v: 1,
        days: { '2026-11-23': { castles: { score: 210, timeMs: 95000 }, bad: { score: -1, timeMs: 5 } }, 'not-a-day': { castles: { score: 1, timeMs: 1 } } },
      }),
    });
    expect(loadDailyBook(s)).toEqual({ '2026-11-23': { castles: { score: 210, timeMs: 95000 } } });
    expect(saveDailyBook(s, { '2026-11-24': { castles: { score: 5, timeMs: 10 } } })).toBe(true);
    expect(loadDailyBook(s)).toEqual({ '2026-11-24': { castles: { score: 5, timeMs: 10 } } });
    expect(loadDailyBook(memoryStorage({ [DAILY_KEY]: 'nope' }))).toEqual({});
    expect(loadDailyBook(throwingStorage())).toEqual({});
  });
});
