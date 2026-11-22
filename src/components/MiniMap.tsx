import { useMemo } from 'react';
import { layoutRooms } from '../model/minimap';
import type { Dungeon } from '../model/manifest';

export interface MiniMapProps {
  dungeon: Dungeon;
  /** Room ids the player has entered. */
  visited: readonly string[];
  currentRoomId: string;
}

const CELL = 14;
const GAP = 8;
const PAD = 6;

/**
 * Fog-of-war map. Shows rooms the player has visited, the current room, and
 * unexplored exits from visited rooms as dark cells. Draws no text.
 */
export function MiniMap({ dungeon, visited, currentRoomId }: MiniMapProps) {
  const layout = useMemo(() => layoutRooms(dungeon), [dungeon]);
  const seen = new Set(visited);
  const known = new Set(seen);
  for (const room of dungeon.rooms) {
    if (!seen.has(room.room_id)) continue;
    for (const exit of room.exits ?? []) known.add(exit.to);
  }

  const pos = (id: string) => {
    const c = layout.cells.get(id);
    if (!c) return null;
    return { x: PAD + c.col * (CELL + GAP), y: PAD + c.row * (CELL + GAP) };
  };
  const width = PAD * 2 + Math.max(layout.cols, 1) * CELL + Math.max(layout.cols - 1, 0) * GAP;
  const height = PAD * 2 + Math.max(layout.rows, 1) * CELL + Math.max(layout.rows - 1, 0) * GAP;

  const edges: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const room of dungeon.rooms) {
    if (!seen.has(room.room_id)) continue;
    const a = pos(room.room_id);
    if (!a) continue;
    (room.exits ?? []).forEach((exit, i) => {
      const b = pos(exit.to);
      if (!b || !known.has(exit.to)) return;
      edges.push({
        key: `${room.room_id}>${exit.to}-${i}`,
        x1: a.x + CELL / 2,
        y1: a.y + CELL / 2,
        x2: b.x + CELL / 2,
        y2: b.y + CELL / 2,
      });
    });
  }

  const explored = dungeon.rooms.filter((r) => seen.has(r.room_id)).length;

  return (
    <svg
      className="minimap"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Mini-map: ${explored} of ${dungeon.rooms.length} rooms explored`}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={width} height={height} className="minimap__bg" />
      {edges.map((e) => (
        <line key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="minimap__edge" />
      ))}
      {dungeon.rooms.map((room) => {
        const p = pos(room.room_id);
        if (!p || !known.has(room.room_id)) return null;
        const state = room.room_id === currentRoomId ? 'current' : seen.has(room.room_id) ? 'visited' : 'unknown';
        return (
          <rect
            key={room.room_id}
            x={p.x}
            y={p.y}
            width={CELL}
            height={CELL}
            className={`minimap__room minimap__room--${state}`}
            data-room={room.room_id}
            data-state={state}
          />
        );
      })}
    </svg>
  );
}
