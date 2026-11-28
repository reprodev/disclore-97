/**
 * Study Mastery: a pure, cross-disc summary of what has been read, mastered, and won, and where to
 * continue. The caller reads the saved progress and passes it in.
 */
import { buildFlashcards } from './flashcards';
import type { DiscManifest } from './manifest';

export interface MasteryInput {
  /** Section ids read, per disc id. */
  read: ReadonlyMap<string, readonly string[]>;
  /** Flashcard ids mastered, per disc id. */
  mastered: ReadonlyMap<string, readonly string[]>;
  /** KeepMaze victories, per disc id. */
  wins: ReadonlyMap<string, number>;
}

export interface MasterySummary {
  articlesRead: number;
  articlesTotal: number;
  cardsMastered: number;
  cardsTotal: number;
  victories: number;
  /** Discs with every article read. */
  discsCompleted: number;
}

/** Counts progress over the mounted discs only. Ids that no longer exist on a disc are ignored. */
export function masterySummary(discs: readonly DiscManifest[], input: MasteryInput): MasterySummary {
  const out: MasterySummary = { articlesRead: 0, articlesTotal: 0, cardsMastered: 0, cardsTotal: 0, victories: 0, discsCompleted: 0 };
  for (const disc of discs) {
    const sections = new Set(disc.sections.map((s) => s.section_id));
    const read = new Set((input.read.get(disc.disc_id) ?? []).filter((id) => sections.has(id)));
    const cards = new Set(buildFlashcards(disc).map((c) => c.id));
    const mastered = new Set((input.mastered.get(disc.disc_id) ?? []).filter((id) => cards.has(id)));
    const wins = input.wins.get(disc.disc_id) ?? 0;
    out.articlesRead += read.size;
    out.articlesTotal += sections.size;
    out.cardsMastered += mastered.size;
    out.cardsTotal += cards.size;
    out.victories += Number.isInteger(wins) && wins > 0 ? wins : 0;
    if (sections.size > 0 && read.size === sections.size) out.discsCompleted += 1;
  }
  return out;
}

/** Where the reader left off. */
export interface LastVisit {
  discId: string;
  sectionId?: string;
}

export interface ContinueTarget {
  discId: string;
  sectionId?: string;
  /** For the button, for example "Ancient Castles & Keeps › The Moat". */
  label: string;
}

/**
 * The place to continue studying: the last disc and article, when that disc is still mounted. A
 * section that no longer exists falls back to the disc's cover. Returns null when there is nothing to
 * continue.
 */
export function continueTarget(discs: readonly DiscManifest[], last: LastVisit | null): ContinueTarget | null {
  if (!last) return null;
  const disc = discs.find((d) => d.disc_id === last.discId);
  if (!disc) return null;
  const title = disc.title.replace(/^DiscLore '97:\s*/, '');
  const section = last.sectionId ? disc.sections.find((s) => s.section_id === last.sectionId) : undefined;
  return section
    ? { discId: disc.disc_id, sectionId: section.section_id, label: `${title} \u203a ${section.title}` }
    : { discId: disc.disc_id, label: title };
}
