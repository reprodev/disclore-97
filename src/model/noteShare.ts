/**
 * Shareable Research Notebook links: `?notes=<encoded>`.
 *
 * The payload is `{ v: 1, d: disc_id, t: disc title, n: notes }` as JSON, as UTF-8, as unpadded
 * base64url (A-Z a-z 0-9 - _), so it survives a URL untouched. Encoding caps the notes so the link
 * stays short. Decoding treats the link as untrusted input: it checks the alphabet and length,
 * rejects malformed UTF-8 and JSON, strips control characters, and clamps every field. It returns
 * null for anything wrong and never throws. Pure: no DOM, no network, no storage.
 */

export interface SharedNotes {
  discId: string;
  discTitle: string;
  text: string;
}

/** Longest notes text a link carries. Longer notes are cut, keeping the start. */
export const MAX_SHARE_NOTES = 4000;
export const MAX_SHARE_TITLE = 120;
export const MAX_SHARE_ID = 200;
/** Longest encoded value accepted, comfortably above the largest one encoding can produce. */
export const MAX_SHARE_ENCODED = 24000;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2]!;
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) out += ALPHABET[c & 63]!;
  }
  return out;
}

/** Null when the text is not canonical unpadded base64url. */
function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    const v = [...chunk].map((ch) => LOOKUP[ch]);
    if (v.some((x) => x === undefined)) return null;
    const [w, x, y, z] = v as number[];
    out.push((w! << 2) | (x! >> 4));
    if (y !== undefined) out.push(((x! & 15) << 4) | (y >> 2));
    if (z !== undefined) out.push(((y! & 3) << 6) | z);
    // Leftover bits in a short final chunk must be zero, so every value has exactly one spelling.
    if (chunk.length === 2 && (x! & 15) !== 0) return null;
    if (chunk.length === 3 && (y! & 3) !== 0) return null;
  }
  return Uint8Array.from(out);
}

/** Drops control characters except newline and tab, and turns CR LF and lone CR into LF. */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, '');
}

/** One line: control characters and line breaks become spaces, runs of spaces collapse. */
function cleanLine(raw: string, max: number): string {
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** Cuts a string to at most `max` UTF-16 units without splitting a surrogate pair. */
function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = max;
  const code = s.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end--;
  return s.slice(0, end);
}

/** The `?notes=` value for a disc's notes. Notes are cleaned and capped at MAX_SHARE_NOTES. */
export function encodeNotes(notes: SharedNotes): string {
  const payload = {
    v: 1,
    d: cleanLine(notes.discId, MAX_SHARE_ID),
    t: cleanLine(notes.discTitle, MAX_SHARE_TITLE),
    n: cut(cleanText(notes.text), MAX_SHARE_NOTES),
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/** The notes in a `?notes=` value, cleaned. Null for anything malformed, empty, or too long. Never throws. */
export function decodeNotes(encoded: unknown): SharedNotes | null {
  try {
    if (typeof encoded !== 'string') return null;
    const value = encoded.trim();
    if (value === '' || value.length > MAX_SHARE_ENCODED || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = fromBase64Url(value);
    if (!bytes) return null;
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const p: unknown = JSON.parse(json);
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;
    const { v, d, t, n } = p as Record<string, unknown>;
    if (v !== 1 || typeof d !== 'string' || typeof t !== 'string' || typeof n !== 'string') return null;
    const discId = cleanLine(d, MAX_SHARE_ID);
    const text = cut(cleanText(n), MAX_SHARE_NOTES);
    if (discId === '' || text.trim() === '') return null;
    return { discId, discTitle: cleanLine(t, MAX_SHARE_TITLE) || discId, text };
  } catch {
    return null;
  }
}

/** The query string (with a leading "?") for a notes link. */
export function notesQuery(notes: SharedNotes): string {
  return `?notes=${encodeNotes(notes)}`;
}
