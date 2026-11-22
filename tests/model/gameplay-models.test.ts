// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { linkSegments, MIN_LINK_TITLE } from '../../src/model/crossLinks';
import {
  gameReducer,
  initGame,
  maxScore,
  pointsFor,
  POINTS_CORRECT,
  POINTS_HINTED,
  scholarRank,
  STARTING_TORCHES,
  STREAK_BONUS_CAP,
} from '../../src/model/game';
import type { GameState } from '../../src/model/game';
import type { DiscManifest, Dungeon, TriviaQuestion } from '../../src/model/manifest';
import { sameView } from '../../src/model/nav';
import { ANCIENT_LABEL, centuryLabel, collectTimeline, hasTimeline, parseYear, UNDATED_LABEL } from '../../src/model/timeline';
import { BOOKMARK_PREFIX, loadBookmarks, MAX_BOOKMARKS, saveBookmarks, toggleBookmark } from '../../src/library/bookmarks';
import type { StorageLike } from '../../src/library/discLibrary';
import { firstFact } from '../../src/model/discSearch';

describe('timeline', () => {
  it.each([
    ['1100s', 1100],
    ['Late 900s to 1000s', 900],
    ['After 1066', 1066],
    ['1980s and 1990s', 1980],
    ['Around 2010', 2010],
    ['1971', 1971],
    ['280 BC', -280],
    ['Early 100 BCE', -100],
  ])('reads the year in "%s"', (when, year) => {
    expect(parseYear(when)).toBe(year);
  });

  it.each(['Middle Ages', 'Part 2 of 10', 'Before', 'Ancient times', '', '12345'])('finds no year in "%s"', (when) => {
    expect(parseYear(when)).toBeNull();
  });

  it('names the century group of a year', () => {
    expect(centuryLabel(1187)).toBe('1100s');
    expect(centuryLabel(976)).toBe('900s');
    expect(centuryLabel(2010)).toBe('2000s');
    expect(centuryLabel(-280)).toBe(ANCIENT_LABEL);
  });

  const disc = (sections: DiscManifest['sections']): DiscManifest => ({
    disc_id: 'd',
    title: 'D',
    tagline: 't',
    sections,
    diagrams: [],
    trivia: [],
    dungeons: [],
  });

  it('collects every section’s events, oldest first, grouped by century, undated last', () => {
    const d = disc([
      {
        section_id: 'a',
        title: 'A',
        paragraphs: ['x'],
        timeline: [
          { when: '1100s', event: 'a1' },
          { when: 'Middle Ages', event: 'a2' },
          { when: '1066', event: 'a3' },
        ],
      },
      { section_id: 'b', title: 'B', paragraphs: ['x'] },
      {
        section_id: 'c',
        title: 'C',
        paragraphs: ['x'],
        timeline: [
          { when: 'Late 900s', event: 'c1' },
          { when: '1100s', event: 'c2' },
          { when: 'Before', event: 'c3' },
        ],
      },
    ]);
    const groups = collectTimeline(d);
    expect(groups.map((g) => g.label)).toEqual(['900s', '1000s', '1100s', UNDATED_LABEL]);
    expect(groups.map((g) => g.items.map((i) => i.event))).toEqual([['c1'], ['a3'], ['a1', 'c2'], ['a2', 'c3']]);
    expect(groups[2]!.items[1]).toMatchObject({ sectionId: 'c', sectionTitle: 'C', when: '1100s', year: 1100 });
    expect(hasTimeline(d)).toBe(true);
  });

  it('is empty for a disc without timeline entries', () => {
    const d = disc([{ section_id: 'a', title: 'A', paragraphs: ['x'], timeline: [] }]);
    expect(collectTimeline(d)).toEqual([]);
    expect(hasTimeline(d)).toBe(false);
  });

  it('puts BC events in the first group', () => {
    const d = disc([{ section_id: 'a', title: 'A', paragraphs: ['x'], timeline: [{ when: '1100s', event: 'x' }, { when: '280 BC', event: 'y' }] }]);
    expect(collectTimeline(d).map((g) => g.label)).toEqual([ANCIENT_LABEL, '1100s']);
  });

  it('treats the timeline view as one place in the history', () => {
    expect(sameView({ kind: 'timeline' }, { kind: 'timeline' })).toBe(true);
    expect(sameView({ kind: 'timeline' }, { kind: 'diagram', diagram_id: 'x' })).toBe(false);
    expect(sameView({ kind: 'timeline' }, null)).toBe(false);
  });
});

describe('cross-links', () => {
  const T = [
    { section_id: 'keep', title: 'Keep Tower' },
    { section_id: 'moat', title: 'The Moat' },
    { section_id: 'gate', title: 'Drawbridge' },
  ];
  const join = (segs: { text: string }[]) => segs.map((s) => s.text).join('');
  const links = (segs: { text: string; sectionId?: string }[]) => segs.filter((s) => s.sectionId).map((s) => [s.text, s.sectionId]);

  it('returns one plain piece when nothing is mentioned', () => {
    expect(linkSegments('Nothing to see here.', T)).toEqual([{ text: 'Nothing to see here.' }]);
    expect(linkSegments('', T)).toEqual([{ text: '' }]);
    expect(linkSegments('Any text', [])).toEqual([{ text: 'Any text' }]);
  });

  it('links whole-word, case-insensitive mentions and keeps the original wording', () => {
    const text = 'Guards on the keep tower watched the DRAWBRIDGE.';
    const segs = linkSegments(text, T);
    expect(links(segs)).toEqual([
      ['keep tower', 'keep'],
      ['DRAWBRIDGE', 'gate'],
    ]);
    expect(join(segs)).toBe(text);
  });

  it('links each target once, at its first mention', () => {
    const text = 'The Keep Tower stands. Later the keep tower falls, and the Keep Tower rises again.';
    const segs = linkSegments(text, T);
    expect(links(segs)).toEqual([['Keep Tower', 'keep']]);
    expect(segs[0]).toEqual({ text: 'The ' });
    expect(join(segs)).toBe(text);
  });

  it('does not link part of a longer word', () => {
    expect(links(linkSegments('The Drawbridges were old and the Moaty fields wet.', T))).toEqual([]);
    expect(links(linkSegments('Keep Towers everywhere', T))).toEqual([]);
    expect(links(linkSegments('Keep Tower, the Moat; Drawbridge.', T)).map((l) => l[1])).toEqual(['keep', 'moat', 'gate']);
  });

  it('skips a mention that is part of a longer word but still finds a later whole one', () => {
    const segs = linkSegments('Drawbridges came first; one Drawbridge remains.', T);
    expect(links(segs)).toEqual([['Drawbridge', 'gate']]);
  });

  it('prefers the longer title and never overlaps two links', () => {
    const segs = linkSegments('A Castle Keep Tower and a Castle.', [
      { section_id: 'castle', title: 'Castle' },
      { section_id: 'ct', title: 'Castle Keep Tower' },
    ]);
    // The first Castle is inside the longer title, so Castle links at its first free mention instead.
    expect(links(segs)).toEqual([
      ['Castle Keep Tower', 'ct'],
      ['Castle', 'castle'],
    ]);
    expect(segs.filter((s) => s.sectionId).map((s) => s.text)).toEqual(['Castle Keep Tower', 'Castle']);
    expect(join(segs)).toBe('A Castle Keep Tower and a Castle.');
  });

  it('ignores titles shorter than the minimum', () => {
    expect(MIN_LINK_TITLE).toBe(4);
    expect(links(linkSegments('See the Keep and the Gate.', [{ section_id: 'g', title: 'Gat' }]))).toEqual([]);
    expect(links(linkSegments('See the Keep.', [{ section_id: 'k', title: 'Keep' }]))).toEqual([['Keep', 'k']]);
  });

  it('treats titles as plain text, never as patterns', () => {
    const segs = linkSegments('Learn C++ (and more) today.', [
      { section_id: 'cpp', title: 'C++ (and more)' },
      { section_id: 'dot', title: '.*.*.*' },
    ]);
    expect(links(segs)).toEqual([['C++ (and more)', 'cpp']]);
  });

  it('never produces markup: the pieces always rebuild the original text', () => {
    const text = '<b>Keep Tower</b> & "The Moat" <script>alert(1)</script>';
    const segs = linkSegments(text, T);
    expect(join(segs)).toBe(text);
    expect(links(segs).map((l) => l[1])).toEqual(['keep', 'moat']);
  });
});

describe('Knowledge Score, Streak, and Torches', () => {
  const dungeon: Dungeon = {
    dungeon_id: 'd',
    title: 'D',
    rooms: [
      { room_id: 'entrance', name: 'A', description: 'a', exits: [{ to: 'hall' }] },
      { room_id: 'hall', name: 'B', description: 'b', exits: [{ to: 'entrance' }, { to: 'throne_room' }] },
      { room_id: 'throne_room', name: 'C', description: 'c', exits: [] },
    ],
  };
  const qs: TriviaQuestion[] = Array.from({ length: 6 }, (_, i) => ({
    question_id: `q${i}`,
    prompt: `Q${i}?`,
    options: ['right', 'wrong'],
    correct_index: 0,
    section_id: 's',
  }));
  const rng = () => 0.5;
  const start = () => initGame(dungeon, qs, rng);
  const step = (s: GameState, ...actions: Parameters<typeof gameReducer>[1][]) =>
    actions.reduce((acc, a) => gameReducer(acc, a, dungeon, qs, rng), s);
  const right = (s: GameState, to: string) => step(s, { type: 'selectExit', to }, { type: 'answer', index: 0 });
  const wrong = (s: GameState, to: string) => step(s, { type: 'selectExit', to }, { type: 'answer', index: 1 });

  it('starts at zero with full torches', () => {
    const s = start();
    expect([s.score, s.streak, s.bestStreak, s.torches]).toEqual([0, 0, 0, STARTING_TORCHES]);
    expect(STARTING_TORCHES).toBe(3);
  });

  it('a right answer earns 100, then a streak bonus of 10 per answer already in a row', () => {
    expect(pointsFor(0, false)).toBe(POINTS_CORRECT);
    expect(pointsFor(1, false)).toBe(110);
    expect(pointsFor(STREAK_BONUS_CAP, false)).toBe(150);
    expect(pointsFor(STREAK_BONUS_CAP + 4, false)).toBe(150); // the bonus is capped
    const s1 = right(start(), 'hall');
    expect([s1.score, s1.streak, s1.bestStreak]).toEqual([100, 1, 1]);
    const s2 = right(s1, 'throne_room');
    expect([s2.score, s2.streak, s2.bestStreak]).toEqual([210, 2, 2]);
    expect(s2.won).toBe(true);
    expect(s2.torches).toBe(3);
  });

  it('Peek Hint makes a right answer worth 50, with no bonus, and still counts toward the streak', () => {
    const s0 = step(start(), { type: 'selectExit', to: 'hall' }, { type: 'peek' });
    expect(s0.pending!.hinted).toBe(true);
    const s1 = step(s0, { type: 'answer', index: 0 });
    expect([s1.score, s1.streak]).toEqual([POINTS_HINTED, 1]);
    // The next question starts without a hint, and the streak bonus applies to it.
    const s2 = right(s1, 'throne_room');
    expect(s2.score).toBe(POINTS_HINTED + 110);
    expect(s2.streak).toBe(2);
  });

  it('a hint does not rescue a wrong answer', () => {
    const s = step(start(), { type: 'selectExit', to: 'hall' }, { type: 'peek' }, { type: 'answer', index: 1 });
    expect([s.score, s.streak, s.torches, s.incorrect]).toEqual([0, 0, 2, 1]);
  });

  it('peek does nothing without a question and is the same when repeated', () => {
    const idle = start();
    expect(gameReducer(idle, { type: 'peek' }, dungeon, qs, rng)).toBe(idle);
    const hinted = step(idle, { type: 'selectExit', to: 'hall' }, { type: 'peek' });
    expect(gameReducer(hinted, { type: 'peek' }, dungeon, qs, rng)).toBe(hinted);
  });

  it('a wrong answer resets the streak and dims a torch, keeping the best streak and the score', () => {
    const s1 = right(start(), 'hall'); // 100, streak 1
    const s2 = wrong(s1, 'throne_room');
    expect([s2.score, s2.streak, s2.bestStreak, s2.torches, s2.incorrect]).toEqual([100, 0, 1, 2, 1]);
    expect(s2.pending).toBeNull();
    expect(s2.roomId).toBe('hall');
    // The retry is worth the base 100 again, because the streak restarted.
    const s3 = right(s2, 'throne_room');
    expect(s3.score).toBe(200);
    expect(s3.won).toBe(true);
  });

  it('never soft-locks: torches stop at zero and the maze can still be finished', () => {
    let s = start();
    for (let i = 0; i < 8; i++) s = wrong(s, 'hall');
    expect(s.torches).toBe(0);
    expect(s.incorrect).toBe(8);
    expect(s.score).toBe(0);
    expect(s.won).toBe(false);
    s = right(s, 'hall');
    s = right(s, 'throne_room');
    expect(s.won).toBe(true);
    expect(s.score).toBe(210);
    expect(s.torches).toBe(0);
  });

  it('the score never goes down', () => {
    let s = start();
    let last = 0;
    for (const play of [right, wrong, right, wrong, wrong, right]) {
      s = play(s, s.roomId === 'entrance' ? 'hall' : 'throne_room');
      expect(s.score).toBeGreaterThanOrEqual(last);
      last = s.score;
      if (s.won) {
        s = start();
        last = 0;
      }
    }
  });

  it('restart brings back full torches and clears score and streaks', () => {
    const s = step(wrong(right(start(), 'hall'), 'throne_room'), { type: 'restart' });
    expect([s.score, s.streak, s.bestStreak, s.torches, s.moves, s.incorrect]).toEqual([0, 0, 0, 3, 0, 0]);
  });

  it('ranks scholars by the share of the best possible score', () => {
    expect(maxScore(0)).toBe(0);
    expect(maxScore(2)).toBe(210);
    expect(scholarRank(210, 2)).toBe('Royal Archivist');
    expect(scholarRank(160, 2)).toBe('Court Scholar'); // 76 percent
    expect(scholarRank(110, 2)).toBe('Keep Explorer'); // 52 percent
    expect(scholarRank(60, 2)).toBe('Torchbearer');
    expect(scholarRank(0, 0)).toBe('Torchbearer');
    expect(scholarRank(maxScore(7), 7)).toBe('Royal Archivist');
  });
});

describe('bookmarks storage', () => {
  function store(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
    const map = new Map(Object.entries(initial));
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

  it('saves per disc under its own key and reads back in order', () => {
    const s = store();
    expect(saveBookmarks(s, 'castles', ['a', 'b'])).toBe(true);
    expect(saveBookmarks(s, 'retro', ['z'])).toBe(true);
    expect(Array.from(s.map.keys()).sort()).toEqual([`${BOOKMARK_PREFIX}castles`, `${BOOKMARK_PREFIX}retro`]);
    expect(loadBookmarks(s, 'castles')).toEqual(['a', 'b']);
    expect(loadBookmarks(s, 'retro')).toEqual(['z']);
    expect(loadBookmarks(s, 'other')).toEqual([]);
  });

  it('removes the key when the list is empty', () => {
    const s = store();
    saveBookmarks(s, 'castles', ['a']);
    saveBookmarks(s, 'castles', []);
    expect(s.map.size).toBe(0);
  });

  it('drops duplicates and sections that no longer exist', () => {
    const s = store({ [`${BOOKMARK_PREFIX}d`]: JSON.stringify({ v: 1, sections: ['a', 'a', 'gone', 'b', 5, null] }) });
    expect(loadBookmarks(s, 'd')).toEqual(['a', 'gone', 'b']);
    expect(loadBookmarks(s, 'd', new Set(['a', 'b']))).toEqual(['a', 'b']);
  });

  it.each(['not json', '[]', '{"sections": "a"}', 'null', '{"v":1}'])('treats %s as no bookmarks', (raw) => {
    expect(loadBookmarks(store({ [`${BOOKMARK_PREFIX}d`]: raw }), 'd')).toEqual([]);
  });

  it('never throws when storage is missing or refuses', () => {
    expect(loadBookmarks(undefined, 'd')).toEqual([]);
    expect(saveBookmarks(undefined, 'd', ['a'])).toBe(false);
    const boom: StorageLike = {
      length: 0,
      key: () => {
        throw new Error('no');
      },
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
      removeItem: () => {
        throw new Error('no');
      },
    };
    expect(loadBookmarks(boom, 'd')).toEqual([]);
    expect(saveBookmarks(boom, 'd', ['a'])).toBe(false);
  });

  it('toggles an id in and out, and caps the list', () => {
    expect(toggleBookmark([], 'a')).toEqual(['a']);
    expect(toggleBookmark(['a', 'b'], 'a')).toEqual(['b']);
    const many = Array.from({ length: MAX_BOOKMARKS }, (_, i) => `s${i}`);
    const next = toggleBookmark(many, 'new');
    expect(next).toHaveLength(MAX_BOOKMARKS);
    expect(next[next.length - 1]).toBe('new');
  });
});

describe('firstFact', () => {
  it('prefers the first Quick Fact, then the first sentence of the first paragraph', () => {
    expect(firstFact({ section_id: 'a', title: 'A', paragraphs: ['Body.'], facts: ['  ', 'Fact one.', 'Fact two.'] })).toBe('Fact one.');
    expect(firstFact({ section_id: 'a', title: 'A', paragraphs: ['First sentence. Second sentence.'] })).toBe('First sentence.');
    expect(firstFact({ section_id: 'a', title: 'A', paragraphs: [] })).toBe('');
  });
});
