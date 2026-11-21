import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, setCorrectIndex } from '../generators';

describe('Property 7: Answer index out of range is rejected', () => {
  // Feature: disclore-97-core, Property 7: Answer index out of range is rejected
  // **Validates: Requirements 5.7**
  it('a negative or too-large correct_index yields an index-range error at that path', () => {
    fc.assert(
      fc.property(
        arbManifest,
        fc.nat(),
        fc.boolean(),
        fc.integer({ min: 1, max: 1000 }),
        (m, pick, negative, delta) => {
          const q = m.trivia[pick % m.trivia.length];
          const value = negative ? -delta : q.options.length - 1 + delta;
          const mut = setCorrectIndex(m, pick, value);
          const result = validateManifest(mut.manifest);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(
              result.errors.some((e) => e.code === 'index-range' && e.path === `$.${mut.path}`),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
