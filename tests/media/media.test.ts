// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compileDisc } from '../../src/model/compiler';
import type { ExtractedSource } from '../../src/model/compiler';
import { MAX_MEDIA, safeMediaUrl } from '../../src/model/media';
import type { DiscManifest } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';
import { prebakedDiscs } from '../../src/discs';
import { loadDisc } from '../../src/discs/loader';

const OK = 'https://cdn.example.org/pics/one.png';

describe('safeMediaUrl', () => {
  it('accepts public https images and normalizes them', () => {
    expect(safeMediaUrl(OK)).toBe(OK);
    expect(safeMediaUrl('https://cdn.example.org/a.jpg?w=300#x')).toBe('https://cdn.example.org/a.jpg?w=300#x');
  });

  it.each([
    ['http scheme', 'http://cdn.example.org/a.png'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:image/png;base64,AAAA'],
    ['blob scheme', 'blob:https://cdn.example.org/1'],
    ['localhost', 'https://localhost/a.png'],
    ['loopback ip', 'https://127.0.0.1/a.png'],
    ['private ip', 'https://10.0.0.5/a.png'],
    ['link-local ip', 'https://169.254.169.254/a.png'],
    ['internal name', 'https://printer.local/a.png'],
    ['credentials', 'https://user:pw@cdn.example.org/a.png'],
    ['odd port', 'https://cdn.example.org:8443/a.png'],
    ['svg', 'https://cdn.example.org/logo.svg'],
    ['uppercase svg', 'https://cdn.example.org/logo.SVG'],
    ['svgz', 'https://cdn.example.org/logo.svgz'],
    ['whitespace', 'https://cdn.example.org/a b.png'],
    ['empty', ''],
    ['not a url', 'just words'],
  ])('rejects %s', (_name, url) => {
    expect(safeMediaUrl(url)).toBeNull();
  });

  it('rejects non-strings', () => {
    for (const v of [undefined, null, 5, {}, []]) expect(safeMediaUrl(v)).toBeNull();
  });
});

describe('validateManifest media', () => {
  const base = prebakedDiscs[0] as DiscManifest;
  const withMedia = (media: unknown) => ({ ...base, media }) as unknown;

  it('accepts a disc with no media, and a disc with safe media', () => {
    expect(validateManifest(base).ok).toBe(true);
    expect(validateManifest(withMedia([{ url: OK, caption: 'A picture' }])).ok).toBe(true);
    expect(validateManifest(withMedia([])).ok).toBe(true);
  });

  it.each([
    'http://cdn.example.org/a.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'https://localhost/a.png',
    'https://192.168.1.1/a.png',
    'https://cdn.example.org/a.svg',
  ])('rejects the unsafe url %s', (url) => {
    const r = validateManifest(withMedia([{ url, caption: 'x' }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'unsafe-media' && e.path === '$.media[0].url')).toBe(true);
  });

  it('rejects empty and markup captions', () => {
    for (const caption of ['', '   ', '<b>x</b>']) {
      const r = validateManifest(withMedia([{ url: OK, caption }]));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.path === '$.media[0].caption')).toBe(true);
    }
  });

  it('rejects more than 8 items', () => {
    const many = Array.from({ length: MAX_MEDIA + 1 }, (_, i) => ({ url: `https://cdn.example.org/${i}.png`, caption: `c${i}` }));
    const r = validateManifest(withMedia(many));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === '$.media')).toBe(true);
  });

  it('reports wrong types', () => {
    expect(validateManifest(withMedia('nope')).ok).toBe(false);
    expect(validateManifest(withMedia([{ url: 5, caption: 'x' }])).ok).toBe(false);
    expect(validateManifest(withMedia([{ url: OK }])).ok).toBe(false);
  });

  it('pre-baked discs without media still load unchanged', () => {
    for (const d of prebakedDiscs) {
      expect('media' in d).toBe(false);
      expect(loadDisc(d, false).ok).toBe(true);
    }
  });
});

describe('compileDisc media', () => {
  const source = (media: unknown): ExtractedSource =>
    ({
      title: 'Pictures',
      headings: ['One', 'Two', 'Three', 'Four', 'Five'],
      paragraphs: ['A paragraph of text about the first topic.', 'Another paragraph of text.'],
      metadata: { kind: 'webpage', source: 'https://example.com/' },
      media,
    }) as ExtractedSource;

  it('omits media when there is none', () => {
    const m = compileDisc(source(undefined));
    expect('media' in m).toBe(false);
  });

  it('keeps safe https pictures, drops the rest, dedupes, and caps at 8', () => {
    const list = [
      { url: OK, caption: 'First' },
      { url: OK, caption: 'Duplicate' },
      { url: 'http://cdn.example.org/b.png', caption: 'insecure' },
      { url: 'javascript:alert(1)', caption: 'script' },
      { url: 'https://cdn.example.org/c.svg', caption: 'vector' },
      ...Array.from({ length: 12 }, (_, i) => ({ url: `https://cdn.example.org/p${i}.png`, caption: `Pic ${i}` })),
    ];
    const m = compileDisc(source(list));
    expect(m.media).toHaveLength(MAX_MEDIA);
    expect(m.media![0]).toEqual({ url: OK, caption: 'First' });
    expect(m.media!.every((i) => i.url.startsWith('https://'))).toBe(true);
    expect(new Set(m.media!.map((i) => i.url)).size).toBe(MAX_MEDIA);
    expect(validateManifest(m).ok).toBe(true);
  });

  it('sanitizes captions and gives empty ones a fallback', () => {
    const m = compileDisc(
      source([
        { url: OK, caption: '<script>alert(1)</script>Safe <b>text</b> ![x](https://img.example/y.png)' },
        { url: 'https://cdn.example.org/two.png', caption: '   ' },
      ]),
    );
    expect(m.media![0].caption).not.toMatch(/[<>]/);
    expect(m.media![0].caption).not.toContain('img.example');
    expect(m.media![1].caption.trim()).not.toBe('');
    expect(validateManifest(m).ok).toBe(true);
  });

  it('does not change anything else about the disc', () => {
    const plain = compileDisc(source(undefined));
    const withPics = compileDisc(source([{ url: OK, caption: 'x' }]));
    const { media, ...rest } = withPics;
    expect(media).toBeDefined();
    expect(rest).toEqual(plain);
  });
});
