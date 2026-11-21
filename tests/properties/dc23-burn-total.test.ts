// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 23: Burn never throws and never yields an invalid disc
// **Validates: Requirements 6.3, 14.5**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { burn } from '../../src/adapters/burn';
import { validateManifest } from '../../src/model/validate';
import { arbFetchBehavior, arbGithubUrl, makeFetch } from '../generators-io';

const arbInput = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ unit: 'binary', maxLength: 100 }),
  fc.constantFrom('', '   ', 'https://example.com/page', 'http://localhost/x', 'ftp://x/y', 'Rust: a language'),
  fc.webUrl(),
  arbGithubUrl.map((g) => g.input),
  fc.constantFrom('# Title\n\nSome text\n\n## Part\n\nMore text', 'Dungeons and dragons'),
);

describe('Property 23: Burn never throws and never yields an invalid disc', () => {
  it('always resolves; any ok result passes validateManifest', async () => {
    await fc.assert(
      fc.asyncProperty(arbInput, arbFetchBehavior, fc.boolean(), async (input, behavior, abortEarly) => {
        const ctl = new AbortController();
        // Unblocks "hang" behaviors without waiting for the adapter deadlines.
        const timer = setTimeout(() => ctl.abort(), 5);
        if (abortEarly) ctl.abort();
        try {
          const r = await burn(input, { fetch: makeFetch(behavior), signal: ctl.signal });
          if (r.ok) {
            expect(validateManifest(r.manifest).ok).toBe(true);
          } else {
            expect(typeof r.error.code).toBe('string');
            expect(r.error.message).not.toMatch(/[<>]/);
          }
        } finally {
          clearTimeout(timer);
        }
      }),
      { numRuns: 100 },
    );
  });
});
