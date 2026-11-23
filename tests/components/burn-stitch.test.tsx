// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { ERROR_MESSAGES, makeError } from '../../src/adapters/errors';
import { fetchGithubSource } from '../../src/adapters/github';
import type { FetchLike } from '../../src/adapters/types';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { BurnDialog, STITCH_PRESET } from '../../src/components/BurnDialog';
import type { StorageLike } from '../../src/library/discLibrary';
import type { DiscManifest } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';

vi.mock('../../src/adapters/github', () => ({ fetchGithubSource: vi.fn() }));
const githubMock = vi.mocked(fetchGithubSource);

const repo = {
  title: 'Hello-World',
  headings: ['README'],
  paragraphs: ['My first repository on GitHub.', 'Say hello to the world.'],
  metadata: { kind: 'github' as const, source: 'https://github.com/octocat/Hello-World' },
};

/** No network at all: topics fall back to their offline outline, and GitHub is mocked. */
const failingFetch: FetchLike = () => Promise.reject(new TypeError('offline'));

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
  githubMock.mockReset();
  githubMock.mockResolvedValue({ ok: true, value: repo });
});
afterEach(() => {
  cleanup();
  __setContextFactory(null);
});

function setup(props: Partial<Parameters<typeof BurnDialog>[0]> = {}) {
  const onBurned = vi.fn<(m: DiscManifest) => void>();
  const onClose = vi.fn();
  render(<BurnDialog onBurned={onBurned} onClose={onClose} fetch={failingFetch} minBurnMs={0} online={() => true} {...props} />);
  return { onBurned, onClose };
}

type User = ReturnType<typeof userEvent.setup>;
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
const toStitch = (user: User) => user.click(radio('Stitch CD-R (2-4 Sources)'));
const rowBox = (n: number) => screen.getByRole('textbox', { name: `Source ${n}:` }) as HTMLTextAreaElement;
const rows = () => within(screen.getByRole('group', { name: 'Stitch sources' })).getAllByRole('textbox', { name: /^Source \d:$/ });
const stitchBtn = () => screen.getByRole('button', { name: 'Stitch & Burn' }) as HTMLButtonElement;

describe('BurnDialog modes', () => {
  it('starts in Single Source mode with the original box and Burn button, and no stitch rows', () => {
    setup();
    expect(radio('Single Source').checked).toBe(true);
    expect(radio('Stitch CD-R (2-4 Sources)').checked).toBe(false);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Burn' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stitch & Burn' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Burn mode' })).toBeTruthy();
  });

  it('switches to Stitch mode with a title box, two source rows, and Stitch & Burn, and back again', async () => {
    const user = userEvent.setup();
    setup();
    await toStitch(user);
    expect(radio('Stitch CD-R (2-4 Sources)').checked).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Disc Title (optional):' })).toBeTruthy();
    expect(rows()).toHaveLength(2);
    expect(stitchBtn().disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Burn' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Presets' })).toBeNull();
    await user.click(radio('Single Source'));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Burn' })).toBeTruthy();
  });

  it('keeps what was typed in each mode when switching back and forth', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole('textbox'), 'Lighthouse');
    await toStitch(user);
    await user.type(rowBox(1), 'Aurora');
    await user.click(radio('Single Source'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Lighthouse');
    await toStitch(user);
    expect(rowBox(1).value).toBe('Aurora');
  });
});

describe('Stitch mode rows', () => {
  it('adds rows up to 4 and removes them down to 2', async () => {
    const user = userEvent.setup();
    setup();
    await toStitch(user);
    const add = () => screen.getByRole('button', { name: '+ Add Source' }) as HTMLButtonElement;
    const removeBtn = (n: number) => screen.getByRole('button', { name: `Remove Source ${n}` }) as HTMLButtonElement;
    expect(removeBtn(1).disabled).toBe(true);
    expect(screen.getByText('2 of 4 sources')).toBeTruthy();
    await user.click(add());
    await user.click(add());
    expect(rows()).toHaveLength(4);
    expect(add().disabled).toBe(true);
    expect(screen.getByText('4 of 4 sources')).toBeTruthy();
    await user.type(rowBox(3), 'Third');
    await user.type(rowBox(4), 'Fourth');
    await user.click(removeBtn(3));
    expect(rows().map((r) => (r as HTMLTextAreaElement).value)).toEqual(['', '', 'Fourth']);
    await user.click(removeBtn(1));
    expect(rows()).toHaveLength(2);
    expect(removeBtn(1).disabled).toBe(true);
    expect(removeBtn(2).disabled).toBe(true);
  });

  it('the preset fills a GitHub repository and a topic in one click', async () => {
    const user = userEvent.setup();
    setup();
    await toStitch(user);
    await user.click(screen.getByRole('button', { name: 'Mix: octocat/Hello-World + Lighthouse' }));
    expect(rows().map((r) => (r as HTMLTextAreaElement).value)).toEqual([...STITCH_PRESET.rows]);
    expect(stitchBtn().disabled).toBe(false);
  });

  it('needs two filled rows before Stitch & Burn is on', async () => {
    const user = userEvent.setup();
    setup();
    await toStitch(user);
    await user.type(rowBox(1), 'Lighthouse');
    expect(stitchBtn().disabled).toBe(true);
    await user.type(rowBox(2), '   ');
    expect(stitchBtn().disabled).toBe(true);
    await user.type(rowBox(2), 'Aurora');
    expect(stitchBtn().disabled).toBe(false);
  });
});

describe('Stitch & Burn', () => {
  it('burns the preset into one stitched disc with the custom title', async () => {
    const user = userEvent.setup();
    const { onBurned } = setup();
    await toStitch(user);
    await user.type(screen.getByRole('textbox', { name: 'Disc Title (optional):' }), 'Coastal Code');
    await user.click(screen.getByRole('button', { name: STITCH_PRESET.label }));
    await user.click(stitchBtn());
    await waitFor(() => expect(onBurned).toHaveBeenCalledTimes(1));
    const m = onBurned.mock.calls[0]![0];
    expect(validateManifest(m).ok).toBe(true);
    expect(m.title).toBe('Coastal Code');
    expect(m.disc_id.startsWith('stitched-')).toBe(true);
    expect(githubMock).toHaveBeenCalledWith('octocat', 'Hello-World', expect.any(Object));
    const titles = m.sections.map((s) => s.title);
    expect(titles).toContain('Hello-World');
    expect(titles).toContain('Lighthouse');
    expect(titles).toContain('Connections');
  });

  it('names the failing source in the error, and keeps the rows for a retry', async () => {
    githubMock.mockResolvedValue({ ok: false, error: makeError('repo-not-found') });
    const user = userEvent.setup();
    const { onBurned } = setup();
    await toStitch(user);
    await user.type(rowBox(1), 'Lighthouse');
    await user.type(rowBox(2), 'https://github.com/octocat/missing');
    await user.click(stitchBtn());
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toBe(`Source 2: ${ERROR_MESSAGES['repo-not-found']}`));
    expect(onBurned).not.toHaveBeenCalled();
    expect(rowBox(2).value).toBe('https://github.com/octocat/missing');
    expect(within(alert).queryByRole('button')).toBeNull(); // no single-source offline burn offer
    await waitFor(() => expect(document.activeElement).toBe(rowBox(1)));
  });

  it('refuses URL sources while offline, before any request', async () => {
    const user = userEvent.setup();
    const { onBurned } = setup({ online: () => false });
    await toStitch(user);
    await user.click(screen.getByRole('button', { name: STITCH_PRESET.label }));
    await user.click(stitchBtn());
    expect(screen.getByRole('alert').textContent).toBe('URL sources need a connection.');
    expect(githubMock).not.toHaveBeenCalled();
    expect(onBurned).not.toHaveBeenCalled();
  });

  it('works offline for topics and Markdown, which need no address', async () => {
    const user = userEvent.setup();
    const { onBurned } = setup({ online: () => false });
    await toStitch(user);
    await user.type(rowBox(1), 'Lighthouse');
    await user.type(rowBox(2), '# Notes{enter}{enter}A keeper trims the wick.');
    await user.click(stitchBtn());
    await waitFor(() => expect(onBurned).toHaveBeenCalledTimes(1));
    expect(onBurned.mock.calls[0]![0].title).toBe('Lighthouse + Notes');
  });

  it('Cancel stops a stitch in progress and closes without burning', async () => {
    let release: () => void = () => {};
    githubMock.mockImplementation(() => new Promise((res) => (release = () => res({ ok: true, value: repo }))));
    const user = userEvent.setup();
    const { onBurned, onClose } = setup();
    await toStitch(user);
    await user.click(screen.getByRole('button', { name: STITCH_PRESET.label }));
    await user.click(stitchBtn());
    // A disabled fieldset disables its radios without setting their own `disabled` property.
    expect(radio('Single Source').matches(':disabled')).toBe(true);
    expect(rowBox(1).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const signal = githubMock.mock.calls[0]![2]!.signal!;
    expect(signal.aborted).toBe(true);
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(onBurned).not.toHaveBeenCalled();
  });
});

describe('in the app', () => {
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

  it('mounts the stitched disc with a Stitched badge on the Burned CD-Rs shelf', async () => {
    const user = userEvent.setup();
    const empty = { disc_id: 'base', title: 'Base Disc', tagline: 't', sections: [{ section_id: 's', title: 'S', paragraphs: ['p'] }], diagrams: [], trivia: [], dungeons: [] };
    render(<App sources={[empty]} storage={memoryStorage()} fetch={failingFetch} />);
    await user.click(screen.getByRole('button', { name: /Burn New CD-R Disc/ }));
    await toStitch(user);
    await user.click(screen.getByRole('button', { name: STITCH_PRESET.label }));
    await user.click(stitchBtn());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeNull(), { timeout: 4000 });
    expect(screen.getByRole('navigation', { name: 'Hello-World + Lighthouse' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Close Disc' }));
    await user.click(screen.getByRole('tab', { name: /^Burned/ }));
    expect(document.querySelector('.pack-badge--stitched')!.textContent).toBe('Stitched');
  });
});
