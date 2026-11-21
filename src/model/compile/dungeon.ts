import type { Dungeon, Room, Section } from '../manifest';
import { createIdAllocator, ENTRANCE_ID, THRONE_ID } from './ids';
import type { IdAllocator } from './ids';
import { sanitizeLine, truncate } from './text';

const MIN_ROOMS = 8;
const MAX_ROOMS = 12;
const MAX_TREE_CHILDREN = 3;
const MAX_EXITS = 5;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;

/** Six original description templates. Each quotes the linked section title. */
const DESCRIPTION_TEMPLATES: readonly ((title: string) => string)[] = [
  (t) => `Torches light a room that holds the article "${t}".`,
  (t) => `Dusty shelves here are stacked with scrolls about "${t}".`,
  (t) => `A carved plaque on the wall reads "${t}" in faded gold letters.`,
  (t) => `Your footsteps echo in a chamber devoted to "${t}".`,
  (t) => `A cold draft carries a whisper of "${t}" through the stones.`,
  (t) => `Banners hang from the ceiling, each one stitched with the words "${t}".`,
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Builds the Keep dungeon. Every room is attached to a spanning tree rooted at
 * `entrance`, so the dungeon has zero orphans and a path to `throne_room`.
 * `rng` is the 'dungeon' stream. Fresh ids are used unless `ids` is given.
 */
export function buildDungeon(
  sections: readonly Pick<Section, 'title'>[],
  discTitle: string,
  rng: () => number,
  ids: IdAllocator = createIdAllocator(),
): Dungeon {
  const n = Math.max(sections.length, 1);
  const titleOf = (k: number): string => {
    const t = sections.length > 0 ? sections[((k % n) + n) % n].title : discTitle;
    return sanitizeLine(t, 120) || discTitle;
  };
  const pick = (len: number): number => Math.min(len - 1, Math.floor(rng() * len));

  const roomCount = clamp(n + 3, MIN_ROOMS, MAX_ROOMS);
  const hallCount = roomCount - 2;

  const hallIds: string[] = [];
  for (let k = 0; k < hallCount; k++) hallIds.push(ids.hall());

  // Section index per room, and exits per room.
  const sectionIndex = new Map<string, number>();
  sectionIndex.set(ENTRANCE_ID, 0);
  sectionIndex.set(THRONE_ID, n - 1);
  hallIds.forEach((id, i) => sectionIndex.set(id, (i + 1) % n));

  const exits = new Map<string, string[]>();
  exits.set(ENTRANCE_ID, []);
  exits.set(THRONE_ID, []);
  for (const id of hallIds) exits.set(id, []);

  const parentOf = new Map<string, string>();
  const depth = new Map<string, number>([[ENTRANCE_ID, 0]]);
  const children = new Map<string, number>([[ENTRANCE_ID, 0]]);

  const attach = (parent: string, child: string): void => {
    exits.get(parent)?.push(child);
    parentOf.set(child, parent);
    depth.set(child, (depth.get(parent) ?? 0) + 1);
    children.set(parent, (children.get(parent) ?? 0) + 1);
    children.set(child, 0);
  };

  // Shuffle halls (Fisher-Yates).
  const shuffled = hallIds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Spanning tree rooted at entrance.
  const attached: string[] = [ENTRANCE_ID];
  for (const hall of shuffled) {
    const open = attached.filter((a) => (children.get(a) ?? 0) < MAX_TREE_CHILDREN);
    attach(open[pick(open.length)], hall);
    attached.push(hall);
  }

  // Throne room: prefer a parent at depth >= 2 that still has tree capacity.
  const openHalls = hallIds.filter((h) => (children.get(h) ?? 0) < MAX_TREE_CHILDREN);
  const deep = openHalls.filter((h) => (depth.get(h) ?? 0) >= 2);
  const throneCandidates = deep.length > 0 ? deep : openHalls.length > 0 ? openHalls : hallIds;
  attach(throneCandidates[pick(throneCandidates.length)], THRONE_ID);

  // Bounded extra loops.
  const allIds = [ENTRANCE_ID, ...hallIds, THRONE_ID];
  const sources = [ENTRANCE_ID, ...hallIds];
  const wanted = 2 + Math.floor(roomCount / 3);
  let added = 0;
  for (let iter = 0; iter < 4 * wanted && added < wanted; iter++) {
    const from = sources[pick(sources.length)];
    const to = allIds[pick(allIds.length)];
    const list = exits.get(from);
    if (!list || from === to || list.includes(to) || list.length >= MAX_EXITS) continue;
    list.push(to);
    added += 1;
  }

  // Dead-end repair: every non-throne room gets an exit.
  for (const id of sources) {
    const list = exits.get(id);
    if (list && list.length === 0) list.push(parentOf.get(id) ?? ENTRANCE_ID);
  }

  const rooms: Room[] = allIds.map((id) => {
    const idx = sectionIndex.get(id) ?? 0;
    const title = titleOf(idx);
    const name =
      id === ENTRANCE_ID
        ? `Entrance: ${discTitle}`
        : id === THRONE_ID
          ? `Throne Room of ${discTitle}`
          : `Hall of ${title}`;
    const template = DESCRIPTION_TEMPLATES[pick(DESCRIPTION_TEMPLATES.length)];
    return {
      room_id: id,
      name: truncate(name, NAME_MAX),
      description: truncate(template(title), DESCRIPTION_MAX),
      exits: (exits.get(id) ?? []).map((to) => ({ to })),
    };
  });

  return {
    dungeon_id: ids.dungeon(),
    title: `Keep of ${discTitle}`,
    rooms,
  };
}
