// @vitest-environment node
// Feature: dynamic-disc-compiler, Property 16: SSRF guard rejects bad scheme, credentials, and ports
// **Validates: Requirements 10.1, 10.6, 10.7**
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { checkTarget } from '../../src/extract/ssrf';
import { arbPublicHost } from '../generators-io';

const arbBadScheme = fc.constantFrom('ftp', 'file', 'gopher', 'ws', 'wss', 'javascript', 'data', 'ssh');
const arbCred = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const arbBadPort = fc.integer({ min: 1, max: 65535 }).filter((p) => p !== 80 && p !== 443);

describe('Property 16: SSRF guard rejects bad scheme, credentials, and ports', () => {
  it('rejects non-http(s) schemes', () => {
    fc.assert(
      fc.property(arbPublicHost, arbBadScheme, (host, scheme) => {
        return checkTarget(`${scheme}://${host}/`).ok === false;
      }),
      { numRuns: 100 },
    );
  });

  it('rejects embedded credentials', () => {
    fc.assert(
      fc.property(
        arbPublicHost,
        fc.constantFrom('http', 'https'),
        arbCred,
        fc.option(arbCred, { nil: undefined }),
        (host, scheme, user, pass) => {
          const auth = pass === undefined ? user : `${user}:${pass}`;
          return checkTarget(`${scheme}://${auth}@${host}/`).ok === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects ports other than 80 and 443', () => {
    fc.assert(
      fc.property(arbPublicHost, fc.constantFrom('http', 'https'), arbBadPort, (host, scheme, port) => {
        return checkTarget(`${scheme}://${host}:${port}/`).ok === false;
      }),
      { numRuns: 100 },
    );
  });
});
