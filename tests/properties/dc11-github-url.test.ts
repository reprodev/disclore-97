import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseInput } from '../../src/model/sourceInput';
import { arbGithubUrl, arbOwnerRepo } from '../generators-io';

// Feature: dynamic-disc-compiler, Property 11: GitHub URL classification
// **Validates: Requirements 1.1, 1.8**

const BAD_CHARS = '!@$%&()*+,;=~^`{}|"<>éß中'.split('');
const GOOD_NAME = fc.constantFrom('abc', 'repo-1', 'my_repo', 'a.b');

const arbBadName = fc
  .tuple(
    fc.array(fc.constantFrom(...'abcXYZ019-_.'.split('')), { maxLength: 5 }),
    fc.constantFrom(...BAD_CHARS),
    fc.array(fc.constantFrom(...'abcXYZ019-_.'.split('')), { maxLength: 5 }),
  )
  .map(([a, c, b]) => a.join('') + c + b.join(''));

const arbDots = fc.integer({ min: 1, max: 6 }).map((n) => '.'.repeat(n));

describe('Property 11: GitHub URL classification', () => {
  it('classifies every generated GitHub URL as github with canonical url', () => {
    fc.assert(
      fc.property(arbGithubUrl, ({ input, owner, repo }) => {
        const r = parseInput(input);
        expect(r).toEqual({
          ok: true,
          kind: 'github',
          owner,
          repo,
          url: `https://github.com/${owner}/${repo}`,
        });
      }),
      { numRuns: 100 },
    );
  });

  it('rejects owner or repo segments with disallowed characters', () => {
    fc.assert(
      fc.property(arbBadName, GOOD_NAME, fc.boolean(), (bad, good, badIsOwner) => {
        const [o, r] = badIsOwner ? [bad, good] : [good, bad];
        expect(parseInput(`https://github.com/${o}/${r}`)).toEqual({
          ok: false,
          error: 'invalid-github-url',
        });
      }),
      { numRuns: 100 },
    );
  });

  it('rejects dot-only segments', () => {
    fc.assert(
      fc.property(arbDots, GOOD_NAME, fc.boolean(), (dots, good, dotsIsOwner) => {
        const [o, r] = dotsIsOwner ? [dots, good] : [good, dots];
        expect(parseInput(`https://github.com/${o}/${r}`)).toEqual({
          ok: false,
          error: 'invalid-github-url',
        });
      }),
      { numRuns: 100 },
    );
  });

  it('rejects URLs with a missing repo', () => {
    fc.assert(
      fc.property(arbOwnerRepo, fc.boolean(), ({ owner }, slash) => {
        expect(parseInput(`https://github.com/${owner}${slash ? '/' : ''}`)).toEqual({
          ok: false,
          error: 'invalid-github-url',
        });
      }),
      { numRuns: 100 },
    );
  });
});
