// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanQuery,
  handleTopic,
  MAX_QUERY_CHARS,
  pageUrl,
  parseExtract,
  TOPIC_DEADLINE_MS,
} from '../../src/extract/topicHandler';
import { validateManifest } from '../../src/model/validate';
import { compileDisc } from '../../src/model/compiler';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const WIKI = ['https:', '', 'en.wikipedia.org'].join('/');
const THUMB = ['https:', '', 'upload.wikimedia.org', 'thumb', 'lead.jpg'].join('/');
const req = (q: string | null, method = 'GET') =>
  new Request('https://disclore.test/api/topic' + (q === null ? '' : '?q=' + encodeURIComponent(q)), { method });
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const INTRO = 'A lighthouse is a tower, building, or other structure designed to emit light from a system of lamps and lenses.';
const EXTRACT = [
  INTRO,
  'It is used as a navigational aid for maritime pilots at sea or on inland waterways.',
  '',
  '== History ==',
  'Before the Fresnel lens, lighthouses relied on open fires and later on oil lamps with mirrors behind them.',
  '=== Ancient world ===',
  'The Pharos of Alexandria, built around 280 BC, is the best known lighthouse of antiquity.',
  '== Design ==',
  'Short line',
  'The tower shape resists wind, and the lantern room at the top houses the lens and lamp.',
  '== See also ==',
  'List of lighthouses in the world, an index of towers that is not prose to read.',
  '== References ==',
  'Smith, J. (1999). A long citation that must not become a paragraph in the compiled disc.',
].join('\n');

function searchReply(over: Record<string, unknown> = {}) {
  return reply({
    query: { pages: [{ pageid: 1, title: 'Lighthouse', extract: EXTRACT, thumbnail: { source: THUMB, width: 800, height: 600 }, ...over }] },
  });
}
const imageInfo = (name: string, mime: string, w: number, h: number, thumb: string) => ({
  title: name,
  imageinfo: [{ mime, width: w, height: h, thumburl: thumb, url: thumb }],
});
const file = (n: string) => ['https:', '', 'upload.wikimedia.org', n].join('/');

function wikiFetch(opts: { search?: () => Response; images?: () => Response } = {}) {
  const calls: URL[] = [];
  const fn = vi.fn<Fetch>(async (input) => {
    const u = new URL(input);
    calls.push(u);
    if (u.searchParams.get('generator') === 'search') return (opts.search ?? searchReply)();
    if (u.searchParams.get('generator') === 'images') {
      return (opts.images ?? (() => reply({ query: { pages: [] } })))();
    }
    throw new Error('unexpected ' + input);
  });
  return { fn, calls };
}

afterEach(() => vi.useRealTimers());

describe('cleanQuery', () => {
  it('trims, collapses whitespace, drops control characters, and caps the length', () => {
    expect(cleanQuery('  tide \n\t pools\u0000 ')).toBe('tide pools');
    expect(cleanQuery(null)).toBe('');
    expect(cleanQuery('   ')).toBe('');
    expect(cleanQuery('x'.repeat(500))).toHaveLength(MAX_QUERY_CHARS);
  });
});

describe('parseExtract', () => {
  it('keeps prose, lists real section headings, and drops references and short fragments', () => {
    const { headings, paragraphs } = parseExtract(EXTRACT);
    expect(headings).toEqual(['History', 'Ancient world', 'Design']);
    expect(paragraphs).toHaveLength(5);
    expect(paragraphs[0]).toBe(INTRO);
    expect(paragraphs.join('\n')).not.toContain('Short line');
    expect(paragraphs.join('\n')).not.toContain('citation');
    expect(paragraphs.join('\n')).not.toContain('List of lighthouses');
  });

  it('caps the counts and paragraph length', () => {
    const many = Array.from({ length: 30 }, (_, i) => `== Section ${i} ==\n${'word '.repeat(400)}`).join('\n');
    const { headings, paragraphs } = parseExtract(many);
    expect(headings).toHaveLength(12);
    expect(paragraphs).toHaveLength(30);
    expect(paragraphs.every((p) => p.length <= 1200)).toBe(true);
    expect(parseExtract('=\n==\n== ==\n' + '='.repeat(5000)).paragraphs.length).toBeLessThanOrEqual(1);
  });
});

describe('handleTopic', () => {
  it('returns an ExtractedSource-shaped body with the page address and safe pictures', async () => {
    const { fn } = wikiFetch({
      images: () =>
        reply({
          query: {
            pages: [
              imageInfo('File:Fresnel_lens.jpg', 'image/jpeg', 1200, 900, file('thumb/fresnel.jpg')),
              imageInfo('File:Flag_of_Spain.svg', 'image/svg+xml', 900, 600, file('thumb/flag.svg.png')),
              imageInfo('File:Commons-logo.png', 'image/png', 600, 600, file('thumb/logo.png')),
              imageInfo('File:Tiny.png', 'image/png', 40, 40, file('thumb/tiny.png')),
              imageInfo('File:Diagram.svg', 'image/svg+xml', 900, 900, file('thumb/diagram.svg.png')),
              imageInfo('File:Silicon_chip.png', 'image/png', 800, 600, file('thumb/chip.png')),
              imageInfo('File:Insecure.jpg', 'image/jpeg', 800, 600, 'http://upload.example.org/x.jpg'),
              imageInfo('File:Lead.jpg', 'image/jpeg', 800, 600, THUMB),
            ],
          },
        }),
    });
    const res = await handleTopic(req('Lighthouses'), { fetch: fn });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Lighthouse');
    expect(body.headings).toEqual(['History', 'Ancient world', 'Design']);
    expect(body.paragraphs).toHaveLength(5);
    expect(body.metadata).toEqual({ kind: 'topic', source: `${WIKI}/wiki/Lighthouse` });
    expect(body.media).toEqual([
      { url: THUMB, caption: 'Lighthouse' },
      { url: file('thumb/fresnel.jpg'), caption: 'Fresnel lens' },
      { url: file('thumb/chip.png'), caption: 'Silicon chip' },
    ]);
  });

  it('only ever calls the Wikipedia API, with the search text passed as data', async () => {
    const { fn, calls } = wikiFetch();
    await handleTopic(req('x&action=evil https://attacker.example'), { fetch: fn });
    expect(calls.length).toBeGreaterThan(0);
    for (const u of calls) {
      expect(u.origin).toBe(WIKI);
      expect(u.pathname).toBe('/w/api.php');
    }
    expect(calls[0].searchParams.get('gsrsearch')).toBe('x&action=evil https://attacker.example');
    expect(calls[0].searchParams.get('action')).toBe('query');
    expect(fn.mock.calls[0]![1]!.headers).toMatchObject({ 'user-agent': expect.stringContaining('Disclore97') });
  });

  it('produces a source that compiles to a valid disc with pictures', async () => {
    const { fn } = wikiFetch();
    const body = await (await handleTopic(req('Lighthouses'), { fetch: fn })).json();
    const m = compileDisc(body);
    expect(validateManifest(m).ok).toBe(true);
    expect(m.media?.[0]?.url).toBe(THUMB);
    expect(JSON.stringify(m.sections)).toContain('Pharos of Alexandria');
  });

  it('still answers with text when the picture lookup fails', async () => {
    const { fn } = wikiFetch({ images: () => new Response('boom', { status: 500 }) });
    const res = await handleTopic(req('Lighthouses'), { fetch: fn });
    expect(res.status).toBe(200);
    expect((await res.json()).media).toEqual([{ url: THUMB, caption: 'Lighthouse' }]);
  });

  it('omits media when there are no safe pictures', async () => {
    const { fn } = wikiFetch({ search: () => searchReply({ thumbnail: undefined }) });
    const body = await (await handleTopic(req('Lighthouses'), { fetch: fn })).json();
    expect('media' in body).toBe(false);
  });

  it('returns 400 for a missing or blank query without calling out', async () => {
    const { fn } = wikiFetch();
    for (const q of [null, '', '   ']) {
      const res = await handleTopic(req(q), { fetch: fn });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('missing-query');
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE', 'HEAD'])('returns 405 for %s', async (method) => {
    const { fn } = wikiFetch();
    const res = await handleTopic(req('x', method), { fetch: fn });
    expect(res.status).toBe(405);
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns 404 when nothing matches', async () => {
    const { fn } = wikiFetch({ search: () => reply({ batchcomplete: true }) });
    const res = await handleTopic(req('qzxjv'), { fetch: fn });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not-found');
  });

  it('returns 404 for a disambiguation page and for a page with no prose', async () => {
    const dis = wikiFetch({ search: () => searchReply({ extract: 'Mercury may refer to:\n\n== Science ==\nMercury, the planet and the element named after the god.' }) });
    expect((await handleTopic(req('mercury'), { fetch: dis.fn })).status).toBe(404);
    const empty = wikiFetch({ search: () => searchReply({ extract: '== See also ==\nsomething' }) });
    expect((await handleTopic(req('x'), { fetch: empty.fn })).status).toBe(404);
  });

  it('returns 502 when Wikipedia errors, sends junk, or the request throws', async () => {
    for (const search of [
      () => new Response('down', { status: 503 }),
      () => new Response('<html>', { status: 200 }),
    ]) {
      const { fn } = wikiFetch({ search });
      const res = await handleTopic(req('x'), { fetch: fn });
      expect(res.status).toBe(502);
      expect((await res.json()).error).toBe('upstream-failed');
    }
    const boom = vi.fn<Fetch>(async () => {
      throw new Error('network');
    });
    expect((await handleTopic(req('x'), { fetch: boom })).status).toBe(502);
  });

  it('returns 504 when Wikipedia does not answer in time', async () => {
    vi.useFakeTimers();
    const hang = vi.fn<Fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const p = handleTopic(req('x'), { fetch: hang });
    await vi.advanceTimersByTimeAsync(TOPIC_DEADLINE_MS + 10);
    const res = await p;
    expect(res.status).toBe(504);
    expect((await res.json()).error).toBe('timeout');
  });
});

describe('pageUrl', () => {
  it('uses underscores and encodes the title', () => {
    expect(pageUrl('Tide pool')).toBe(`${WIKI}/wiki/Tide_pool`);
    expect(pageUrl('AC/DC?')).toBe(`${WIKI}/wiki/AC%2FDC%3F`);
  });
});
