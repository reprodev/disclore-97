/**
 * Shared fast-check generators and mutation helpers for the DiscLore '97 tests.
 *
 * - `arbDungeon`: arbitrary dungeons (cycles, self-loops, unknown exits, sometimes
 *   no `entrance` or `throne_room`). Used for solver properties.
 * - `arbValidDungeon`: dungeons that are solvable with no orphans.
 * - `arbManifest`: valid manifests by construction. Every identifier scope that
 *   mutations need has at least two items, there is at least one hotspot, and
 *   every trivia question has at least two options.
 * - Mutation helpers: each applies exactly one defect to a deep copy of a valid
 *   manifest. `pick` arguments are arbitrary naturals (from `fc.nat()`) and are
 *   reduced modulo the number of candidates, so any value is accepted.
 *
 * Mutation results carry `segments` (path as keys/indices) and `path`
 * (dotted form such as `sections[0].title`) so tests can compare against
 * validator error paths with whatever matching they need.
 */
import fc from 'fast-check';
import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from '../src/model/manifest';
import type { ExtractedSource } from '../src/model/source';
import type {
  DiscManifest,
  Diagram,
  Dungeon,
  Room,
  Section,
  Shape,
  TriviaQuestion,
} from '../src/model/manifest';

// ---------------------------------------------------------------------------
// Dungeons
// ---------------------------------------------------------------------------

function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items;
  const k = by % items.length;
  return [...items.slice(k), ...items.slice(0, k)];
}

const arbText = fc.string({ minLength: 1, maxLength: 12 });

/** Build rooms from ids and raw exit picks. Picks index into `targets` (modulo). */
function buildRooms(ids: string[], picks: number[][], targets: string[]): Room[] {
  return ids.map((id, i) => ({
    room_id: id,
    name: `Room ${id}`,
    description: `Description of ${id}`,
    exits: (picks[i] ?? []).map((p) => ({ to: targets[p % targets.length] })),
  }));
}

/**
 * Arbitrary dungeon: random directed exits, cycles, self-loops, exits to unknown
 * rooms, and (about one case in six each) a missing `entrance` or `throne_room`.
 * Always has at least one room.
 */
export const arbDungeon: fc.Arbitrary<Dungeon> = fc
  .record({
    hasEntrance: fc.oneof({ weight: 5, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }),
    hasThrone: fc.oneof({ weight: 5, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }),
    extra: fc.integer({ min: 0, max: 10 }),
    ghosts: fc.integer({ min: 0, max: 3 }),
    rot: fc.nat(),
    exitPicks: fc.array(fc.array(fc.nat(), { maxLength: 4 }), { minLength: 12, maxLength: 12 }),
    dungeon_id: arbText,
    title: arbText,
  })
  .map(({ hasEntrance, hasThrone, extra, ghosts, rot, exitPicks, dungeon_id, title }) => {
    const ids: string[] = [];
    if (hasEntrance) ids.push(ENTRANCE_ROOM_ID);
    if (hasThrone) ids.push(THRONE_ROOM_ID);
    for (let i = 0; i < extra; i++) ids.push(`room_${i}`);
    if (ids.length === 0) ids.push('room_x');
    const unknown = Array.from({ length: ghosts }, (_, i) => `ghost_${i}`);
    const rooms = buildRooms(ids, exitPicks, [...ids, ...unknown]);
    return { dungeon_id, title, rooms: rotate(rooms, rot) };
  });

/**
 * Dungeon that is solvable with no orphans: a chain entrance -> mid rooms ->
 * throne_room guarantees reachability, plus random extra exits (cycles,
 * self-loops, back edges) between existing rooms. At least 2 rooms.
 */
export const arbValidDungeon: fc.Arbitrary<Dungeon> = fc
  .record({
    mids: fc.integer({ min: 0, max: 6 }),
    rot: fc.nat(),
    extraPicks: fc.array(fc.array(fc.nat(), { maxLength: 3 }), { minLength: 8, maxLength: 8 }),
    title: arbText,
  })
  .map(({ mids, rot, extraPicks, title }) => {
    const chain = [ENTRANCE_ROOM_ID as string, ...Array.from({ length: mids }, (_, i) => `mid_${i}`), THRONE_ROOM_ID as string];
    const rooms = buildRooms(chain, extraPicks, chain);
    for (let i = 0; i < chain.length - 1; i++) {
      if (!rooms[i].exits.some((e) => e.to === chain[i + 1])) rooms[i].exits.push({ to: chain[i + 1] });
    }
    return { dungeon_id: 'dungeon', title, rooms: rotate(rooms, rot) };
  });

// ---------------------------------------------------------------------------
// Manifests
// ---------------------------------------------------------------------------

const arbCoord = fc.integer({ min: 0, max: 100 });
const arbColor = fc.constantFrom('currentColor', 'none', 'var(--surface)', 'var(--title-bg)');

// Optional styling keys are omitted (never undefined) so JSON round trip is lossless.

const arbShape: fc.Arbitrary<Shape> = fc.oneof(
  fc
    .record({ kind: fc.constant('rect' as const), x: arbCoord, y: arbCoord, width: arbCoord, height: arbCoord, fill: arbColor, stroke: arbColor }, { requiredKeys: ['kind', 'x', 'y', 'width', 'height'] })
    .map((s) => s as Shape),
  fc
    .record({ kind: fc.constant('circle' as const), cx: arbCoord, cy: arbCoord, r: arbCoord, fill: arbColor, stroke: arbColor }, { requiredKeys: ['kind', 'cx', 'cy', 'r'] })
    .map((s) => s as Shape),
  fc
    .record({ kind: fc.constant('line' as const), x1: arbCoord, y1: arbCoord, x2: arbCoord, y2: arbCoord, stroke: arbColor }, { requiredKeys: ['kind', 'x1', 'y1', 'x2', 'y2'] })
    .map((s) => s as Shape),
  fc
    .record(
      {
        kind: fc.constant('polygon' as const),
        points: fc.array(fc.tuple(arbCoord, arbCoord), { minLength: 3, maxLength: 6 }),
        fill: arbColor,
        stroke: arbColor,
      },
      { requiredKeys: ['kind', 'points'] },
    )
    .map((s) => s as Shape),
);

/**
 * Valid manifest by construction:
 * - 2..4 sections, 2..3 diagrams (each with 1..3 hotspots), 2..4 trivia questions,
 *   2..3 dungeons, all with unique ids;
 * - hotspot and trivia `section_id` values drawn from generated section ids;
 * - coordinates are integers in 0..100;
 * - every dungeon is solvable with no orphans and all exits target known rooms;
 * - all values are JSON-safe and no property is `undefined`.
 */
export const arbManifest: fc.Arbitrary<DiscManifest> = fc
  .record({
    disc_id: arbText,
    title: arbText,
    tagline: arbText,
    sectionCount: fc.integer({ min: 2, max: 4 }),
    sectionTexts: fc.array(fc.record({ title: arbText, paragraphs: fc.array(arbText, { minLength: 1, maxLength: 3 }) }), { minLength: 4, maxLength: 4 }),
    diagramCount: fc.integer({ min: 2, max: 3 }),
    diagrams: fc.array(
      fc.record({
        title: arbText,
        shapes: fc.array(arbShape, { maxLength: 4 }),
        hotspots: fc.array(fc.record({ label: arbText, x: arbCoord, y: arbCoord, sectionPick: fc.nat() }), { minLength: 1, maxLength: 3 }),
      }),
      { minLength: 3, maxLength: 3 },
    ),
    triviaCount: fc.integer({ min: 2, max: 4 }),
    trivia: fc.array(
      fc.record({
        prompt: arbText,
        options: fc.array(arbText, { minLength: 2, maxLength: 5 }),
        correctPick: fc.nat(),
        sectionPick: fc.nat(),
      }),
      { minLength: 4, maxLength: 4 },
    ),
    dungeonCount: fc.integer({ min: 2, max: 3 }),
    dungeons: fc.array(arbValidDungeon, { minLength: 3, maxLength: 3 }),
  })
  .map((g) => {
    const sections: Section[] = g.sectionTexts.slice(0, g.sectionCount).map((s, i) => ({
      section_id: `section_${i}`,
      title: s.title,
      paragraphs: s.paragraphs,
    }));
    const sid = (pick: number) => sections[pick % sections.length].section_id;
    const diagrams: Diagram[] = g.diagrams.slice(0, g.diagramCount).map((d, i) => ({
      diagram_id: `diagram_${i}`,
      title: d.title,
      viewBox: '0 0 100 100',
      shapes: d.shapes,
      hotspots: d.hotspots.map((h) => ({ label: h.label, x: h.x, y: h.y, section_id: sid(h.sectionPick) })),
    }));
    const trivia: TriviaQuestion[] = g.trivia.slice(0, g.triviaCount).map((q, i) => ({
      question_id: `question_${i}`,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correctPick % q.options.length,
      section_id: sid(q.sectionPick),
    }));
    const dungeons: Dungeon[] = g.dungeons.slice(0, g.dungeonCount).map((d, i) => ({ ...d, dungeon_id: `dungeon_${i}` }));
    return { disc_id: g.disc_id, title: g.title, tagline: g.tagline, sections, diagrams, trivia, dungeons };
  });

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

export type PathSegment = string | number;

export interface Mutation {
  /** Deep-copied, mutated manifest typed loosely because it may now be invalid. */
  manifest: unknown;
  /** Location of the modified field. */
  segments: PathSegment[];
  /** Dotted form of `segments`, e.g. `sections[0].title`. */
  path: string;
}

export function formatPath(segments: PathSegment[]): string {
  let out = '';
  for (const s of segments) {
    out += typeof s === 'number' ? `[${s}]` : out === '' ? s : `.${s}`;
  }
  return out;
}

function clone(m: DiscManifest): DiscManifest {
  return JSON.parse(JSON.stringify(m)) as DiscManifest;
}

function at(m: unknown, segments: PathSegment[]): any {
  let cur: any = m;
  for (const s of segments) cur = cur[s];
  return cur;
}

function mutation(manifest: unknown, segments: PathSegment[]): Mutation {
  return { manifest, segments, path: formatPath(segments) };
}

const OPTIONAL_KEYS = new Set(['fill', 'stroke']);

/** All required-field locations (object keys, excluding optional styling keys). */
export function requiredFieldPaths(m: unknown): PathSegment[][] {
  const out: PathSegment[][] = [];
  const walk = (node: unknown, prefix: PathSegment[]) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => {
        if (child !== null && typeof child === 'object') walk(child, [...prefix, i]);
      });
    } else if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (OPTIONAL_KEYS.has(k)) continue;
        out.push([...prefix, k]);
        walk(v, [...prefix, k]);
      }
    }
  };
  walk(m, []);
  return out;
}

/** Delete one required field. */
export function deleteField(m: DiscManifest, pick: number): Mutation {
  const copy = clone(m);
  const paths = requiredFieldPaths(copy);
  const target = paths[pick % paths.length];
  delete at(copy, target.slice(0, -1))[target[target.length - 1]];
  return mutation(copy, target);
}

/** Replace one required field with a value of a different JSON type. */
export function retypeField(m: DiscManifest, pick: number): Mutation {
  const copy = clone(m);
  const paths = requiredFieldPaths(copy);
  const target = paths[pick % paths.length];
  const parent = at(copy, target.slice(0, -1));
  const key = target[target.length - 1];
  parent[key] = typeof parent[key] === 'string' ? 12345 : 'wrong-type';
  return mutation(copy, target);
}

export type IdScope = 'sections' | 'diagrams' | 'trivia' | 'dungeons' | 'rooms';
export const ID_SCOPES: IdScope[] = ['sections', 'diagrams', 'trivia', 'dungeons', 'rooms'];

const ID_KEY: Record<IdScope, string> = {
  sections: 'section_id',
  diagrams: 'diagram_id',
  trivia: 'question_id',
  dungeons: 'dungeon_id',
  rooms: 'room_id',
};

/**
 * Give item B the identifier of item A within one scope. `rooms` uses the dungeon
 * chosen by `pick`. The mutation path is that of the modified (second) id.
 */
export function duplicateId(m: DiscManifest, scope: IdScope, pick: number): Mutation {
  const copy = clone(m);
  let listPath: PathSegment[];
  if (scope === 'rooms') {
    const d = pick % copy.dungeons.length;
    listPath = ['dungeons', d, 'rooms'];
  } else {
    listPath = [scope];
  }
  const list = at(copy, listPath) as any[];
  const a = pick % list.length;
  const b = (a + 1 + (Math.floor(pick / list.length) % (list.length - 1))) % list.length;
  const key = ID_KEY[scope];
  list[b][key] = list[a][key];
  return mutation(copy, [...listPath, b, key]);
}

/** Set a hotspot `x` or `y` to an arbitrary (usually out-of-range) number. */
export function setHotspotCoordinate(m: DiscManifest, pick: number, axis: 'x' | 'y', value: number): Mutation {
  const copy = clone(m);
  const all: [number, number][] = [];
  copy.diagrams.forEach((d, i) => d.hotspots.forEach((_, j) => all.push([i, j])));
  const [i, j] = all[pick % all.length];
  // NaN and Infinity are not JSON-safe, so assign after cloning.
  copy.diagrams[i].hotspots[j][axis] = value;
  return mutation(copy, ['diagrams', i, 'hotspots', j, axis]);
}

export type RefKind = 'hotspot' | 'trivia' | 'exit';
export const REF_KINDS: RefKind[] = ['hotspot', 'trivia', 'exit'];
export const DANGLING_ID = 'does_not_exist';

/** Repoint a hotspot/trivia `section_id` or an exit `to` at an id that does not exist. */
export function repointReference(m: DiscManifest, kind: RefKind, pick: number): Mutation {
  const copy = clone(m);
  if (kind === 'hotspot') {
    const all: [number, number][] = [];
    copy.diagrams.forEach((d, i) => d.hotspots.forEach((_, j) => all.push([i, j])));
    const [i, j] = all[pick % all.length];
    copy.diagrams[i].hotspots[j].section_id = DANGLING_ID;
    return mutation(copy, ['diagrams', i, 'hotspots', j, 'section_id']);
  }
  if (kind === 'trivia') {
    const i = pick % copy.trivia.length;
    copy.trivia[i].section_id = DANGLING_ID;
    return mutation(copy, ['trivia', i, 'section_id']);
  }
  const all: [number, number, number][] = [];
  copy.dungeons.forEach((d, i) => d.rooms.forEach((r, j) => r.exits.forEach((_, k) => all.push([i, j, k]))));
  const [i, j, k] = all[pick % all.length];
  copy.dungeons[i].rooms[j].exits[k].to = DANGLING_ID;
  return mutation(copy, ['dungeons', i, 'rooms', j, 'exits', k, 'to']);
}

/** Set a trivia question's `correct_index` to `value` (typically negative or >= options.length). */
export function setCorrectIndex(m: DiscManifest, pick: number, value: number): Mutation {
  const copy = clone(m);
  const i = pick % copy.trivia.length;
  copy.trivia[i].correct_index = value;
  return mutation(copy, ['trivia', i, 'correct_index']);
}

/**
 * Remove `entrance` or `throne_room` from one dungeon. Exits that pointed at the
 * removed room are dropped too, so the only defect is the missing reserved room.
 */
export function removeReservedRoom(m: DiscManifest, which: 'entrance' | 'throne_room', pick: number): Mutation & { dungeonIndex: number } {
  const copy = clone(m);
  const d = pick % copy.dungeons.length;
  const dungeon = copy.dungeons[d];
  dungeon.rooms = dungeon.rooms.filter((r) => r.room_id !== which);
  for (const r of dungeon.rooms) r.exits = r.exits.filter((e) => e.to !== which);
  return { ...mutation(copy, ['dungeons', d, 'rooms']), dungeonIndex: d };
}

/**
 * Cut every path into the throne room of one dungeon by removing all exits that
 * target it. The throne room stays present, so the dungeon is unsolvable (and the
 * throne room becomes an orphan).
 */
export function cutPaths(m: DiscManifest, pick: number): Mutation & { dungeonIndex: number } {
  const copy = clone(m);
  const d = pick % copy.dungeons.length;
  for (const r of copy.dungeons[d].rooms) r.exits = r.exits.filter((e) => e.to !== THRONE_ROOM_ID);
  return { ...mutation(copy, ['dungeons', d]), dungeonIndex: d };
}

/**
 * Add `count` (>= 1) rooms to one dungeon that no room links to. They may have
 * exits into the existing rooms. Returns the orphan ids. The dungeon stays solvable.
 */
export function addOrphans(m: DiscManifest, pick: number, count: number): Mutation & { dungeonIndex: number; orphanIds: string[] } {
  const copy = clone(m);
  const d = pick % copy.dungeons.length;
  const dungeon = copy.dungeons[d];
  const n = Math.max(1, count);
  const orphanIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `orphan_${i}`;
    orphanIds.push(id);
    dungeon.rooms.push({
      room_id: id,
      name: `Orphan ${i}`,
      description: 'Nobody can reach this room.',
      exits: [{ to: ENTRANCE_ROOM_ID }],
    });
  }
  return { ...mutation(copy, ['dungeons', d]), dungeonIndex: d, orphanIds };
}

// ---------------------------------------------------------------------------
// Dynamic disc compiler: source generators
// ---------------------------------------------------------------------------

/** Grapheme-cluster strings (emoji, combining marks). */
export const arbTextGrapheme: fc.Arbitrary<string> = fc.string({ unit: 'grapheme', maxLength: 40 });

/** Full Unicode strings including odd code points and lone surrogates. */
export const arbTextBinary: fc.Arbitrary<string> = fc.string({ unit: 'binary', maxLength: 40 });

const HTML_PIECES = [
  '<b>',
  '</b>',
  '<div class="x">',
  '<scr<script>ipt>',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<!-- c -->',
  '&amp;',
  '&lt;',
  '&#60;',
  '&#x3C;',
  '&nbsp;',
  '<a href="javascript:void(0)">',
  'text',
  ' ',
];

/** HTML-like fragments: tags, nested script tags, entities, comments. */
export const arbTextHtml: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...HTML_PIECES), { minLength: 1, maxLength: 8 })
  .map((parts) => parts.join(''));

const MARKDOWN_PIECES = [
  '# Heading',
  '## Sub heading',
  '[link](http://example.com)',
  '![img](http://img.example/p.png)',
  '```\ncode\n```',
  '**bold**',
  '_em_',
  '`code`',
  '- item',
  '1. item',
  '> quote',
  '| a | b |',
  'plain',
];

/** Markdown-like fragments: links, images, fences, headings. */
export const arbTextMarkdown: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...MARKDOWN_PIECES), { minLength: 1, maxLength: 6 })
  .map((parts) => parts.join('\n'));

/** Runs of spaces, tabs, newlines, and Unicode spaces, optionally around a word. */
export const arbTextWhitespace: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r\n', '\u00a0', '\u2003', '\u3000'), { minLength: 1, maxLength: 30 })
  .chain((ws) => fc.constantFrom('', 'word').map((w) => ws.join('') + w + ws.join('')));

/** Strings of control characters (C0, DEL, C1) and bidi/zero-width marks. */
export const arbTextControl: fc.Arbitrary<string> = fc
  .array(fc.constantFrom('\u0000', '\u0007', '\u001b', '\u007f', '\u0085', '\u009f', '\u200b', '\u202e', '\u2066', '\ufeff'), {
    minLength: 1,
    maxLength: 12,
  })
  .map((parts) => parts.join(''));

/** A 5000-character string. */
export const arbTextLong: fc.Arbitrary<string> = fc.constantFrom('abc ', 'word\n', 'x').map((s) => s.repeat(Math.ceil(5000 / s.length)).slice(0, 5000));

/** Union of all text variants, plus ordinary and empty strings. */
export const arbTextVariant: fc.Arbitrary<string> = fc.oneof(
  { weight: 4, arbitrary: fc.string({ maxLength: 40 }) },
  { weight: 1, arbitrary: fc.constant('') },
  { weight: 1, arbitrary: arbTextGrapheme },
  { weight: 1, arbitrary: arbTextBinary },
  { weight: 2, arbitrary: arbTextHtml },
  { weight: 2, arbitrary: arbTextMarkdown },
  { weight: 1, arbitrary: arbTextWhitespace },
  { weight: 1, arbitrary: arbTextControl },
  { weight: 1, arbitrary: arbTextLong },
);

const HEADING_POOL = ['Overview', 'Usage', 'Install', 'License'];

const arbHeading: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom(...HEADING_POOL) },
  { weight: 2, arbitrary: arbTextVariant },
);

const arbKind = fc.constantFrom('github' as const, 'webpage' as const, 'markdown' as const, 'topic' as const);

const arbSourceLabel: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('https://github.com/o/r', 'https://example.com/page', 'Topic: Lighthouses', 'Pasted Markdown', ''),
  arbTextVariant,
);

/** Build a source record, omitting optional metadata fields instead of setting undefined. */
function buildSource(
  kind: 'github' | 'webpage' | 'markdown' | 'topic',
  title: string,
  headings: string[],
  paragraphs: string[],
  source: string,
  opt: { description?: string; languages?: string[]; author?: string; facts?: string[] },
): ExtractedSource {
  const metadata: ExtractedSource['metadata'] = { kind, source };
  if (opt.description !== undefined) metadata.description = opt.description;
  if (opt.languages !== undefined) metadata.languages = opt.languages;
  if (opt.author !== undefined) metadata.author = opt.author;
  if (opt.facts !== undefined) metadata.facts = opt.facts;
  return { title, headings, paragraphs, metadata };
}

const optionalKeys = { requiredKeys: [] as never[] };

/**
 * Arbitrary extracted source: all four kinds, empty strings and lists, duplicate
 * headings from a small pool, very long strings, and optional description,
 * languages, author, and facts (omitted rather than undefined).
 */
const arbGeneratedSource: fc.Arbitrary<ExtractedSource> = fc
  .record({
    kind: arbKind,
    title: arbTextVariant,
    headings: fc.array(arbHeading, { maxLength: 20 }),
    paragraphs: fc.array(arbTextVariant, { maxLength: 30 }),
    source: arbSourceLabel,
    opt: fc.record(
      {
        description: arbTextVariant,
        languages: fc.array(arbTextVariant, { maxLength: 5 }),
        author: arbTextVariant,
        facts: fc.array(arbTextVariant, { maxLength: 6 }),
      },
      optionalKeys,
    ),
  })
  .map((g) => buildSource(g.kind, g.title, g.headings, g.paragraphs, g.source, g.opt));

/** Fully empty source: empty title, headings, and paragraphs; metadata kept valid. */
const arbEmptySource: fc.Arbitrary<ExtractedSource> = fc
  .record({ kind: arbKind, source: arbSourceLabel })
  .map((g) => buildSource(g.kind, '', [], [], g.source, {}));

export const arbExtractedSource: fc.Arbitrary<ExtractedSource> = fc.oneof(
  { weight: 1, arbitrary: arbEmptySource },
  { weight: 9, arbitrary: arbGeneratedSource },
);

/** Thin sources: 0 to 4 headings, 0 to 2 paragraphs, mostly empty strings. */
export const arbThinSource: fc.Arbitrary<ExtractedSource> = fc
  .record({
    kind: arbKind,
    title: fc.constantFrom('', 'T'),
    headings: fc.array(fc.constantFrom('', 'Overview', 'Usage'), { maxLength: 4 }),
    paragraphs: fc.array(fc.constantFrom('', 'Short.'), { maxLength: 2 }),
    source: fc.constantFrom('', 'Topic: x', 'https://github.com/o/r'),
  })
  .map((g) => buildSource(g.kind, g.title, g.headings, g.paragraphs, g.source, {}));

const HOSTILE_FRAGMENTS = [
  '<script>alert(1)</script>',
  'javascript:',
  'onerror=',
  '![x](http://img.example/p.png)',
  '[label](http://link.example)',
  '\u0000\u0007\u001b\u007f\u009f',
];

/** Wraps arbitrary text with at least one hostile fragment, so every string carries one. */
const arbHostileString: fc.Arbitrary<string> = fc
  .record({
    pre: fc.string({ maxLength: 10 }),
    frag: fc.constantFrom(...HOSTILE_FRAGMENTS),
    post: fc.string({ maxLength: 10 }),
    extra: fc.constantFrom(...HOSTILE_FRAGMENTS),
  })
  .map((g) => `${g.pre}${g.frag}${g.post}${g.extra}`);

/** Sources whose every string (title, headings, paragraphs, metadata) contains hostile content. */
export const arbHostileSource: fc.Arbitrary<ExtractedSource> = fc
  .record({
    kind: arbKind,
    title: arbHostileString,
    headings: fc.array(arbHostileString, { maxLength: 12 }),
    paragraphs: fc.array(arbHostileString, { maxLength: 15 }),
    source: arbHostileString,
    opt: fc.record(
      {
        description: arbHostileString,
        languages: fc.array(arbHostileString, { maxLength: 4 }),
        author: arbHostileString,
        facts: fc.array(arbHostileString, { maxLength: 4 }),
      },
      optionalKeys,
    ),
  })
  .map((g) => buildSource(g.kind, g.title, g.headings, g.paragraphs, g.source, g.opt));

const MD_BLOCKS = [
  '```\nfenced code\n```',
  '<div>\nhtml block\n</div>',
  '- list item\n- another',
  '1. first\n2. second',
  '| a | b |\n|---|---|\n| 1 | 2 |',
  '![alt](http://img.example/p.png)',
  'A plain paragraph of prose about the subject.',
  'Another paragraph with [a link](http://example.com) inside.',
  '',
];

/** Markdown documents with fences, HTML blocks, lists, tables, and headings of levels 1 to 6. */
export const arbMarkdown: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      fc.tuple(fc.integer({ min: 1, max: 6 }), fc.string({ maxLength: 20 })).map(([n, t]) => `${'#'.repeat(n)} ${t}`),
      fc.constantFrom(...MD_BLOCKS),
    ),
    { maxLength: 15 },
  )
  .map((blocks) => blocks.join('\n\n'));

/** Single-line topic strings. */
export const arbTopic: fc.Arbitrary<string> = fc
  .oneof(
    fc.string({ maxLength: 60 }),
    fc.constantFrom('Lighthouses', 'Rust: a language', 'C++', 'C#', 'The History of Tea'),
    arbTextGrapheme,
    arbTextHtml,
  )
  .map((s) => s.replace(/[\r\n\u2028\u2029]+/g, ' '));
