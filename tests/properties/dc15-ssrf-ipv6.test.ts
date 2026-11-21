// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 15: SSRF guard blocks private and mapped IPv6
// **Validates: Requirements 10.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkTarget } from '../../src/extract/ssrf';
import { arbBlockedIPv6 } from '../generators-io';

describe('Property 15: SSRF guard blocks private and mapped IPv6', () => {
  it('rejects every blocked IPv6 host over http and https', () => {
    fc.assert(
      fc.property(arbBlockedIPv6, fc.constantFrom('http', 'https'), (host, scheme) => {
        const verdict = checkTarget(`${scheme}://${host}/`);
        expect(verdict.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
