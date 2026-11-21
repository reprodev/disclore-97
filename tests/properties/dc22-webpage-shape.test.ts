// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 22: Webpage response shape validation
// **Validates: Requirements 12.3, 12.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { fetchWebpageSource } from '../../src/adapters/webpage';
import { arbWebpageJson, makeFetch } from '../generators-io';

function isStrList(v: unknown): boolean {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function validShape(b: unknown): boolean {
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  return typeof o.title === 'string' && isStrList(o.headings) && isStrList(o.paragraphs);
}

// Valid-shaped bodies with lists beyond the caps, to exercise truncation.
const arbOversized = fc.record({
  title: fc.string({ maxLength: 10 }),
  headings: fc.array(fc.string({ maxLength: 5 }), { minLength: 13, maxLength: 30 }),
  paragraphs: fc.array(fc.string({ maxLength: 5 }), { minLength: 41, maxLength: 80 }),
});

describe('Property 22: Webpage response shape validation', () => {
  it('200 JSON yields ok webpage only for the valid shape, otherwise fetch-failed', async () => {
    await fc.assert(
      fc.asyncProperty(arbWebpageJson, async (body) => {
        const r = await fetchWebpageSource('https://example.com/page', {
          fetch: makeFetch({ kind: 'json', status: 200, body }),
        });
        if (validShape(body)) {
          expect(r.ok).toBe(true);
          if (r.ok) {
            expect(r.value.metadata.kind).toBe('webpage');
            expect(r.value.headings.length).toBeLessThanOrEqual(12);
            expect(r.value.paragraphs.length).toBeLessThanOrEqual(40);
          }
        } else {
          expect(r.ok).toBe(false);
          if (!r.ok) expect(r.error.code).toBe('fetch-failed');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('caps headings at 12 and paragraphs at 40', async () => {
    await fc.assert(
      fc.asyncProperty(arbOversized, async (body) => {
        const r = await fetchWebpageSource('https://example.com/page', {
          fetch: makeFetch({ kind: 'json', status: 200, body }),
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.value.headings).toEqual(body.headings.slice(0, 12));
          expect(r.value.paragraphs).toEqual(body.paragraphs.slice(0, 40));
        }
      }),
      { numRuns: 100 },
    );
  });
});
