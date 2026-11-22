/**
 * Disc-wide timeline: every dated entry from every section of one disc, ordered by date
 * and grouped by century. Pure data work. No React and no DOM.
 */
import type { DiscManifest } from './manifest';

export interface TimelineItem {
  when: string;
  event: string;
  sectionId: string;
  sectionTitle: string;
  /** First year found in `when` (negative for BC), or null when the text names no year. */
  year: number | null;
}

export interface TimelineGroup {
  label: string;
  items: TimelineItem[];
}

export const UNDATED_LABEL = 'Other dates';
export const ANCIENT_LABEL = 'Before 1 AD';

/**
 * Reads the first year out of free text such as "1100s", "Late 900s to 1000s", "After 1066",
 * "Around 2010", or "280 BC". Returns null for "Middle Ages", "Part 2 of 10", and the like.
 */
export function parseYear(when: string): number | null {
  const m = /(?<!\d)(\d{3,4})s?\b/.exec(when);
  if (!m) return null;
  const year = Number(m[1]);
  return /\b(?:BC|BCE)\b/i.test(when) ? -year : year;
}

/** The century group a year belongs to, for example 1187 gives "1100s". */
export function centuryLabel(year: number): string {
  return year < 0 ? ANCIENT_LABEL : `${Math.floor(year / 100) * 100}s`;
}

/** True when any section of the disc has at least one timeline entry. */
export function hasTimeline(disc: DiscManifest): boolean {
  return disc.sections.some((s) => (s.timeline?.length ?? 0) > 0);
}

/**
 * Gathers the timeline entries of every section. Dated entries are sorted by year (ties keep
 * the disc's own order) and grouped by century. Entries with no year follow, in disc order,
 * under "Other dates".
 */
export function collectTimeline(disc: DiscManifest): TimelineGroup[] {
  const all: TimelineItem[] = [];
  for (const section of disc.sections) {
    for (const entry of section.timeline ?? []) {
      all.push({
        when: entry.when,
        event: entry.event,
        sectionId: section.section_id,
        sectionTitle: section.title,
        year: parseYear(entry.when),
      });
    }
  }

  const dated = all
    .map((item, order) => ({ item, order }))
    .filter((x) => x.item.year !== null)
    .sort((a, b) => a.item.year! - b.item.year! || a.order - b.order)
    .map((x) => x.item);

  const groups: TimelineGroup[] = [];
  for (const item of dated) {
    const label = centuryLabel(item.year!);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const undated = all.filter((item) => item.year === null);
  if (undated.length > 0) groups.push({ label: UNDATED_LABEL, items: undated });
  return groups;
}
