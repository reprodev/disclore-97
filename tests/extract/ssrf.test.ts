// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkTarget } from '../../src/extract/ssrf';

const reason = (u: string) => {
  const v = checkTarget(u);
  return v.ok ? 'ok' : v.reason;
};

describe('checkTarget: host names', () => {
  it.each([
    ['http://localhost/', 'host-name'],
    ['http://LOCALHOST./', 'host-name'],
    ['http://a.localhost/', 'host-name'],
    ['http://printer.local/', 'host-name'],
    ['http://db.internal/', 'host-name'],
    ['http://intranet/', 'host-name'],
    ['http://foo/', 'host-name'],
  ])('%s -> %s', (u, r) => expect(reason(u)).toBe(r));

  it.each(['http://127.0.0.1.nip.io/', 'http://a.sslip.io/', 'https://nip.io/'])(
    'rejects wildcard DNS %s',
    (u) => expect(reason(u)).toBe('blocked-suffix'),
  );
});

describe('checkTarget: IPv4 ranges at both ends', () => {
  const ranges: Array<[string, string]> = [
    ['0.0.0.0', '0.255.255.255'],
    ['10.0.0.0', '10.255.255.255'],
    ['100.64.0.0', '100.127.255.255'],
    ['127.0.0.0', '127.255.255.255'],
    ['169.254.0.0', '169.254.255.255'],
    ['172.16.0.0', '172.31.255.255'],
    ['192.0.0.0', '192.0.0.255'],
    ['192.0.2.0', '192.0.2.255'],
    ['192.168.0.0', '192.168.255.255'],
    ['198.18.0.0', '198.19.255.255'],
    ['198.51.100.0', '198.51.100.255'],
    ['203.0.113.0', '203.0.113.255'],
    ['224.0.0.0', '239.255.255.255'],
    ['240.0.0.0', '255.255.255.255'],
  ];
  it.each(ranges.flat())('blocks %s', (ip) => expect(reason(`http://${ip}/`)).toBe('private-address'));

  it('blocks 255.255.255.255 explicitly', () => {
    expect(reason('http://255.255.255.255/')).toBe('private-address');
  });

  it.each(['11.0.0.0', '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0', '192.169.0.0', '8.8.8.8'])(
    'allows just-outside address %s',
    (ip) => expect(reason(`http://${ip}/`)).toBe('ok'),
  );
});

describe('checkTarget: IPv6 and encoded IPv4', () => {
  it.each([
    'http://[::1]/',
    'http://[::]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
  ])('blocks %s', (u) => expect(reason(u)).toBe('private-address'));

  it.each(['http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'http://127.1/'])(
    'blocks encoded loopback %s',
    (u) => expect(reason(u)).toBe('private-address'),
  );
});

describe('checkTarget: scheme, credentials, port', () => {
  it('rejects credentials', () => {
    expect(reason('https://user:pw@example.com/')).toBe('credentials');
    expect(reason('https://user@example.com/')).toBe('credentials');
  });
  it.each(['22', '8080'])('rejects port %s', (p) => expect(reason(`https://example.com:${p}/`)).toBe('port'));
  it('rejects ftp: and file:', () => {
    expect(reason('ftp://example.com/')).toBe('scheme');
    expect(reason('file:///etc/passwd')).toBe('scheme');
  });
  it('rejects unparsable input', () => {
    expect(reason('not a url')).toBe('bad-url');
  });
});

describe('checkTarget: allowed', () => {
  it('accepts https://example.com', () => {
    const v = checkTarget('https://example.com');
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.url.hostname).toBe('example.com');
  });
  it('accepts explicit ports 80 and 443', () => {
    expect(reason('http://example.com:80/')).toBe('ok');
    expect(reason('https://example.com:443/')).toBe('ok');
  });
});
