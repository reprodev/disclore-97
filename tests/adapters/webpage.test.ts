// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWebpageSource } from '../../src/adapters/webpage';
import type { FetchLike } from '../../src/adapters/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function makeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return respond();
  };
  return { fn, calls };
}

afterEach(() => vi.useRealTimers());

describe('fetchWebpageSource', () => {
  it('requests the encoded url on the same-origin endpoint', async () => {
    const { fn, calls } = makeFetch(() => json({ title: 'T', headings: [], paragraphs: [] }));
    const target = 'https://example.com/a b?x=1&y=2#frag';
    await fetchWebpageSource(target, { fetch: fn });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/api/extract?url=${encodeURIComponent(target)}`);
    expect(calls[0].url.startsWith('/api/extract?url=')).toBe(true);
  });

  it('builds an ExtractedSource on success', async () => {
    const { fn } = makeFetch(() =>
      json({ title: 'Page', headings: ['A', 'B'], paragraphs: ['p1', 'p2'], url: 'https://example.com/final' }),
    );
    const r = await fetchWebpageSource('https://example.com/', { fetch: fn });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe('Page');
    expect(r.value.headings).toEqual(['A', 'B']);
    expect(r.value.paragraphs).toEqual(['p1', 'p2']);
    expect(r.value.metadata.kind).toBe('webpage');
    expect(r.value.metadata.source).toBe('https://example.com/final');
  });

  it('maps 404 to unavailable', async () => {
    const { fn } = makeFetch(() => new Response('Not found', { status: 404 }));
    const r = await fetchWebpageSource('https://example.com/', { fetch: fn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unavailable');
  });

  it('maps an SPA index.html with status 200 to unavailable', async () => {
    const { fn } = makeFetch(
      () => new Response('<!doctype html><html><body><div id="root"></div></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const r = await fetchWebpageSource('https://example.com/', { fetch: fn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unavailable');
  });

  it('maps an error JSON body to fetch-failed with its message', async () => {
    const { fn } = makeFetch(() => json({ error: { message: 'Blocked target <b>host</b>' } }, 403));
    const r = await fetchWebpageSource('https://example.com/', { fetch: fn });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('fetch-failed');
    expect(r.error.message).toContain('Blocked target');
    expect(r.error.message).not.toMatch(/[<>]/);
  });

  it('maps a wrong response shape to fetch-failed', async () => {
    for (const body of [{ title: 1, headings: [], paragraphs: [] }, { title: 'T', headings: 'x', paragraphs: [] }, [], null]) {
      const { fn } = makeFetch(() => json(body));
      const r = await fetchWebpageSource('https://example.com/', { fetch: fn });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('fetch-failed');
    }
  });

  it('times out after 12000 ms', async () => {
    vi.useFakeTimers();
    const fn: FetchLike = (_url, init) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
      });
    const p = fetchWebpageSource('https://example.com/', { fetch: fn });
    await vi.advanceTimersByTimeAsync(11999);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('timeout');
  });

  it('maps an outer abort to cancelled', async () => {
    const ac = new AbortController();
    const fn: FetchLike = (_url, init) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
      });
    const p = fetchWebpageSource('https://example.com/', { fetch: fn, signal: ac.signal });
    ac.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('cancelled');
  });
});
