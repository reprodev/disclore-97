// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 18: HTML extraction round trip
// **Validates: Requirements 9.2**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractHtml } from '../../src/extract/htmlExtract';
import { arbHtmlDoc } from '../generators-io';

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

describe('Property 18: HTML extraction round trip', () => {
  it('returns the title, headings, and paragraphs rendered into the document', () => {
    fc.assert(
      fc.property(arbHtmlDoc, (doc) => {
        const out = extractHtml(doc.html);
        expect(out.title).toBe(norm(doc.title));
        expect(out.headings).toEqual(doc.headings.map(norm));
        expect(out.paragraphs).toEqual(doc.paragraphs.map(norm));
      }),
      { numRuns: 100 },
    );
  });
});
