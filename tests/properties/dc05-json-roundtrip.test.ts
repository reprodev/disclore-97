import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { validateManifest } from '../../src/model/validate';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

function findUndefined(value: unknown, path = '$'): string | null {
  if (value === undefined) return path;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findUndefined(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const hit = findUndefined(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

const arbAnySource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

describe('Property 5: JSON round trip', () => {
  // Feature: dynamic-disc-compiler, Property 5: JSON round trip
  // **Validates: Requirements 6.4, 17.9**
  it('compiled manifests contain no undefined and survive JSON stringify/parse', () => {
    fc.assert(
      fc.property(arbAnySource, (source) => {
        const m = compileDisc(source);
        expect(findUndefined(m)).toBeNull();
        const parsed = JSON.parse(JSON.stringify(m));
        expect(parsed).toEqual(m);
        expect(validateManifest(parsed).ok).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
