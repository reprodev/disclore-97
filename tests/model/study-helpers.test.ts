// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { countMatches, normalizeQuery, splitByQuery } from '../../src/model/findInText';
import { findMentions } from '../../src/model/discSearch';
import type { DiscManifest } from '../../src/model/manifest';
import { loadBookmarks, saveBookmarks } from '../../src/library/bookmarks';
import { loadVisited, markVisited, saveVisited, VISITED_PREFIX } from '../../src/library/visited';
import type { StorageLike } from '../../src/library/discLibrary';

const disc = (id: string, title: string, sections: DiscManifest['sections']): DiscManifest => ({
  disc_id: id,
  title,
  tagline: 't',
  sections,
  diagrams: [],
  trivia: [],
  dungeons: [],
});

const A = disc('a', 'Castles', [
  {
    section_id: 'moat',
    title: 'The Moat',
    paragraphs: ['Water fills the moat. A moat can be dry. Nothing else here.', 'Moats are not the same word.'],
    facts: ['A moat is a ditch.'],
  },
  { section_id: 'keep', title: 'Keep', paragraphs: ['The keep stands behind the moat, and the moat guards it.'] },
]);
const B = disc('b', 'Retro', [{ section_id: 'modem', title: 'Modem', paragraphs: ['A modem is not a moat.'] }]);

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
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

describe('findMentions', () => {
  it('finds whole-word matches in titles, facts, and sentences across discs, in that order', () => {
    const m = findMentions([A, B], 'moat');
    expect(m.map((x) => x.kind)).toEqual(['title', 'fact', 'sentence', 'sentence', 'sentence', 'sentence']);
    expect(m[0]).toMatchObject({ discId: 'a', sectionId: 'moat', text: 'The Moat' });
    expect(m[1]!.text).toBe('A moat is a ditch.');
    expect(m.some((x) => x.discId === 'b')).toBe(true);
  });

  it('does not match inside longer words and ignores case', () => {
    const m = findMentions([A], 'MOAT');
    expect(m.some((x) => x.text.startsWith('Moats are'))).toBe(false);
    expect(findMentions([A], 'moa')).toEqual([]);
  });

  it('drops sentences that repeat a fact, caps sentences per section, and honors the limit', () => {
    const crowded = disc('c', 'Crowded', [
      { section_id: 's', title: 'S', paragraphs: ['A moat one. A moat two. A moat three. A moat four.'], facts: ['A moat one.'] },
    ]);
    const m = findMentions([crowded], 'moat');
    expect(m.filter((x) => x.kind === 'sentence')).toHaveLength(3);
    expect(m.filter((x) => x.text === 'A moat one.')).toHaveLength(1);
    expect(findMentions([A, B], 'moat', 2)).toHaveLength(2);
  });

  it('returns nothing for a very short word', () => {
    expect(findMentions([A], 'a')).toEqual([]);
    expect(findMentions([A], '  ')).toEqual([]);
  });
});

describe('findInText', () => {
  it('splits text into plain and matching pieces, ignoring case', () => {
    expect(splitByQuery('The Moat and the moat', 'moat')).toEqual([
      { text: 'The ', hit: false },
      { text: 'Moat', hit: true },
      { text: ' and the ', hit: false },
      { text: 'moat', hit: true },
    ]);
  });

  it('returns one plain piece for an empty query or no match', () => {
    expect(splitByQuery('abc', '   ')).toEqual([{ text: 'abc', hit: false }]);
    expect(splitByQuery('abc', 'z')).toEqual([{ text: 'abc', hit: false }]);
  });

  it('counts matches and trims the query', () => {
    expect(countMatches('aaa', 'a')).toBe(3);
    expect(normalizeQuery('  KeEp ')).toBe('keep');
  });
});

describe('visited storage', () => {
  it('uses its own key per disc, separate from bookmarks', () => {
    const s = memoryStorage();
    expect(saveVisited(s, 'a', ['moat', 'keep'])).toBe(true);
    expect(s.map.has(VISITED_PREFIX + 'a')).toBe(true);
    expect(VISITED_PREFIX).toBe('disclore97.visited.');
    expect(loadVisited(s, 'a')).toEqual(['moat', 'keep']);
    expect(loadBookmarks(s, 'a')).toEqual([]);
    saveBookmarks(s, 'a', ['keep']);
    expect(loadVisited(s, 'a')).toEqual(['moat', 'keep']);
  });

  it('drops unknown, duplicate, and unreadable entries, and never throws', () => {
    const s = memoryStorage();
    s.setItem(VISITED_PREFIX + 'a', JSON.stringify({ v: 1, sections: ['moat', 'moat', 'gone', 7] }));
    expect(loadVisited(s, 'a', new Set(['moat', 'keep']))).toEqual(['moat']);
    s.setItem(VISITED_PREFIX + 'a', 'not json');
    expect(loadVisited(s, 'a')).toEqual([]);
    expect(loadVisited(undefined, 'a')).toEqual([]);
    expect(saveVisited(undefined, 'a', ['x'])).toBe(false);
  });

  it('markVisited adds once and keeps the same array when already present', () => {
    const base = ['moat'];
    expect(markVisited(base, 'moat')).toBe(base);
    expect(markVisited(base, 'keep')).toEqual(['moat', 'keep']);
  });
});
