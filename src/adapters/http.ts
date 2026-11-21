import { makeError } from './errors';
import type { FetchLike, Result } from './types';

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  /** Full body text, read inside the deadline. */
  text: string;
}

/**
 * GET-style request with a deadline that also covers reading the body.
 * Never throws. Outcomes: outer abort -> cancelled, deadline -> timeout, other failure -> network.
 */
export async function fetchWithDeadline(
  fetchFn: FetchLike,
  url: string,
  init: RequestInit | undefined,
  ms: number,
  outer?: AbortSignal,
): Promise<Result<HttpResponse>> {
  if (outer?.aborted) return { ok: false, error: makeError('cancelled') };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener('abort', onOuterAbort, { once: true });

  // Rejects when the controller aborts, so a fetch that ignores its signal still ends.
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  aborted.catch(() => undefined);

  try {
    const work = (async (): Promise<HttpResponse> => {
      const res = await fetchFn(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { status: res.status, ok: res.ok, headers: res.headers, text };
    })();
    work.catch(() => undefined);
    const value = await Promise.race([work, aborted]);
    return { ok: true, value };
  } catch {
    if (outer?.aborted) return { ok: false, error: makeError('cancelled') };
    if (timedOut) return { ok: false, error: makeError('timeout') };
    return { ok: false, error: makeError('network') };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}
