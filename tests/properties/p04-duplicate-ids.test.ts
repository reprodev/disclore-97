import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, duplicateId, ID_SCOPES } from '../generators';

describe('Property 4: Duplicate identifiers are rejected', () => {
  // Feature: disclore-97-core, Property 4: Duplicate identifiers are rejected
  // **Validates: Requirements 5.3**
  it('setting one id equal to another in the same scope yields a duplicate-id error', () => {
    fc.assert(
      fc.property(arbManifest, fc.constantFrom(...ID_SCOPES), fc.nat(), (m, scope, pick) => {
        const mut = duplicateId(m, scope, pick);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.some((e) => e.code === 'duplicate-id')).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
