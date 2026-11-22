// @vitest-environment node
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { burn, burnFallback } from '../../src/adapters/burn';
import { ERROR_MESSAGES, FALLBACK_CODES, makeError } from '../../src/adapters/errors';
import type { BurnErrorCode, FetchLike } from '../../src/adapters/types';
import { loadDisc } from '../../src/discs/loader';
import { fetchGithubSource } from '../../src/adapters/github';
import { fetchWebpageSource } from '../../src/adapters/webpage';
import { validateManifest } from '../../src/model/validate';

vi.mock('../../src/discs/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/discs/loader')>();
  return { loadDisc: vi.fn(actual.loadDisc) };
});
vi.mock('../../src/adapters/github', () => ({ fetchGithubSource: vi.fn() }));
vi.mock('../../src/adapters/webpage', () => ({ fetchWebpageSource: vi.fn() }));

const loadDiscMock = vi.mocked(loadDisc);
const githubMock = vi.mocked(fetchGithubSource);
const webMock = vi.mocked(fetchWebpageSource);

const MD = '# Moats\n\nA moat is a ditch.\n\n## Gates\n\nA gate is a door.\n';
const GH = 'https://github.com/octo/widget';
const WEB = 'https://example.com/page';

describe('burn orchestrator', () => {
  let fetchSpy: Mock<FetchLike>;
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('../../src/discs/loader')>('../../src/discs/loader');
    loadDiscMock.mockReset();
    loadDiscMock.mockImplementation(actual.loadDisc);
    githubMock.mockReset();
    webMock.mockReset();
    fetchSpy = vi.fn<FetchLike>(() => Promise.reject(new Error('no network')));
  });

  it('calls loadDisc with prebaked false and returns the validated manifest', async () => {
    const r = await burn(MD, { fetch: fetchSpy });
    expect(r.ok).toBe(true);
    expect(loadDiscMock).toHaveBeenCalledTimes(1);
    expect(loadDiscMock.mock.calls[0]![1]).toBe(false);
    if (r.ok) expect(validateManifest(r.manifest).ok).toBe(true);
  });

  it('returns validation-failed with the error list and mounts nothing', async () => {
    const errors = [{ path: 'rooms[0]', code: 'bad' as never, message: 'broken' }];
    loadDiscMock.mockReturnValue({ ok: false, errors });
    const r = await burn(MD);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('validation-failed');
      expect(r.error.validation).toEqual(errors);
    }
    expect('manifest' in r).toBe(false);
  });

  it('maps an adapter that throws to fetch-failed with a fallback topic', async () => {
    githubMock.mockRejectedValue(new Error('boom'));
    const r = await burn(GH);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('fetch-failed');
      expect(r.error.fallbackTopic).toBe('widget');
    }
    expect(loadDiscMock).not.toHaveBeenCalled();
  });

  it('returns cancelled when already aborted or aborted during fetch', async () => {
    const pre = new AbortController();
    pre.abort();
    const r1 = await burn(GH, { signal: pre.signal });
    expect(!r1.ok && r1.error.code).toBe('cancelled');

    const ctl = new AbortController();
    githubMock.mockImplementation(async () => {
      ctl.abort();
      return { ok: false, error: makeError('network') };
    });
    const r2 = await burn(GH, { signal: ctl.signal });
    expect(!r2.ok && r2.error.code).toBe('cancelled');
    expect(!r2.ok && r2.error.fallbackTopic).toBeUndefined();
  });

  it.each([...FALLBACK_CODES])('attaches fallbackTopic for %s (github and webpage)', async (code) => {
    githubMock.mockResolvedValue({ ok: false, error: makeError(code) });
    webMock.mockResolvedValue({ ok: false, error: makeError(code) });
    const g = await burn(GH);
    const w = await burn(WEB);
    expect(!g.ok && g.error.fallbackTopic).toBe('widget');
    expect(!w.ok && w.error.fallbackTopic).toBe('example.com');
  });

  it('does not attach fallbackTopic to non-fallback codes', async () => {
    const code: BurnErrorCode = 'invalid-github-url';
    githubMock.mockResolvedValue({ ok: false, error: makeError(code) });
    const r = await burn(GH);
    expect(!r.ok && r.error.fallbackTopic).toBeUndefined();
    expect(!r.ok && r.error.message).toBe(ERROR_MESSAGES[code]);
  });

  it('burnFallback produces a valid disc', async () => {
    const r = await burnFallback('widget');
    expect(r.ok).toBe(true);
    if (r.ok) expect(validateManifest(r.manifest).ok).toBe(true);
    expect(loadDiscMock.mock.calls[0]![1]).toBe(false);
  });

  it('makes no fetch call for markdown, and only the topic lookup for a topic', async () => {
    const a = await burn(MD, { fetch: fetchSpy });
    expect(a.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    const b = await burn('medieval castles', { fetch: fetchSpy });
    expect(b.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/topic?q=medieval%20castles');
    expect(githubMock).not.toHaveBeenCalled();
    expect(webMock).not.toHaveBeenCalled();
  });

  describe('topic burns', () => {
    const wikiReply = () =>
      new Response(
        JSON.stringify({
          title: 'Lighthouse',
          headings: ['History', 'Design', 'Lenses', 'Keepers', 'Modern use'],
          paragraphs: [
            'A lighthouse is a tower with a bright light that guides ships at sea.',
            'Early lighthouses burned wood or coal in open fires on a hilltop or tower.',
            'The Fresnel lens, invented in 1822, bent light into a narrow and powerful beam.',
          ],
          media: [
            { url: 'https://cdn.example.org/lighthouse.jpg', caption: 'A lighthouse' },
            { url: 'http://cdn.example.org/insecure.jpg', caption: 'Insecure' },
          ],
          metadata: { kind: 'topic', source: ['https:', '', 'en.example.org', 'wiki', 'Lighthouse'].join('/') },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    it('builds the disc from the fetched encyclopedia article and its safe pictures', async () => {
      const f = vi.fn<FetchLike>(async () => wikiReply());
      const r = await burn('Lighthouses', { fetch: f });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.manifest.title).toBe('Lighthouse');
      expect(r.manifest.sections.some((s) => s.paragraphs.some((p) => p.includes('Fresnel lens')))).toBe(true);
      expect(r.manifest.media).toEqual([{ url: 'https://cdn.example.org/lighthouse.jpg', caption: 'A lighthouse' }]);
      expect(JSON.stringify(r.manifest)).not.toContain('offline study outline');
    });

    it('reports the fetching stage before compiling', async () => {
      const stages: string[] = [];
      await burn('Lighthouses', { fetch: vi.fn<FetchLike>(async () => wikiReply()), onStage: (s) => stages.push(s) });
      expect(stages).toEqual(['fetching', 'compiling', 'validating']);
    });

    it.each([
      ['a network failure', () => Promise.reject(new Error('offline'))],
      ['a 404 (no match or no endpoint)', () => Promise.resolve(new Response('not found', { status: 404 }))],
      ['a 502 from the endpoint', () => Promise.resolve(new Response('{"error":"upstream-failed"}', { status: 502 }))],
      ['an HTML reply', () => Promise.resolve(new Response('<html></html>', { status: 200 }))],
      ['a reply with no paragraphs', () => Promise.resolve(new Response('{"title":"X","headings":[],"paragraphs":[]}', { status: 200 }))],
    ])('falls back to the offline study outline after %s', async (_name, reply) => {
      const f = vi.fn<FetchLike>(reply);
      const r = await burn('Lighthouses', { fetch: f });
      expect(f).toHaveBeenCalledTimes(1);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.manifest.title).toBe('Lighthouses');
      expect(r.manifest.sections[0]!.paragraphs.join(' ')).toMatch(/offline study outline/i);
      expect('media' in r.manifest).toBe(false);
      expect(validateManifest(r.manifest).ok).toBe(true);
    });

    it('still returns cancelled when the burn is aborted', async () => {
      const ctl = new AbortController();
      const f = vi.fn<FetchLike>(async () => {
        ctl.abort();
        return wikiReply();
      });
      const r = await burn('Lighthouses', { fetch: f, signal: ctl.signal });
      expect(!r.ok && r.error.code).toBe('cancelled');
    });

    it('burnFallback never calls the network', async () => {
      const r = await burnFallback('Lighthouses', {});
      expect(r.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
