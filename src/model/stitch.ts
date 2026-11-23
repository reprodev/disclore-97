/**
 * Multi-Source CD-R Stitcher: combines 2 to 4 extracted sources (any mix of topics, GitHub
 * repositories, web pages, and Markdown) into one ExtractedSource of kind `stitched`, so the
 * ordinary compiler turns it into a single disc.
 *
 * Pure and deterministic: no React, no DOM, no network, no clock, no randomness. The same inputs,
 * in the same order, always give the same stitched source and so the same disc.
 *
 * Layout. The compiler splits the paragraph list evenly across the section headings, in order. So
 * every heading here owns exactly `k` paragraphs, the same `k` for all of them, and each source's
 * articles keep their own text. Each source becomes a block of articles that starts with an article
 * named after the source. A closing "Connections" article names every article of every source, which
 * the article viewer turns into cross-links between the sources.
 */
import { normalizeSource, sanitizeLine, sanitizeParagraph } from './compiler';
import type { MediaItem } from './manifest';
import { KIND_LABELS } from './compile/sections';
import { MAX_CAPTION, MAX_MEDIA, pickMedia } from './media';
import type { ExtractedSource, SourceKind } from './source';

/** A stitched disc combines at least this many sources, and at most MAX_STITCH. */
export const MIN_STITCH = 2;
export const MAX_STITCH = 4;

/** The compiler keeps at most 12 sections and pads to at least 5. */
const MAX_SECTIONS = 12;
const MIN_SECTIONS = 5;
/** Paragraphs per article: at most 3, so even the first article stays under its 7-paragraph cap. */
const MAX_PER_ARTICLE = 3;
/** A merged paragraph stops growing here, under the compiler's 1200-character paragraph limit. */
const MERGE_LIMIT = 1100;
const TITLE_MAX = 80;
const NAME_MAX = 60;
const HEADING_MAX = 120;
const LABEL_PART_MAX = 70;
const LABEL_MAX = 300;
const MAX_FACTS = 4;

/** Titles for the closing articles. Only the first is used unless the disc needs padding to 5 articles. */
const HUB_TITLES = ['Connections', 'Sources on This Disc', 'Comparing the Sources'];

interface Block {
  name: string;
  kind: SourceKind;
  label: string;
  /** This source's article titles: its own name first. */
  headings: string[];
  paragraphs: string[];
  facts: string[];
  media: MediaItem[];
}

/** "A", "A and B", "A, B, and C". */
function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Splits `items` into `parts` runs in order, as evenly as possible (earlier runs are never longer). */
function splitEvenly<T>(items: readonly T[], parts: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < parts; i++) {
    out.push(items.slice(Math.floor((i * items.length) / parts), Math.floor(((i + 1) * items.length) / parts)));
  }
  return out;
}

/**
 * Exactly `k` paragraphs from a run of at least `k`: the first k-1 as they are, and the rest joined
 * into the last one, whole paragraphs only, while it stays under MERGE_LIMIT.
 */
function fitTo(run: readonly string[], k: number): string[] {
  const head = run.slice(0, k - 1);
  let last = run[k - 1] ?? '';
  for (const p of run.slice(k)) {
    if (last.length + 1 + p.length > MERGE_LIMIT) break;
    last = `${last} ${p}`;
  }
  return [...head, last];
}

/** A short, readable name for a source: its title, else its label, else "Source N". */
function nameOf(src: ExtractedSource, index: number): string {
  const label = src.metadata.source.replace(/^Topic:\s*/i, '').replace(/\s*\(offline study outline\)$/i, '');
  return sanitizeLine(src.title, NAME_MAX) || sanitizeLine(label, NAME_MAX) || `Source ${index + 1}`;
}

/** The source label as it appears in the stitched label: no scheme, no trailing slash, capped. */
function labelPart(src: ExtractedSource, name: string): string {
  const raw = src.metadata.source.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return sanitizeLine(raw, LABEL_PART_MAX) || name;
}

/**
 * Stitches 2 to 4 sources into one. Inputs past the fourth are ignored. Every input is normalized
 * first, so this accepts untrusted values. `compileDisc(stitchSources(...))` always gives a disc that
 * passes the validator, with its own sections for each source, a Connections article that links
 * them, and at most 8 safe, unique pictures drawn in turn from each source.
 */
export function stitchSources(sources: readonly ExtractedSource[], customTitle?: string): ExtractedSource {
  const inputs = (Array.isArray(sources) ? sources : []).slice(0, MAX_STITCH).map((s) => normalizeSource(s));
  const n = inputs.length;

  // ---- One block of articles per source -------------------------------------------------------
  const hubCountMax = HUB_TITLES.length;
  const perSource = n > 0 ? Math.max(1, Math.floor((MAX_SECTIONS - 1) / n)) : 0;
  const used = new Set<string>(HUB_TITLES.map((t) => t.toLowerCase()));
  const take = (title: string): string | null => {
    const t = sanitizeLine(title, HEADING_MAX);
    const key = t.toLowerCase();
    if (t === '' || used.has(key)) return null;
    used.add(key);
    return t;
  };

  const blocks: Block[] = inputs.map((src, i) => {
    const name = nameOf(src, i);
    const kind = src.metadata.kind;
    const label = labelPart(src, name);
    const paragraphs = src.paragraphs.length > 0
      ? src.paragraphs
      : [
          sanitizeParagraph(
            `"${name}" is one of the sources stitched into this disc. Little of its text could be read, so this article is a short placeholder. Source (${KIND_LABELS[kind]}): ${label}.`,
          ),
        ];
    // At most one article per paragraph, so every article has text of its own.
    const want = Math.max(1, Math.min(perSource, paragraphs.length));
    const headings: string[] = [];
    const add = (raw: string) => {
      if (headings.length >= want) return;
      const t = take(raw) ?? take(`${name}: ${raw}`);
      if (t !== null) headings.push(t);
    };
    add(name);
    if (headings.length === 0) add(`Source ${i + 1}: ${name}`);
    for (const h of src.headings) add(h);
    for (let part = 2; headings.length < want && part <= want + 8; part++) add(`${name}: Part ${part}`);
    const facts = [...(src.metadata.facts ?? [])];
    if (src.metadata.description) facts.unshift(src.metadata.description);
    return { name, kind, label, headings, paragraphs, facts, media: src.media ?? [] };
  });

  // ---- The closing articles, and the paragraph count per article -------------------------------
  const sourceArticles = blocks.reduce((sum, b) => sum + b.headings.length, 0);
  const hubCount = Math.min(hubCountMax, Math.max(1, MIN_SECTIONS - sourceArticles));
  const k = blocks.length > 0
    ? Math.max(1, Math.min(MAX_PER_ARTICLE, ...blocks.map((b) => Math.floor(b.paragraphs.length / b.headings.length))))
    : 1;

  const headings: string[] = [];
  const paragraphs: string[] = [];
  for (const b of blocks) {
    splitEvenly(b.paragraphs, b.headings.length).forEach((run, j) => {
      headings.push(b.headings[j]!);
      paragraphs.push(...fitTo(run, k));
    });
  }

  // Connections: one paragraph per source naming its articles (which become cross-links), then a summary.
  const names = blocks.map((b) => b.name);
  const pool = [
    ...blocks.map((b) => {
      const others = b.headings.slice(1);
      const covers = others.length > 0 ? ` Its articles here are ${listJoin([b.headings[0]!, ...others])}.` : '';
      return sanitizeParagraph(`${b.headings[0]} comes from ${KIND_LABELS[b.kind].toLowerCase()} content (${b.label}).${covers}`);
    }),
    sanitizeParagraph(
      n > 0
        ? `This disc stitches together ${n} ${n === 1 ? 'source' : 'sources'}: ${listJoin(names)}. Follow the links in each article to move between them, and use the diagram, the timeline, and KeepMaze to see how they fit together.`
        : 'This disc was stitched from no readable sources.',
    ),
  ];
  const hubTitles = HUB_TITLES.slice(0, hubCount);
  splitEvenly(pool, hubTitles.length).forEach((run, j) => {
    headings.push(hubTitles[j]!);
    // The pool always has at least k paragraphs per closing article (see the tests), but stay safe.
    const filled = run.length >= k ? run : [...run, ...Array.from({ length: k - run.length }, () => pool[pool.length - 1]!)];
    paragraphs.push(...fitTo(filled, k));
  });

  // ---- Title, label, facts, pictures ------------------------------------------------------------
  const joined = names.join(' + ');
  const title =
    sanitizeLine(customTitle ?? '', TITLE_MAX) ||
    (joined.length <= TITLE_MAX ? joined : sanitizeLine(`${names[0] ?? 'Stitched Disc'} + ${n - 1} more`, TITLE_MAX)) ||
    'Stitched Disc';
  const source = sanitizeLine(`Stitched: ${blocks.map((b) => b.label).join(' + ')}`, LABEL_MAX) || 'Stitched';

  const facts: string[] = [`Stitched from ${n} ${n === 1 ? 'source' : 'sources'}`];
  for (const b of blocks) {
    const f = b.facts[0];
    if (f && facts.length < MAX_FACTS && !facts.includes(f)) facts.push(f);
  }

  // Pictures in turn from each source, so each source is seen before any source's second picture.
  const queues = blocks.map((b) => [...b.media]);
  const interleaved: MediaItem[] = [];
  while (queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) interleaved.push(next);
    }
  }
  const media = pickMedia(interleaved, (c) => sanitizeLine(c, MAX_CAPTION), MAX_MEDIA);

  return {
    title,
    headings,
    paragraphs,
    metadata: {
      kind: 'stitched',
      source,
      description: sanitizeLine(`A stitched CD-R of ${n} ${n === 1 ? 'source' : 'sources'}: ${listJoin(names)}.`, 140),
      facts,
    },
    ...(media.length > 0 ? { media } : {}),
  };
}
