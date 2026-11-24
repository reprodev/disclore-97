import type { BurnError, BurnErrorCode } from './types';

export const ERROR_MESSAGES: Record<BurnErrorCode, string> = {
  'empty-input': 'Please paste a GitHub address, a web page address, some Markdown, or a topic.',
  'unsupported-scheme': 'Only http and https addresses are supported.',
  'input-too-long': 'That input is too long. Please keep it under 20000 characters.',
  'invalid-github-url': 'That does not look like a GitHub repository address. Use the form https://github.com/owner/repo.',
  'repo-not-found': 'That GitHub repository could not be found. It may be private or the name may be wrong.',
  'rate-limited':
    'All lines to the GitHub archive are busy. GitHub takes about 20 repository burns an hour from each connection. Please wait up to an hour and redial, or choose Burn offline to make an outline disc now.',
  timeout: 'The request took too long and was stopped. Please try again.',
  network: 'The network could not be reached. Check your connection and try again.',
  unavailable: 'The page reader is not available, so that address cannot be read here.',
  'fetch-failed': 'The content could not be fetched.',
  'validation-failed': 'The disc could not be built because it failed its safety checks.',
  cancelled: 'The burn was cancelled.',
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
