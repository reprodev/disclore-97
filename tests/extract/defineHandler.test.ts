// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanWord, DEFINE_DEADLINE_MS, handleDefine, parseEntries } from '../../src/extract/defineHandler';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const req = (word: string | null, method = 'GET') =>
  new Request('https://disclore.test/api/define' + (word === null ? '' : '?word=' + encodeURIComponent(word)), { method });
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const MOAT = [
  {
    word: 'moat',
    phonetic: '/moʊt/',
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          { definition: 'A deep, wide <b>ditch</b>, usually filled with water, around a castle.' },
          { definition: 'Any similar defensive barrier.' },
          { definition: 'A third sense.' },
          { definition: 'A fourth sense that is dropped.' },
        ],
      },
      { partOfSpeech: 'verb', definitions: [{ definition: 'To surround with a moat.' }] },
    ],
  },
];

afterEach(() => vi.useRealTimers());

describe('cleanWord', () => {
  it('accepts one plain word, trimmed and lowercased', () => {
    expect(cleanWord('  Moat ')).toBe('moat');
    expect(cleanWord("o'clock")).toBe("o'clock");
    expect(cleanWord('well-known')).toBe('well-known');
    expect(cleanWord('café')).toBe('café');
  });

  it('rejects anything else', () => {
    for (const bad of [null, '', '   ', 'two words', 'a/b', '../etc', 'x?y=1', '123', '-dash', 'a'.repeat(41)]) {
      expect(cleanWord(bad)).toBe('');
    }
  });
});

describe('parseEntries', () => {
  it('keeps at most 3 definitions per meaning, strips angle brackets, and keeps the phonetic', () => {
    const body = parseEntries(MOAT, 'moat')!;
    expect(body.phonetic).toBe('/moʊt/');
    expect(body.meanings).toHaveLength(2);
    expect(body.meanings[0]!.definitions).toHaveLength(3);
    expect(body.meanings[0]!.definitions[0]).toBe('A deep, wide bditch/b, usually filled with water, around a castle.');
  });

  it('returns null when nothing is usable', () => {
    expect(parseEntries({ title: 'No Definitions Found' }, 'x')).toBeNull();
    expect(parseEntries([{ meanings: [] }], 'x')).toBeNull();
    expect(parseEntries([{ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 5 }] }] }], 'x')).toBeNull();
  });
});

describe('handleDefine', () => {
  it('answers a short JSON body for a known word and asks the fixed dictionary host', async () => {
    const f = vi.fn<Fetch>(async () => reply(MOAT));
    const res = await handleDefine(req('Moat'), { fetch: f });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { word: string; meanings: unknown[] };
    expect(body.word).toBe('moat');
    expect(body.meanings).toHaveLength(2);
    const url = new URL(f.mock.calls[0]![0]);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('api.dictionaryapi.dev');
    expect(url.pathname).toBe('/api/v2/entries/en/moat');
  });

  it('rejects other methods with 405', async () => {
    const f = vi.fn<Fetch>();
    const res = await handleDefine(req('moat', 'POST'), { fetch: f });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
    expect(f).not.toHaveBeenCalled();
  });

  it('answers 400 bad-word without calling upstream', async () => {
    const f = vi.fn<Fetch>();
    for (const w of [null, '', 'two words', '../x']) {
      const res = await handleDefine(req(w), { fetch: f });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe('bad-word');
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('answers 404 not-found when upstream has no entry', async () => {
    const res = await handleDefine(req('zzzzqx'), { fetch: async () => reply({ title: 'No Definitions Found' }, 404) });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not-found');
  });

  it('answers 404 when the reply holds no usable meaning', async () => {
    const res = await handleDefine(req('moat'), { fetch: async () => reply([{ meanings: [] }]) });
    expect(res.status).toBe(404);
  });

  it('answers 502 upstream-failed on other statuses, network errors, and non-JSON', async () => {
    const statuses = [
      await handleDefine(req('moat'), { fetch: async () => reply({}, 500) }),
      await handleDefine(req('moat'), {
        fetch: async () => {
          throw new Error('down');
        },
      }),
      await handleDefine(req('moat'), { fetch: async () => new Response('<html>', { status: 200 }) }),
    ];
    for (const res of statuses) {
      expect(res.status).toBe(502);
      expect(((await res.json()) as { error: string }).error).toBe('upstream-failed');
    }
  });

  it('answers 504 timeout when upstream does not answer in time', async () => {
    vi.useFakeTimers();
    const hang: Fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const pending = handleDefine(req('moat'), { fetch: hang });
    await vi.advanceTimersByTimeAsync(DEFINE_DEADLINE_MS + 10);
    const res = await pending;
    expect(res.status).toBe(504);
    expect(((await res.json()) as { error: string }).error).toBe('timeout');
  });
});
