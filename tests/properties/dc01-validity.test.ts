import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { validateManifest } from '../../src/model/validate';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

describe('Property 1: Compiled discs always validate', () => {
  // Feature: dynamic-disc-compiler, Property 1: Compiled discs always validate
  // **Validates: Requirements 2.11, 6.1, 17.2**
  it('validateManifest accepts compileDisc output for extracted, thin, and hostile sources', () => {
    fc.assert(
      fc.property(fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource), (source) => {
        const manifest = compileDisc(source);
        const result = validateManifest(manifest);
        if (!result.ok) {
          expect(result.errors).toEqual([]);
        }
        expect(result.ok).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
