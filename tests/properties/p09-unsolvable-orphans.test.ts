import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { solveDungeon } from '../../src/model/solver';
import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from '../../src/model/manifest';
import { arbManifest, arbDungeon, cutPaths, addOrphans } from '../generators';

describe('Property 9: Unsolvable and orphaned dungeons are reported', () => {
  // Feature: disclore-97-core, Property 9: Unsolvable and orphaned dungeons are reported
  // **Validates: Requirements 5.10, 5.11**
  it('a dungeon with no path from entrance to throne_room yields an unsolvable-dungeon error', () => {
    fc.assert(
      fc.property(arbManifest, fc.nat(), (m, pick) => {
        const mut = cutPaths(m, pick);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(
            result.errors.some(
              (e) => e.code === 'unsolvable-dungeon' && e.path === `$.dungeons[${mut.dungeonIndex}]`,
            ),
          ).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  // Feature: disclore-97-core, Property 9: Unsolvable and orphaned dungeons are reported
  // **Validates: Requirements 5.10, 5.11**
  it('an orphan-room error lists exactly the orphaned room ids', () => {
    fc.assert(
      fc.property(arbManifest, fc.nat(), fc.integer({ min: 1, max: 4 }), (m, pick, count) => {
        const mut = addOrphans(m, pick, count);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const orphanErrors = result.errors.filter((e) => e.code === 'orphan-room');
          expect(orphanErrors).toHaveLength(1);
          const err = orphanErrors[0];
          expect(err.path).toBe(`$.dungeons[${mut.dungeonIndex}]`);
          const listed = err.message.slice(err.message.indexOf(': ') + 2).split(', ');
          expect([...listed].sort()).toEqual([...mut.orphanIds].sort());
          expect(result.errors.some((e) => e.code === 'unsolvable-dungeon')).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 9 (iff form): validator agrees with solveDungeon', () => {
  // Feature: disclore-97-core, Property 9: Unsolvable and orphaned dungeons are reported
  // **Validates: Requirements 5.10, 5.11**
  it('reports unsolvable-dungeon iff path is empty, and orphan-room listing exactly the orphans iff any exist', () => {
    const arbWithReserved = arbDungeon.filter((d) => {
      const ids = new Set(d.rooms.map((r) => r.room_id));
      return ids.has(ENTRANCE_ROOM_ID) && ids.has(THRONE_ROOM_ID);
    });
    fc.assert(
      fc.property(arbManifest, arbWithReserved, (m, d) => {
        const dungeon = { ...d, dungeon_id: 'dungeon_0' };
        const manifest = { ...m, dungeons: [dungeon, ...m.dungeons.slice(1)] };
        const solved = solveDungeon(dungeon);
        const result = validateManifest(manifest);
        const errors = result.ok ? [] : result.errors.filter((e) => e.path === '$.dungeons[0]');

        const unsolvable = errors.filter((e) => e.code === 'unsolvable-dungeon');
        expect(unsolvable.length).toBe(solved.path.length === 0 ? 1 : 0);

        const orphanErrors = errors.filter((e) => e.code === 'orphan-room');
        if (solved.orphans.length > 0) {
          expect(orphanErrors).toHaveLength(1);
          const msg = orphanErrors[0].message;
          expect(msg.slice(msg.indexOf(': ') + 2).split(', ')).toEqual(solved.orphans);
        } else {
          expect(orphanErrors).toHaveLength(0);
        }
      }),
      { numRuns: 300 },
    );
  });
});
