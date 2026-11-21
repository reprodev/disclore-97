// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkTarget } from '../../src/extract/ssrf';
import { arbPublicHost } from '../generators-io';

// Feature: dynamic-disc-compiler, Property 17: SSRF guard permits public hostnames
// **Validates: Requirements 10.12**

describe('Property 17: SSRF guard permits public hostnames', () => {
  it('accepts public hostnames over http/https with port absent, 80, or 443', () => {
    fc.assert(
      fc.property(
        arbPublicHost,
        fc.constantFrom('http', 'https'),
        fc.constantFrom('', ':80', ':443'),
        (host, scheme, port) => {
          const verdict = checkTarget(`${scheme}://${host}${port}/path`);
          expect(verdict.ok).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
