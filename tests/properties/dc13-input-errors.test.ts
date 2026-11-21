import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseInput } from '../../src/model/sourceInput';

const KNOWN_SCHEMES = [
  'javascript', 'data', 'file', 'vbscript', 'mailto', 'ftp', 'ws', 'wss',
  'blob', 'about', 'tel', 'sms', 'view-source',
];
const WS_CHARS = [' ', '\t', '\n', '\r', '\v', '\f', '\u00a0', '\u2003', '\u2028', '\ufeff'];

const arbWhitespace = fc.array(fc.constantFrom(...WS_CHARS), { maxLength: 40 }).map((a) => a.join(''));

const arbCase = (s: string) =>
  fc.array(fc.boolean(), { minLength: s.length, maxLength: s.length }).map((flags) =>
    [...s].map((c, i) => (flags[i] ? c.toUpperCase() : c.toLowerCase())).join(''),
  );

const arbRest = fc.string({ maxLength: 200 });

const arbGenericScheme = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.stringMatching(/^[a-z0-9+.-]{0,10}$/),
  )
  .map(([h, t]) => h + t)
  .filter((s) => s !== 'http' && s !== 'https')
  .chain(arbCase)
  .filter((s) => !['http', 'https'].includes(s.toLowerCase()));

describe('Property 13: Input error codes', () => {
  // Feature: dynamic-disc-compiler, Property 13: Input error codes
  // **Validates: Requirements 1.5, 1.6, 1.7**
  it('whitespace-only strings give empty-input', () => {
    fc.assert(
      fc.property(arbWhitespace, (s) => {
        expect(parseInput(s)).toEqual({ ok: false, error: 'empty-input' });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: dynamic-disc-compiler, Property 13: Input error codes
  // **Validates: Requirements 1.5, 1.6, 1.7**
  it('strings over 20000 characters after trim give input-too-long', () => {
    fc.assert(
      fc.property(
        arbWhitespace,
        fc.constantFrom('a', 'x', '9', '#', '.'),
        fc.integer({ min: 20001, max: 21000 }),
        arbWhitespace,
        (pre, ch, n, post) => {
          const s = pre + ch.repeat(n) + post;
          expect(parseInput(s)).toEqual({ ok: false, error: 'input-too-long' });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: dynamic-disc-compiler, Property 13: Input error codes
  // **Validates: Requirements 1.5, 1.6, 1.7**
  it('a non-http(s) scheme followed by // gives unsupported-scheme', () => {
    fc.assert(
      fc.property(arbWhitespace, arbGenericScheme, arbRest, (pre, scheme, rest) => {
        const s = `${pre}${scheme}://${rest}`;
        fc.pre(s.trim().length <= 20000);
        expect(parseInput(s)).toEqual({ ok: false, error: 'unsupported-scheme' });
      }),
      { numRuns: 200 },
    );
  });

  // Feature: dynamic-disc-compiler, Property 13: Input error codes
  // **Validates: Requirements 1.5, 1.6, 1.7**
  it('a known scheme name in any case followed by a colon gives unsupported-scheme', () => {
    fc.assert(
      fc.property(
        arbWhitespace,
        fc.constantFrom(...KNOWN_SCHEMES).chain(arbCase),
        arbRest,
        (pre, scheme, rest) => {
          expect(parseInput(`${pre}${scheme}:${rest}`)).toEqual({
            ok: false,
            error: 'unsupported-scheme',
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});
