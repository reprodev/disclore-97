import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { prebakedDiscs } from '../../src/discs';
import { loadDisc } from '../../src/discs/loader';
import { buildFlashcards, gotIt, initDeck, isComplete, MAX_CARDS, needReview } from '../../src/model/flashcards';
import type { DiscManifest } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';
import { arbExtractedSource, arbHostileSource, arbManifest, arbThinSource } from '../generators';

/** Valid manifests of several shapes: hand-built, and compiled from extracted, thin, and hostile sources. */
const arbDisc: fc.Arbitrary<DiscManifest> = fc.oneof(
  arbManifest,
  fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource).map((s) => compileDisc(s)),
);

describe('Flashcards: buildFlashcards', () => {
  it('gives every valid disc a non-empty deck of non-empty cards', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        expect(validateManifest(disc).ok).toBe(true);
        const cards = buildFlashcards(disc);
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
        for (const c of cards) {
          for (const text of [c.front, c.back, c.hint, c.id]) {
            expect(typeof text).toBe('string');
            expect(text.trim()).not.toBe('');
          }
          expect(['trivia', 'fact']).toContain(c.kind);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('cites a real section on every card, with unique ids', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        const ids = new Set(disc.sections.map((s) => s.section_id));
        const cards = buildFlashcards(disc);
        for (const c of cards) expect(ids.has(c.section_id)).toBe(true);
        expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic and does not change the disc', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        const before = JSON.stringify(disc);
        expect(buildFlashcards(disc)).toEqual(buildFlashcards(disc));
        expect(JSON.stringify(disc)).toBe(before);
      }),
      { numRuns: 100 },
    );
  });

  it('makes at most one trivia card per question, each citing the question\'s own section', () => {
    fc.assert(
      fc.property(arbManifest, (disc) => {
        const cards = buildFlashcards(disc).filter((c) => c.kind === 'trivia');
        expect(cards.length).toBeLessThanOrEqual(disc.trivia.length);
        for (const c of cards) {
          const q = disc.trivia.find((t) => `t:${t.question_id}` === c.id)!;
          expect(q.section_id).toBe(c.section_id);
        }
      }),
      { numRuns: 100 },
    );
  });
  it('works for every built-in disc and gives each a rich deck', () => {
    for (const src of prebakedDiscs) {
      const r = loadDisc(src, false);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const cards = buildFlashcards(r.manifest);
      expect(cards.length).toBeGreaterThanOrEqual(r.manifest.sections.length);
      expect(cards.some((c) => c.kind === 'trivia')).toBe(true);
      expect(cards.some((c) => c.kind === 'fact')).toBe(true);
    }
  });
});

describe('Flashcards: deck rules', () => {
  const arbCount = fc.integer({ min: 1, max: 30 });
  const deckOf = (n: number) =>
    initDeck(Array.from({ length: n }, (_, i) => ({ id: `c${i}`, kind: 'fact' as const, front: 'f', back: 'b', hint: 'h', section_id: 's' })));

  it('Need Review never loses or duplicates a card, and never masters one', () => {
    fc.assert(
      fc.property(arbCount, fc.integer({ min: 0, max: 20 }), (n, steps) => {
        let d = deckOf(n);
        for (let i = 0; i < steps; i++) d = needReview(d);
        expect([...d.queue].sort()).toEqual(Array.from({ length: n }, (_, i) => `c${i}`).sort());
        expect(d.mastered).toEqual([]);
      }),
    );
  });

  it('Got It moves cards to mastered one at a time until the deck is complete', () => {
    fc.assert(
      fc.property(arbCount, (n) => {
        let d = deckOf(n);
        for (let i = 0; i < n; i++) {
          expect(isComplete(d, n)).toBe(false);
          d = gotIt(d);
          expect(d.mastered).toHaveLength(i + 1);
        }
        expect(isComplete(d, n)).toBe(true);
        expect(gotIt(d)).toBe(d);
      }),
    );
  });
});
