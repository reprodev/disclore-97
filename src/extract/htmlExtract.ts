/**
 * HTML_Extractor: strips an HTML string to a title, headings, and paragraphs.
 * Pure, linear scanner with no DOM. Also lists safe picture URLs (extractImages).
 */

import { safeMediaUrl } from '../model/media';

export interface Extracted {
  title: string;
  headings: string[];
  paragraphs: string[];
}

const MAX_HEADINGS = 12;
const MAX_PARAGRAPHS = 40;
const MAX_STRING = 1200;
const MAX_BUFFER = 2400;

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  lsquo: '\u2018',
  rsquo: '\u2019',
  sbquo: '\u201a',
  ldquo: '\u201c',
  rdquo: '\u201d',
  bdquo: '\u201e',
  bull: '\u2022',
  middot: '\u00b7',
  laquo: '\u00ab',
  raquo: '\u00bb',
  euro: '\u20ac',
  pound: '\u00a3',
  yen: '\u00a5',
  cent: '\u00a2',
  sect: '\u00a7',
  deg: '\u00b0',
  times: '\u00d7',
  divide: '\u00f7',
  para: '\u00b6',
  larr: '\u2190',
  rarr: '\u2192',
};

// Built from pieces: ampersand, hash (char code 35), optional x, digits, semicolon.
const HASH = String.fromCharCode(35);
const ENTITY_RE = new RegExp(
  '&(' + HASH + 'x[0-9a-f]{1,6}|' + HASH + '[0-9]{1,7}|[a-z][a-z0-9]{1,8});',
  'gi',
);

function codePointToString(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) {
    return '\ufffd';
  }
  return String.fromCodePoint(n);
}

/** Decode named, decimal, and hexadecimal entities in a single pass. */
export function decodeEntities(s: string): string {
  return s.replace(ENTITY_RE, (whole: string, body: string) => {
    if (body.charCodeAt(0) === 35) {
      const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const n = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return codePointToString(n);
    }
    const hit = Object.prototype.hasOwnProperty.call(NAMED, body)
      ? NAMED[body]
      : Object.prototype.hasOwnProperty.call(NAMED, body.toLowerCase())
        ? NAMED[body.toLowerCase()]
        : undefined;
    return hit === undefined ? whole : hit;
  });
}

function clean(raw: string): string {
  const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  return text.length > MAX_STRING ? text.slice(0, MAX_STRING).trim() : text;
}

const DISCARD = new Set(['noscript', 'template', 'svg', 'iframe']);
const BLOCK = new Set([
  'div', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'section', 'article', 'header',
  'footer', 'nav', 'aside', 'main', 'blockquote', 'pre', 'form', 'h4', 'h5', 'h6',
]);
const NAME_RE = /[A-Za-z][A-Za-z0-9:-]*/y;

export function extractHtml(html: string): Extracted {
  let title = '';
  let titleSeen = false;
  const headings: string[] = [];
  const paragraphs: string[] = [];
  try {
    const src = typeof html === 'string' ? html : '';
    const n = src.length;
    let discard = 0;
    let kind: 'h' | 'p' | null = null;
    let buf = '';

    const add = (text: string): void => {
      if (kind === null || discard > 0 || buf.length >= MAX_BUFFER) return;
      buf += text;
      if (buf.length > MAX_BUFFER) buf = buf.slice(0, MAX_BUFFER);
    };
    const flush = (): void => {
      if (kind !== null) {
        const text = clean(buf);
        if (text) {
          if (kind === 'h') {
            if (headings.length < MAX_HEADINGS) headings.push(text);
          } else if (paragraphs.length < MAX_PARAGRAPHS) {
            paragraphs.push(text);
          }
        }
      }
      kind = null;
      buf = '';
    };

    let i = 0;
    while (i < n) {
      const lt = src.indexOf('<', i);
      if (lt === -1) {
        add(src.slice(i));
        break;
      }
      if (lt > i) add(src.slice(i, lt));

      if (src.startsWith('<!--', lt)) {
        const end = src.indexOf('-->', lt + 4);
        if (end === -1) break;
        i = end + 3;
        continue;
      }
      const c1 = src.charAt(lt + 1);
      if (c1 === '!' || c1 === '?') {
        const end = src.indexOf('>', lt + 2);
        if (end === -1) break;
        i = end + 1;
        continue;
      }
      const closing = c1 === '/';
      NAME_RE.lastIndex = lt + (closing ? 2 : 1);
      const m = NAME_RE.exec(src);
      if (!m) {
        add('<');
        i = lt + 1;
        continue;
      }
      const name = m[0].toLowerCase();

      // Skip attributes up to the closing '>' outside quotes.
      let j = lt + (closing ? 2 : 1) + m[0].length;
      let quote = '';
      let end = -1;
      for (; j < n; j++) {
        const ch = src.charAt(j);
        if (quote) {
          if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') {
          end = j;
          break;
        }
      }
      if (end === -1) break; // unterminated tag ends the scan
      const selfClosing = src.charAt(end - 1) === '/';
      i = end + 1;

      if (closing) {
        if (DISCARD.has(name)) {
          if (discard > 0) discard--;
        } else if (name === 'p' || name === 'h1' || name === 'h2' || name === 'h3' || BLOCK.has(name)) {
          flush();
        }
        continue;
      }

      if (name === 'script' || name === 'style') {
        if (selfClosing) continue;
        const close = new RegExp('</' + name, 'iy');
        let k = i;
        let found = -1;
        // Sticky regex scanned at each '<' candidate keeps this linear.
        while (k < n) {
          const nx = src.indexOf('<', k);
          if (nx === -1) break;
          close.lastIndex = nx;
          if (close.test(src)) {
            found = nx;
            break;
          }
          k = nx + 1;
        }
        if (found === -1) break;
        i = found;
        continue;
      }

      if (DISCARD.has(name)) {
        if (!selfClosing) discard++;
        continue;
      }
      if (discard > 0) continue;

      if (name === 'title') {
        const re = /<\/title/gi;
        re.lastIndex = i;
        const cm = re.exec(src);
        const raw = cm ? src.slice(i, cm.index) : src.slice(i);
        if (!titleSeen) {
          titleSeen = true;
          title = clean(raw.slice(0, MAX_BUFFER));
        }
        if (!cm) break;
        i = cm.index;
        continue;
      }
      if (name === 'h1' || name === 'h2' || name === 'h3') {
        flush();
        kind = 'h';
      } else if (name === 'p') {
        flush();
        kind = 'p';
      } else if (BLOCK.has(name)) {
        flush();
      } else if (name === 'br') {
        add(' ');
      }
    }
    flush();
  } catch {
    // never throw; return what was gathered
  }
  return { title, headings, paragraphs };
}

// ---------------------------------------------------------------------------
// Picture extraction
// ---------------------------------------------------------------------------

export interface ImageCandidate {
  url: string;
  caption: string;
}

const MAX_IMAGES = 8;
const MAX_TAGS_SCANNED = 500;
const MAX_TAG_LENGTH = 4096;
/** An explicit width or height at or below this is a pixel, spacer, or icon. */
const MIN_IMAGE_SIDE = 48;
const META_IMAGE_KEYS = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'twitter:image',
  'twitter:image:src',
]);
/** Names that mean an icon, sprite, spacer, or tracking pixel, as whole words in a path or class. */
const ICON_HINT =
  /(?:^|[\s/_.-])(?:favicon|icons?|sprites?|spacer|pixel|tracking|beacon|blank|1x1)(?:$|[\s/_.?-])|\.ico(?:$|\?)/i;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttrs(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(tag)) !== null) {
    const key = m[1].toLowerCase();
    if (!attrs.has(key)) attrs.set(key, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return attrs;
}

function isTiny(attrs: Map<string, string>): boolean {
  for (const key of ['width', 'height']) {
    const v = attrs.get(key);
    if (v === undefined) continue;
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n <= MIN_IMAGE_SIDE && !v.includes('%')) return true;
  }
  return false;
}

/**
 * Lists safe https pictures from og:image, twitter:image, and img tags, in page order.
 * Relative paths resolve against `base`. Skips duplicates, data URLs, svg, icons, tiny
 * images, and anything safeMediaUrl rejects. Returns at most 8. Never throws.
 */
export function extractImages(html: string, base: string): ImageCandidate[] {
  const out: ImageCandidate[] = [];
  try {
    const src = typeof html === 'string' ? html : '';
    let baseUrl: URL;
    try {
      baseUrl = new URL(base);
    } catch {
      return out;
    }
    const seen = new Set<string>();
    const n = src.length;
    let scanned = 0;
    let i = 0;

    const take = (rawUrl: string, caption: string): void => {
      const trimmed = rawUrl.trim();
      if (trimmed === '' || /^data:/i.test(trimmed) || ICON_HINT.test(trimmed)) return;
      let abs: string;
      try {
        abs = new URL(trimmed, baseUrl).href;
      } catch {
        return;
      }
      const safe = safeMediaUrl(abs);
      if (safe === null || seen.has(safe)) return;
      seen.add(safe);
      out.push({ url: safe, caption: clean(caption).slice(0, 200) });
    };

    while (i < n && out.length < MAX_IMAGES && scanned < MAX_TAGS_SCANNED) {
      const lt = src.indexOf('<', i);
      if (lt === -1) break;
      i = lt + 1;
      const head = src.slice(lt + 1, lt + 6).toLowerCase();
      const isMeta = head.startsWith('meta') && /[\s/]/.test(head.charAt(4));
      const isImg = head.startsWith('img') && /[\s/]/.test(head.charAt(3));
      if (!isMeta && !isImg) continue;
      scanned++;

      let end = -1;
      const limit = Math.min(n, lt + MAX_TAG_LENGTH);
      let quote = '';
      for (let j = lt + 4; j < limit; j++) {
        const ch = src.charAt(j);
        if (quote) {
          if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') {
          end = j;
          break;
        }
      }
      if (end === -1) continue;
      i = end + 1;

      const attrs = parseAttrs(src.slice(lt + (isMeta ? 5 : 4), end));
      if (isMeta) {
        const key = (attrs.get('property') ?? attrs.get('name') ?? '').toLowerCase();
        const content = attrs.get('content');
        if (META_IMAGE_KEYS.has(key) && content) take(content, '');
      } else {
        const url = attrs.get('src');
        if (url && !isTiny(attrs) && !ICON_HINT.test(attrs.get('class') ?? '')) take(url, attrs.get('alt') ?? '');
      }
    }
  } catch {
    // never throw; return what was gathered
  }
  return out;
}
