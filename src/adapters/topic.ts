// Topic adapter: same-origin /api/topic (encyclopedia lookup) to ExtractedSource. Never throws.

import { makeError } from './errors';
import { fetchWithDeadline } from './http';
import type { AdapterOptions, FetchLike, Result } from './types';
import { sanitizeLine } from '../model/compiler';
import { MAX_CAPTION, MAX_MEDIA, pickMedia } from '../model/media';
import type { ExtractedSource } from '../model/source';

const DEFAULT_ENDPOINT = '/api/topic';
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_QUERY = 100;
const MAX_HEADINGS = 12;
const MAX_PARAGRAPHS = 40;
const INIT: RequestInit = { method: 'GET' };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** A page address worth keeping as the source label: any parseable https address. */
function pageSource(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  try {
    return new URL(v).protocol === 'https:' ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Looks a topic up through /api/topic. Fails (never throws) when the endpoint is missing,
 * the network is down, nothing matched, or the reply is not the expected shape.
 * Returned picture addresses are checked again here, whatever the server sent.
 */
export async function fetchTopicSource(
  topic: string,
  opts: AdapterOptions & { endpoint?: string } = {},
): Promise<Result<ExtractedSource>> {
  const fetchFn: FetchLike = opts.fetch ?? ((i, init) => globalThis.fetch(i, init));
  const ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const label = `Topic: ${topic}`;
  const target = `${endpoint}?q=${encodeURIComponent(topic.slice(0, MAX_QUERY))}`;

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

  if (
    !isObj(body) ||
    typeof body.title !== 'string' ||
    !isStringList(body.headings) ||
    !isStringList(body.paragraphs) ||
    body.paragraphs.length === 0
  ) {
    return { ok: false, error: makeError('fetch-failed') };
  }

  const meta = isObj(body.metadata) ? body.metadata : {};
  const media = pickMedia(body.media, (c) => sanitizeLine(c, MAX_CAPTION), MAX_MEDIA);

  return {
    ok: true,
    value: {
      title: body.title.trim() !== '' ? body.title : topic,
      headings: body.headings.slice(0, MAX_HEADINGS),
      paragraphs: body.paragraphs.slice(0, MAX_PARAGRAPHS),
      metadata: { kind: 'topic', source: pageSource(meta.source, label) },
      ...(media.length > 0 ? { media } : {}),
    },
  };
}
