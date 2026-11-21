import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, FALLBACK_CODES, makeError } from '../../src/adapters/errors';
import type { BurnErrorCode } from '../../src/adapters/types';

// Record forces this list to cover every BurnErrorCode at type-check time.
const ALL_CODES_RECORD: Record<BurnErrorCode, true> = {
  'empty-input': true,
  'unsupported-scheme': true,
  'input-too-long': true,
  'invalid-github-url': true,
  'repo-not-found': true,
  'rate-limited': true,
  timeout: true,
  network: true,
  unavailable: true,
  'fetch-failed': true,
  'validation-failed': true,
  cancelled: true,
};
const ALL_CODES = Object.keys(ALL_CODES_RECORD) as BurnErrorCode[];

describe('ERROR_MESSAGES', () => {
  it('has exactly one entry per BurnErrorCode', () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...ALL_CODES].sort());
  });

  it.each(ALL_CODES)('message for %s is non-empty and has no angle brackets', (code) => {
    const message = ERROR_MESSAGES[code];
    expect(message.trim().length).toBeGreaterThan(0);
    expect(message).not.toMatch(/[<>]/);
    expect(makeError(code).message).not.toMatch(/[<>]/);
  });
});

describe('FALLBACK_CODES', () => {
  it('matches exactly the six codes of Requirement 11.3', () => {
    expect([...FALLBACK_CODES].sort()).toEqual(
      ['fetch-failed', 'network', 'rate-limited', 'repo-not-found', 'timeout', 'unavailable'],
    );
  });
});
