/**
 * Section planning for the disc compiler.
 *
 * Public API:
 *
 *   planSections(source: ExtractedSource, discTitle?: string, ids?: IdAllocator): PlannedDisc
 *
 *   interface PlannedDisc { title: string; tagline: string; sections: Section[] }
 *
 * - `source` should already be normalized (sanitized, empties dropped); the
 *   function still re-sanitizes everything it emits and tolerates empty lists.
 * - `discTitle` optionally overrides the derived disc title. It is sanitized
 *   to 1..80 characters and falls back to the derived title when empty.
 * - `ids` optionally supplies a shared id allocator. Section ids come from it.
 * - Returns plain JSON values (no `undefined`): 5 to 12 sections, each with
 *   1..8 paragraphs, 1..4 facts, a reading-order timeline, and a plate key
 *   that Plate.tsx defines. Section 0 ends with the attribution paragraph
 *   `Source ({kindLabel}): {label}`. Title is 1..80 and tagline 1..140 chars.
 * - Pure and deterministic: no randomness, no clock.
 */
import type { Section, TimelineEntry } from '../manifest';
import type { ExtractedSource, SourceKind } from '../source';
import { createIdAllocator, type IdAllocator } from './ids';
import { sanitizeLine, sanitizeParagraph } from './text';

export interface PlannedDisc {
  title: string;
  tagline: string;
  sections: Section[];
}

const MAX_SECTIONS = 12;
const MIN_SECTIONS = 5;
const MAX_PARAGRAPHS = 8;
const MAX_FACTS = 4;

const TEMPLATE_POOL: readonly string[] = [
  'Overview',
  'Key Ideas',
  'Background',
  'How It Works',
  'In Practice',
  'Terms to Know',
  'Going Further',
  'Summary',
];

export const KIND_LABELS: Record<SourceKind, string> = {
  github: 'GitHub repository',
  webpage: 'Web page',
  markdown: 'Markdown text',
  topic: 'Topic',
};

/** Plate keys defined by Plate.tsx, three per source kind. */
const PLATES_BY_KIND: Record<SourceKind, readonly string[]> = {
  github: ['terminal', 'computer', 'disc'],
  webpage: ['browser', 'bbs', 'modem'],
  markdown: ['book', 'disc', 'phone'],
  topic: ['book', 'computer', 'browser'],
};

function firstSentence(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  return sanitizeLine(parts[0] ?? '', 140);
}

function kindOf(source: ExtractedSource): SourceKind {
  const k = source.metadata?.kind;
  return k === 'github' || k === 'webpage' || k === 'markdown' || k === 'topic' ? k : 'topic';
}

function listOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function planTitles(headings: string[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  const add = (raw: string): void => {
    const t = sanitizeLine(raw, 120);
    const key = t.toLowerCase();
    if (t === '' || seen.has(key) || titles.length >= MAX_SECTIONS) return;
    seen.add(key);
    titles.push(t);
  };
  for (const h of headings) add(h);
  for (const p of TEMPLATE_POOL) {
    if (titles.length >= MIN_SECTIONS) break;
    add(p);
  }
  return titles;
}

export function planSections(
  source: ExtractedSource,
  discTitle?: string,
  ids: IdAllocator = createIdAllocator(),
): PlannedDisc {
  const kind = kindOf(source);
  const kindLabel = KIND_LABELS[kind];
  const meta = source.metadata;
  const label = sanitizeLine(typeof meta?.source === 'string' ? meta.source : '', 300) || 'unknown source';

  const title =
    sanitizeLine(discTitle ?? '', 80) ||
    sanitizeLine(typeof source.title === 'string' ? source.title : '', 80) ||
    sanitizeLine(label === 'unknown source' ? '' : label, 80) ||
    'Untitled Disc';

  const titles = planTitles(listOf(source.headings));
  const paragraphs = listOf(source.paragraphs)
    .map(sanitizeParagraph)
    .filter((p) => p !== '');
  const n = titles.length;
  const total = paragraphs.length;

  const sections: Section[] = titles.map((sectionTitle, i) => {
    const start = Math.floor((i * total) / n);
    const end = Math.floor(((i + 1) * total) / n);
    const cap = i === 0 ? MAX_PARAGRAPHS - 1 : MAX_PARAGRAPHS;
    const own = paragraphs.slice(start, end).slice(0, cap);

    const facts: string[] = [];
    const addFact = (f: string): void => {
      const t = sanitizeLine(f, 140);
      if (t !== '' && !facts.includes(t) && facts.length < MAX_FACTS) facts.push(t);
    };
    if (i === 0) {
      for (const f of listOf(meta?.facts)) addFact(f);
      const langs = listOf(meta?.languages).map((l) => sanitizeLine(l, 40)).filter((l) => l !== '');
      if (langs.length > 0) addFact(`Languages: ${langs.join(', ')}`);
      const author = sanitizeLine(typeof meta?.author === 'string' ? meta.author : '', 80);
      if (author !== '') addFact(`By: ${author}`);
    }
    for (const p of own.slice(0, 3)) addFact(firstSentence(p));
    if (facts.length === 0) addFact(`Article ${i + 1} of ${n} in "${title}".`);

    const paras = own.slice();
    if (paras.length === 0) {
      paras.push(
        sanitizeParagraph(
          `This article introduces "${sectionTitle}" as part of "${title}". It was generated from ${kindLabel} content, so treat it as a starting point and check the source for details.`,
        ),
      );
    }
    if (i === 0) paras.push(sanitizeParagraph(`Source (${kindLabel}): ${label}`));

    const timeline: TimelineEntry[] = [
      { when: `Part ${i + 1} of ${n}`, event: sanitizeLine(`${sectionTitle} in ${title}`, 200) },
    ];
    if (i > 0) {
      timeline.push({ when: 'Before', event: sanitizeLine(`Previous article: ${titles[i - 1]}`, 200) });
    }
    if (i < n - 1) {
      timeline.push({ when: 'After', event: sanitizeLine(`Next article: ${titles[i + 1]}`, 200) });
    }

    const plates = PLATES_BY_KIND[kind];
    return {
      section_id: ids.section(sectionTitle),
      title: sectionTitle,
      paragraphs: paras,
      facts,
      timeline,
      plate: plates[i % plates.length],
    };
  });

  const description = sanitizeLine(typeof meta?.description === 'string' ? meta.description : '', 140);
  const tagline =
    description ||
    (paragraphs[0] ? firstSentence(paragraphs[0]) : '') ||
    sanitizeLine(`A ${kindLabel} Expansion Pack compiled from ${label}.`, 140) ||
    'A compiled Expansion Pack.';

  return { title, tagline, sections };
}
