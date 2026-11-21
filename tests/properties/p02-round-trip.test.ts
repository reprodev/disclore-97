import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest } from '../generators';

describe('Property 2: Manifest JSON round trip', () => {
  // Feature: disclore-97-core, Property 2: Manifest JSON round trip
  // **Validates: Requirements 5.13, 8.10**
  it('stringify, parse, validate yields ok with a deep-equal manifest', () => {
    fc.assert(
      fc.property(arbManifest, (m) => {
        const result = validateManifest(JSON.parse(JSON.stringify(m)));
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.manifest).toEqual(m);
      }),
      { numRuns: 200 },
    );
  });
});
