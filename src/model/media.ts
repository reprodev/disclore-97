/**
 * Safe-media rules shared by the compiler, the validator, and the adapters.
 * Pure: no network access. Only public https images are allowed.
 */
import { checkTarget } from '../extract/ssrf';
import type { MediaItem } from './manifest';

export const MAX_MEDIA = 8;
export const MAX_CAPTION = 120;
export const MAX_MEDIA_URL = 2048;

// Whitespace and control characters never belong in an address.
const BAD_CHARS = /[\s\u0000-\u001f\u007f-\u009f]/;
const SVG_PATH = /\.svgz?$/i;

/**
 * Returns the normalized address when `raw` is a safe image URL, otherwise null.
 * Rejects non-https schemes (http, javascript, data, blob, ...), credentials,
 * odd ports, localhost and private or reserved hosts, and .svg images.
 */
export function safeMediaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '' || raw.length > MAX_MEDIA_URL || BAD_CHARS.test(raw)) {
    return null;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!checkTarget(u).ok) return null;
  if (SVG_PATH.test(u.pathname)) return null;
  return u.href;
}

/** True when a caption is usable as-is: non-empty text with no angle brackets. */
export function isValidCaption(c: unknown): c is string {
  return typeof c === 'string' && c.trim() !== '' && c.length <= 200 && !/[<>]/.test(c);
}

/** Keeps the safe, unique items of an untrusted list. Captions are passed through `cleanCaption`. */
export function pickMedia(
  raw: unknown,
  cleanCaption: (c: string) => string,
  limit: number = MAX_MEDIA,
): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length && out.length < limit; i++) {
    const item: unknown = raw[i];
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const url = safeMediaUrl(rec.url);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, caption: typeof rec.caption === 'string' ? cleanCaption(rec.caption) : '' });
  }
  return out;
}
