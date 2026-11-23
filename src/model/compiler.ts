/**
 * Disc compiler: turns an ExtractedSource into a DiscManifest.
 *
 * Pure and deterministic. No I/O, no clock, no unseeded randomness. Every random-looking
 * choice comes from a seeded PRNG, with one independent stream per stage.
 * Imports only source.ts, manifest.ts, and compile/*.
 */
import type { DiscManifest } from './manifest';
import type { ExtractedSource, SourceKind, SourceMetadata } from './source';
import { buildDiagram, ALLOWED_TOKENS as DIAGRAM_TOKENS } from './compile/diagram';
import { buildDungeon } from './compile/dungeon';
import { createIdAllocator, discId } from './compile/ids';
import { MAX_CAPTION, MAX_MEDIA, pickMedia } from './media';
import { fnv1a32, stream } from './compile/prng';
import { planSections } from './compile/sections';
import { sanitizeLine, sanitizeParagraph } from './compile/text';
import { buildTrivia } from './compile/trivia';

export type { ExtractedSource, SourceKind, SourceMetadata } from './source';
export { sanitizeLine, sanitizeParagraph } from './compile/text';

/** The `--color-*` names the compiler may emit in diagram shapes. */
export const ALLOWED_TOKENS: readonly string[] = DIAGRAM_TOKENS;

const MAX_HEADING_INPUT = 200;
const MAX_PARAGRAPH_INPUT = 400;
const MAX_LIST_INPUT = 50;
const TITLE_MAX = 120;
const HEADING_MAX = 120;
const SOURCE_LABEL_MAX = 300;

const KINDS: readonly SourceKind[] = ['github', 'webpage', 'markdown', 'topic', 'stitched'];

function stringItems(v: unknown, limit: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (let i = 0; i < v.length && out.length < limit; i++) {
    const item: unknown = v[i];
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

function cleanList(v: unknown, max: number, limit: number): string[] {
  return stringItems(v, limit)
    .map((s) => sanitizeLine(s, max))
    .filter((s) => s !== '');
}

/**
 * Coerces any runtime value into a clean ExtractedSource: non-arrays and
 * non-strings are dropped, text is sanitized and truncated, empties are
 * removed, and headings are deduplicated (case-insensitive).
 */
export function normalizeSource(input: unknown): ExtractedSource {
  const obj: Record<string, unknown> =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const rawMeta: Record<string, unknown> =
    typeof obj.metadata === 'object' && obj.metadata !== null
      ? (obj.metadata as Record<string, unknown>)
      : {};

  const kind: SourceKind = KINDS.includes(rawMeta.kind as SourceKind) ? (rawMeta.kind as SourceKind) : 'topic';
  const metadata: SourceMetadata = {
    kind,
    source: typeof rawMeta.source === 'string' ? sanitizeLine(rawMeta.source, SOURCE_LABEL_MAX) : '',
  };
  if (typeof rawMeta.description === 'string') {
    const d = sanitizeLine(rawMeta.description, 140);
    if (d !== '') metadata.description = d;
  }
  const languages = cleanList(rawMeta.languages, 40, MAX_LIST_INPUT);
  if (languages.length > 0) metadata.languages = languages;
  if (typeof rawMeta.author === 'string') {
    const a = sanitizeLine(rawMeta.author, 80);
    if (a !== '') metadata.author = a;
  }
  const facts = cleanList(rawMeta.facts, 140, MAX_LIST_INPUT);
  if (facts.length > 0) metadata.facts = facts;

  const seen = new Set<string>();
  const headings: string[] = [];
  for (const h of stringItems(obj.headings, MAX_HEADING_INPUT)) {
    const t = sanitizeLine(h, HEADING_MAX);
    const key = t.toLowerCase();
    if (t === '' || seen.has(key)) continue;
    seen.add(key);
    headings.push(t);
  }

  const paragraphs = stringItems(obj.paragraphs, MAX_PARAGRAPH_INPUT)
    .map((p) => sanitizeParagraph(p))
    .filter((p) => p !== '');

  const media = pickMedia(obj.media, (c) => sanitizeLine(c, MAX_CAPTION), MAX_MEDIA);

  return {
    title: typeof obj.title === 'string' ? sanitizeLine(obj.title, TITLE_MAX) : '',
    headings,
    paragraphs,
    metadata,
    ...(media.length > 0 ? { media } : {}),
  };
}

/** Canonical string hashed into the seed. Equal normalized sources give equal strings. */
function canonical(s: ExtractedSource): string {
  return [
    s.metadata.kind,
    s.metadata.source,
    s.title,
    s.headings.join('\u0002'),
    s.paragraphs.join('\u0002'),
  ].join('\u0001');
}

function identityOf(s: ExtractedSource): string {
  const src = s.metadata.source;
  // A stitched disc is named by its title and every input, so a new title or a new mix is a new disc.
  if (s.metadata.kind === 'stitched') return `${s.title} | ${src}`;
  try {
    const url = new URL(src);
    if (s.metadata.kind === 'github') {
      return url.pathname.replace(/^\/+/, '').replace(/\/+$/, '') || src;
    }
    if (s.metadata.kind === 'webpage') return url.host + url.pathname;
  } catch {
    return src || s.title;
  }
  return s.metadata.kind === 'markdown' || s.metadata.kind === 'topic' ? s.title || src : src;
}

/** Compiles source content into a DiscManifest. Total: never throws on any input. */
export function compileDisc(source: ExtractedSource): DiscManifest {
  const src = normalizeSource(source);
  const seed = fnv1a32(canonical(src));
  const ids = createIdAllocator();

  const planned = planSections(src, undefined, ids);
  const diagram = buildDiagram(planned.sections, planned.title, stream(seed, 'diagram'), src.metadata.kind);
  const trivia = buildTrivia(planned.sections, seed, stream(seed, 'trivia'), ids);
  const dungeon = buildDungeon(planned.sections, planned.title, stream(seed, 'dungeon'), ids);

  // Pictures never change the seed, so discs without media compile exactly as before.
  const media = (src.media ?? []).map((m, i) => ({
    url: m.url,
    caption: m.caption !== '' ? m.caption : sanitizeLine(`${planned.title}, picture ${i + 1}`, MAX_CAPTION),
  }));

  return {
    disc_id: discId(src.metadata.kind, identityOf(src)),
    title: planned.title,
    tagline: planned.tagline,
    sections: planned.sections,
    diagrams: [diagram],
    trivia,
    dungeons: [dungeon],
    ...(media.length > 0 ? { media } : {}),
  };
}
