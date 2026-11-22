/**
 * Take a Tour: a guided walk through a disc, one stop per article, in order.
 * Pure and deterministic. No React, no DOM, no fetch.
 */
import type { DiscManifest, MediaItem } from './manifest';
import { firstFact } from './discSearch';

export interface TourStop {
  section_id: string;
  title: string;
  /** Plate key of the article, when it has one. */
  plate?: string;
  /** The disc picture shown for this stop (section index modulo the picture count). */
  media?: MediaItem;
  /** First Quick Fact, else the first sentence of the first paragraph, else the title (or the id). Never empty. */
  spotlightFact: string;
  /** The article's first dated event, written as "when: event". */
  timelineNote?: string;
}

/** One stop per section, in the disc's order. */
export function buildTour(disc: DiscManifest): TourStop[] {
  const media = disc.media ?? [];
  return disc.sections.map((section, i) => {
    const fact = firstFact(section).trim();
    const first = section.timeline?.find((t) => t.when.trim() !== '' || t.event.trim() !== '');
    const note = first ? [first.when.trim(), first.event.trim()].filter((p) => p !== '').join(': ') : '';
    return {
      section_id: section.section_id,
      title: section.title,
      ...(section.plate !== undefined ? { plate: section.plate } : {}),
      ...(media.length > 0 ? { media: media[i % media.length]! } : {}),
      spotlightFact: fact !== '' ? fact : section.title.trim() !== '' ? section.title.trim() : section.section_id,
      ...(note !== '' ? { timelineNote: note } : {}),
    };
  });
}
