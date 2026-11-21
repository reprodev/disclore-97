// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 21: README decoding round trip and limit
// **Validates: Requirements 8.3, 8.12**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { decodeReadme } from '../../src/adapters/github';
import { base64Wrapped } from '../generators-io';

const LIMIT = 100000;

// Replaces lone surrogates with U+FFFD (same behavior as String.prototype.toWellFormed).
function wellFormed(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (n >= 0xdc00 && n <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      } else out += '\uFFFD';
    } else if (c >= 0xdc00 && c <= 0xdfff) out += '\uFFFD';
    else out += s[i];
  }
  return out;
}

// Short arbitrary Unicode text (well-formed, so UTF-8 round-trips exactly).
const arbShort = fc.string({ unit: 'binary', maxLength: 400 }).map(wellFormed);

// Long text: ASCII prefix past the limit, so the limit is exercised, plus a Unicode tail.
const arbLong = fc
  .tuple(fc.integer({ min: 1, max: 500 }), fc.string({ unit: 'binary', maxLength: 50 }))
  .map(([extra, tail]) => 'a'.repeat(LIMIT + extra) + wellFormed(tail));

describe('Property 21: README decoding round trip and limit', () => {
  it('returns the original text for arbitrary Unicode, wrapped at 60 columns', () => {
    fc.assert(
      fc.property(arbShort, (text) => {
        expect(decodeReadme(base64Wrapped(text, 60))).toBe(text.slice(0, LIMIT));
      }),
      { numRuns: 100 },
    );
  });

  it('cuts texts longer than 100000 characters to 100000 characters', () => {
    fc.assert(
      fc.property(arbLong, (text) => {
        const out = decodeReadme(base64Wrapped(text, 60));
        expect(out.length).toBe(LIMIT);
        expect(out).toBe(text.slice(0, LIMIT));
      }),
      { numRuns: 100 },
    );
  });
});
