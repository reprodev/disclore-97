// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 14: SSRF guard blocks private IPv4 in every notation
// **Validates: Requirements 10.3, 10.5, 17.13**
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkTarget } from '../../src/extract/ssrf';
import { arbBlockedIPv4Text, arbBlockedIPv4, IPV4_RENDERERS } from '../generators-io';

describe('Property 14: SSRF guard blocks private IPv4 in every notation', () => {
  it('rejects every blocked address in any notation, over http and https', () => {
    fc.assert(
      fc.property(arbBlockedIPv4Text, fc.constantFrom('http', 'https'), ({ text }, scheme) => {
        const verdict = checkTarget(`${scheme}://${text}/`);
        expect(verdict.ok).toBe(false);
        if (!verdict.ok) expect(verdict.reason).toBe('private-address');
      }),
      { numRuns: 200 },
    );
  });

  it('rejects the same address in all notations', () => {
    fc.assert(
      fc.property(arbBlockedIPv4, (octets) => {
        for (const [, render] of IPV4_RENDERERS) {
          expect(checkTarget(`https://${render(octets)}/`).ok).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
