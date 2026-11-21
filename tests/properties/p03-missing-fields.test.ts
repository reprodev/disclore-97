import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, deleteField, retypeField } from '../generators';

describe('Property 3: Missing or mistyped fields are reported by path', () => {
  // Feature: disclore-97-core, Property 3: Missing or mistyped fields are reported by path
  // **Validates: Requirements 5.2**
  it('deleting a required field yields a missing-field error at that path', () => {
    fc.assert(
      fc.property(arbManifest, fc.nat(), (m, pick) => {
        const mut = deleteField(m, pick);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.map((e) => e.path)).toContain(`$.${mut.path}`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('replacing a required field with a wrong-type value yields an error at that path', () => {
    fc.assert(
      fc.property(arbManifest, fc.nat(), (m, pick) => {
        const mut = retypeField(m, pick);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.map((e) => e.path)).toContain(`$.${mut.path}`);
        }
      }),
      { numRuns: 200 },
    );
  });
});
