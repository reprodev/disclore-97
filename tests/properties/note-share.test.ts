import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decodeNotes, encodeNotes, MAX_SHARE_ENCODED, MAX_SHARE_NOTES, MAX_SHARE_TITLE, notesQuery } from '../../src/model/noteShare';
import { parseDeepLink } from '../../src/model/deepLink';

/** Notes text as people write it: any Unicode, including emoji, accents, line breaks, and tabs. */
const arbText = fc.string({ unit: 'grapheme', minLength: 1, maxLength: 300 }).filter((s) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\r]/g, '').trim() !== '');
const arbId = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,30}$/);
const arbTitle = fc.string({ unit: 'grapheme', minLength: 1, maxLength: 60 });

const CONTROL_EXCEPT_NL_TAB = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/;

describe('noteShare: encode and decode', () => {
  it('round-trips any notes text, title, and disc id, and the link uses only URL-safe characters', () => {
    fc.assert(
      fc.property(arbId, arbTitle, arbText, (discId, discTitle, text) => {
        const encoded = encodeNotes({ discId, discTitle, text });
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(encodeURIComponent(encoded)).toBe(encoded);
        const back = decodeNotes(encoded);
        expect(back).not.toBeNull();
        expect(back!.discId).toBe(discId);
        expect(back!.text).toBe(text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, ''));
        expect(back!.discTitle.length).toBeLessThanOrEqual(MAX_SHARE_TITLE);
      }),
      { numRuns: 300 },
    );
  });

  it('survives a trip through a real URL and the deep-link parser', () => {
    fc.assert(
      fc.property(arbId, arbTitle, arbText, (discId, discTitle, text) => {
        const url = new URL(`https://disclore.test/${notesQuery({ discId, discTitle, text })}`);
        const link = parseDeepLink(url.search);
        expect(link.notes).toBeDefined();
        expect(decodeNotes(link.notes)!.discId).toBe(discId);
      }),
      { numRuns: 150 },
    );
  });

  it('caps the notes in a link, keeping the start and never splitting a character', () => {
    const long = '\u{1F384}'.repeat(MAX_SHARE_NOTES); // two UTF-16 units each
    const back = decodeNotes(encodeNotes({ discId: 'd', discTitle: 'D', text: long }))!;
    expect(back.text.length).toBeLessThanOrEqual(MAX_SHARE_NOTES);
    expect(back.text).toBe('\u{1F384}'.repeat(MAX_SHARE_NOTES / 2));
    expect(encodeNotes({ discId: 'd', discTitle: 'D', text: 'x'.repeat(50000) }).length).toBeLessThan(MAX_SHARE_ENCODED);
  });

  it('never throws and returns null or clean notes for any string at all', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.stringMatching(/^[A-Za-z0-9_-]{0,80}$/), fc.base64String()), (s) => {
        const out = decodeNotes(s);
        if (out !== null) {
          expect(out.text.trim()).not.toBe('');
          expect(CONTROL_EXCEPT_NL_TAB.test(out.text)).toBe(false);
          expect(CONTROL_EXCEPT_NL_TAB.test(out.discTitle)).toBe(false);
          expect(out.discId).not.toBe('');
        }
        return true;
      }),
      { numRuns: 500 },
    );
  });

  it('never throws on mutated links: flipped, cut, or extended characters', () => {
    fc.assert(
      fc.property(arbId, arbText, fc.nat(), fc.constantFrom('flip', 'cut', 'append', 'pad'), (discId, text, at, how) => {
        const good = encodeNotes({ discId, discTitle: 'T', text });
        const i = at % good.length;
        const bad =
          how === 'flip'
            ? good.slice(0, i) + (good[i] === 'A' ? 'B' : 'A') + good.slice(i + 1)
            : how === 'cut'
              ? good.slice(0, i)
              : how === 'append'
                ? `${good}Z`
                : `${good}==`;
        expect(() => decodeNotes(bad)).not.toThrow();
        return true;
      }),
      { numRuns: 300 },
    );
  });

  it('rejects malformed input with null', () => {
    const json = (o: unknown) => encodeNotesRaw(JSON.stringify(o));
    for (const bad of [
      undefined,
      null,
      42,
      {},
      '',
      '   ',
      '!!!!',
      'abc=',
      'A', // one leftover character can never be valid base64
      'x'.repeat(MAX_SHARE_ENCODED + 4),
      encodeNotesRaw('not json'),
      encodeNotesRaw('\u00ff\u00fe'), // bytes that are not valid UTF-8 once encoded below
      json([1, 2, 3]),
      json({ v: 2, d: 'a', t: 'A', n: 'text' }),
      json({ v: 1, d: 5, t: 'A', n: 'text' }),
      json({ v: 1, d: 'a', t: 'A', n: '   ' }),
      json({ v: 1, d: '', t: 'A', n: 'text' }),
      json({ v: 1, d: 'a', t: 'A' }),
    ]) {
      expect(decodeNotes(bad as string), String(bad).slice(0, 40)).toBeNull();
    }
    expect(decodeNotes(invalidUtf8())).toBeNull();
  });

  it('strips control characters and keeps line breaks and tabs', () => {
    const encoded = encodeNotesRaw(JSON.stringify({ v: 1, d: 'disc\u0000one', t: 'A\u0007Title\nTwo', n: 'line 1\r\nline\u0001 2\tend\u200b' }));
    expect(decodeNotes(encoded)).toEqual({ discId: 'disc one', discTitle: 'A Title Two', text: 'line 1\nline 2\tend\u200b' });
  });
});

/** base64url of the UTF-8 bytes of `text`, built independently of the module under test. */
function encodeNotesRaw(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

/** base64url of bytes that are not valid UTF-8. */
function invalidUtf8(): string {
  return Buffer.from([0x7b, 0xff, 0xfe, 0x7d]).toString('base64url');
}
