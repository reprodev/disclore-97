// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGithubSource } from '../../src/adapters/github';
import type { FetchLike } from '../../src/adapters/types';

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const REPO = {
  full_name: 'octo/hello',
  description: 'A friendly repo',
  default_branch: 'main',
  language: 'TypeScript',
  stargazers_count: 42,
  topics: ['demo', 'cli'],
  license: { name: 'MIT License' },
  owner: { login: 'octo' },
};

function makeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const path = url.replace('https://api.github.com/repos/octo/hello', '') || '/';
    const route = routes[path];
    if (!route) throw new Error('unexpected ' + url);
    return route();
  };
  return { fn, calls };
}

const okRoutes = () => ({
  '/': () => json(REPO),
  '/languages': () => json({ Go: 10, TypeScript: 500, CSS: 50 }),
  '/readme': () => json({ encoding: 'base64', content: b64('# Hello\n\n## Usage\n\nThis is the readme body.') }),
});

afterEach(() => vi.useRealTimers());

describe('fetchGithubSource', () => {
  it('builds an ExtractedSource from all three responses', async () => {
    const { fn } = makeFetch(okRoutes());
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.value;
    expect(s.title).toBe('octo/hello');
    expect(s.headings[0]).toBe('About this repository');
    expect(s.headings).toContain('Usage');
    expect(s.paragraphs[0]).toBe('A friendly repo');
    expect(s.paragraphs.join('\n')).toContain('This is the readme body.');
    expect(s.paragraphs[1]).toContain('Stars: 42');
    expect(s.paragraphs[1]).toContain('License: MIT License');
    expect(s.metadata.kind).toBe('github');
    expect(s.metadata.source).toBe('https://github.com/octo/hello');
    expect(s.metadata.languages).toEqual(['TypeScript', 'CSS', 'Go']);
    expect(s.metadata.author).toBe('octo');
  });

  it('still succeeds when the README is missing', async () => {
    const { fn } = makeFetch({ ...okRoutes(), '/readme': () => json({ message: 'Not Found' }, 404) });
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.paragraphs[0]).toBe('A friendly repo');
      expect(r.value.paragraphs.join('\n')).not.toContain('readme body');
    }
  });

  it('ignores a README with a non-base64 encoding', async () => {
    const { fn } = makeFetch({
      ...okRoutes(),
      '/readme': () => json({ encoding: 'none', content: 'plain readme text here' }),
    });
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.paragraphs.join('\n')).not.toContain('plain readme text');
  });

  it('returns repo-not-found on 404', async () => {
    const { fn } = makeFetch({ '/': () => json({ message: 'Not Found' }, 404) });
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('repo-not-found');
  });

  it.each([403, 429])('returns rate-limited on %i', async (status) => {
    const { fn } = makeFetch({ '/': () => json({ message: 'limit' }, status) });
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('rate-limited');
  });

  it('returns timeout when the request never resolves', async () => {
    vi.useFakeTimers();
    const fn: FetchLike = () => new Promise<Response>(() => undefined);
    const p = fetchGithubSource('octo', 'hello', { fetch: fn, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('timeout');
  });

  it('returns network when fetch rejects', async () => {
    const fn: FetchLike = () => Promise.reject(new TypeError('failed'));
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('network');
  });

  it('returns cancelled when the signal is already aborted', async () => {
    const { fn, calls } = makeFetch(okRoutes());
    const ac = new AbortController();
    ac.abort();
    const r = await fetchGithubSource('octo', 'hello', { fetch: fn, signal: ac.signal });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('cancelled');
    expect(calls).toHaveLength(0);
  });

  it('returns cancelled when aborted mid-request', async () => {
    const fn: FetchLike = () => new Promise<Response>(() => undefined);
    const ac = new AbortController();
    const p = fetchGithubSource('octo', 'hello', { fetch: fn, signal: ac.signal });
    ac.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('cancelled');
  });

  it('only calls api.github.com and sends no Authorization header', async () => {
    const { fn, calls } = makeFetch(okRoutes());
    await fetchGithubSource('octo', 'hello', { fetch: fn });
    expect(calls).toHaveLength(3);
    for (const c of calls) {
      expect(c.url.startsWith('https://api.github.com/')).toBe(true);
      const h = new Headers(c.init?.headers);
      expect(h.has('authorization')).toBe(false);
    }
  });
});
