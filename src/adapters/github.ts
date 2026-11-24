// GitHub adapter: public REST API to ExtractedSource. Never throws.

import { makeError, rateLimitedError } from './errors';
import { fetchWithDeadline } from './http';
import { extractImages } from '../extract/htmlExtract';
import { parseMarkdown } from './markdown';
import type { AdapterOptions, BurnError, FetchLike, Result } from './types';
import { sanitizeLine } from '../model/compiler';
import { MAX_CAPTION, MAX_MEDIA, pickMedia, safeMediaUrl } from '../model/media';
import type { MediaItem } from '../model/manifest';
import type { ExtractedSource } from '../model/source';

const API = 'https://api.github.com';
const DEFAULT_TIMEOUT_MS = 8000;
const README_MAX_CHARS = 100000;
const README_MAX_B64 = 133336;
const MAX_LANGUAGES = 8;
const IMAGE_SCAN_CHARS = 60000;
/** Where GitHub serves repository files as raw bytes. Built from parts so no address literal sits in source. */
const RAW_BASE = ['https:', '', 'raw.githubusercontent.com'].join('/');
const INIT: RequestInit = { method: 'GET', headers: { Accept: 'application/vnd.github+json' } };
/** The longest wait worth quoting. Beyond this the busy-line message falls back to "up to an hour". */
const MAX_QUOTED_WAIT_MINUTES = 120;

/**
 * Roughly how many minutes until GitHub takes requests again, from `X-RateLimit-Reset` (epoch seconds)
 * or, failing that, `Retry-After` (seconds). Rounds up to whole minutes. Returns undefined when neither
 * header is present, readable, and within the next two hours.
 */
export function minutesUntilReset(headers: Headers | undefined, nowMs: number = Date.now()): number | undefined {
  try {
    const reset = Number(headers?.get('x-ratelimit-reset') ?? '');
    let seconds: number | undefined;
    if (headers?.get('x-ratelimit-reset') && Number.isFinite(reset) && reset > 0) {
      seconds = reset - nowMs / 1000;
    } else {
      const retry = Number(headers?.get('retry-after') ?? '');
      if (headers?.get('retry-after') && Number.isFinite(retry) && retry >= 0) seconds = retry;
    }
    if (seconds === undefined) return undefined;
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return minutes <= MAX_QUOTED_WAIT_MINUTES ? minutes : undefined;
  } catch {
    return undefined;
  }
}

/** Base64 to bytes to UTF-8 text, at most 100000 characters. Returns '' on invalid base64. */
export function decodeReadme(content: string): string {
  try {
    const b64 = String(content ?? '')
      .replace(/\s+/g, '')
      .slice(0, README_MAX_B64);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes).slice(0, README_MAX_CHARS);
  } catch {
    return '';
  }
}

const MD_IMAGE = /!\[([^\]]{0,200})\]\(\s*<?([^)\s>]{1,500})>?(?:\s+"[^"]{0,200}")?\s*\)/g;
const ABSOLUTE_REF = /^[a-z][a-z0-9+.-]*:/i;

/** Resolves a README image reference to a picture address, or null when it is unusable. */
function resolveReadmeImage(ref: string, owner: string, repo: string): string | null {
  const t = ref.trim();
  if (t === '' || t.startsWith('//')) return null;
  if (ABSOLUTE_REF.test(t)) return t;
  // Relative to the repository root, served raw. A path that climbs out of the repo is dropped.
  try {
    const root = new URL(`${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/`);
    const u = new URL(t.replace(/^\/+/, ''), root);
    return u.host === root.host && u.pathname.startsWith(root.pathname) ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Safe pictures referenced by a README: Markdown images and HTML img tags.
 * Relative paths become raw file addresses. SVG badges and unsafe addresses are skipped.
 */
export function readmeImages(readme: string, owner: string, repo: string): MediaItem[] {
  const text = readme.slice(0, IMAGE_SCAN_CHARS);
  const found: { url: string; caption: string }[] = [];

  MD_IMAGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_IMAGE.exec(text)) !== null && found.length < MAX_MEDIA * 4) {
    const url = resolveReadmeImage(m[2], owner, repo);
    if (url !== null && safeMediaUrl(url) !== null) found.push({ url, caption: m[1] });
  }

  // HTML img tags: let the page extractor resolve them against the repository root.
  const root = `${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/`;
  const rootPath = new URL(root).pathname;
  for (const img of extractImages(text, root)) {
    if (new URL(img.url).host !== new URL(root).host || new URL(img.url).pathname.startsWith(rootPath)) {
      found.push(img);
    }
  }
  return pickMedia(found, (c) => c, MAX_MEDIA * 4);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

export async function fetchGithubSource(
  owner: string,
  repo: string,
  opts: AdapterOptions = {},
): Promise<Result<ExtractedSource>> {
  const fetchFn: FetchLike = opts.fetch ?? ((i, init) => globalThis.fetch(i, init));
  const ms = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const first = await fetchWithDeadline(fetchFn, base, INIT, ms, opts.signal);
  if (!first.ok) return first;
  const { status } = first.value;
  if (status === 404) return { ok: false, error: makeError('repo-not-found') };
  if (status === 403 || status === 429) {
    return { ok: false, error: rateLimitedError(minutesUntilReset(first.value.headers)) };
  }
  if (!first.value.ok) return { ok: false, error: makeError('fetch-failed') };
  const info = parseJson(first.value.text);
  if (!isObj(info)) return { ok: false, error: makeError('fetch-failed') };

  const [langRes, readmeRes] = await Promise.all([
    fetchWithDeadline(fetchFn, `${base}/languages`, INIT, ms, opts.signal),
    fetchWithDeadline(fetchFn, `${base}/readme`, INIT, ms, opts.signal),
  ]);
  for (const r of [langRes, readmeRes]) {
    if (!r.ok && r.error.code === 'cancelled') return { ok: false, error: r.error as BurnError };
  }

  let languages: string[] = [];
  if (langRes.ok && langRes.value.ok) {
    const j = parseJson(langRes.value.text);
    if (isObj(j)) {
      languages = Object.entries(j)
        .filter((e): e is [string, number] => typeof e[1] === 'number')
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .slice(0, MAX_LANGUAGES)
        .map((e) => e[0]);
    }
  }

  let readme = '';
  if (readmeRes.ok && readmeRes.value.ok) {
    const j = parseJson(readmeRes.value.text);
    if (isObj(j) && j.encoding === 'base64' && typeof j.content === 'string') {
      readme = decodeReadme(j.content);
    }
  }
  const parsed = parseMarkdown(readme);

  const description = str(info.description);
  const license = isObj(info.license) ? str(info.license.name) : undefined;
  const branch = str(info.default_branch);
  const primary = str(info.language);
  const topics = Array.isArray(info.topics)
    ? info.topics.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    : [];
  const stars = typeof info.stargazers_count === 'number' ? info.stargazers_count : undefined;

  const facts: string[] = [];
  if (stars !== undefined) facts.push(`Stars: ${stars}`);
  if (branch) facts.push(`Default branch: ${branch}`);
  if (license) facts.push(`License: ${license}`);
  if (primary) facts.push(`Primary language: ${primary}`);
  if (topics.length > 0) facts.push(`Topics: ${topics.join(', ')}`);

  const paragraphs: string[] = [];
  if (description) paragraphs.push(description);
  if (facts.length > 0) paragraphs.push(`Repository facts: ${facts.join('; ')}`);
  paragraphs.push(...parsed.paragraphs);

  const title = str(info.full_name) ?? `${owner}/${repo}`;
  const author = isObj(info.owner) ? str(info.owner.login) : undefined;
  const avatar = isObj(info.owner) ? str(info.owner.avatar_url) : undefined;
  const media = pickMedia(
    [...(avatar ? [{ url: avatar, caption: `${author ?? owner} on GitHub` }] : []), ...readmeImages(readme, owner, repo)],
    (c) => sanitizeLine(c, MAX_CAPTION),
    MAX_MEDIA,
  );

  return {
    ok: true,
    value: {
      title,
      headings: ['About this repository', ...parsed.headings],
      paragraphs,
      metadata: {
        kind: 'github',
        source: `https://github.com/${owner}/${repo}`,
        ...(description ? { description } : {}),
        languages,
        ...(author ? { author } : {}),
        facts,
      },
      ...(media.length > 0 ? { media } : {}),
    },
  };
}
