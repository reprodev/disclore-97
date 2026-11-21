import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateManifest } from '../../src/model/validate';
import { arbManifest, setHotspotCoordinate } from '../generators';

const arbBadCoord = fc.oneof(
  fc.double({ max: 0, noNaN: true, noDefaultInfinity: true }).filter((v) => v < 0),
  fc.double({ min: 100, noNaN: true, noDefaultInfinity: true }).filter((v) => v > 100),
  fc.constantFrom(NaN, Infinity, -Infinity),
);

describe('Property 5: Out-of-range hotspot coordinates are rejected', () => {
  // Feature: disclore-97-core, Property 5: Out-of-range hotspot coordinates are rejected
  // **Validates: Requirements 5.4, 8.8**
  it('rejects hotspot x or y that is <0, >100, NaN or infinite with a coordinate-range error', () => {
    fc.assert(
      fc.property(arbManifest, fc.nat(), fc.constantFrom('x' as const, 'y' as const), arbBadCoord, (m, pick, axis, value) => {
        // Valid baseline accepted.
        expect(validateManifest(m).ok).toBe(true);
        const mut = setHotspotCoordinate(m, pick, axis, value);
        const result = validateManifest(mut.manifest);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.some((e) => e.code === 'coordinate-range' && e.path === `$.${mut.path}`)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
