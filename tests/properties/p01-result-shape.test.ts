import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, deleteField, retypeField, duplicateId, ID_SCOPES, setCorrectIndex, repointReference, REF_KINDS } from '../generators';

function checkShape(input: unknown): void {
  const result = validateManifest(input);
  if (result.ok) {
    expect(result.manifest).toBeDefined();
  } else {
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    for (const e of result.errors) {
      expect(typeof e.path).toBe('string');
      expect(e.path.length).toBeGreaterThan(0);
      expect(typeof e.message).toBe('string');
      expect(e.message.length).toBeGreaterThan(0);
    }
  }
}

describe('Property 1: Validator result shape', () => {
  // Feature: disclore-97-core, Property 1: Validator result shape
  // **Validates: Requirements 5.1**
  it('returns ok+manifest or non-empty errors with path and message for arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        checkShape(input);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: disclore-97-core, Property 1: Validator result shape
  // **Validates: Requirements 5.1**
  it('holds for valid and mutated manifests', () => {
    fc.assert(
      fc.property(
        arbManifest,
        fc.nat(),
        fc.constantFrom('valid', 'delete', 'retype', 'dup', 'index', 'ref'),
        (m, pick, kind) => {
          let input: unknown = m;
          if (kind === 'delete') input = deleteField(m, pick).manifest;
          else if (kind === 'retype') input = retypeField(m, pick).manifest;
          else if (kind === 'dup') input = duplicateId(m, ID_SCOPES[pick % ID_SCOPES.length], pick).manifest;
          else if (kind === 'index') input = setCorrectIndex(m, pick, -1 - (pick % 5)).manifest;
          else if (kind === 'ref') input = repointReference(m, REF_KINDS[pick % REF_KINDS.length], pick).manifest;
          checkShape(input);
          if (kind === 'valid') expect(validateManifest(input).ok).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
