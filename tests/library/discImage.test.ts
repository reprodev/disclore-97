// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { topicToSource } from '../../src/adapters/markdown';
import { prebakedDiscs } from '../../src/discs';
import {
  discImageFileName,
  MAX_IMAGE_BYTES,
  MAX_REPORTED_ERRORS,
  parseDiscImage,
  readFileText,
  saveTextFile,
  serializeDiscImage,
} from '../../src/library/discImage';
import { compileDisc } from '../../src/model/compiler';
import type { DiscManifest } from '../../src/model/manifest';

const burned = (): DiscManifest => ({
  ...compileDisc(topicToSource('Lighthouses and the keepers who tended their lamps')),
  media: [{ url: 'https://cdn.example.org/lighthouse.jpg', caption: 'A lighthouse' }],
});

/** A deep copy that tests can break without touching the original. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const setUrlApi = (create: unknown, revoke: unknown) => {
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true, writable: true });
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('save and mount round trip', () => {
  it.each(prebakedDiscs.map((d) => [d.disc_id, d] as const))('the built-in disc %s survives a round trip', (_id, disc) => {
    const r = parseDiscImage(serializeDiscImage(disc));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest).toEqual(disc);
  });

  it('a burned disc with pictures survives a round trip', () => {
    const m = burned();
    const r = parseDiscImage(serializeDiscImage(m));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest).toEqual(m);
  });

  it('writes readable JSON that ends with a newline', () => {
    const text = serializeDiscImage(prebakedDiscs[0]!);
    expect(text).toContain('\n  "disc_id"');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('accepts a file that starts with a byte order mark', () => {
    expect(parseDiscImage('\uFEFF' + serializeDiscImage(prebakedDiscs[0]!)).ok).toBe(true);
  });

  it('names the file after the disc, with safe characters only', () => {
    expect(discImageFileName(prebakedDiscs[0]!)).toBe(`${prebakedDiscs[0]!.disc_id}.json`);
    expect(discImageFileName({ ...burned(), disc_id: '../Weird Id/..\\x:y' })).toBe('weird-id-x-y.json');
    expect(discImageFileName({ ...burned(), disc_id: '***' })).toBe('disc.json');
  });
});

describe('rejecting bad disc images', () => {
  const rejected = (text: unknown) => {
    const r = parseDiscImage(text);
    expect(r.ok).toBe(false);
    return r.ok ? { message: '', errors: [] } : r;
  };

  it.each([
    ['empty text', ''],
    ['plain words', 'this is not json'],
    ['truncated JSON', serializeDiscImage(prebakedDiscs[0]!).slice(0, 200)],
    ['a trailing comma', '{"a": 1,}'],
  ])('rejects %s as not valid JSON', (_name, text) => {
    expect(rejected(text).message).toMatch(/not valid JSON/);
  });

  it.each([
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"disc"'],
    ['an array', '[]'],
    ['an empty object', '{}'],
    ['an object of the wrong shape', '{"title": "x"}'],
  ])('rejects %s as not a disc image', (_name, text) => {
    const r = rejected(text);
    expect(r.message).toMatch(/not a DiscLore '97 disc image/);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects non-text input and oversized text', () => {
    expect(rejected(undefined).message).toMatch(/could not be read/);
    expect(rejected(null).message).toMatch(/could not be read/);
    expect(rejected('x'.repeat(MAX_IMAGE_BYTES + 1)).message).toMatch(/too large/);
  });

  it('rejects a disc with a dangling reference and names the path', () => {
    const m = clone(prebakedDiscs[0]!);
    m.trivia[0]!.section_id = 'nope';
    const r = rejected(JSON.stringify(m));
    expect(r.errors.some((e) => e.code === 'dangling-reference' && e.path === '$.trivia[0].section_id')).toBe(true);
  });

  it('rejects an unsolvable dungeon', () => {
    const m = clone(prebakedDiscs[0]!);
    for (const room of m.dungeons[0]!.rooms) room.exits = [];
    const r = rejected(JSON.stringify(m));
    expect(r.errors.some((e) => e.code === 'unsolvable-dungeon')).toBe(true);
  });

  it('rejects an out-of-range hotspot', () => {
    const m = clone(prebakedDiscs[0]!);
    m.diagrams[0]!.hotspots[0]!.x = 250;
    expect(rejected(JSON.stringify(m)).errors.some((e) => e.code === 'coordinate-range')).toBe(true);
  });

  it.each([
    ['an http picture', 'http://cdn.example.org/a.png'],
    ['a javascript address', 'javascript:alert(1)'],
    ['a data address', 'data:image/png;base64,AAAA'],
    ['an SVG picture', 'https://cdn.example.org/a.svg'],
    ['a localhost picture', 'https://localhost/a.png'],
    ['a private-network picture', 'https://192.168.0.10/a.png'],
    ['a picture with credentials', 'https://user:pw@cdn.example.org/a.png'],
  ])('rejects %s as unsafe media', (_name, url) => {
    const m = { ...burned(), media: [{ url, caption: 'x' }] };
    const r = rejected(JSON.stringify(m));
    expect(r.errors.some((e) => e.code === 'unsafe-media' && e.path === '$.media[0].url')).toBe(true);
  });

  it('rejects markup in a caption and too many pictures', () => {
    const base = burned();
    const markup = rejected(JSON.stringify({ ...base, media: [{ url: base.media![0]!.url, caption: '<img src=x onerror=alert(1)>' }] }));
    expect(markup.errors.some((e) => e.path === '$.media[0].caption')).toBe(true);
    const many = Array.from({ length: 9 }, (_, i) => ({ url: `https://cdn.example.org/${i}.png`, caption: `c${i}` }));
    expect(rejected(JSON.stringify({ ...base, media: many })).errors.some((e) => e.path === '$.media')).toBe(true);
  });

  it('rejects an unknown shape animation', () => {
    const m = clone(prebakedDiscs[0]!);
    (m.diagrams[0]!.shapes[0] as unknown as Record<string, unknown>).anim = 'spin';
    expect(rejected(JSON.stringify(m)).errors.some((e) => e.path.endsWith('.anim'))).toBe(true);
  });

  it('reports at most a few problems, so the dialog stays short', () => {
    const m = clone(prebakedDiscs[0]!);
    m.sections = [];
    for (const q of m.trivia) q.section_id = 'gone';
    for (const d of m.diagrams) for (const h of d.hotspots) h.section_id = 'gone';
    const r = rejected(JSON.stringify(m));
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.length).toBeLessThanOrEqual(MAX_REPORTED_ERRORS);
  });

  it('never throws, whatever the text', () => {
    for (const text of ['\u0000', '{"__proto__": {"x": 1}}', '[[[[[[[[[[', '{"disc_id": {"a": {}}}', 'true']) {
      expect(() => parseDiscImage(text)).not.toThrow();
      expect(parseDiscImage(text).ok).toBe(false);
    }
  });
});

describe('file helpers', () => {
  it('readFileText reads a File', async () => {
    const file = new File(['{"a":1}'], 'a.json', { type: 'application/json' });
    await expect(readFileText(file)).resolves.toBe('{"a":1}');
  });

  it('saveTextFile downloads through a temporary link and releases the address', async () => {
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:disc';
    });
    const revoke = vi.fn();
    setUrlApi(create, revoke);
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(`${this.download}|${this.getAttribute('href')}`);
    });

    expect(saveTextFile('castles.json', '{"x":1}')).toBe(true);
    expect(names).toEqual(['castles.json|blob:disc']);
    expect(blobs[0]!.type).toBe('application/json');
    await expect(readFileText(blobs[0]!)).resolves.toBe('{"x":1}');
    expect(document.querySelector('a[download]')).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect(revoke).toHaveBeenCalledWith('blob:disc');
  });

  it('saveTextFile reports false when the browser cannot create a file address', () => {
    setUrlApi(undefined, undefined);
    expect(saveTextFile('x.json', '{}')).toBe(false);
  });
});
