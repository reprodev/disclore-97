/**
 * SSRF_Guard. Pure: no network access, no imports.
 * Checks the text of a URL only. It cannot see what a public hostname resolves to.
 */

export type SsrfReason =
  | 'bad-url'
  | 'scheme'
  | 'credentials'
  | 'port'
  | 'host-name'
  | 'blocked-suffix'
  | 'private-address';

export type SsrfVerdict = { ok: true; url: URL } | { ok: false; reason: SsrfReason };

/** [base, prefix length] pairs. */
const IPV4_BLOCKED: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 8],
  [0x0a000000, 8],
  [0x64400000, 10],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0000000, 24],
  [0xc0000200, 24],
  [0xc0a80000, 16],
  [0xc6120000, 15],
  [0xc6336400, 24],
  [0xcb007100, 24],
  [0xe0000000, 4],
  [0xf0000000, 4],
  [0xa83f8110, 32],
];

function ipv4Blocked(ip: number): boolean {
  for (const [base, bits] of IPV4_BLOCKED) {
    if (bits === 32) {
      if (ip === base) return true;
    } else if (ip >>> (32 - bits) === base >>> (32 - bits)) {
      return true;
    }
  }
  return false;
}

function parseIpv4(host: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  let n = 0;
  for (let i = 1; i <= 4; i++) {
    const o = Number(m[i]);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

/** Parse an IPv6 literal (without brackets) into 8 hextets, or null if malformed. */
function parseIpv6(s: string): number[] | null {
  if (s === '' || !/^[0-9a-f:.]+$/.test(s)) return null;
  let text = s;
  let tail: number[] = [];
  const lastColon = text.lastIndexOf(':');
  if (text.includes('.')) {
    const v4 = parseIpv4(text.slice(lastColon + 1));
    if (v4 === null) return null;
    tail = [v4 >>> 16, v4 & 0xffff];
    text = text.slice(0, lastColon + 1) + '0:0';
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const out: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = toGroups(halves[0]);
  if (head === null) return null;
  let groups: number[];
  if (halves.length === 2) {
    const rest = toGroups(halves[1]);
    if (rest === null) return null;
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...new Array<number>(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  if (tail.length === 2) {
    groups[6] = tail[0];
    groups[7] = tail[1];
  }
  return groups;
}

function ipv6Blocked(g: number[]): boolean {
  const allZeroUpTo = (n: number): boolean => g.slice(0, n).every((x) => x === 0);
  if (allZeroUpTo(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // 100::/64
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // 2001:db8::/32
  const v4 = (hi: number, lo: number): number => ((hi << 16) | lo) >>> 0;
  if (allZeroUpTo(5) && g[5] === 0xffff) return ipv4Blocked(v4(g[6], g[7])); // mapped
  if (allZeroUpTo(6)) return ipv4Blocked(v4(g[6], g[7])); // IPv4-compatible
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return ipv4Blocked(v4(g[6], g[7])); // NAT64
  }
  if (g[0] === 0x2002) return ipv4Blocked(v4(g[1], g[2])); // 6to4
  return false;
}

const BLOCKED_NAME_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa'];
const WILDCARD_DNS = ['nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me'];

function check(raw: string | URL): SsrfVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'bad-url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'scheme' };
  if (url.username !== '' || url.password !== '') return { ok: false, reason: 'credentials' };
  if (url.port !== '' && url.port !== '80' && url.port !== '443') return { ok: false, reason: 'port' };

  let host = url.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);

  if (host.startsWith('[')) {
    const groups = parseIpv6(host.replace(/^\[|\]$/g, ''));
    if (groups === null || ipv6Blocked(groups)) return { ok: false, reason: 'private-address' };
    return { ok: true, url };
  }

  const ip = parseIpv4(host);
  if (ip !== null) {
    return ipv4Blocked(ip) ? { ok: false, reason: 'private-address' } : { ok: true, url };
  }

  const labels = host.split('.');
  const last = labels[labels.length - 1];
  if (
    host === '' ||
    labels.length < 2 ||
    labels.some((l) => l === '') ||
    /^\d+$/.test(last) ||
    last.startsWith('0x')
  ) {
    return { ok: false, reason: 'host-name' };
  }
  if (host === 'localhost' || BLOCKED_NAME_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'host-name' };
  }
  if (WILDCARD_DNS.some((d) => host === d || host.endsWith('.' + d))) {
    return { ok: false, reason: 'blocked-suffix' };
  }
  return { ok: true, url };
}

export function checkTarget(raw: string | URL): SsrfVerdict {
  try {
    return check(raw);
  } catch {
    return { ok: false, reason: 'bad-url' };
  }
}
