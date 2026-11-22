/**
 * handleTopic: testable core of the /api/topic Pages Function.
 * Looks a topic up on English Wikipedia and answers with an ExtractedSource-shaped JSON body:
 * title, section headings, plain-text paragraphs, and a few safe pictures.
 *
 * The Wikipedia host is fixed here and built from parts. Callers choose only the search
 * text, so this cannot be pointed at any other address.
 */

import { MAX_CAPTION, MAX_MEDIA, pickMedia } from '../model/media';
import type { MediaItem } from '../model/manifest';
import type { ExtractedSource } from '../model/source';

export interface TopicDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
}

export const TOPIC_DEADLINE_MS = 8000;
export const MAX_QUERY_CHARS = 100;
const MAX_TEXT_CHARS = 2 * 1024 * 1024;
const MAX_HEADINGS = 12;
const MAX_PARAGRAPHS = 40;
const MAX_PARAGRAPH_CHARS = 1200;
const MIN_PARAGRAPH_CHARS = 40;
const MIN_IMAGE_WIDTH = 200;
const MIN_IMAGE_HEIGHT = 150;
const THUMB_WIDTH = 800;

const SCHEME = 'https:';
const WIKI_HOST = ['en', 'wikipedia', 'org'].join('.');
const USER_AGENT = 'Disclore97-Topic/1.0 (encyclopedia topic lookup for a retro disc viewer)';

/** Sections that hold lists of links or citations rather than prose. */
const SKIP_SECTIONS = new Set([
  'see also',
  'references',
  'external links',
  'further reading',
  'notes',
  'footnotes',
  'citations',
  'bibliography',
  'sources',
  'general references',
  'explanatory notes',
]);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** File names of site furniture, maps of flags, and other non-illustrative images. */
const JUNK_FILE =
  /(?:^|[^a-z])(?:icons?|logos?|flags?|symbols?|commons|wikimedia|wikidata|wikiquote|disambig|stub|ambox|padlock|portal|question|edit|oojs|ooui|nuvola|crystal|blank)(?![a-z])/i;
/** Disambiguation pages open with a short line such as "X may refer to:". */
const DISAMBIGUATION = /\brefers? to:\s*$/i;

function json(status: number, body: Record<string, unknown>, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

class Failure extends Error {
  constructor(readonly response: Response) {
    super('topic-failure');
  }
}

const fail = (status: number, error: string): Failure => new Failure(json(status, { error }));

/** Collapses whitespace, drops control characters, and caps the length. */
export function cleanQuery(raw: string | null): string {
  if (raw === null) return '';
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_CHARS)
    .trim();
}

function apiUrl(params: Record<string, string>): string {
  const u = new URL(`${SCHEME}//${WIKI_HOST}/w/api.php`);
  const all: Record<string, string> = { action: 'query', format: 'json', formatversion: '2', ...params };
  for (const [k, v] of Object.entries(all)) u.searchParams.set(k, v);
  return u.href;
}

/** The public page address for an article title. */
export function pageUrl(title: string): string {
  return `${SCHEME}//${WIKI_HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/**
 * Splits a plain-text article extract (section headings written as `== Name ==`) into
 * section headings and paragraphs. Reference-style sections and short list fragments are dropped.
 */
export function parseExtract(text: string): { headings: string[]; paragraphs: string[] } {
  const headings: string[] = [];
  const paragraphs: string[] = [];
  let skip = false;
  for (const line of text.split(/\r\n|\r|\n/)) {
    const t = line.trim();
    if (t === '') continue;
    if (t.startsWith('==')) {
      const m = /^(={2,6})\s*(.+?)\s*\1$/.exec(t);
      if (m) {
        const level = m[1].length;
        if (level <= 3) {
          skip = SKIP_SECTIONS.has(m[2].toLowerCase());
          if (!skip && headings.length < MAX_HEADINGS) headings.push(m[2]);
        }
        continue;
      }
    }
    if (skip || t.length < MIN_PARAGRAPH_CHARS) continue;
    if (paragraphs.length < MAX_PARAGRAPHS) paragraphs.push(t.slice(0, MAX_PARAGRAPH_CHARS));
  }
  return { headings, paragraphs };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function getJson(url: string, deps: TopicDeps, signal: AbortSignal, timedOut: Promise<never>): Promise<unknown> {
  let res: Response;
  try {
    res = await Promise.race([
      deps.fetch(url, {
        method: 'GET',
        signal,
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      }),
      timedOut,
    ]);
  } catch (e) {
    if (e instanceof Failure) throw e;
    if (signal.aborted) throw fail(504, 'timeout');
    throw fail(502, 'upstream-failed');
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw fail(502, 'upstream-failed');
  }
  try {
    const text = await Promise.race([res.text(), timedOut]);
    if (text.length > MAX_TEXT_CHARS) throw fail(502, 'too-large');
    return JSON.parse(text) as unknown;
  } catch (e) {
    if (e instanceof Failure) throw e;
    if (signal.aborted) throw fail(504, 'timeout');
    throw fail(502, 'upstream-failed');
  }
}

/** "File:Fresnel_lens.jpg" becomes "Fresnel lens". */
function captionFromFile(fileTitle: string): string {
  return fileTitle
    .replace(/^[^:]*:/, '')
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function articleImages(data: unknown): MediaItem[] {
  const pages = isObj(data) && isObj(data.query) && Array.isArray(data.query.pages) ? data.query.pages : [];
  const out: MediaItem[] = [];
  for (const page of pages) {
    if (!isObj(page) || typeof page.title !== 'string' || JUNK_FILE.test(page.title)) continue;
    if (/\.svg$/i.test(page.title)) continue;
    const info = Array.isArray(page.imageinfo) && isObj(page.imageinfo[0]) ? page.imageinfo[0] : undefined;
    if (!info || typeof info.mime !== 'string' || !IMAGE_MIMES.has(info.mime)) continue;
    const w = typeof info.width === 'number' ? info.width : 0;
    const h = typeof info.height === 'number' ? info.height : 0;
    if (w < MIN_IMAGE_WIDTH || h < MIN_IMAGE_HEIGHT) continue;
    const url = typeof info.thumburl === 'string' ? info.thumburl : typeof info.url === 'string' ? info.url : '';
    out.push({ url, caption: captionFromFile(page.title) });
  }
  return out;
}

async function lookup(query: string, deps: TopicDeps, signal: AbortSignal, timedOut: Promise<never>): Promise<Response> {
  const found = await getJson(
    apiUrl({
      generator: 'search',
      gsrsearch: query,
      gsrlimit: '1',
      gsrnamespace: '0',
      prop: 'extracts|pageimages',
      explaintext: '1',
      exsectionformat: 'wiki',
      exlimit: '1',
      piprop: 'thumbnail',
      pithumbsize: String(THUMB_WIDTH),
    }),
    deps,
    signal,
    timedOut,
  );
  const pages = isObj(found) && isObj(found.query) && Array.isArray(found.query.pages) ? found.query.pages : [];
  const page = pages.find(isObj);
  if (!page || typeof page.title !== 'string' || typeof page.extract !== 'string') throw fail(404, 'not-found');

  const { headings, paragraphs } = parseExtract(page.extract);
  const firstLine = page.extract.split(/\r\n|\r|\n/).find((l) => l.trim() !== '') ?? '';
  if (paragraphs.length === 0 || DISAMBIGUATION.test(firstLine.trim())) throw fail(404, 'not-found');

  const candidates: MediaItem[] = [];
  const lead = isObj(page.thumbnail) && typeof page.thumbnail.source === 'string' ? page.thumbnail.source : '';
  if (lead !== '') candidates.push({ url: lead, caption: page.title });
  try {
    const more = await getJson(
      apiUrl({
        titles: page.title,
        generator: 'images',
        gimlimit: '30',
        prop: 'imageinfo',
        iiprop: 'url|mime|size',
        iiurlwidth: String(THUMB_WIDTH),
      }),
      deps,
      signal,
      timedOut,
    );
    candidates.push(...articleImages(more));
  } catch (e) {
    // Pictures are a bonus. The article text is still worth returning.
    if (e instanceof Failure && e.response.status === 504) throw e;
  }
  const media = pickMedia(candidates, (c) => c.slice(0, MAX_CAPTION), MAX_MEDIA);

  const body: ExtractedSource = {
    title: page.title,
    headings,
    paragraphs,
    ...(media.length > 0 ? { media } : {}),
    metadata: { kind: 'topic', source: pageUrl(page.title) },
  };
  return json(200, body as unknown as Record<string, unknown>);
}

export async function handleTopic(request: Request, deps: TopicDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'method-not-allowed' }, { allow: 'GET' });
  }
  let raw: string | null;
  try {
    raw = new URL(request.url).searchParams.get('q');
  } catch {
    raw = null;
  }
  const query = cleanQuery(raw);
  if (query === '') return json(400, { error: 'missing-query' });

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(fail(504, 'timeout'));
    }, TOPIC_DEADLINE_MS);
  });
  timedOut.catch(() => undefined);
  try {
    return await lookup(query, deps, controller.signal, timedOut);
  } catch (e) {
    if (e instanceof Failure) return e.response;
    return json(502, { error: 'upstream-failed' });
  } finally {
    clearTimeout(timer);
  }
}
