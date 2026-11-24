import type { BurnError, BurnErrorCode } from './types';

/**
 * The busy-line message for a GitHub rate limit. `minutes` is the approximate wait GitHub reported,
 * when it said. `offerOffline` adds the pointer to the Burn offline button, which only the Burn dialog shows.
 */
export function rateLimitMessage(minutes?: number, offerOffline = true): string {
  const wait =
    minutes === undefined
      ? 'Please wait up to an hour and redial'
      : minutes <= 1
        ? 'The line should clear in about a minute. Please redial then'
        : `The line should clear in about ${minutes} minutes. Please redial then`;
  return (
    'All lines to the GitHub archive are busy. GitHub takes about 20 repository burns an hour from each connection. ' +
    (offerOffline ? `${wait}, or choose Burn offline to make an outline disc now.` : `${wait}.`)
  );
}

export const ERROR_MESSAGES: Record<BurnErrorCode, string> = {
  'empty-input': 'The disc tray is empty. Paste a GitHub address, a web page address, some Markdown, or a topic, then press Burn.',
  'unsupported-scheme': 'This drive reads only http and https addresses. Check the address and try again.',
  'input-too-long': 'That will not fit on one CD-R. Please keep the input under 20000 characters.',
  'invalid-github-url':
    'That does not look like a GitHub repository address. Use the form https://github.com/owner/repo.',
  'repo-not-found': 'No repository answered at that address. It may be private, renamed, or mistyped.',
  'rate-limited': rateLimitMessage(),
  timeout: 'The connection timed out before the transfer finished. Please try again in a moment.',
  network: 'No dial tone: the network could not be reached. Check your connection and try again.',
  unavailable: 'The page reader is not available on this line, so that source cannot be read here.',
  'fetch-failed': 'The transfer failed: the content could not be fetched. The site may block readers or be off the air.',
  'validation-failed': 'The disc failed its safety checks, so nothing was burned.',
  cancelled: 'Burn cancelled. Nothing was written to the disc.',
};

export const FALLBACK_CODES: ReadonlySet<BurnErrorCode> = new Set<BurnErrorCode>([
  'network',
  'timeout',
  'rate-limited',
  'repo-not-found',
  'unavailable',
  'fetch-failed',
]);

export function makeError(code: BurnErrorCode, extra?: string): BurnError {
  const base = ERROR_MESSAGES[code];
  return { code, message: extra ? `${base} ${extra}` : base };
}

/** A rate-limited error, with the approximate wait when GitHub reported one. */
export function rateLimitedError(minutes?: number): BurnError {
  return { code: 'rate-limited', message: rateLimitMessage(minutes), ...(minutes !== undefined ? { retryMinutes: minutes } : {}) };
}
