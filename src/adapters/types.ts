import type { ValidationError } from '../model/manifest';

export type BurnErrorCode =
  | 'empty-input'
  | 'unsupported-scheme'
  | 'input-too-long'
  | 'invalid-github-url'
  | 'repo-not-found'
  | 'rate-limited'
  | 'timeout'
  | 'network'
  | 'unavailable'
  | 'fetch-failed'
  | 'validation-failed'
  | 'cancelled';

export interface BurnError {
  code: BurnErrorCode;
  message: string;
  validation?: ValidationError[];
  fallbackTopic?: string;
  /** For a rate limit: roughly how many minutes until the source takes requests again, when known. */
  retryMinutes?: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: BurnError };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AdapterOptions {
  /** Defaults to the global fetch. */
  fetch?: FetchLike;
  /** User cancel. */
  signal?: AbortSignal;
  /** Deadline in ms, covering the body read. */
  timeoutMs?: number;
}
