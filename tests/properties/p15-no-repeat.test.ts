import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createQueue, drawQuestion } from '../../src/model/questionQueue';

// Feature: disclore-97-core, Property 15: Questions do not repeat until all are used
// **Validates: Requirements 12.7**

/** Deterministic rng in [0, 1) driven by a pre-generated list of values. */
function rngFrom(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('Property 15: Questions do not repeat until all are used', () => {
  it('every aligned window of N draws contains each index exactly once', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.array(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), {
          minLength: 1,
          maxLength: 50,
        }),
        fc.integer({ min: 1, max: 5 }),
        (n, values, windows) => {
          const rng = rngFrom(values);
          let queue = createQueue(n, rng);
          for (let w = 0; w < windows; w++) {
            const seen: number[] = [];
            for (let k = 0; k < n; k++) {
              const r = drawQuestion(queue, n, rng);
              seen.push(r.index);
              queue = r.queue;
            }
            expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
