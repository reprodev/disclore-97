// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 19: HTML extraction discards, limits, and totality
// **Validates: Requirements 9.3, 9.4, 9.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractHtml } from '../../src/extract/htmlExtract';
import { arbHtmlDoc } from '../generators-io';

const allStrings = (o: { title: string; headings: string[]; paragraphs: string[] }): string[] => [
  o.title,
  ...o.headings,
  ...o.paragraphs,
];

const WRAPPERS = ['script', 'style', 'noscript', 'template', 'svg', 'iframe'] as const;

describe('Property 19: HTML extraction discards, limits, and totality', () => {
  it('never outputs marker text from discarded elements', () => {
    fc.assert(
      fc.property(arbHtmlDoc, (doc) => {
        const out = extractHtml(doc.html);
        for (const marker of doc.markers) {
          for (const s of allStrings(out)) expect(s).not.toContain(marker);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('discards markers inside discarded wrappers around content elements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WRAPPERS),
        fc.constantFrom('h1', 'h2', 'p'),
        fc.stringMatching(/^[a-z]{4,10}$/),
        (wrap, inner, salt) => {
          const marker = `ZQX${salt}`;
          const html =
            `<p>keep</p><${wrap}><${inner}>${marker}</${inner}></${wrap}>` +
            `<!-- <p>${marker}</p> --><title>t</title><p>after</p>`;
          const out = extractHtml(html);
          for (const s of allStrings(out)) expect(s).not.toContain(marker);
          expect(out.paragraphs).toContain('keep');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('limits headings to 12, paragraphs to 40, and each string to 1200 characters', () => {
    const arbText = fc.string({ minLength: 1, maxLength: 1500 }).map((s) => s.replace(/[<>&]/g, 'x'));
    fc.assert(
      fc.property(
        fc.array(arbText, { maxLength: 30 }),
        fc.array(arbText, { maxLength: 60 }),
        fc.nat(2000),
        (hs, ps, titleLen) => {
          const html =
            `<title>${'t'.repeat(titleLen)}</title>` +
            hs.map((h) => `<h2>${h}</h2>`).join('') +
            ps.map((p) => `<p>${p}</p>`).join('');
          const out = extractHtml(html);
          expect(out.headings.length).toBeLessThanOrEqual(12);
          expect(out.paragraphs.length).toBeLessThanOrEqual(40);
          for (const s of allStrings(out)) expect(s.length).toBeLessThanOrEqual(1200);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('limits hold for arbitrary generated documents', () => {
    fc.assert(
      fc.property(arbHtmlDoc, (doc) => {
        const out = extractHtml(doc.html);
        expect(out.headings.length).toBeLessThanOrEqual(12);
        expect(out.paragraphs.length).toBeLessThanOrEqual(40);
        for (const s of allStrings(out)) expect(s.length).toBeLessThanOrEqual(1200);
      }),
      { numRuns: 100 },
    );
  });

  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ maxLength: 300 }), fc.string({ unit: 'binary', maxLength: 300 })), (s) => {
        const out = extractHtml(s);
        expect(typeof out.title).toBe('string');
        expect(Array.isArray(out.headings)).toBe(true);
        expect(Array.isArray(out.paragraphs)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('never throws on tag-heavy fragments', () => {
    const piece = fc.constantFrom(
      '<', '>', '</', '<p>', '</p>', '<h1>', '<script>', '</script', '<!--', '-->', '<svg>',
      '<title>', '&#', '&amp;', '"', "'", '/', 'text', ' ', '<iframe', '<template>',
    );
    fc.assert(
      fc.property(fc.array(piece, { maxLength: 40 }).map((a) => a.join('')), (s) => {
        expect(() => extractHtml(s)).not.toThrow();
      }),
      { numRuns: 200 },
    );
  });

  it('returns empty lists when the input has no content elements', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ maxLength: 200 }).map((s) => s.replace(/</g, ' ')),
          fc.string({ unit: 'binary', maxLength: 200 }).map((s) => s.replace(/</g, ' ')),
          fc.constant(''),
        ),
        (s) => {
          const out = extractHtml(s);
          expect(out.headings).toEqual([]);
          expect(out.paragraphs).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
