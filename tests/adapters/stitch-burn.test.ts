// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { burnStitchedDisc, STITCH_MESSAGE } from '../../src/adapters/burn';
import { ERROR_MESSAGES, makeError } from '../../src/adapters/errors';
import { fetchGithubSource } from '../../src/adapters/github';
import { fetchTopicSource } from '../../src/adapters/topic';
import { fetchWebpageSource } from '../../src/adapters/webpage';
import { loadDisc } from '../../src/discs/loader';
import { discOrigin } from '../../src/library/discOrigin';
import { solveDungeon } from '../../src/model/solver';
import type { ExtractedSource } from '../../src/model/source';
import { validateManifest } from '../../src/model/validate';

vi.mock('../../src/discs/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/discs/loader')>();
  return { loadDisc: vi.fn(actual.loadDisc) };
});
vi.mock('../../src/adapters/github', () => ({ fetchGithubSource: vi.fn() }));
vi.mock('../../src/adapters/webpage', () => ({ fetchWebpageSource: vi.fn() }));
vi.mock('../../src/adapters/topic', () => ({ fetchTopicSource: vi.fn() }));

const loadDiscMock = vi.mocked(loadDisc);
const githubMock = vi.mocked(fetchGithubSource);
const webMock = vi.mocked(fetchWebpageSource);
const topicMock = vi.mocked(fetchTopicSource);

const GH = 'https://github.com/octocat/Hello-World';
const WEB = 'https://example.com/lights';
const MD = '# Keeper Notes\n\nThe keeper trims the wick at dusk.\n\n## Lens Care\n\nPolish the Fresnel lens every morning.\n';

const repo: ExtractedSource = {
  title: 'Hello-World',
  headings: ['README', 'Usage'],
  paragraphs: ['My first repository on GitHub.', 'Run it to say hello.', 'Pull requests are welcome.'],
  metadata: { kind: 'github', source: GH, description: 'My first repository', facts: ['Stars: 2000'] },
  media: [{ url: 'https://avatars.githubusercontent.com/u/583231', caption: 'octocat' }],
};
const lighthouse: ExtractedSource = {
  title: 'Lighthouse',
  headings: ['History', 'Lenses', 'Keepers'],
  paragraphs: Array.from({ length: 9 }, (_, i) => `Lighthouse paragraph ${i + 1}. A tower guides ships with light.`),
  metadata: { kind: 'topic', source: 'https://en.wikipedia.org/wiki/Lighthouse' },
  media: [
    { url: 'https://upload.wikimedia.org/lighthouse.jpg', caption: 'A lighthouse' },
    { url: 'javascript:alert(1)', caption: 'bad' },
  ],
};

beforeEach(async () => {
  const actual = await vi.importActual<typeof import('../../src/discs/loader')>('../../src/discs/loader');
  loadDiscMock.mockReset();
  loadDiscMock.mockImplementation(actual.loadDisc);
  githubMock.mockReset();
  webMock.mockReset();
  topicMock.mockReset();
  githubMock.mockResolvedValue({ ok: true, value: repo });
  topicMock.mockResolvedValue({ ok: true, value: lighthouse });
});

describe('burnStitchedDisc', () => {
  it('stitches GitHub, a Wikipedia topic, and Markdown into one valid disc gated by loadDisc(manifest, false)', async () => {
    const stages: string[] = [];
    const r = await burnStitchedDisc([GH, 'Lighthouse', MD], undefined, { onStage: (s) => stages.push(s) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.manifest;
    expect(githubMock).toHaveBeenCalledWith('octocat', 'Hello-World', expect.any(Object));
    expect(topicMock).toHaveBeenCalledWith('Lighthouse', expect.any(Object));
    expect(loadDiscMock).toHaveBeenCalledTimes(1);
    expect(loadDiscMock.mock.calls[0]![1]).toBe(false);
    expect(validateManifest(m).ok).toBe(true);
    for (const d of m.dungeons) expect(solveDungeon(d).path.length).toBeGreaterThan(0);
    expect(m.disc_id.startsWith('stitched-')).toBe(true);
    expect(discOrigin(m, false)).toBe('Stitched');
    expect(m.title).toBe('Hello-World + Lighthouse + Keeper Notes');
    const titles = m.sections.map((s) => s.title);
    expect(titles[0]).toBe('Hello-World');
    expect(titles).toContain('Lighthouse');
    expect(titles).toContain('Keeper Notes');
    expect(titles).toContain('Connections');
    expect(titles.indexOf('Hello-World')).toBeLessThan(titles.indexOf('Lighthouse'));
    expect(titles.indexOf('Lighthouse')).toBeLessThan(titles.indexOf('Keeper Notes'));
    // Pictures from both sources, the unsafe one dropped.
    expect((m.media ?? []).map((x) => x.url)).toEqual([repo.media![0]!.url, lighthouse.media![0]!.url]);
    expect(stages).toEqual(['fetching', 'compiling', 'validating']);
  });

  it('uses the custom disc title', async () => {
    const r = await burnStitchedDisc([GH, 'Lighthouse'], '  Coastal Code  ', {});
    expect(r.ok && r.manifest.title).toBe('Coastal Code');
  });

  it('falls back to the offline study outline for a topic that cannot be looked up', async () => {
    topicMock.mockResolvedValue({ ok: false, error: makeError('unavailable') });
    const r = await burnStitchedDisc(['Lighthouse', MD], undefined, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest.sections.some((s) => s.paragraphs.some((p) => /offline study outline/i.test(p)))).toBe(true);
  });

  it('stops with a message naming the source when a GitHub or web page source fails', async () => {
    githubMock.mockResolvedValue({ ok: false, error: makeError('repo-not-found') });
    const r = await burnStitchedDisc(['Lighthouse', GH], undefined, {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('repo-not-found');
      expect(r.error.message).toBe(`Source 2: ${ERROR_MESSAGES['repo-not-found']}`);
    }
    expect(loadDiscMock).not.toHaveBeenCalled();

    webMock.mockRejectedValue(new Error('boom'));
    const w = await burnStitchedDisc([MD, WEB, 'Lighthouse'], undefined, {});
    expect(!w.ok && w.error.message).toBe(`Source 2: ${ERROR_MESSAGES['fetch-failed']}`);
  });

  it('names a source that cannot be read at all', async () => {
    const r = await burnStitchedDisc(['Lighthouse', 'javascript:alert(1)'], undefined, {});
    expect(!r.ok && r.error.code).toBe('unsupported-scheme');
    expect(!r.ok && r.error.message.startsWith('Source 2:')).toBe(true);
  });

  it('needs 2 to 4 filled sources, and ignores blank rows', async () => {
    for (const rows of [[], ['Lighthouse'], ['Lighthouse', '   ', ''], ['a', 'b', 'c', 'd', 'e']]) {
      const r = await burnStitchedDisc(rows, undefined, {});
      expect(r.ok, JSON.stringify(rows)).toBe(false);
      if (!r.ok) expect(r.error.message).toBe(STITCH_MESSAGE);
    }
    const ok = await burnStitchedDisc(['', 'Lighthouse', '  ', MD], undefined, {});
    expect(ok.ok).toBe(true);
    expect(githubMock).not.toHaveBeenCalled();
  });

  it('is cancelled cleanly before it starts, and while it is fetching', async () => {
    const pre = new AbortController();
    pre.abort();
    const a = await burnStitchedDisc([GH, 'Lighthouse'], undefined, { signal: pre.signal });
    expect(!a.ok && a.error.code).toBe('cancelled');
    expect(githubMock).not.toHaveBeenCalled();

    const mid = new AbortController();
    githubMock.mockImplementation(async () => {
      mid.abort();
      return { ok: true, value: repo };
    });
    const b = await burnStitchedDisc([GH, 'Lighthouse'], undefined, { signal: mid.signal });
    expect(!b.ok && b.error.code).toBe('cancelled');
    expect(loadDiscMock).not.toHaveBeenCalled();
  });

  it('passes the signal and the fetch to every adapter', async () => {
    const controller = new AbortController();
    const fetch = vi.fn();
    await burnStitchedDisc([GH, 'Lighthouse'], undefined, { signal: controller.signal, fetch });
    expect(githubMock.mock.calls[0]![2]).toMatchObject({ signal: controller.signal, fetch });
    expect(topicMock.mock.calls[0]![1]).toMatchObject({ signal: controller.signal, fetch });
  });

  it('reports a failed gate as validation-failed and mounts nothing', async () => {
    loadDiscMock.mockReturnValue({ ok: false, errors: [{ path: '$.x', code: 'bad' as never, message: 'broken' }] });
    const r = await burnStitchedDisc([GH, 'Lighthouse'], undefined, {});
    expect(!r.ok && r.error.code).toBe('validation-failed');
  });

  it('never throws, even when an adapter throws synchronously or the progress callback throws', async () => {
    topicMock.mockImplementation(() => {
      throw new Error('sync boom');
    });
    const r = await burnStitchedDisc(['Lighthouse', MD], undefined, {
      onStage: () => {
        throw new Error('bad callback');
      },
    });
    expect(r.ok).toBe(true); // the topic falls back to its offline outline
  });
});
