import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { createDiscLibrary, MAX_DISCS, type StorageLike } from '../../src/library/discLibrary';
import type { DiscManifest } from '../../src/model/manifest';
import { arbExtractedSource } from '../generators';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

const arbManifests = fc
  .array(arbExtractedSource, { minLength: 1, maxLength: 14 })
  .map((sources) => sources.map((s) => compileDisc(s)));

describe('Property 24: Library round trip, capacity, and replacement', () => {
  // Feature: dynamic-disc-compiler, Property 24: Library round trip, capacity, and replacement
  // **Validates: Requirements 15.2, 15.8, 15.9**
  it('keeps the most recent distinct ids in save order, at most 10, with later content winning', () => {
    fc.assert(
      fc.property(arbManifests, (manifests) => {
        const lib = createDiscLibrary(memoryStorage());
        const expected: DiscManifest[] = [];
        for (const m of manifests) {
          expect(lib.save(m)).toEqual({ saved: true });
          const idx = expected.findIndex((e) => e.disc_id === m.disc_id);
          if (idx >= 0) expected.splice(idx, 1);
          expected.push(m);
          while (expected.length > MAX_DISCS) expected.shift();
        }
        const loaded = lib.load();
        expect(loaded.length).toBeLessThanOrEqual(MAX_DISCS);
        expect(loaded.map((d) => d.disc_id)).toEqual(expected.map((d) => d.disc_id));
        expect(loaded).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('replaces a disc saved twice under the same id with the later content', () => {
    fc.assert(
      fc.property(arbExtractedSource, (source) => {
        const lib = createDiscLibrary(memoryStorage());
        const first = compileDisc(source);
        const second: DiscManifest = { ...first, title: first.title + ' v2' };
        lib.save(first);
        lib.save(second);
        const loaded = lib.load();
        expect(loaded).toHaveLength(1);
        expect(loaded[0]).toEqual(second);
      }),
      { numRuns: 100 },
    );
  });
});
