// GitHub adapter: public REST API to ExtractedSource. Never throws.

import { makeError } from './errors';
import { fetchWithDeadline } from './http';
import { parseMarkdown } from './markdown';
import type { AdapterOptions, BurnError, FetchLike, Result } from './types';
import type { ExtractedSource } from '../model/source';

const API = 'https://api.github.com';
const DEFAULT_TIMEOUT_MS = 8000;
const README_MAX_CHARS = 100000;
const README_MAX_B64 = 133336;
const MAX_LANGUAGES = 8;
const INIT: RequestInit = { method: 'GET', headers: { Accept: 'application/vnd.github+json' } };

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
  if (status === 403 || status === 429) return { ok: false, error: makeError('rate-limited') };
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
    },
  };
}
