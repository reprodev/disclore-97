import type { Section } from './manifest';

/** The first paragraph stands in for a summary. */
export function summaryOf(section: Section): string {
  return section.paragraphs[0] ?? '';
}

/**
 * Live "Find in Disc" filter. Every whitespace-separated term must appear,
 * case-insensitively, in the title, summary, or facts. An empty query keeps
 * every section.
 */
export function filterSections(sections: Section[], query: string): Section[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return sections;
  return sections.filter((s) => {
    const hay = [s.title, summaryOf(s), ...(s.facts ?? [])].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

const STOP = new Set([
  'the', 'and', 'for', 'that', 'with', 'from', 'this', 'were', 'was', 'are', 'had', 'has', 'have', 'its',
  'but', 'not', 'one', 'into', 'than', 'then', 'them', 'they', 'their', 'there', 'which', 'when', 'what',
  'who', 'all', 'any', 'can', 'could', 'would', 'often', 'also', 'such', 'each', 'more', 'most', 'many',
  'some', 'only', 'over', 'under', 'about', 'while', 'where', 'before', 'after', 'because', 'through',
]);

function words(section: Section): Set<string> {
  const text = [section.title, section.title, ...section.paragraphs, ...(section.facts ?? [])]
    .join(' ')
    .toLowerCase();
  const out = new Set<string>();
  for (const w of text.match(/[a-z]{4,}/g) ?? []) if (!STOP.has(w)) out.add(w);
  return out;
}

/**
 * Sections related to `sectionId`, best match first. Ranks by shared
 * significant words, then fills with neighbors in disc order so the strip is
 * never empty on a disc with more than one section. Never includes the
 * section itself.
 */
export function relatedSections(sections: Section[], sectionId: string, max = 3): Section[] {
  const idx = sections.findIndex((s) => s.section_id === sectionId);
  if (idx < 0) return [];
  const mine = words(sections[idx]!);
  const scored = sections
    .map((s, i) => {
      if (i === idx) return { s, i, score: -1 };
      let score = 0;
      for (const w of words(s)) if (mine.has(w)) score++;
      return { s, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);

  const picked: Section[] = scored.slice(0, max).map((x) => x.s);
  for (const n of [sections[idx + 1], sections[idx - 1]]) {
    if (picked.length >= Math.min(2, max)) break;
    if (n && !picked.includes(n)) picked.push(n);
  }
  return picked;
}
