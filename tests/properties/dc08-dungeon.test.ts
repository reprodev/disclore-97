import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { solveDungeon } from '../../src/model/solver';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';
import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from '../../src/model/manifest';

const arbAnySource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

describe('Property 8: Dungeons are solvable with no orphans', () => {
  // Feature: dynamic-disc-compiler, Property 8: Dungeons are solvable with no orphans
  // **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 17.6**
  it('every compiled dungeon is solvable, orphan-free, and well-formed', () => {
    fc.assert(
      fc.property(arbAnySource, (source) => {
        const m = compileDisc(source);
        const phrases = [m.title, ...m.sections.map((s) => s.title)]
          .map((t) => t.toLowerCase())
          .filter((t) => t.length > 0);
        const words = new Set(phrases.flatMap((p) => p.split(/\s+/)).filter((w) => w.length > 0));

        expect(m.dungeons.length).toBeGreaterThanOrEqual(1);
        for (const d of m.dungeons) {
          expect(d.rooms.length).toBeGreaterThanOrEqual(8);
          const ids = new Set(d.rooms.map((r) => r.room_id));
          expect(d.rooms.filter((r) => r.room_id === ENTRANCE_ROOM_ID)).toHaveLength(1);
          expect(d.rooms.filter((r) => r.room_id === THRONE_ROOM_ID)).toHaveLength(1);

          const result = solveDungeon(d);
          expect(result.path.length).toBeGreaterThan(0);
          expect(result.orphans).toEqual([]);

          for (const room of d.rooms) {
            for (const exit of room.exits) expect(ids.has(exit.to)).toBe(true);
            if (room.room_id !== THRONE_ROOM_ID) {
              expect(room.exits.length).toBeGreaterThanOrEqual(1);
            }
            expect(room.name.trim().length).toBeGreaterThan(0);
            expect(room.description.trim().length).toBeGreaterThan(0);

            const text = `${room.name} ${room.description}`.toLowerCase();
            const hasPhrase = phrases.some((p) => text.includes(p));
            const hasWord = text.split(/\s+/).some((w) => words.has(w));
            expect(hasPhrase || hasWord).toBe(true);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
