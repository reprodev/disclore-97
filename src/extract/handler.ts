/**
 * handleExtract: testable core of the /api/extract Pages Function.
 * Fetches a public web page with SSRF checks, and returns its extracted text as JSON.
 */

import { checkTarget } from './ssrf';
import { extractHtml } from './htmlExtract';

export interface ExtractDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Optional environment bindings. No configuration is required. */
  env?: Record<string, string | undefined>;
}

export const MAX_REDIRECTS = 3;
export const DEADLINE_MS = 8000;
export const MAX_BYTES = 1024 * 1024;
const USER_AGENT = 'Disclore97-Extractor/1.0 (+text extraction for a retro disc viewer)';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function json(status: number, body: Record<string, unknown>, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

class Failure extends Error {
  constructor(readonly response: Response) {
    super('extract-failure');
  }
}

function fail(status: number, error: string, extra?: Record<string, unknown>): Failure {
  return new Failure(json(status, { error, ...extra }));
}

async function readLimited(res: Response, signal: AbortSignal): Promise<string> {
  const body = res.body;
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const onAbort = () => {
    reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', onAbort);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw fail(502, 'too-large');
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder('utf-8').decode(all);
}

async function run(
  start: URL,
  deps: ExtractDeps,
  signal: AbortSignal,
  timedOut: Promise<never>,
): Promise<Response> {
  let current = start;
  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await Promise.race([
        deps.fetch(current.href, {
          method: 'GET',
          redirect: 'manual',
          credentials: 'omit',
          signal,
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html, application/xhtml+xml',
          },
        }),
        timedOut,
      ]);
    } catch (e) {
      if (e instanceof Failure) throw e;
      if (signal.aborted) throw fail(504, 'timeout');
      throw fail(502, 'upstream-failed');
    }

    if (REDIRECT_STATUSES.has(res.status)) {
      await res.body?.cancel().catch(() => undefined);
      const loc = res.headers.get('location');
      if (!loc) throw fail(502, 'upstream-failed');
      if (hop >= MAX_REDIRECTS) throw fail(502, 'too-many-redirects');
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        throw fail(502, 'upstream-failed');
      }
      const verdict = checkTarget(next);
      if (!verdict.ok) throw fail(403, 'forbidden-target', { reason: verdict.reason });
      current = verdict.url;
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel().catch(() => undefined);
      throw fail(502, 'upstream-failed', { status: res.status });
    }

    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'text/html' && type !== 'application/xhtml+xml') {
      await res.body?.cancel().catch(() => undefined);
      throw fail(415, 'unsupported-content-type');
    }
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      await res.body?.cancel().catch(() => undefined);
      throw fail(502, 'too-large');
    }

    let html: string;
    try {
      html = await Promise.race([readLimited(res, signal), timedOut]);
    } catch (e) {
      if (e instanceof Failure) throw e;
      if (signal.aborted) throw fail(504, 'timeout');
      throw fail(502, 'upstream-failed');
    }
    const { title, headings, paragraphs } = extractHtml(html);
    return json(200, { title, headings, paragraphs, url: current.href });
  }
}

export async function handleExtract(request: Request, deps: ExtractDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'method-not-allowed' }, { allow: 'GET' });
  }
  let target: string | null;
  try {
    target = new URL(request.url).searchParams.get('url');
  } catch {
    target = null;
  }
  if (!target) return json(400, { error: 'missing-url' });

  const verdict = checkTarget(target);
  if (!verdict.ok) return json(403, { error: 'forbidden-target', reason: verdict.reason });

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(fail(504, 'timeout'));
    }, DEADLINE_MS);
  });
  timedOut.catch(() => undefined);
  try {
    return await run(verdict.url, deps, controller.signal, timedOut);
  } catch (e) {
    if (e instanceof Failure) return e.response;
    return json(502, { error: 'upstream-failed' });
  } finally {
    clearTimeout(timer);
  }
}
