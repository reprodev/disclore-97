import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { fnv1a32, mulberry32, stream } from '../../src/model/compile/prng';
import { discId } from '../../src/model/compile/ids';
import { sanitizeLine } from '../../src/model/compile/text';
import { arbExtractedSource } from '../generators';

const ID_RE = /^(github|webpage|markdown|topic)(-[a-z0-9]+)+$/;
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('prng', () => {
  it('fnv1a32 gives fixed known outputs', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('mulberry32 gives fixed known outputs in [0, 1)', () => {
    const next = mulberry32(42);
    expect([next(), next(), next()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('stream is deterministic and differs by salt', () => {
    expect(stream(1, 'a')()).toBe(stream(1, 'a')());
    expect(stream(1, 'a')()).not.toBe(stream(1, 'b')());
  });
});

describe('discId', () => {
  it('handles empty identities', () => {
    for (const id of ['', '   ', '!!!']) {
      const out = discId('topic', id);
      expect(out).toMatch(ID_RE);
      expect(out.startsWith('topic-')).toBe(true);
    }
  });

  it('keeps C++ and C# apart', () => {
    const a = discId('topic', 'C++');
    const b = discId('topic', 'C#');
    expect(a).not.toBe(b);
    expect(a).toMatch(ID_RE);
    expect(b).toMatch(ID_RE);
  });

  it('is case-insensitive and deterministic', () => {
    expect(discId('github', 'Owner/Repo')).toBe(discId('github', 'owner/repo'));
    expect(discId('github', ' owner/repo ')).toBe(discId('github', 'owner/repo'));
  });

  it('never exceeds 48 characters', () => {
    for (const kind of ['github', 'webpage', 'markdown', 'topic'] as const) {
      const out = discId(kind, 'x'.repeat(500) + ' long identity');
      expect(out.length).toBeLessThanOrEqual(48);
      expect(out).toMatch(ID_RE);
    }
  });
});

describe('sanitizeLine', () => {
  it('removes nested tag fragments', () => {
    const out = sanitizeLine('<scr<script>ipt>alert(1)</scr</script>ipt>', 200);
    expect(out).not.toMatch(/[<>]/);
    expect(out).not.toContain('<script');
  });

  it('drops images and reduces links to visible text', () => {
    expect(sanitizeLine('a ![alt](http://x/y.png) b', 50)).toBe('a b');
    expect(sanitizeLine('see [the docs](http://x/y) now', 50)).toBe('see the docs now');
  });

  it('removes bidi and zero-width characters', () => {
    expect(sanitizeLine('a\u202Eb\u2066c\u200Bd\uFEFFe', 50)).toBe('abcde');
  });

  it('removes lone surrogates but keeps valid pairs', () => {
    expect(sanitizeLine('a\uD800b\uDC00c', 50)).toBe('abc');
    expect(sanitizeLine('a\u{1F600}b', 50)).toBe('a\u{1F600}b');
  });

  it('truncates without splitting a surrogate pair', () => {
    const input = 'a' + '\u{1F600}'.repeat(10);
    for (let max = 1; max <= 12; max++) {
      const out = sanitizeLine(input, max);
      expect(out.length).toBeLessThanOrEqual(max);
      expect(LONE.test(out)).toBe(false);
    }
    expect(sanitizeLine(input, 3)).toBe('a\u2026');
  });

  it('collapses whitespace', () => {
    expect(sanitizeLine('  a \n\t b  ', 50)).toBe('a b');
  });
});

describe('arbExtractedSource', () => {
  it('samples at least 100 sources covering empty, long, and HTML-like inputs', () => {
    const samples = fc.sample(arbExtractedSource, 120);
    expect(samples.length).toBeGreaterThanOrEqual(100);
    const strings = samples.flatMap((s) => [s.title, ...s.headings, ...s.paragraphs]);
    expect(samples.some((s) => s.headings.length === 0 && s.paragraphs.length === 0)).toBe(true);
    expect(strings.some((t) => t === '')).toBe(true);
    expect(strings.some((t) => t.length >= 1000)).toBe(true);
    expect(strings.some((t) => /<[a-z!/]/i.test(t))).toBe(true);
  });
});
