// Dictionary adapter: same-origin /api/define (one-word definition) to a short result. Never throws.

import { makeError } from './errors';
import { fetchWithDeadline } from './http';
import type { AdapterOptions, FetchLike, Result } from './types';
import { sanitizeLine } from '../model/compiler';

const DEFAULT_ENDPOINT = '/api/define';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_MEANINGS = 3;
const MAX_DEFINITIONS = 3;
const MAX_DEFINITION_CHARS = 280;
const INIT: RequestInit = { method: 'GET' };

export interface Definition {
  word: string;
  phonetic?: string;
  meanings: { partOfSpeech: string; definitions: string[] }[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Looks one word up through /api/define. Fails (never throws) when the endpoint is missing,
 * the network is down, the word is unknown, or the reply is not the expected shape.
 * All text is sanitized to plain text again here, whatever the server sent.
 */
export async function fetchDefinition(
  word: string,
  opts: AdapterOptions & { endpoint?: string } = {},
): Promise<Result<Definition>> {
  const fetchFn: FetchLike = opts.fetch ?? ((i, init) => globalThis.fetch(i, init));
  const ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const target = `${endpoint}?word=${encodeURIComponent(word.trim().slice(0, 40))}`;

  const res = await fetchWithDeadline(fetchFn, target, INIT, ms, opts.signal);
  if (!res.ok) return res;
  const { status, text } = res.value;
  if (status === 404) return { ok: false, error: makeError('unavailable') };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, error: makeError('unavailable') };
  }
  if (!res.value.ok) return { ok: false, error: makeError('fetch-failed') };
  if (!isObj(body) || typeof body.word !== 'string' || !Array.isArray(body.meanings)) {
    return { ok: false, error: makeError('fetch-failed') };
  }

  const meanings: Definition['meanings'] = [];
  for (const m of body.meanings) {
    if (!isObj(m) || typeof m.partOfSpeech !== 'string' || !Array.isArray(m.definitions)) continue;
    const definitions = m.definitions
      .filter((d): d is string => typeof d === 'string')
      .map((d) => sanitizeLine(d, MAX_DEFINITION_CHARS))
      .filter((d) => d !== '')
      .slice(0, MAX_DEFINITIONS);
    const pos = sanitizeLine(m.partOfSpeech, 24);
    if (definitions.length > 0 && pos !== '' && meanings.length < MAX_MEANINGS) {
      meanings.push({ partOfSpeech: pos, definitions });
    }
  }
  if (meanings.length === 0) return { ok: false, error: makeError('unavailable') };

  const phonetic = typeof body.phonetic === 'string' ? sanitizeLine(body.phonetic, 40) : '';
  return {
    ok: true,
    value: { word: sanitizeLine(body.word, 40) || word, ...(phonetic !== '' ? { phonetic } : {}), meanings },
  };
}
