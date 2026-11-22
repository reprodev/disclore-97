/**
 * handleDefine: testable core of the /api/define Pages Function.
 * Looks one English word up in the free Dictionary API and answers with a short JSON body:
 * { word, phonetic?, meanings: [{ partOfSpeech, definitions: string[] }] }.
 *
 * The dictionary host is fixed here and built from parts. Callers choose only the word,
 * and the word is checked against a strict pattern, so this cannot be pointed elsewhere.
 */

export interface DefineDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
}

export const DEFINE_DEADLINE_MS = 8000;
const MAX_TEXT_CHARS = 512 * 1024;
const MAX_MEANINGS = 3;
const MAX_DEFINITIONS = 3;
const MAX_DEFINITION_CHARS = 280;
const MAX_PHONETIC_CHARS = 40;

const SCHEME = 'https:';
const DICT_HOST = ['api', 'dictionaryapi', 'dev'].join('.');
const USER_AGENT = 'Disclore97-Define/1.0 (single word lookup for a retro disc viewer)';
const WORD_PATTERN = /^\p{L}[\p{L}'’-]{0,39}$/u;

export interface DefineMeaning {
  partOfSpeech: string;
  definitions: string[];
}

export interface DefineBody {
  word: string;
  phonetic?: string;
  meanings: DefineMeaning[];
}

function json(status: number, body: Record<string, unknown>, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

class Failure extends Error {
  constructor(readonly response: Response) {
    super('define-failure');
  }
}

const fail = (status: number, error: string): Failure => new Failure(json(status, { error }));

/** Trims and lowercases the word. Returns '' when it is not a single plain word. */
export function cleanWord(raw: string | null): string {
  if (raw === null) return '';
  const w = raw.trim().toLowerCase();
  return WORD_PATTERN.test(w) ? w : '';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function plain(text: string, max: number): string {
  return text
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** Reduces the upstream array of entries to a few short meanings. Returns null when nothing usable. */
export function parseEntries(data: unknown, word: string): DefineBody | null {
  if (!Array.isArray(data)) return null;
  const meanings: DefineMeaning[] = [];
  let phonetic = '';
  for (const entry of data) {
    if (!isObj(entry)) continue;
    if (phonetic === '' && typeof entry.phonetic === 'string') phonetic = plain(entry.phonetic, MAX_PHONETIC_CHARS);
    if (!Array.isArray(entry.meanings)) continue;
    for (const m of entry.meanings) {
      if (!isObj(m) || typeof m.partOfSpeech !== 'string' || !Array.isArray(m.definitions)) continue;
      const definitions: string[] = [];
      for (const d of m.definitions) {
        if (!isObj(d) || typeof d.definition !== 'string') continue;
        const t = plain(d.definition, MAX_DEFINITION_CHARS);
        if (t !== '' && definitions.length < MAX_DEFINITIONS) definitions.push(t);
      }
      const pos = plain(m.partOfSpeech, 24);
      if (definitions.length > 0 && pos !== '' && meanings.length < MAX_MEANINGS) {
        meanings.push({ partOfSpeech: pos, definitions });
      }
    }
  }
  if (meanings.length === 0) return null;
  return { word, ...(phonetic !== '' ? { phonetic } : {}), meanings };
}

async function lookup(word: string, deps: DefineDeps, signal: AbortSignal, timedOut: Promise<never>): Promise<Response> {
  const url = `${SCHEME}//${DICT_HOST}/api/v2/entries/en/${encodeURIComponent(word)}`;
  let res: Response;
  try {
    res = await Promise.race([
      deps.fetch(url, { method: 'GET', signal, headers: { 'user-agent': USER_AGENT, accept: 'application/json' } }),
      timedOut,
    ]);
  } catch (e) {
    if (e instanceof Failure) throw e;
    if (signal.aborted) throw fail(504, 'timeout');
    throw fail(502, 'upstream-failed');
  }
  if (res.status === 404) {
    await res.body?.cancel().catch(() => undefined);
    throw fail(404, 'not-found');
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw fail(502, 'upstream-failed');
  }
  let data: unknown;
  try {
    const text = await Promise.race([res.text(), timedOut]);
    if (text.length > MAX_TEXT_CHARS) throw fail(502, 'too-large');
    data = JSON.parse(text) as unknown;
  } catch (e) {
    if (e instanceof Failure) throw e;
    if (signal.aborted) throw fail(504, 'timeout');
    throw fail(502, 'upstream-failed');
  }
  const body = parseEntries(data, word);
  if (!body) throw fail(404, 'not-found');
  return json(200, body as unknown as Record<string, unknown>);
}

export async function handleDefine(request: Request, deps: DefineDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'method-not-allowed' }, { allow: 'GET' });
  }
  let raw: string | null;
  try {
    raw = new URL(request.url).searchParams.get('word');
  } catch {
    raw = null;
  }
  const word = cleanWord(raw);
  if (word === '') return json(400, { error: 'bad-word' });

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(fail(504, 'timeout'));
    }, DEFINE_DEADLINE_MS);
  });
  timedOut.catch(() => undefined);
  try {
    return await lookup(word, deps, controller.signal, timedOut);
  } catch (e) {
    if (e instanceof Failure) return e.response;
    return json(502, { error: 'upstream-failed' });
  } finally {
    clearTimeout(timer);
  }
}
