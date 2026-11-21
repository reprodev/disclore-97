import { ENTRANCE_ROOM_ID } from './manifest';
import type { Dungeon } from './manifest';

export interface MapCell {
  col: number;
  row: number;
}

export interface MapLayout {
  cells: Map<string, MapCell>;
  cols: number;
  rows: number;
}

/**
 * Lays rooms out on a grid for the mini-map. Column is the BFS distance from
 * the entrance, row is the order of discovery within that column. Rooms that
 * the entrance cannot reach go in one extra column at the end. Pure and
 * deterministic.
 */
export function layoutRooms(dungeon: Dungeon): MapLayout {
  const byId = new Map(dungeon.rooms.map((r) => [r.room_id, r]));
  const depth = new Map<string, number>();
  if (byId.has(ENTRANCE_ROOM_ID)) {
    depth.set(ENTRANCE_ROOM_ID, 0);
    const queue: string[] = [ENTRANCE_ROOM_ID];
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head]!;
      for (const exit of byId.get(id)!.exits) {
        if (byId.has(exit.to) && !depth.has(exit.to)) {
          depth.set(exit.to, depth.get(id)! + 1);
          queue.push(exit.to);
        }
      }
    }
  }
  const lastCol = depth.size === 0 ? 0 : Math.max(...depth.values()) + 1;
  const rowsPerCol = new Map<number, number>();
  const cells = new Map<string, MapCell>();
  for (const room of dungeon.rooms) {
    const col = depth.get(room.room_id) ?? lastCol;
    const row = rowsPerCol.get(col) ?? 0;
    rowsPerCol.set(col, row + 1);
    cells.set(room.room_id, { col, row });
  }
  const cols = rowsPerCol.size === 0 ? 0 : Math.max(...rowsPerCol.keys()) + 1;
  const rows = rowsPerCol.size === 0 ? 0 : Math.max(...rowsPerCol.values());
  return { cells, cols, rows };
}
