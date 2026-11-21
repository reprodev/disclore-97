// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 25: Library skips and removes corrupt entries
// **Validates: Requirements 15.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDiscLibrary, KEY_PREFIX, type StorageLike } from '../../src/library/discLibrary';
import { castlesDisc, retroDisc } from '../../src/discs';
import { validateManifest } from '../../src/model/validate';

class MemStorage implements StorageLike {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

const validBase = [castlesDisc, retroDisc];

type Corrupt =
  | { kind: 'json'; raw: string }
  | { kind: 'version'; v: unknown }
  | { kind: 'manifest'; manifest: unknown };

const arbCorrupt: fc.Arbitrary<Corrupt> = fc.oneof(
  fc.constantFrom('', '{', 'not json', '[1,', '{"v":1,').map((raw) => ({ kind: 'json' as const, raw })),
  fc
    .oneof(fc.constant(2), fc.constant(0), fc.constant('1'), fc.constant(null), fc.integer({ min: 2, max: 99 }))
    .map((v) => ({ kind: 'version' as const, v })),
  fc
    .oneof(
      fc.constant(null),
      fc.constant({}),
      fc.constant([]),
      fc.constant('str'),
      fc.constant(42),
      fc.constant({ disc_id: 'bad', title: 'x' }),
      fc.constant({ ...retroDisc, rooms: [] }),
      fc.constant({ ...retroDisc, title: 5 }),
    )
    .map((manifest) => ({ kind: 'manifest' as const, manifest })),
);

function rawFor(c: Corrupt, seq: number): string {
  switch (c.kind) {
    case 'json':
      return c.raw;
    case 'version':
      return JSON.stringify({ v: c.v, seq, manifest: retroDisc });
    case 'manifest':
      return JSON.stringify({ v: 1, seq, manifest: c.manifest });
  }
}

describe('Property 25: Library skips and removes corrupt entries', () => {
  it('sanity: prebaked discs are valid manifests', () => {
    for (const d of validBase) expect(validateManifest(d).ok).toBe(true);
  });

  it('load skips and removes corrupt entries; valid ones remain', () => {
    fc.assert(
      fc.property(
        fc.subarray(validBase, { minLength: 0 }),
        fc.array(arbCorrupt, { minLength: 1, maxLength: 5 }),
        (valid, corrupts) => {
          const storage = new MemStorage();
          const lib = createDiscLibrary(storage);
          for (const d of valid) expect(lib.save(d)).toEqual({ saved: true });

          const corruptKeys = corrupts.map((c, i) => {
            const key = `${KEY_PREFIX}corrupt-${i}`;
            storage.setItem(key, rawFor(c, i + 1));
            return key;
          });
          // Unrelated keys must be untouched.
          storage.setItem('other.key', 'garbage');

          const loaded = lib.load();
          expect(loaded.map((m) => m.disc_id).sort()).toEqual(valid.map((m) => m.disc_id).sort());
          for (const k of corruptKeys) expect(storage.getItem(k)).toBeNull();
          for (const d of valid) expect(storage.getItem(KEY_PREFIX + d.disc_id)).not.toBeNull();
          expect(storage.getItem('other.key')).toBe('garbage');
        },
      ),
      { numRuns: 100 },
    );
  });
});
