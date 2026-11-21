import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { castlesDisc, retroDisc } from '../../src/discs';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

const ID_PATTERN = /^(github|webpage|markdown|topic)(-[a-z0-9]+)+$/;
const PREBAKED_IDS = [castlesDisc.disc_id, retroDisc.disc_id];

describe('Property 3: Disc id shape', () => {
  // Feature: dynamic-disc-compiler, Property 3: Disc id shape
  // **Validates: Requirements 2.7, 15.10**
  it('disc_id matches the pattern, is at most 48 chars, starts with the kind, and is never a pre-baked id', () => {
    fc.assert(
      fc.property(fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource), (source) => {
        const { disc_id } = compileDisc(source);
        expect(disc_id).toMatch(ID_PATTERN);
        expect(disc_id.length).toBeLessThanOrEqual(48);
        expect(disc_id.startsWith(source.metadata.kind)).toBe(true);
        expect(PREBAKED_IDS).not.toContain(disc_id);
      }),
      { numRuns: 200 },
    );
  });
});
