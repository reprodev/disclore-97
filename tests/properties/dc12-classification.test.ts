import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { parseInput } from '../../src/model/sourceInput';

const KINDS = ['github', 'webpage', 'markdown', 'topic'];
const ERRORS = ['empty-input', 'unsupported-scheme', 'input-too-long', 'invalid-github-url'];

const word = fc.stringMatching(/^[A-Za-z0-9]{1,10}$/);
const ws = fc.stringMatching(/^[ \t\r\n]{0,5}$/);

const arbAnyString = fc.oneof(
  fc.string({ maxLength: 120 }),
  fc.string({ unit: 'binary', maxLength: 60 }),
  fc.constantFrom('http://', 'https://', 'javascript:', '# ', '\n', 'https://github.com/').chain((p) =>
    fc.string({ maxLength: 40 }).map((r) => p + r),
  ),
);

const arbWebUrl = fc
  .tuple(
    fc.constantFrom('http', 'https', 'HTTPS'),
    fc.array(word, { minLength: 1, maxLength: 3 }),
    fc.constantFrom('com', 'org', 'net'),
    fc.array(word, { maxLength: 3 }),
  )
  .map(([scheme, labels, tld, path]) => `${scheme}://${labels.join('.')}x.${tld}/${path.join('/')}`);

const arbMarkdown = fc.oneof(
  fc.tuple(word, word).map(([a, b]) => `${a}\n${b}`),
  word.map((w) => `# ${w}`),
  fc.tuple(word, word).map(([a, b]) => `${a} ${b}\n\n## ${b}`),
);

const arbTopic = fc
  .array(word, { minLength: 1, maxLength: 5 })
  .map((ws2) => ws2.join(' '));

describe('Property 12: Classification partition, trim invariance, and purity', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('fetch must not be called by parseInput');
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // Feature: dynamic-disc-compiler, Property 12: Classification partition, trim invariance, and purity
  // **Validates: Requirements 1.2, 1.3, 1.4, 1.9, 1.10**
  it('returns exactly one kind or error, is trim-invariant and pure, and never fetches or throws', () => {
    fc.assert(
      fc.property(arbAnyString, ws, ws, (s, w1, w2) => {
        const r = parseInput(s);
        if (r.ok) {
          expect(KINDS).toContain(r.kind);
        } else {
          expect(ERRORS).toContain(r.error);
        }
        expect(parseInput(s)).toEqual(r);
        expect(parseInput(w1 + s + w2)).toEqual(r);
        expect(parseInput(' \n' + s + ' \t')).toEqual(r);
        expect(globalThis.fetch).not.toHaveBeenCalled();
      }),
      { numRuns: 200 },
    );
  });

  // Feature: dynamic-disc-compiler, Property 12: Classification partition, trim invariance, and purity
  // **Validates: Requirements 1.2, 1.3, 1.4, 1.9, 1.10**
  it('classifies non-GitHub URLs as webpage, line-break/heading text as markdown, other single-line text as topic', () => {
    fc.assert(
      fc.property(arbWebUrl, arbMarkdown, arbTopic, ws, ws, (url, md, topic, w1, w2) => {
        const a = parseInput(w1 + url + w2);
        expect(a.ok && a.kind).toBe('webpage');
        const b = parseInput(w1 + md + w2);
        expect(b.ok && b.kind).toBe('markdown');
        const c = parseInput(w1 + topic + w2);
        expect(c.ok && c.kind).toBe('topic');
        expect(globalThis.fetch).not.toHaveBeenCalled();
      }),
      { numRuns: 200 },
    );
  });
});
