/**
 * Search and discovery across every mounted disc: the Pinpointer, the "Did You Know?" spotlight,
 * and "Surprise Me!". Pure functions over DiscManifest data. No React and no DOM.
 */
import type { DiscManifest } from './manifest';

export interface SectionRef {
  discId: string;
  discTitle: string;
  sectionId: string;
  sectionTitle: string;
}

export const MIN_QUERY_CHARS = 2;
export const MAX_HITS = 8;
const MAX_FACT_CHARS = 180;

/** Splits a query into lowercase words. Fewer than MIN_QUERY_CHARS characters gives no words. */
function queryWords(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_CHARS) return [];
  return q.split(/\s+/).filter((w) => w !== '');
}

/**
 * Sections whose title, facts, or text contain every word of `query`, best matches first:
 * all words in the title, then some word in the title, then facts, then body text. Ties keep
 * the order of the discs and sections. At most `limit` results.
 */
export function searchSections(discs: readonly DiscManifest[], query: string, limit = MAX_HITS): SectionRef[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  const ranked: { rank: number; order: number; ref: SectionRef }[] = [];
  let order = 0;
  for (const disc of discs) {
    for (const section of disc.sections) {
      const title = section.title.toLowerCase();
      const facts = (section.facts ?? []).join(' ').toLowerCase();
      const body = section.paragraphs.join(' ').toLowerCase();
      const all = `${title} ${facts} ${body}`;
      order++;
      if (!words.every((w) => all.includes(w))) continue;
      const rank = words.every((w) => title.includes(w))
        ? 0
        : words.some((w) => title.includes(w))
          ? 1
          : words.every((w) => facts.includes(w))
            ? 2
            : 3;
      ranked.push({
        rank,
        order,
        ref: {
          discId: disc.disc_id,
          discTitle: disc.title,
          sectionId: section.section_id,
          sectionTitle: section.title,
        },
      });
    }
  }
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.slice(0, limit).map((r) => r.ref);
}

export interface Fact extends SectionRef {
  text: string;
}

function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(t);
  const s = m ? m[0] : t;
  return s.length > MAX_FACT_CHARS ? `${s.slice(0, MAX_FACT_CHARS - 3).trimEnd()}...` : s;
}

/**
 * Real facts from the mounted discs, each with its disc and section. A section's own Quick Facts
 * are used when it has them, otherwise the first sentence of its first paragraph. Facts are
 * interleaved across discs, so "Next Fact" moves from disc to disc instead of exhausting one.
 */
export function collectFacts(discs: readonly DiscManifest[]): Fact[] {
  const perDisc: Fact[][] = discs.map((disc) => {
    const out: Fact[] = [];
    for (const section of disc.sections) {
      const ref: SectionRef = {
        discId: disc.disc_id,
        discTitle: disc.title,
        sectionId: section.section_id,
        sectionTitle: section.title,
      };
      const own = (section.facts ?? []).map((f) => f.trim()).filter((f) => f !== '');
      if (own.length > 0) {
        for (const f of own) out.push({ ...ref, text: f });
      } else {
        const lead = firstSentence(section.paragraphs[0] ?? '');
        if (lead !== '') out.push({ ...ref, text: lead });
      }
    }
    return out;
  });
  const result: Fact[] = [];
  for (let i = 0; perDisc.some((list) => i < list.length); i++) {
    for (const list of perDisc) if (i < list.length) result.push(list[i]!);
  }
  return result;
}

/** A section chosen from all discs, uniformly, using `rng` (a [0, 1) generator). Null when there are none. */
export function pickRandomSection(discs: readonly DiscManifest[], rng: () => number): SectionRef | null {
  const all: SectionRef[] = [];
  for (const disc of discs) {
    for (const section of disc.sections) {
      all.push({
        discId: disc.disc_id,
        discTitle: disc.title,
        sectionId: section.section_id,
        sectionTitle: section.title,
      });
    }
  }
  if (all.length === 0) return null;
  const r = rng();
  const i = Math.min(all.length - 1, Math.max(0, Math.floor(Number.isFinite(r) ? r * all.length : 0)));
  return all[i]!;
}
