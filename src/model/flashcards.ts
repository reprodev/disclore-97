/**
 * Flashcards: study cards built from a disc's trivia and Quick Facts, plus the pure rules for
 * working through a deck. Deterministic. No React, no DOM, no fetch.
 */
import { firstFact } from './discSearch';
import type { DiscManifest } from './manifest';

export interface Flashcard {
  /** Stable id: `t:<question_id>` for trivia, `f:<section_id>:<n>` for a Quick Fact or lead. */
  id: string;
  kind: 'trivia' | 'fact';
  /** The side shown first: a question, or a cue naming the article. */
  front: string;
  /** The answer side. */
  back: string;
  /** Short reminder of where the card comes from (the article title). */
  hint: string;
  /** The article this card came from. Always a real section of the disc. */
  section_id: string;
}

/** Decks stay a study session, not a library: at most this many cards. */
export const MAX_CARDS = 80;

const clean = (s: string | undefined): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

/** The first candidate with visible text. The last one is always non-empty (a section id). */
function pick(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const t = clean(c);
    if (t !== '') return t;
  }
  return '';
}

/**
 * The disc's deck: every trivia question (prompt, then the right option), then every Quick Fact of
 * every article (the article's title as the cue, then the fact). An article with no Quick Facts
 * gives one card from its first sentence, so any disc with an article has a deck. Duplicate cards
 * are dropped, and the deck is capped at MAX_CARDS.
 */
export function buildFlashcards(disc: DiscManifest): Flashcard[] {
  const titleOf = new Map(disc.sections.map((s) => [s.section_id, s]));
  const cards: Flashcard[] = [];
  const seen = new Set<string>();
  const add = (card: Flashcard): void => {
    const key = `${card.front}\u0000${card.back}`;
    if (seen.has(key) || cards.length >= MAX_CARDS) return;
    seen.add(key);
    cards.push(card);
  };

  for (const q of disc.trivia) {
    const section = titleOf.get(q.section_id);
    if (!section) continue;
    add({
      id: `t:${q.question_id}`,
      kind: 'trivia',
      front: pick(q.prompt, section.title, section.section_id),
      back: pick(q.options[q.correct_index], section.title, section.section_id),
      hint: pick(section.title, section.section_id),
      section_id: section.section_id,
    });
  }

  for (const section of disc.sections) {
    const title = pick(section.title, section.section_id);
    const facts = (section.facts ?? []).map(clean).filter((f) => f !== '');
    const texts = facts.length > 0 ? facts : [pick(firstFact(section), section.title, section.section_id)];
    texts.forEach((back, n) =>
      add({
        id: `f:${section.section_id}:${n}`,
        kind: 'fact',
        front: `${title}: what is worth remembering?`,
        back,
        hint: title,
        section_id: section.section_id,
      }),
    );
  }
  return cards;
}

/** Progress through a deck. `queue` holds the card ids still to master, current card first. */
export interface DeckState {
  queue: string[];
  mastered: string[];
  /** Whether the answer side of the current card is showing. */
  flipped: boolean;
}

/** How many other cards a "Need Review" card waits behind before it comes back. */
export const REVIEW_GAP = 3;

export function initDeck(cards: readonly Flashcard[]): DeckState {
  return { queue: cards.map((c) => c.id), mastered: [], flipped: false };
}

export const flipCard = (d: DeckState): DeckState => (d.queue.length === 0 ? d : { ...d, flipped: !d.flipped });

/** "Got It": the current card is mastered and leaves the queue. */
export function gotIt(d: DeckState): DeckState {
  const [current, ...rest] = d.queue;
  if (current === undefined) return d;
  return { queue: rest, mastered: d.mastered.includes(current) ? d.mastered : [...d.mastered, current], flipped: false };
}

/** "Need Review": the current card goes back behind up to REVIEW_GAP other cards. */
export function needReview(d: DeckState): DeckState {
  const [current, ...rest] = d.queue;
  if (current === undefined) return d;
  const at = Math.min(REVIEW_GAP, rest.length);
  return { ...d, queue: [...rest.slice(0, at), current, ...rest.slice(at)], flipped: false };
}

export const isComplete = (d: DeckState, total: number): boolean => total > 0 && d.queue.length === 0;

export const restartDeck = (cards: readonly Flashcard[]): DeckState => initDeck(cards);
