/**
 * Manifest types for DiscLore '97 discs.
 *
 * All types are JSON-compatible: primitives, arrays, and plain objects.
 * Optional fields must be omitted, never set to `undefined`, so a JSON
 * round trip is lossless.
 */

/**
 * Reserved room id: every dungeon must contain exactly one room with this id.
 * It is the room where the KeepMaze player starts and the root of the
 * solver's search.
 */
export const ENTRANCE_ROOM_ID = 'entrance' as const;

/**
 * Reserved room id: every dungeon must contain a room with this id.
 * Reaching it wins the KeepMaze game.
 */
export const THRONE_ROOM_ID = 'throne_room' as const;

/** A disc: the top-level unit that is loaded, validated, and browsed. */
export interface DiscManifest {
  disc_id: string;
  title: string;
  tagline: string;
  /** Non-empty. */
  sections: Section[];
  diagrams: Diagram[];
  trivia: TriviaQuestion[];
  dungeons: Dungeon[];
}

/** One dated entry in an article's timeline callout. */
export interface TimelineEntry {
  when: string;
  event: string;
}

/**
 * An article. `paragraphs` must be non-empty.
 *
 * The optional fields feed the encyclopedia layout. Omit them when unused,
 * never set them to `undefined`.
 */
export interface Section {
  section_id: string;
  title: string;
  paragraphs: string[];
  /** Short bullet facts for the Quick Facts callout. */
  facts?: string[];
  /** Dated entries for the Timeline callout. */
  timeline?: TimelineEntry[];
  /** Key of the inline SVG plate shown beside the text. Unknown keys use a default plate. */
  plate?: string;
}

/**
 * Drawing primitives in the 0..100 diagram coordinate space.
 * Colors are `currentColor`, `none`, or `var(--...)`; no hex literals.
 */
export type Shape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string }
  | { kind: 'polygon'; points: [number, number][]; fill?: string; stroke?: string };

/** A clickable point on a diagram. `x` and `y` must be within 0..100 inclusive. */
export interface Hotspot {
  label: string;
  x: number;
  y: number;
  /** Must reference an existing section. */
  section_id: string;
}

export interface Diagram {
  diagram_id: string;
  title: string;
  viewBox: '0 0 100 100';
  shapes: Shape[];
  hotspots: Hotspot[];
}

export interface TriviaQuestion {
  question_id: string;
  prompt: string;
  /** Length >= 2. */
  options: string[];
  /** Integer index into `options`. */
  correct_index: number;
  /** Section cited when the question is answered incorrectly. Must exist. */
  section_id: string;
}

/** A directed exit. `to` is a `room_id` in the same dungeon. */
export interface Exit {
  to: string;
}

/** A dungeon room. Room ids are unique within a dungeon. */
export interface Room {
  room_id: string;
  name: string;
  description: string;
  exits: Exit[];
}

/**
 * A KeepMaze dungeon. Must contain rooms with the reserved ids
 * {@link ENTRANCE_ROOM_ID} (`entrance`) and {@link THRONE_ROOM_ID}
 * (`throne_room`), a path between them, and no orphan rooms.
 */
export interface Dungeon {
  dungeon_id: string;
  title: string;
  rooms: Room[];
}

export type ErrorCode =
  | 'missing-field'
  | 'wrong-type'
  | 'duplicate-id'
  | 'coordinate-range'
  | 'dangling-reference'
  | 'index-range'
  | 'missing-room'
  | 'unsolvable-dungeon'
  | 'orphan-room';

export type ValidationError = { path: string; code: ErrorCode; message: string };

export type ValidationResult =
  | { ok: true; manifest: DiscManifest }
  | { ok: false; errors: ValidationError[] };
