import { describe, expect, it } from 'vitest';
import { burn, burnFallback, refreshDisc } from '../../src/adapters/burn';
import { ERROR_MESSAGES, rateLimitMessage } from '../../src/adapters/errors';
import { minutesUntilReset } from '../../src/adapters/github';
import type { FetchLike } from '../../src/adapters/types';
import { createDiscLibrary, type StorageLike } from '../../src/library/discLibrary';
import { discOrigin } from '../../src/library/discOrigin';
import type { DiscManifest } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';

const REPO = 'https://github.com/octo/hello';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** A GitHub API double that serves one small public repository. */
const githubOk: FetchLike = async (input) => {
  const url = String(input);
  if (url.endsWith('/languages')) return json({ TypeScript: 900, CSS: 100 });
  if (url.endsWith('/readme')) {
    const md = '# Hello\n\nHello is a friendly test repository.\n\n## Usage\n\nRun it and say hello to the world.';
    return json({ encoding: 'base64', content: btoa(md) });
  }
  return json({
    full_name: 'octo/hello',
    description: 'A friendly repo',
    default_branch: 'main',
    stargazers_count: 7,
    owner: { login: 'octo' },
  });
};

const offline: FetchLike = () => Promise.reject(new TypeError('offline'));

/** A GitHub API double that is over its rate limit, resetting `minutes` from now. */
function githubBusy(minutes: number): FetchLike {
  const reset = String(Math.floor(Date.now() / 1000) + minutes * 60);
  return async () => json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-reset': reset });
}

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

async function githubOutline(): Promise<DiscManifest> {
  const r = await burnFallback('hello', {}, { kind: 'github', input: REPO });
  if (!r.ok) throw new Error('outline did not burn');
  return r.manifest;
}

describe('offline outlines remember their source', () => {
  it('Burn offline after a failed GitHub burn keeps the kind and the address', async () => {
    const m = await githubOutline();
    expect(m.outline).toEqual({ kind: 'github', input: REPO });
    expect(validateManifest(m).ok).toBe(true);
    expect(discOrigin(m, false)).toBe('Outline');
  });

  it('a topic burn that falls back to the outline records the topic', async () => {
    const r = await burn('  Lighthouses of Maine  ', { fetch: offline });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest.outline).toEqual({ kind: 'topic', input: 'Lighthouses of Maine' });
  });

  it('a full disc carries no outline marker', async () => {
    const r = await burn(REPO, { fetch: githubOk });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest.outline).toBeUndefined();
  });

  it('the marker does not change what the compiler builds', async () => {
    const plain = await burnFallback('hello');
    const marked = await githubOutline();
    if (!plain.ok) throw new Error('no plain outline');
    const withoutMarker: Partial<DiscManifest> = { ...marked };
    delete withoutMarker.outline;
    expect(plain.manifest.outline).toEqual({ kind: 'topic', input: 'hello' });
    const plainWithoutMarker: Partial<DiscManifest> = { ...plain.manifest };
    delete plainWithoutMarker.outline;
    expect(withoutMarker).toEqual(plainWithoutMarker);
  });
});

describe('the validator checks the outline marker', () => {
  it.each([
    ['a kind it does not know', { kind: 'markdown', input: 'x' }],
    ['an empty input', { kind: 'topic', input: '   ' }],
    ['a control character', { kind: 'topic', input: 'bad\u0007topic' }],
    ['an overlong input', { kind: 'topic', input: 'a'.repeat(2049) }],
    ['a non-object', 'github'],
    ['a missing input', { kind: 'topic' }],
  ])('rejects %s', async (_label, outline) => {
    const m = await githubOutline();
    const r = validateManifest({ ...m, outline });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.path.startsWith('$.outline'))).toBe(true);
  });
});

describe('refreshDisc', () => {
  it('upgrades an outline to the full disc under the same disc_id', async () => {
    const outline = await githubOutline();
    const r = await refreshDisc(outline, { fetch: githubOk });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.disc_id).toBe(outline.disc_id);
    expect(r.manifest.outline).toBeUndefined();
    expect(r.manifest.title).toBe('octo/hello');
    expect(validateManifest(r.manifest).ok).toBe(true);
  });

  it('fails, without an offline button, while GitHub is still rate-limited, and quotes the wait', async () => {
    const outline = await githubOutline();
    const r = await refreshDisc(outline, { fetch: githubBusy(12) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('rate-limited');
    expect(r.error.message).toMatch(/All lines to the GitHub archive are busy/);
    expect(r.error.message).toMatch(/about 1[23] minutes/);
    expect(r.error.message).not.toMatch(/Burn offline/);
    expect(r.error.fallbackTopic).toBeUndefined();
  });

  it('fails while offline and leaves the outline object untouched', async () => {
    const outline = await githubOutline();
    const before = JSON.stringify(outline);
    const r = await refreshDisc(outline, { fetch: offline });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('network');
    expect(JSON.stringify(outline)).toBe(before);
  });

  it('a topic outline whose lookup still fails returns an error, not another outline', async () => {
    const t = await burn('Lighthouses of Maine', { fetch: offline });
    if (!t.ok) throw new Error('no topic outline');
    const r = await refreshDisc(t.manifest, { fetch: async () => json({ error: 'nothing' }, 404) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/did not answer with an article for "Lighthouses of Maine"/);
  });

  it('a topic outline refreshes into the Wikipedia disc when the lookup answers', async () => {
    const t = await burn('Lighthouses of Maine', { fetch: offline });
    if (!t.ok) throw new Error('no topic outline');
    const article: FetchLike = async () =>
      json({
        title: 'Lighthouses of Maine',
        headings: ['History', 'Keepers'],
        paragraphs: [
          'Maine has more than sixty lighthouses along its rocky coast.',
          'Keepers tended the lamps through long winter nights.',
          'Many lights are now automated and open to visitors.',
        ],
        metadata: { source: 'Wikipedia: Lighthouses of Maine' },
      });
    const r = await refreshDisc(t.manifest, { fetch: article });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.disc_id).toBe(t.manifest.disc_id);
      expect(r.manifest.outline).toBeUndefined();
      expect(discOrigin(r.manifest, false)).toBe('Wikipedia');
    }
  });

  it('refuses a disc whose saved input does not match its kind, and a disc that is not an outline', async () => {
    const outline = await githubOutline();
    const tampered = { ...outline, outline: { kind: 'github' as const, input: 'just some words' } };
    const r = await refreshDisc(tampered, { fetch: githubOk });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('validation-failed');
    const full = await burn(REPO, { fetch: githubOk });
    if (!full.ok) throw new Error('no full disc');
    expect((await refreshDisc(full.manifest, { fetch: githubOk })).ok).toBe(false);
  });
});

describe('the library replaces a refreshed disc in place', () => {
  it('keeps the disc in the same position with keepPosition', async () => {
    const storage = memoryStorage();
    const lib = createDiscLibrary(storage);
    const outline = await githubOutline();
    const other = await burnFallback('Another topic entirely');
    if (!other.ok) throw new Error('no second disc');
    lib.save(outline);
    lib.save(other.manifest);
    const refreshed = await refreshDisc(outline, { fetch: githubOk });
    if (!refreshed.ok) throw new Error('refresh failed');
    expect(lib.save(refreshed.manifest, { keepPosition: true }).saved).toBe(true);
    const ids = lib.load().map((d) => d.disc_id);
    expect(ids).toEqual([outline.disc_id, other.manifest.disc_id]);
    expect(lib.load()[0]!.outline).toBeUndefined();
    // Without keepPosition a save still moves the disc to the newest place.
    lib.save(refreshed.manifest);
    expect(lib.load().map((d) => d.disc_id)).toEqual([other.manifest.disc_id, outline.disc_id]);
  });
});

describe('the GitHub busy line', () => {
  it('reads the reset time into whole minutes', () => {
    const now = 1_700_000_000_000;
    const h = (v: Record<string, string>) => new Headers(v);
    expect(minutesUntilReset(h({ 'x-ratelimit-reset': String(now / 1000 + 600) }), now)).toBe(10);
    expect(minutesUntilReset(h({ 'x-ratelimit-reset': String(now / 1000 + 61) }), now)).toBe(2);
    expect(minutesUntilReset(h({ 'x-ratelimit-reset': String(now / 1000 + 5) }), now)).toBe(1);
    expect(minutesUntilReset(h({ 'retry-after': '90' }), now)).toBe(2);
    expect(minutesUntilReset(h({}), now)).toBeUndefined();
    expect(minutesUntilReset(h({ 'x-ratelimit-reset': 'soon' }), now)).toBeUndefined();
    expect(minutesUntilReset(h({ 'x-ratelimit-reset': String(now / 1000 + 6 * 3600) }), now)).toBeUndefined();
    expect(minutesUntilReset(undefined, now)).toBeUndefined();
  });

  it('a burn quotes the wait and still offers Burn offline', async () => {
    const r = await burn(REPO, { fetch: githubBusy(25) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('rate-limited');
    expect(r.error.message).toMatch(/about 2[56] minutes/);
    expect(r.error.message).toMatch(/Burn offline/);
    expect(r.error.fallbackTopic).toBe('hello');
  });

  it('falls back to "up to an hour" with no reset header', async () => {
    const r = await burn(REPO, { fetch: async () => json({ message: 'limit' }, 429) });
    expect(!r.ok && r.error.message).toBe(ERROR_MESSAGES['rate-limited']);
    expect(rateLimitMessage()).toMatch(/wait up to an hour and redial/);
    expect(rateLimitMessage(1)).toMatch(/about a minute/);
  });
});
