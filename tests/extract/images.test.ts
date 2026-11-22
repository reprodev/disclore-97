// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { extractImages } from '../../src/extract/htmlExtract';
import { handleExtract } from '../../src/extract/handler';

const BASE = 'https://example.com/blog/post.html';

describe('extractImages', () => {
  it('reads og:image, twitter:image, and img tags in page order', () => {
    const html =
      '<head><meta property="og:image" content="https://cdn.example.org/og.jpg">' +
      '<meta name="twitter:image" content="https://cdn.example.org/tw.jpg"></head>' +
      '<body><img src="https://cdn.example.org/body.png" alt="A body picture"></body>';
    expect(extractImages(html, BASE)).toEqual([
      { url: 'https://cdn.example.org/og.jpg', caption: '' },
      { url: 'https://cdn.example.org/tw.jpg', caption: '' },
      { url: 'https://cdn.example.org/body.png', caption: 'A body picture' },
    ]);
  });

  it('resolves relative and protocol-relative paths against the page', () => {
    const html = '<img src="/img/a.png"><img src="b.png"><img src="//cdn.example.org/c.png">';
    expect(extractImages(html, BASE).map((i) => i.url)).toEqual([
      'https://example.com/img/a.png',
      'https://example.com/blog/b.png',
      'https://cdn.example.org/c.png',
    ]);
  });

  it('decodes entities in addresses and alt text', () => {
    const [img] = extractImages('<img src="/a.png?x=1&amp;y=2" alt="Tom &amp; Jerry">', BASE);
    expect(img).toEqual({ url: 'https://example.com/a.png?x=1&y=2', caption: 'Tom & Jerry' });
  });

  it('skips svg, data, http, javascript, private hosts, and credentials', () => {
    const html = [
      '<img src="/logo.svg">',
      '<img src="data:image/png;base64,AAAA">',
      '<img src="http://cdn.example.org/a.png">',
      '<img src="javascript:alert(1)">',
      '<img src="https://127.0.0.1/a.png">',
      '<img src="https://localhost/a.png">',
      '<img src="https://u:p@cdn.example.org/a.png">',
      '<img src="/ok.png">',
    ].join('');
    expect(extractImages(html, BASE).map((i) => i.url)).toEqual(['https://example.com/ok.png']);
  });

  it('skips tracking pixels, icons, and tiny images', () => {
    const html = [
      '<img src="/p.gif" width="1" height="1">',
      '<img src="/small.png" width="32" height="32">',
      '<img src="/favicon.png">',
      '<img src="/sprite.png">',
      '<img src="/a.ico">',
      '<img src="/icon.png" class="site-icon">',
      '<img src="/big.png" width="640" height="480">',
      '<img src="/fluid.png" width="100%">',
    ].join('');
    expect(extractImages(html, BASE).map((i) => i.url)).toEqual([
      'https://example.com/big.png',
      'https://example.com/fluid.png',
    ]);
  });

  it('deduplicates and caps at 8', () => {
    const imgs = Array.from({ length: 20 }, (_, i) => `<img src="/p${i % 12}.png">`).join('');
    const out = extractImages(imgs, BASE);
    expect(out).toHaveLength(8);
    expect(new Set(out.map((i) => i.url)).size).toBe(8);
  });

  it('returns nothing for an http page with relative images, and never throws on junk', () => {
    expect(extractImages('<img src="/a.png">', 'http://example.com/')).toEqual([]);
    expect(extractImages('<img src="/a.png">', 'not a url')).toEqual([]);
    expect(extractImages('<img <img <img <meta ' + 'x'.repeat(10000), BASE)).toEqual([]);
    expect(extractImages(undefined as unknown as string, BASE)).toEqual([]);
  });

  it('stays fast on a page of unterminated tags', () => {
    const start = Date.now();
    extractImages('<img '.repeat(200000), BASE);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('handleExtract media', () => {
  const page = (body: string) =>
    new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  const req = (u: string) => new Request('https://disclore.test/api/extract?url=' + encodeURIComponent(u));

  it('adds a media list when the page has safe pictures', async () => {
    const fetch = vi.fn(async () =>
      page('<title>T</title><p>Hello there.</p><img src="/pic.png" alt="Pic">'),
    );
    const res = await handleExtract(req('https://example.com/a'), { fetch });
    const body = await res.json();
    expect(body.media).toEqual([{ url: 'https://example.com/pic.png', caption: 'Pic' }]);
  });

  it('leaves media out when there are no pictures', async () => {
    const fetch = vi.fn(async () => page('<title>T</title><p>Hello there.</p>'));
    const body = await (await handleExtract(req('https://example.com/a'), { fetch })).json();
    expect('media' in body).toBe(false);
  });
});
