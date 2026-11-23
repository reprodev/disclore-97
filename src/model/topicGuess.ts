/**
 * Turns a web page address into a short encyclopedia topic, for the "Try as Wikipedia topic" fallback
 * when a site cannot be read. Pure and never throws.
 *
 * The last meaningful path segment wins ("/history/lighthouses-of-maine.html" gives "lighthouses of
 * maine"). Segments that are generic ("index", "article", "wiki"), mostly digits or ids, or too short are
 * skipped. With no usable segment, the site's own name is used ("www.nasa.gov" gives "nasa").
 */

const GENERIC = new Set([
  'index', 'default', 'home', 'main', 'article', 'articles', 'wiki', 'news', 'blog', 'blogs', 'post', 'posts',
  'page', 'pages', 'story', 'stories', 'item', 'items', 'en', 'amp', 'view', 'read', 'p', 'a', 'c', 'w',
]);

/** Second-level labels that sit between a site's name and a country code, as in "example.co.uk". */
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu']);

/** Words longer than this are cut, so a guess stays a search phrase rather than a sentence. */
const MAX_TOPIC = 80;

function cleanSegment(raw: string): string {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    // A malformed escape keeps the raw text.
  }
  return s
    .replace(/\.(?:s?html?|php\d?|aspx?|jsp|cfm)$/i, '')
    .replace(/[-_+.~]+/g, ' ')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usable(words: string): boolean {
  if (words === '' || GENERIC.has(words.toLowerCase())) return false;
  const letters = (words.match(/\p{L}/gu) ?? []).length;
  // At least three letters, and more letters than digits, so ids and dates are skipped.
  const digits = (words.match(/\p{N}/gu) ?? []).length;
  return letters >= 3 && letters > digits;
}

function cap(words: string): string {
  if (words.length <= MAX_TOPIC) return words;
  const cut = words.slice(0, MAX_TOPIC);
  const space = cut.lastIndexOf(' ');
  return (space > 20 ? cut.slice(0, space) : cut).trim();
}

export function topicFromUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;

  const segments = parsed.pathname.split('/').filter((s) => s !== '');
  for (let i = segments.length - 1; i >= 0; i--) {
    const words = cleanSegment(segments[i]!);
    if (usable(words)) return cap(words);
  }

  // No usable path: the site's own name. Drop the top-level domain, generic subdomains ("www", "blog",
  // "en"), and second-level parts such as the "co" in "co.uk", then take the last label left.
  const labels = parsed.hostname.toLowerCase().split('.').slice(0, -1);
  const names = labels.filter((l) => !GENERIC.has(l) && !SECOND_LEVEL.has(l) && !/^www\d*$/.test(l));
  const words = cleanSegment(names[names.length - 1] ?? '');
  return usable(words) ? cap(words) : undefined;
}
