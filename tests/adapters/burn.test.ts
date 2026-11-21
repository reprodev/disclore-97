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

  it('makes no fetch call for markdown and topic inputs', async () => {
    const a = await burn(MD, { fetch: fetchSpy });
    const b = await burn('medieval castles', { fetch: fetchSpy });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(githubMock).not.toHaveBeenCalled();
    expect(webMock).not.toHaveBeenCalled();
  });
});
