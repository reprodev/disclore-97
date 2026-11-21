// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleExtract, MAX_BYTES, DEADLINE_MS } from '../../src/extract/handler';

const HTML = '<html><head><title>Hi</title></head><body><h1>Head</h1><p>Some paragraph text here.</p></body></html>';

function htmlRes(body: string = HTML, type = 'text/html; charset=utf-8'): Response {
  return new Response(body, { status: 200, headers: { 'content-type': type } });
}
function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { location: to } });
}
function req(target: string | null, method = 'GET'): Request {
  const u = target === null ? 'https://app.test/api/extract' : `https://app.test/api/extract?url=${encodeURIComponent(target)}`;
  return new Request(u, { method });
}
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

afterEach(() => {
  vi.useRealTimers();
});

describe('handleExtract', () => {
  it('returns 200 with extracted content', async () => {
    const fetch = vi.fn<Fetch>(async () => htmlRes());
    const res = await handleExtract(req('https://example.com/a'), { fetch });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Hi');
    expect(body.url).toBe('https://example.com/a');
  });

  it('returns 400 when url is missing', async () => {
    const fetch = vi.fn<Fetch>();
    const res = await handleExtract(req(null), { fetch });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 403 for a forbidden initial URL without calling fetch', async () => {
    const fetch = vi.fn<Fetch>();
    for (const u of ['http://127.0.0.1/', 'http://localhost/', 'ftp://example.com/', 'http://10.0.0.1/']) {
      const res = await handleExtract(req(u), { fetch });
      expect(res.status).toBe(403);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 403 when a redirect targets a forbidden address', async () => {
    const fetch = vi.fn<Fetch>(async () => redirect('http://127.0.0.1/admin'));
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['POST', 'PUT', 'DELETE', 'HEAD'])('returns 405 for %s', async (method) => {
    const fetch = vi.fn<Fetch>();
    const res = await handleExtract(req('https://example.com/', method), { fetch });
    expect(res.status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 415 for a non-HTML content type', async () => {
    const fetch = vi.fn<Fetch>(async () => htmlRes('{}', 'application/json'));
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(415);
  });

  it('returns 502 for an upstream error status', async () => {
    const fetch = vi.fn<Fetch>(async () => new Response('no', { status: 500 }));
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch throws', async () => {
    const fetch = vi.fn<Fetch>(async () => {
      throw new Error('boom');
    });
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(502);
  });

  it('returns 504 when upstream exceeds the deadline', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<Fetch>(
      (_u, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const p = handleExtract(req('https://example.com/'), { fetch });
    await vi.advanceTimersByTimeAsync(DEADLINE_MS + 10);
    const res = await p;
    expect(res.status).toBe(504);
  });

  it('follows a chain of 3 redirects', async () => {
    let n = 0;
    const fetch = vi.fn<Fetch>(async () => (n++ < 3 ? redirect(`https://example.com/r${n}`) : htmlRes()));
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('fails a chain of 4 redirects with too-many-redirects', async () => {
    let n = 0;
    const fetch = vi.fn<Fetch>(async () => (n++ < 4 ? redirect(`https://example.com/r${n}`) : htmlRes()));
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('too-many-redirects');
  });

  it('returns 502 too-large for a body over 1 MiB', async () => {
    const fetch = vi.fn<Fetch>(async () => htmlRes('a'.repeat(MAX_BYTES + 1)));
    const res = await handleExtract(req('https://example.com/'), { fetch });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('too-large');
  });

  it('sends a User-Agent and no Cookie upstream', async () => {
    const fetch = vi.fn<Fetch>(async () => htmlRes());
    const request = new Request('https://app.test/api/extract?url=' + encodeURIComponent('https://example.com/'), {
      headers: { cookie: 'session=secret' },
    });
    await handleExtract(request, { fetch });
    const init = fetch.mock.calls[0][1]!;
    const headers = new Headers(init.headers);
    expect(headers.get('user-agent')).toBeTruthy();
    expect(headers.has('cookie')).toBe(false);
    expect(init.credentials).toBe('omit');
  });
});
