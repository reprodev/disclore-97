import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, repointReference, REF_KINDS } from '../generators';

describe('Property 6: Dangling references are rejected', () => {
  // Feature: disclore-97-core, Property 6: Dangling references are rejected
  // **Validates: Requirements 5.5, 5.6, 5.9, 8.9**
  it('repointing a hotspot, trivia, or exit reference yields a dangling-reference error at that path', () => {
    fc.assert(
      fc.property(arbManifest, fc.constantFrom(...REF_KINDS), fc.nat(), (m, kind, pick) => {
        const mut = repointReference(m, kind, pick);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(
            result.errors.some((e) => e.code === 'dangling-reference' && e.path === `$.${mut.path}`),
          ).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
