// Pure classification of free-form user input into a compile source.

export type InputErrorCode =
  | 'empty-input'
  | 'unsupported-scheme'
  | 'input-too-long'
  | 'invalid-github-url';

export type ParsedInput =
  | { ok: true; kind: 'github'; owner: string; repo: string; url: string }
  | { ok: true; kind: 'webpage'; url: string }
  | { ok: true; kind: 'markdown'; text: string }
  | { ok: true; kind: 'topic'; text: string }
  | { ok: false; error: InputErrorCode };

const MAX_INPUT_LENGTH = 20000;
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
const BARE_SCHEMES = new Set([
  'javascript', 'data', 'file', 'vbscript', 'mailto', 'ftp', 'ws', 'wss',
  'blob', 'about', 'tel', 'sms', 'view-source',
]);
const SEGMENT_RE = /^[A-Za-z0-9._-]{1,100}$/;
const HEADING_RE = /^ {0,3}#{1,6}\s+\S/;

function topic(s: string): ParsedInput {
  return { ok: true, kind: 'topic', text: s.replace(/\s+/g, ' ').trim() };
}

export function parseInput(raw: string): ParsedInput {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: false, error: 'empty-input' };
  if (s.length > MAX_INPUT_LENGTH) return { ok: false, error: 'input-too-long' };

  const m = SCHEME_RE.exec(s);
  if (m) {
    const scheme = m[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      if (s.startsWith('//', m[0].length) || BARE_SCHEMES.has(scheme)) {
        return { ok: false, error: 'unsupported-scheme' };
      }
    }
  }

  if (/^https?:\/\//i.test(s) && !/\s/.test(s)) {
    let u: URL | null = null;
    try {
      u = new URL(s);
    } catch {
      return topic(s);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'github.com') {
      const segs = u.pathname.split('/').filter((p) => p !== '');
      if (segs.length < 2) return { ok: false, error: 'invalid-github-url' };
      const [owner, repoRaw] = segs;
      const repo = repoRaw.replace(/\.git$/, '');
      if (repo === '') return { ok: false, error: 'invalid-github-url' };
      for (const seg of [owner, repo, ...segs.slice(2)]) {
        if (/^\.+$/.test(seg) || !SEGMENT_RE.test(seg)) {
          return { ok: false, error: 'invalid-github-url' };
        }
      }
      return {
        ok: true,
        kind: 'github',
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`,
      };
    }
    u.hash = '';
    return { ok: true, kind: 'webpage', url: u.href };
  }

  if (/[\r\n]/.test(s) || s.split(/\r\n|\r|\n/).some((l) => HEADING_RE.test(l))) {
    return { ok: true, kind: 'markdown', text: s };
  }
  return topic(s);
}
