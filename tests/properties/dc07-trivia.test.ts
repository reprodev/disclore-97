import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

const arbAnySource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

/** True when `answer` is a substring of the text, allowing a trailing truncation marker. */
function derivedFrom(answer: string, text: string): boolean {
  if (text.includes(answer)) return true;
  if (answer.endsWith('\u2026')) return text.includes(answer.slice(0, -1).trimEnd());
  return false;
}

describe('Property 7: Trivia integrity', () => {
  // Feature: dynamic-disc-compiler, Property 7: Trivia integrity
  // **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 17.5**
  it('trivia questions are well formed, grounded, and varied', () => {
    fc.assert(
      fc.property(arbAnySource, (source) => {
        const m = compileDisc(source);
        const sectionsById = new Map(m.sections.map((s) => [s.section_id, s]));

        expect(m.trivia.length).toBeGreaterThanOrEqual(5);

        const cited = new Set<string>();
        const positions = new Set<number>();

        for (const q of m.trivia) {
          const section = sectionsById.get(q.section_id);
          expect(section).toBeDefined();
          cited.add(q.section_id);

          expect(q.prompt.length).toBeGreaterThanOrEqual(1);
          expect(q.prompt.length).toBeLessThanOrEqual(200);

          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(q.options.length).toBeLessThanOrEqual(4);
          for (const o of q.options) {
            expect(o.length).toBeGreaterThanOrEqual(1);
            expect(o.length).toBeLessThanOrEqual(120);
          }
          const keys = q.options.map((o) => o.trim().toLowerCase());
          expect(new Set(q.options.map((o) => o.trim())).size).toBe(q.options.length);
          expect(new Set(keys).size).toBe(keys.length);

          expect(Number.isInteger(q.correct_index)).toBe(true);
          expect(q.correct_index).toBeGreaterThanOrEqual(0);
          expect(q.correct_index).toBeLessThan(q.options.length);
          positions.add(q.correct_index);

          const answer = q.options[q.correct_index];
          const fromText = section!.paragraphs.some((p) => derivedFrom(answer, p));
          const fromTitle = derivedFrom(answer, section!.title);
          expect(fromText || fromTitle).toBe(true);
        }

        expect(cited.size).toBeGreaterThanOrEqual(3);
        expect(positions.size).toBeGreaterThanOrEqual(3);
      }),
      { numRuns: 200 },
    );
  });
});
