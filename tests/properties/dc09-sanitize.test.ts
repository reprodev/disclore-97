// @vitest-environment node
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
  }, 30000); // About 2.5s alone; headroom for a loaded parallel run (richer diagram scenes add strings to scan).

  // Feature: dynamic-disc-compiler, Property 9: Sanitization of hostile text (media)
  it('keeps only validated https media urls and sanitizes every caption', () => {
    const arbUrl = fc.oneof(
      fc.constantFrom(
        'https://cdn.example.org/a.png',
        'https://cdn.example.org/b.jpg?w=300',
        'http://cdn.example.org/c.png',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        'https://localhost/d.png',
        'https://10.0.0.1/e.png',
        'https://cdn.example.org/f.svg',
        'https://cdn.example.org/<script>.png',
        'https://cdn.example.org/a b.png',
      ),
      fc.webUrl(),
      fc.string(),
    );
    const arbCaption = fc.oneof(
      fc.string(),
      fc.constantFrom(
        '<script>alert(1)</script>Caption',
        '![x](https://img.example/y.png) caption',
        'bidi \u202Etext\u202C here',
        'ctrl\u0000char\u0007s',
        '  spaced   out   ',
        '',
      ),
    );
    const arbMedia = fc.array(fc.record({ url: arbUrl, caption: arbCaption }), { maxLength: 14 });

    fc.assert(
      fc.property(arbHostileSource, arbMedia, (source, media) => {
        const m = compileDisc({ ...source, media });
        const { media: kept, ...rest } = m;

        for (const s of collectStrings(rest)) {
          expect(s).not.toMatch(/[<>]/);
          expect(s).not.toMatch(CONTROL);
          expect(s).not.toMatch(BIDI_ZERO_WIDTH);
        }

        const items = kept ?? [];
        expect(items.length).toBeLessThanOrEqual(8);
        expect(new Set(items.map((i) => i.url)).size).toBe(items.length);
        for (const item of items) {
          // URLs are checked on their own terms: https only, no markup, no whitespace.
          expect(item.url.startsWith('https://')).toBe(true);
          expect(item.url).not.toMatch(/[<>\s]/);
          expect(item.url).not.toMatch(CONTROL);
          expect(item.url).not.toMatch(/\.svgz?($|[?#])/i);
          // Captions get the same treatment as every other text field.
          expect(item.caption.trim()).not.toBe('');
          expect(item.caption).not.toMatch(/[<>]/);
          expect(item.caption).not.toMatch(CONTROL);
          expect(item.caption).not.toMatch(BIDI_ZERO_WIDTH);
          expect(item.caption).not.toMatch(LONE_SURROGATE);
          expect(item.caption).not.toMatch(/\s{2,}/);
          expect(item.caption).not.toMatch(/!\[[^\]]*\]\(/);
          expect(item.caption).not.toContain('img.example');
          expect(item.caption.length).toBeLessThanOrEqual(120);
        }
      }),
      { numRuns: 200 },
    );
  }, 30000); // About 2.5s alone; headroom for a loaded parallel run (richer diagram scenes add strings to scan).
});
