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

/** Bellman-Ford style reference: relax every edge until no change. Returns hop distance or Infinity. */
function referenceDistance(d: Dungeon, from: string, to: string): number {
  const ids = new Set(d.rooms.map((r) => r.room_id));
  if (!ids.has(from) || !ids.has(to)) return Infinity;
  const dist = new Map<string, number>();
  for (const id of ids) dist.set(id, Infinity);
  dist.set(from, 0);
  for (let i = 0; i < ids.size; i++) {
    let changed = false;
    for (const r of d.rooms) {
      for (const e of r.exits) {
        if (!ids.has(e.to)) continue;
        const nd = dist.get(r.room_id)! + 1;
        if (nd < dist.get(e.to)!) {
          dist.set(e.to, nd);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return dist.get(to)!;
}

describe('Property 11', () => {
  // Feature: disclore-97-core, Property 11: Shortest path is valid and minimal
  // **Validates: Requirements 7.2, 7.3, 7.5, 7.7, 8.5, 8.7**
  it('shortest path is valid and minimal; empty when unreachable', () => {
    fc.assert(
      fc.property(arbDungeon, (d) => {
        const { path } = solveDungeon(d);
        const dist = referenceDistance(d, ENTRANCE_ROOM_ID, THRONE_ROOM_ID);

        if (dist === Infinity) {
          expect(path).toEqual([]);
          return;
        }

        expect(path[0]).toBe(ENTRANCE_ROOM_ID);
        expect(path[path.length - 1]).toBe(THRONE_ROOM_ID);
        expect(path.length).toBe(dist + 1);
        expect(new Set(path).size).toBe(path.length);

        const byId = new Map(d.rooms.map((r) => [r.room_id, r]));
        for (let i = 0; i + 1 < path.length; i++) {
          expect(byId.get(path[i])!.exits.some((e) => e.to === path[i + 1])).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
