import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { arbHostileSource } from '../generators';

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const BIDI_ZERO_WIDTH = /[\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF]/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('Property 9: Sanitization of hostile text', () => {
  // Feature: dynamic-disc-compiler, Property 9: Sanitization of hostile text
  // **Validates: Requirements 7.1, 7.2, 7.3, 7.6, 7.8, 17.8**
  it('no compiled string carries markup, control, invisible, or remote-image content', () => {
    fc.assert(
      fc.property(arbHostileSource, (source) => {
        const m = compileDisc(source);

        for (const s of collectStrings(m)) {
          expect(s).not.toMatch(/[<>]/);
          expect(s).not.toMatch(CONTROL);
          expect(s).not.toMatch(BIDI_ZERO_WIDTH);
          expect(s).not.toMatch(LONE_SURROGATE);
          expect(s).not.toMatch(/\s{2,}/);
          // A bare '![' can come from random filler text; a complete image is never retained.
          expect(s).not.toMatch(/!\[[^\]]*\]\(/);
          expect(s).not.toContain('img.example');
          expect(s).not.toContain('link.example');
        }

        expect(m.title.length).toBeGreaterThanOrEqual(1);
        expect(m.title.length).toBeLessThanOrEqual(80);
        expect(m.tagline.length).toBeLessThanOrEqual(140);
        expect(m.sections.length).toBeLessThanOrEqual(12);
        for (const sec of m.sections) {
          expect(sec.title.length).toBeGreaterThanOrEqual(1);
          expect(sec.title.length).toBeLessThanOrEqual(80);
          expect(sec.paragraphs.length).toBeLessThanOrEqual(8);
          for (const p of sec.paragraphs) expect(p.length).toBeLessThanOrEqual(1200);
        }
      }),
      { numRuns: 200 },
    );
  });
});
