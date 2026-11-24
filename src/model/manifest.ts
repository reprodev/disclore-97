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

/** One picture for the Multimedia Reel. `url` is a safe public image address (see media.ts). */
export interface MediaItem {
  url: string;
  caption: string;
}

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
  /** Optional pictures for the Multimedia Reel: at most 8, omitted when there are none. */
  media?: MediaItem[];
  /**
   * Present only on an offline study outline: the source it stands in for, so the app can offer to
   * burn the full disc later. Omitted on every full disc.
   */
  outline?: OutlineSource;
}

/** The source kinds an offline study outline can stand in for. */
export type OutlineKind = 'github' | 'webpage' | 'topic';
export const OUTLINE_KINDS: readonly OutlineKind[] = ['github', 'webpage', 'topic'];
/** Longest `outline.input` accepted: a web address or a topic, never a pasted document. */
export const MAX_OUTLINE_INPUT = 2048;

/** What an offline outline was burned from: the source kind and the exact text that was entered. */
export interface OutlineSource {
  kind: OutlineKind;
  /** The GitHub address, web page address, or topic text, as typed. Plain text, never markup. */
  input: string;
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
  | { kind: 'rect'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; anim?: ShapeAnim }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; anim?: ShapeAnim }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string; anim?: ShapeAnim }
  | { kind: 'polygon'; points: [number, number][]; fill?: string; stroke?: string; anim?: ShapeAnim };

/**
 * Optional micro-animation for a built-in shape: a blinking cursor, a flickering flame, or a glint.
 * Only these three names are valid. They are drawn with CSS and stop for reduced motion.
 */
export type ShapeAnim = 'blink' | 'flicker' | 'glint';
export const SHAPE_ANIMS: readonly ShapeAnim[] = ['blink', 'flicker', 'glint'];

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
  | 'orphan-room'
  | 'unsafe-media';

export type ValidationError = { path: string; code: ErrorCode; message: string };

export type ValidationResult =
  | { ok: true; manifest: DiscManifest }
  | { ok: false; errors: ValidationError[] };
