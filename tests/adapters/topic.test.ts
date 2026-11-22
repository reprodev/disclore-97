// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fetchTopicSource } from '../../src/adapters/topic';
import type { FetchLike } from '../../src/adapters/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const PAGE = ['https:', '', 'en.example.org', 'wiki', 'Lighthouse'].join('/');

const GOOD = {
  title: 'Lighthouse',
  headings: ['History', 'Design'],
  paragraphs: ['A lighthouse is a tower with a light.', 'Fresnel lenses made lights stronger.'],
  media: [
    { url: 'https://cdn.example.org/a.jpg', caption: 'A <b>tower</b>' },
    { url: 'http://cdn.example.org/b.jpg', caption: 'insecure' },
    { url: 'https://cdn.example.org/c.svg', caption: 'vector' },
    { url: 'javascript:alert(1)', caption: 'script' },
    { url: 'https://127.0.0.1/d.jpg', caption: 'private' },
  ],
  metadata: { kind: 'topic', source: PAGE },
};

describe('fetchTopicSource', () => {
  it('calls /api/topic with the encoded topic and returns an ExtractedSource', async () => {
    const f = vi.fn<FetchLike>(async () => json(GOOD));
    const r = await fetchTopicSource('tide pools & more', { fetch: f });
    expect(f.mock.calls[0]![0]).toBe('/api/topic?q=tide%20pools%20%26%20more');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe('Lighthouse');
    expect(r.value.headings).toEqual(['History', 'Design']);
    expect(r.value.paragraphs).toHaveLength(2);
    expect(r.value.metadata).toEqual({ kind: 'topic', source: PAGE });
  });

  it('re-validates picture addresses and sanitizes captions', async () => {
    const r = await fetchTopicSource('x', { fetch: async () => json(GOOD) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.media).toHaveLength(1);
    expect(r.value.media![0].url).toBe('https://cdn.example.org/a.jpg');
    expect(r.value.media![0].caption).not.toMatch(/[<>]/);
  });

  it('omits media when none is safe or none was sent', async () => {
    const none = await fetchTopicSource('x', { fetch: async () => json({ ...GOOD, media: undefined }) });
    const bad = await fetchTopicSource('x', { fetch: async () => json({ ...GOOD, media: [GOOD.media[1]] }) });
    for (const r of [none, bad]) {
      expect(r.ok).toBe(true);
      if (r.ok) expect('media' in r.value).toBe(false);
    }
  });

  it('uses a Topic label when the reply names no usable source, and the topic when the title is blank', async () => {
    const r = await fetchTopicSource('Tide pools', {
      fetch: async () => json({ ...GOOD, title: '  ', metadata: { kind: 'topic', source: 'javascript:alert(1)' } }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe('Tide pools');
    expect(r.value.metadata.source).toBe('Topic: Tide pools');
  });

  it('caps the query length and the list sizes', async () => {
    const f = vi.fn<FetchLike>(async () =>
      json({ ...GOOD, headings: Array.from({ length: 30 }, (_, i) => `H${i}`), paragraphs: Array.from({ length: 80 }, (_, i) => `P${i}`) }),
    );
    const r = await fetchTopicSource('x'.repeat(400), { fetch: f });
    expect(decodeURIComponent(String(f.mock.calls[0]![0]).split('q=')[1]!)).toHaveLength(100);
    expect(r.ok && r.value.headings).toHaveLength(12);
    expect(r.ok && r.value.paragraphs).toHaveLength(40);
  });

  it.each([
    ['a 404', () => new Response('no', { status: 404 }), 'unavailable'],
    ['non-JSON', () => new Response('<html>', { status: 200 }), 'unavailable'],
    ['a 502', () => json({ error: 'upstream-failed' }, 502), 'fetch-failed'],
    ['a wrong shape', () => json({ title: 5, headings: [], paragraphs: ['x'] }), 'fetch-failed'],
    ['no paragraphs', () => json({ title: 'T', headings: [], paragraphs: [] }), 'fetch-failed'],
    ['a non-object', () => json([1, 2]), 'fetch-failed'],
  ])('fails with a coded error for %s', async (_name, make, code) => {
    const r = await fetchTopicSource('x', { fetch: async () => make() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });

  it('fails (never throws) on a network error, a timeout, and an abort', async () => {
    const down = await fetchTopicSource('x', { fetch: () => Promise.reject(new Error('offline')) });
    expect(!down.ok && down.error.code).toBe('network');

    const slow = await fetchTopicSource('x', {
      timeoutMs: 20,
      fetch: (_u, init) =>
        new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort')))),
    });
    expect(!slow.ok && slow.error.code).toBe('timeout');

    const ctl = new AbortController();
    ctl.abort();
    const gone = await fetchTopicSource('x', { fetch: async () => json(GOOD), signal: ctl.signal });
    expect(!gone.ok && gone.error.code).toBe('cancelled');
  });

  it('honors a custom endpoint', async () => {
    const f = vi.fn<FetchLike>(async () => json(GOOD));
    await fetchTopicSource('x', { fetch: f, endpoint: '/alt/topic' });
    expect(f.mock.calls[0]![0]).toBe('/alt/topic?q=x');
  });
});
