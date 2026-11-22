// Webpage adapter: same-origin /api/extract to ExtractedSource. Never throws.

import { makeError } from './errors';
import { fetchWithDeadline } from './http';
import type { AdapterOptions, FetchLike, Result } from './types';
import { sanitizeLine } from '../model/compiler';
import { MAX_CAPTION, MAX_MEDIA, pickMedia } from '../model/media';
import type { ExtractedSource } from '../model/source';

const DEFAULT_ENDPOINT = '/api/extract';
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_HEADINGS = 12;
const MAX_PARAGRAPHS = 40;
const MAX_ERROR_MESSAGE = 200;
const INIT: RequestInit = { method: 'GET' };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function parseHttpUrl(s: string): URL | undefined {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchWebpageSource(
  url: string,
  opts: AdapterOptions & { endpoint?: string } = {},
): Promise<Result<ExtractedSource>> {
  const fetchFn: FetchLike = opts.fetch ?? ((i, init) => globalThis.fetch(i, init));
  const ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const target = `${endpoint}?url=${encodeURIComponent(url)}`;

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

  if (!res.value.ok) {
    const err = isObj(body) ? body.error : undefined;
    const raw = isObj(err) ? err.message : undefined;
    if (typeof raw === 'string') {
      const msg = sanitizeLine(raw.slice(0, MAX_ERROR_MESSAGE), MAX_ERROR_MESSAGE);
      if (msg !== '') return { ok: false, error: makeError('fetch-failed', msg) };
    }
    return { ok: false, error: makeError('fetch-failed') };
  }

  if (!isObj(body) || typeof body.title !== 'string' || !isStringList(body.headings) || !isStringList(body.paragraphs)) {
    return { ok: false, error: makeError('fetch-failed') };
  }

  const finalUrl = typeof body.url === 'string' ? parseHttpUrl(body.url) : undefined;
  const source = finalUrl ? body.url as string : url;
  const host = (finalUrl ?? parseHttpUrl(url))?.hostname ?? '';

  const media = pickMedia(body.media, (c) => sanitizeLine(c, MAX_CAPTION), MAX_MEDIA);

  return {
    ok: true,
    value: {
      title: body.title.trim() !== '' ? body.title : host,
      headings: body.headings.slice(0, MAX_HEADINGS),
      paragraphs: body.paragraphs.slice(0, MAX_PARAGRAPHS),
      metadata: { kind: 'webpage', source },
      ...(media.length > 0 ? { media } : {}),
    },
  };
}
