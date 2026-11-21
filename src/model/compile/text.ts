const MAX_TAG_PASSES = 5;

/** Drops Markdown images, reduces links to their visible text, removes reference definitions. */
export function stripMarkdownInline(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/^ {0,3}\[[^\]]*\]:[ \t]*\S.*$/gm, '');
}

function stripTags(s: string): string {
  let out = s;
  for (let i = 0; i < MAX_TAG_PASSES; i++) {
    const next = out.replace(/<[^<>]*>/g, '');
    if (next === out) break;
    out = next;
  }
  return out.replace(/[<>]/g, '');
}

const CONTROL_AND_INVISIBLE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Shortens `s` to at most `max` UTF-16 units. When text is cut, the last unit is a
 * `…` marker. Never splits a surrogate pair.
 */
export function truncate(s: string, max: number): string {
  if (!Number.isFinite(max) || max <= 0) return '';
  if (s.length <= max) return s;
  let head = s.slice(0, Math.floor(max) - 1);
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  const space = head.lastIndexOf(' ');
  if (space > 0 && space >= head.length - 20) head = head.slice(0, space);
  head = head.trimEnd();
  return head + '\u2026';
}

/** Cleans untrusted text into one safe line of at most `max` units. */
export function sanitizeLine(raw: string, max: number): string {
  if (typeof raw !== 'string' || !(max > 0)) return '';
  let s = raw.length > max * 8 ? raw.slice(0, max * 8) : raw;
  s = stripMarkdownInline(s);
  s = stripTags(s);
  s = s.replace(CONTROL_AND_INVISIBLE, '').replace(LONE_SURROGATE, '');
  s = s.replace(/\s+/g, ' ').trim();
  return truncate(s, max);
}

export function sanitizeParagraph(raw: string): string {
  return sanitizeLine(raw, 1200);
}
