/**
 * fast-check generators for the dynamic disc compiler's input, SSRF, HTML and
 * fetch tests (Requirement 17). Kept apart from `tests/generators.ts`.
 *
 * - Input: `arbOwnerRepo`, `arbGithubUrl`.
 * - SSRF: `arbBlockedIPv4` (with renderers), `arbBlockedIPv6`, `arbPublicHost`.
 * - HTML: `arbHtmlDoc` (document plus the text an extractor should return and
 *   the markers that must not appear in its output).
 * - Fetch: `arbWebpageJson`, `arbFetchBehavior`, `makeFetch` (no real network).
 * - `base64Wrapped`: README payload wrapped at 60 columns.
 */
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// GitHub URLs
// ---------------------------------------------------------------------------
const NAME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.'.split('');

const arbName = fc
  .array(fc.constantFrom(...NAME_CHARS), { minLength: 1, maxLength: 39 })
  .map((cs) => cs.join(''))
  .filter((s) => !/^\.+$/.test(s));

export interface OwnerRepo {
  owner: string;
  repo: string;
}

/** Owner and repo names. The repo never ends in `.git` (any case). */
export const arbOwnerRepo: fc.Arbitrary<OwnerRepo> = fc.record({
  owner: arbName,
  repo: arbName.filter((s) => !/\.git$/i.test(s)),
});

export interface GithubUrlCase extends OwnerRepo {
  /** Raw input, possibly with surrounding whitespace. */
  input: string;
}

const arbWs = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r\n'), { maxLength: 3 })
  .map((a) => a.join(''));

export const arbGithubUrl: fc.Arbitrary<GithubUrlCase> = fc
  .record({
    or: arbOwnerRepo,
    scheme: fc.constantFrom('http', 'https'),
    www: fc.boolean(),
    dotGit: fc.boolean(),
    slash: fc.boolean(),
    sub: fc.option(fc.constantFrom('tree/main', 'blob/main/README.md', 'issues/1', 'pulls'), {
      nil: undefined,
    }),
    query: fc.option(fc.constantFrom('tab=readme', 'a=1&b=2'), { nil: undefined }),
    fragment: fc.option(fc.constantFrom('readme', 'L10'), { nil: undefined }),
    pre: arbWs,
    post: arbWs,
  })
  .map(({ or, scheme, www, dotGit, slash, sub, query, fragment, pre, post }) => {
    let u = `${scheme}://${www ? 'www.' : ''}github.com/${or.owner}/${or.repo}`;
    if (dotGit) u += '.git';
    if (slash || (sub && !dotGit)) u += '/';
    if (sub && !dotGit) u += sub;
    if (query) u += `?${query}`;
    if (fragment) u += `#${fragment}`;
    return { owner: or.owner, repo: or.repo, input: `${pre}${u}${post}` };
  });

// ---------------------------------------------------------------------------
// SSRF: IPv4
// ---------------------------------------------------------------------------
export type Octets = [number, number, number, number];

interface BlockedRange {
  start: Octets;
  prefix: number;
}

export const BLOCKED_IPV4_RANGES: readonly BlockedRange[] = [
  { start: [0, 0, 0, 0], prefix: 8 },
  { start: [10, 0, 0, 0], prefix: 8 },
  { start: [100, 64, 0, 0], prefix: 10 },
  { start: [127, 0, 0, 0], prefix: 8 },
  { start: [169, 254, 0, 0], prefix: 16 },
  { start: [172, 16, 0, 0], prefix: 12 },
  { start: [192, 0, 0, 0], prefix: 24 },
  { start: [192, 168, 0, 0], prefix: 16 },
  { start: [198, 18, 0, 0], prefix: 15 },
  { start: [224, 0, 0, 0], prefix: 4 },
  { start: [255, 255, 255, 255], prefix: 32 },
];

function toInt(o: Octets): number {
  return ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
}

function fromInt(n: number): Octets {
  return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256];
}

/** An address inside one of the blocked ranges. */
export const arbBlockedIPv4: fc.Arbitrary<Octets> = fc
  .constantFrom(...BLOCKED_IPV4_RANGES)
  .chain((r) => {
    const size = 2 ** (32 - r.prefix);
    const base = toInt(r.start);
    return fc.integer({ min: 0, max: size - 1 }).map((off) => fromInt(base + off));
  });

export const renderDotted = (o: Octets): string => o.join('.');
export const renderDecimal = (o: Octets): string => String(toInt(o));
export const renderHex = (o: Octets): string => `0x${toInt(o).toString(16)}`;
/** Dotted octal, each octet with a leading 0 (e.g. `0177.0.0.01`). */
export const renderOctal = (o: Octets): string => o.map((x) => (x === 0 ? '0' : `0${x.toString(8)}`)).join('.');
/** Whole address as one octal integer (e.g. `017700000001`). */
export const renderOctalInt = (o: Octets): string => `0${toInt(o).toString(8)}`;
/** Short forms: `a.d24`, `a.b.d16`. Hex octets in dotted-hex form too. */
export const renderShort2 = (o: Octets): string => `${o[0]}.${(o[1] * 256 + o[2]) * 256 + o[3]}`;
export const renderShort3 = (o: Octets): string => `${o[0]}.${o[1]}.${o[2] * 256 + o[3]}`;
export const renderDottedHex = (o: Octets): string => o.map((x) => `0x${x.toString(16)}`).join('.');

export const IPV4_RENDERERS: readonly (readonly [string, (o: Octets) => string])[] = [
  ['dotted', renderDotted],
  ['decimal', renderDecimal],
  ['hex', renderHex],
  ['octal', renderOctal],
  ['octal-int', renderOctalInt],
  ['short2', renderShort2],
  ['short3', renderShort3],
  ['dotted-hex', renderDottedHex],
];

/** A blocked address rendered in a random notation. */
export const arbBlockedIPv4Text: fc.Arbitrary<{ form: string; text: string; octets: Octets }> = fc
  .tuple(arbBlockedIPv4, fc.constantFrom(...IPV4_RENDERERS))
  .map(([octets, [form, render]]) => ({ form, text: render(octets), octets }));

// ---------------------------------------------------------------------------
// SSRF: IPv6 (bracketed host text, as it appears in a URL)
// ---------------------------------------------------------------------------
const hex4 = fc.integer({ min: 0, max: 0xffff }).map((n) => n.toString(16));

const arbUniqueLocal = fc
  .tuple(fc.constantFrom('fc', 'fd'), fc.integer({ min: 0, max: 255 }), hex4, hex4)
  .map(([p, b, x, y]) => `[${p}${b.toString(16).padStart(2, '0')}:${x}::${y}]`);

const arbLinkLocal = fc
  .tuple(fc.integer({ min: 0x80, max: 0xbf }), hex4, hex4)
  .map(([b, x, y]) => `[fe${b.toString(16)}:${x}::${y}]`);

const arbMapped = arbBlockedIPv4.chain((o) =>
  fc.constantFrom(
    `[::ffff:${renderDotted(o)}]`,
    `[::ffff:${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}]`,
  ),
);

export const arbBlockedIPv6: fc.Arbitrary<string> = fc.oneof(
  arbUniqueLocal,
  arbLinkLocal,
  arbMapped,
  fc.constantFrom('[::]', '[::1]'),
);

const LABEL_TAILS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Public hostnames. Labels start with `h` and the TLD is a fixed common one,
 * so results never equal `localhost` or a blocked wildcard-DNS suffix.
 */
export const arbPublicHost: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(fc.constantFrom(...LABEL_TAILS), { minLength: 3, maxLength: 12 }),
    fc.option(fc.array(fc.constantFrom(...LABEL_TAILS), { minLength: 2, maxLength: 8 }), { nil: undefined }),
    fc.constantFrom('com', 'org', 'net', 'dev'),
  )
  .map(([a, sub, tld]) => `${sub ? `${sub.join('')}.` : ''}h${a.join('')}.${tld}`);

// ---------------------------------------------------------------------------
// HTML documents
// ---------------------------------------------------------------------------
export interface HtmlDocCase {
  html: string;
  /** Decoded title text the extractor should return. */
  title: string;
  /** Decoded heading texts in document order. */
  headings: string[];
  /** Decoded paragraph texts in document order. */
  paragraphs: string[];
  /** Unique strings placed only in discarded elements. */
  markers: string[];
}

const TEXT_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789&<>"\''.split('');
const arbWord = fc
  .array(fc.constantFrom(...TEXT_CHARS), { minLength: 1, maxLength: 8 })
  .map((cs) => cs.join(''));
/** Words joined by single spaces: no whitespace normalisation needed. */
const arbPlain = fc.array(arbWord, { minLength: 1, maxLength: 6 }).map((w) => w.join(' '));

function encodeEntities(text: string, pick: number): string {
  const amp = ['&amp;', '&#38;', '&#x26;'][pick % 3];
  return text
    .replace(/&/g, amp)
    .replace(/</g, pick % 2 ? '&lt;' : '&#60;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, pick % 2 ? '&#39;' : '&apos;');
}

const NOISE = ['b', 'i', 'em', 'strong', 'span', 'code', 'a'] as const;

function withNoise(encoded: string, pick: number): string {
  const tag = NOISE[pick % NOISE.length];
  const open = tag === 'a' ? '<a href="https://example.com/x">' : `<${tag}>`;
  const words = encoded.split(' ');
  const i = pick % words.length;
  words[i] = `${open}${words[i]}</${tag}>`;
  return words.join(' ');
}

const arbBlock = fc.record({
  text: arbPlain,
  entityPick: fc.nat(5),
  noisePick: fc.nat(20),
  noisy: fc.boolean(),
});

type Block = { text: string; entityPick: number; noisePick: number; noisy: boolean };
const render = (b: Block): string => {
  const enc = encodeEntities(b.text, b.entityPick);
  return b.noisy ? withNoise(enc, b.noisePick) : enc;
};

const DISCARDED = ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'comment'] as const;

function discarded(kind: (typeof DISCARDED)[number], marker: string): string {
  switch (kind) {
    case 'script':
      return `<script>var a = "${marker}";</script>`;
    case 'style':
      return `<style>.x::after { content: "${marker}"; }</style>`;
    case 'noscript':
      return `<noscript><p>${marker}</p></noscript>`;
    case 'template':
      return `<template><h2>${marker}</h2><p>${marker}</p></template>`;
    case 'svg':
      return `<svg><title>${marker}</title><text>${marker}</text></svg>`;
    case 'iframe':
      return `<iframe>${marker}</iframe>`;
    case 'comment':
      return `<!-- ${marker} -->`;
  }
}

/**
 * HTML document with title, headings (h1 to h3), paragraphs, inline noise tags,
 * entity-encoded text, and one discarded element per kind carrying a unique
 * marker. Elements are interleaved by a generated permutation.
 */
export const arbHtmlDoc: fc.Arbitrary<HtmlDocCase> = fc
  .record({
    title: arbBlock,
    headings: fc.array(fc.tuple(fc.constantFrom(1, 2, 3), arbBlock), { maxLength: 5 }),
    paragraphs: fc.array(arbBlock, { maxLength: 6 }),
    kinds: fc.shuffledSubarray([...DISCARDED], { minLength: 0, maxLength: DISCARDED.length }),
    salt: fc.array(fc.constantFrom(...LABEL_TAILS), { minLength: 4, maxLength: 6 }).map((a) => a.join('')),
  })
  .map(({ title, headings, paragraphs, kinds, salt }) => {
    const markers = kinds.map((k, i) => `MARK${salt}${k}${i}`);
    const parts: string[] = [];
    headings.forEach(([lvl, b]) => parts.push(`<h${lvl}>${render(b)}</h${lvl}>`));
    paragraphs.forEach((b) => parts.push(`<p>${render(b)}</p>`));
    const noise = kinds.map((k, i) => discarded(k, markers[i]));
    // Interleave: put discarded elements between content parts, round-robin.
    const out: string[] = [];
    const max = Math.max(parts.length, noise.length);
    for (let i = 0; i < max; i++) {
      if (i < noise.length) out.push(noise[i]);
      if (i < parts.length) out.push(parts[i]);
    }
    const html =
      `<!DOCTYPE html><html><head><title>${encodeEntities(title.text, title.entityPick)}</title></head>` +
      `<body>${out.join('\n')}</body></html>`;
    return {
      html,
      title: title.text,
      headings: headings.map(([, b]) => b.text),
      paragraphs: paragraphs.map((b) => b.text),
      markers,
    };
  });

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
const arbShortText = fc.string({ maxLength: 20 });

const arbValidWebpageJson = fc.record(
  {
    title: arbShortText,
    headings: fc.array(arbShortText, { maxLength: 5 }),
    paragraphs: fc.array(arbShortText, { maxLength: 5 }),
    url: fc.constantFrom('https://example.com/', 'http://example.org/a?b=1', 'ftp://x/', 'not a url'),
  },
  { requiredKeys: ['title', 'headings', 'paragraphs'] },
);

/** Arbitrary JSON mixed with objects of the valid `/api/extract` shape. */
export const arbWebpageJson: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue(),
  arbValidWebpageJson,
  arbValidWebpageJson,
);

export type FetchBehavior =
  | { kind: 'json'; status: number; body: unknown }
  | { kind: 'text'; status: number; text: string }
  | { kind: 'reject'; message: string }
  | { kind: 'hang' };

export const arbFetchBehavior: fc.Arbitrary<FetchBehavior> = fc.oneof(
  fc.record({
    kind: fc.constant('json' as const),
    status: fc.constantFrom(200, 201, 400, 403, 404, 429, 500, 502, 503),
    body: arbWebpageJson,
  }),
  fc.record({
    kind: fc.constant('text' as const),
    status: fc.constantFrom(200, 404, 500, 503),
    text: fc.string({ maxLength: 40 }),
  }),
  fc.record({ kind: fc.constant('reject' as const), message: arbShortText }),
  fc.constant({ kind: 'hang' as const }),
);

/**
 * Build an injected `fetch` from a behavior. `hang` never settles until the
 * request's signal aborts, then rejects with an AbortError. No real network.
 */
export function makeFetch(b: FetchBehavior): (input: string, init?: RequestInit) => Promise<Response> {
  return (_input, init) => {
    switch (b.kind) {
      case 'json':
        return Promise.resolve(
          new Response(JSON.stringify(b.body), {
            status: b.status,
            headers: { 'content-type': 'application/json' },
          }),
        );
      case 'text':
        return Promise.resolve(new Response(b.text, { status: b.status }));
      case 'reject':
        return Promise.reject(new Error(b.message));
      case 'hang':
        return new Promise<Response>((_res, rej) => {
          const signal = init?.signal;
          const abort = () => rej(new DOMException('The operation was aborted.', 'AbortError'));
          if (!signal) return;
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
        });
    }
  };
}

// ---------------------------------------------------------------------------
// README payload
// ---------------------------------------------------------------------------
/** Base64 of the UTF-8 text with a newline after every 60 characters (as GitHub does). */
export function base64Wrapped(text: string, columns = 60): string {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += columns) lines.push(b64.slice(i, i + columns));
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/** GitHub README API body for `text`. */
export function readmeBody(text: string): { encoding: 'base64'; content: string } {
  return { encoding: 'base64', content: base64Wrapped(text) };
}
