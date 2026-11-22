// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fetchGithubSource, readmeImages } from '../../src/adapters/github';
import { fetchWebpageSource } from '../../src/adapters/webpage';
import type { FetchLike } from '../../src/adapters/types';

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const RAW = ['https:', '', 'raw.githubusercontent.com'].join('/');

describe('readmeImages', () => {
  it('resolves relative Markdown and HTML images to raw repository files', () => {
    const md = [
      '![Logo](docs/logo.png)',
      '![Shot](./shots/one.jpg "A title")',
      '![Root](/assets/root.png)',
      '<img src="docs/html.png" alt="Html">',
    ].join('\n\n');
    expect(readmeImages(md, 'octo', 'hello').map((i) => i.url)).toEqual([
      `${RAW}/octo/hello/HEAD/docs/logo.png`,
      `${RAW}/octo/hello/HEAD/shots/one.jpg`,
      `${RAW}/octo/hello/HEAD/assets/root.png`,
      `${RAW}/octo/hello/HEAD/docs/html.png`,
    ]);
  });

  it('keeps safe absolute https images and drops badges, http, data, and escapes', () => {
    const md = [
      '![ok](https://cdn.example.org/ok.png)',
      '![badge](https://img.shields.io/badge/a-b.svg)',
      '![svg](docs/diagram.svg)',
      '![http](http://cdn.example.org/a.png)',
      '![data](data:image/png;base64,AAAA)',
      '![js](javascript:alert(1))',
      '![up](../../escape.png)',
      '![proto](//cdn.example.org/p.png)',
    ].join('\n');
    expect(readmeImages(md, 'octo', 'hello').map((i) => i.url)).toEqual(['https://cdn.example.org/ok.png']);
  });

  it('caps the list and stays fast on hostile input', () => {
    const many = Array.from({ length: 100 }, (_, i) => `![p${i}](img/${i}.png)`).join('\n');
    expect(readmeImages(many, 'o', 'r').length).toBeLessThanOrEqual(32);
    const start = Date.now();
    readmeImages('![' .repeat(50000), 'o', 'r');
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('fetchGithubSource media', () => {
  const routes = (owner: Record<string, unknown>, readme: string): FetchLike => async (url) => {
    const path = url.replace('https://api.github.com/repos/octo/hello', '') || '/';
    if (path === '/') return json({ full_name: 'octo/hello', owner });
    if (path === '/languages') return json({});
    if (path === '/readme') return json({ encoding: 'base64', content: b64(readme) });
    throw new Error('unexpected ' + url);
  };

  it('puts the owner avatar first, then README pictures', async () => {
    const f = routes({ login: 'octo', avatar_url: 'https://avatars.example.org/u/1?v=4' }, '# Hi\n\n![Logo](logo.png)');
    const r = await fetchGithubSource('octo', 'hello', { fetch: f });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.media).toEqual([
      { url: 'https://avatars.example.org/u/1?v=4', caption: 'octo on GitHub' },
      { url: `${RAW}/octo/hello/HEAD/logo.png`, caption: 'Logo' },
    ]);
  });

  it('ignores an unsafe avatar and omits media when there are no pictures', async () => {
    const f = routes({ login: 'octo', avatar_url: 'http://avatars.example.org/u/1' }, '# Hi\n\nText only.');
    const r = await fetchGithubSource('octo', 'hello', { fetch: f });
    expect(r.ok).toBe(true);
    if (r.ok) expect('media' in r.value).toBe(false);
  });
});

describe('fetchWebpageSource media', () => {
  const page = (media: unknown): FetchLike => async () =>
    json({ title: 'T', headings: [], paragraphs: ['p'], url: 'https://example.com/', media });

  it('passes safe pictures through and filters unsafe ones', async () => {
    const r = await fetchWebpageSource('https://example.com/', {
      fetch: page([
        { url: 'https://example.com/a.png', caption: 'A <b>pic</b>' },
        { url: 'http://example.com/b.png', caption: 'insecure' },
        { url: 'https://example.com/c.svg', caption: 'vector' },
      ]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.media).toHaveLength(1);
    expect(r.value.media![0].url).toBe('https://example.com/a.png');
    expect(r.value.media![0].caption).not.toMatch(/[<>]/);
  });

  it('omits media when the response has none', async () => {
    const r = await fetchWebpageSource('https://example.com/', { fetch: page(undefined) });
    expect(r.ok).toBe(true);
    if (r.ok) expect('media' in r.value).toBe(false);
  });
});
