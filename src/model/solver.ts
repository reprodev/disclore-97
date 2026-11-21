import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from './manifest';
import type { Dungeon } from './manifest';

export type SolveResult = {
  /** room_ids reachable from 'entrance' (includes 'entrance' itself when present). */
  reachable: Set<string>;
  /** Shortest entrance -> throne_room path, [] if none. */
  path: string[];
  /** Rooms not in `reachable`, in dungeon order. */
  orphans: string[];
};

/**
 * Breadth-first search from the entrance over directed exits.
 * Exits to unknown rooms are ignored. O(rooms + exits).
 */
export function solveDungeon(d: Dungeon): SolveResult {
  const byId = new Map<string, Dungeon['rooms'][number]>();
  for (const room of d.rooms) {
    if (!byId.has(room.room_id)) byId.set(room.room_id, room);
  }

  const reachable = new Set<string>();
  const parent = new Map<string, string>();

  if (byId.has(ENTRANCE_ROOM_ID)) {
    reachable.add(ENTRANCE_ROOM_ID);
    const queue: string[] = [ENTRANCE_ROOM_ID];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      const room = byId.get(current);
      if (!room) continue;
      for (const exit of room.exits) {
        const next = exit.to;
        if (!byId.has(next) || reachable.has(next)) continue;
        reachable.add(next);
        parent.set(next, current);
        queue.push(next);
      }
    }
  }

  let path: string[] = [];
  if (reachable.has(THRONE_ROOM_ID)) {
    const reversed: string[] = [THRONE_ROOM_ID];
    let node = THRONE_ROOM_ID as string;
    while (node !== ENTRANCE_ROOM_ID) {
      const p = parent.get(node);
      if (p === undefined) break;
      reversed.push(p);
      node = p;
    }
    path = reversed.reverse();
  }

  const orphans: string[] = [];
  const seen = new Set<string>();
  for (const room of d.rooms) {
    if (!reachable.has(room.room_id) && !seen.has(room.room_id)) {
      seen.add(room.room_id);
      orphans.push(room.room_id);
    }
  }

  return { reachable, path, orphans };
}
