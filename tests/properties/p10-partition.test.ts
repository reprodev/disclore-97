import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { solveDungeon } from '../../src/model/solver';
import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from '../../src/model/manifest';
import type { Dungeon, Room } from '../../src/model/manifest';

/**
 * Generates dungeons with unique room ids, cycles, self-loops, exits to
 * unknown rooms, and sometimes a missing entrance or throne_room.
 */
const arbDungeon: fc.Arbitrary<Dungeon> = fc
  .record({
    extraCount: fc.integer({ min: 0, max: 10 }),
    hasEntrance: fc.integer({ min: 0, max: 9 }).map((n) => n !== 0),
    hasThrone: fc.integer({ min: 0, max: 9 }).map((n) => n !== 0),
  })
  .chain(({ extraCount, hasEntrance, hasThrone }) => {
    const ids: string[] = [];
    if (hasEntrance) ids.push(ENTRANCE_ROOM_ID);
    if (hasThrone) ids.push(THRONE_ROOM_ID);
    for (let i = 0; i < extraCount; i++) ids.push(`room_${i}`);
    // Targets: known ids (cycles, self-loops included) or unknown ids.
    const targetPool = [...ids, 'ghost_a', 'ghost_b', ENTRANCE_ROOM_ID, THRONE_ROOM_ID];
    const arbExits = fc.array(fc.constantFrom(...targetPool).map((to) => ({ to })), {
      minLength: 0,
      maxLength: 4,
    });
    return fc.tuple(...ids.map(() => arbExits)).map((exitLists) => {
      const rooms: Room[] = ids.map((room_id, i) => ({
        room_id,
        name: room_id,
        description: '',
        exits: exitLists[i],
      }));
      return { dungeon_id: 'd', title: 'D', rooms };
    });
  });

/** Independent iterative depth-first reference. */
function referenceReachable(d: Dungeon): Set<string> {
  const known = new Map(d.rooms.map((r) => [r.room_id, r]));
  const seen = new Set<string>();
  if (!known.has(ENTRANCE_ROOM_ID)) return seen;
  const stack = [ENTRANCE_ROOM_ID as string];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of known.get(id)!.exits) {
      if (known.has(e.to) && !seen.has(e.to)) stack.push(e.to);
    }
  }
  return seen;
}

describe('Property 10', () => {
  // Feature: disclore-97-core, Property 10: Reachable set and orphans partition the rooms
  // **Validates: Requirements 7.1, 7.4, 8.6**
  it('reachable set and orphans partition the rooms', () => {
    fc.assert(
      fc.property(arbDungeon, (d) => {
        const { reachable, orphans } = solveDungeon(d);
        const expected = referenceReachable(d);
        const allIds = d.rooms.map((r) => r.room_id);

        expect([...reachable].sort()).toEqual([...expected].sort());
        expect(orphans).toEqual(allIds.filter((id) => !expected.has(id)));

        const orphanSet = new Set(orphans);
        for (const id of reachable) expect(orphanSet.has(id)).toBe(false);
        for (const id of allIds) expect(reachable.has(id) || orphanSet.has(id)).toBe(true);
        expect(reachable.size + orphanSet.size).toBe(allIds.length);
      }),
      { numRuns: 200 },
    );
  });
});
