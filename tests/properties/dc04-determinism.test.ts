import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

const arbSource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

describe('Property 4: Determinism', () => {
  // Feature: dynamic-disc-compiler, Property 4: Determinism
  // **Validates: Requirements 2.10, 5.8, 17.7**
  it('two compiles of the same source are deep-equal', () => {
    fc.assert(
      fc.property(arbSource, (source) => {
        expect(compileDisc(source)).toEqual(compileDisc(source));
      }),
      { numRuns: 100 },
    );
  });

  it('a compile of a deep copy is deep-equal to the original compile', () => {
    fc.assert(
      fc.property(arbSource, (source) => {
        const original = compileDisc(source);
        expect(compileDisc(structuredClone(source))).toEqual(original);
        expect(compileDisc(JSON.parse(JSON.stringify(source)))).toEqual(original);
      }),
      { numRuns: 100 },
    );
  });
});
