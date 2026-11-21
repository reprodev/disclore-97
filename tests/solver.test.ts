import { describe, it, expect } from 'vitest';
import { solveDungeon } from '../src/model/solver';
import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from '../src/model/manifest';
import type { Dungeon, Room } from '../src/model/manifest';

function room(room_id: string, ...exits: string[]): Room {
  return { room_id, name: room_id, description: '', exits: exits.map((to) => ({ to })) };
}

function dungeon(rooms: Room[]): Dungeon {
  return { dungeon_id: 'd', title: 'D', rooms };
}

describe('solveDungeon', () => {
  // Validates: Requirements 7.5, 7.6, 7.7
  it('solves a 500-room dungeon in under 100 ms', () => {
    const n = 500;
    const rooms: Room[] = [];
    for (let i = 0; i < n; i++) {
      const id = i === 0 ? ENTRANCE_ROOM_ID : i === n - 1 ? THRONE_ROOM_ID : `room_${i}`;
      const next = i + 1 < n ? (i + 1 === n - 1 ? THRONE_ROOM_ID : `room_${i + 1}`) : undefined;
      const back = i > 1 ? `room_${i - 1}` : ENTRANCE_ROOM_ID;
      rooms.push(room(id, ...(next ? [next] : []), back));
    }
    const d = dungeon(rooms);

    const start = performance.now();
    const result = solveDungeon(d);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.reachable.size).toBe(n);
    expect(result.orphans).toEqual([]);
    expect(result.path.length).toBe(n);
  });

  it('terminates on cycles and visits each room at most once', () => {
    const d = dungeon([
      room(ENTRANCE_ROOM_ID, 'a', ENTRANCE_ROOM_ID),
      room('a', 'b'),
      room('b', 'a', ENTRANCE_ROOM_ID, THRONE_ROOM_ID),
      room(THRONE_ROOM_ID, 'a'),
    ]);
    const result = solveDungeon(d);
    expect(result.reachable.size).toBe(4);
    expect(result.orphans).toEqual([]);
    expect(result.path).toEqual([ENTRANCE_ROOM_ID, 'a', 'b', THRONE_ROOM_ID]);
    expect(new Set(result.path).size).toBe(result.path.length);
  });

  it('reports all rooms as orphans when the entrance is missing', () => {
    const d = dungeon([room('a', 'b'), room('b', THRONE_ROOM_ID), room(THRONE_ROOM_ID)]);
    const result = solveDungeon(d);
    expect(result.reachable.size).toBe(0);
    expect(result.path).toEqual([]);
    expect(result.orphans).toEqual(['a', 'b', THRONE_ROOM_ID]);
  });

  it('respects edge direction', () => {
    const d = dungeon([
      room(ENTRANCE_ROOM_ID),
      room('a', ENTRANCE_ROOM_ID, THRONE_ROOM_ID),
      room(THRONE_ROOM_ID),
    ]);
    const result = solveDungeon(d);
    // a -> entrance exists, but entrance -> a does not.
    expect([...result.reachable]).toEqual([ENTRANCE_ROOM_ID]);
    expect(result.path).toEqual([]);
    expect(result.orphans).toEqual(['a', THRONE_ROOM_ID]);
  });
});
