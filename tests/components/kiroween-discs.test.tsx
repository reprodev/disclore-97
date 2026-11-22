// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import type { FetchLike } from '../../src/adapters/types';
import { HomeLauncher } from '../../src/components/HomeLauncher';
import { PackShelf, SAMPLE_BURNS } from '../../src/components/PackShelf';
import { prebakedDiscs } from '../../src/discs';
import { KEY_PREFIX } from '../../src/library/discLibrary';
import type { StorageLike } from '../../src/library/discLibrary';
import type { DiscManifest } from '../../src/model/manifest';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

afterEach(cleanup);

const tab = (name: RegExp | string) => screen.getByRole('tab', { name });
const tiles = () => within(screen.getByRole('list', { name: 'Discs' })).getAllByRole('listitem');
const sampleButtons = () => screen.queryAllByRole('button', { name: /^Burn Sample:/ });

describe('a first visit', () => {
  it('shows four built-in discs, a full 2 by 2 grid, on the Home shelf', () => {
    render(<App skipSplash storage={memoryStorage()} />);
    expect(tab('All (4)').getAttribute('aria-selected')).toBe('true');
    expect(tab('Built-In (4)')).toBeTruthy();
    expect(tab('Burned CD-Rs (0)')).toBeTruthy();
    const titles = tiles().map((t) => t.querySelector('.disc-title')!.textContent);
    expect(titles).toEqual(prebakedDiscs.map((d) => d.title));
    expect(titles).toContain("DiscLore '97: Folklore, Samhain & Halloween");
    expect(titles).toContain("DiscLore '97: Lost Formats & Digital Resurrection");
    for (const t of tiles()) expect(t.querySelector('.pack-badge')!.textContent).toBe('Built-In');
  });

  it('opens a new disc from its card', async () => {
    const user = userEvent.setup();
    render(<App skipSplash storage={memoryStorage()} />);
    await user.click(screen.getByText("DiscLore '97: Folklore, Samhain & Halloween"));
    expect(screen.getByRole('dialog', { name: "DiscLore '97: Folklore, Samhain & Halloween" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Samhain and the Harvest Fires' })).toBeTruthy();
  });

  it('the Pinpointer, spotlight, and Surprise Me! reach the new discs', async () => {
    const user = userEvent.setup();
    render(<App skipSplash storage={memoryStorage()} />);
    await user.type(screen.getByRole('combobox', { name: /Pinpointer/ }), 'emulator');
    await user.click(screen.getByRole('option', { name: /Preserving Software History/ }));
    expect(screen.getByRole('dialog', { name: "DiscLore '97: Lost Formats & Digital Resurrection" })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Preserving Software History' })).toBeTruthy();
  });

  it('Surprise Me! can land in the last built-in disc', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    render(<App skipSplash storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: /Surprise Me!/ }));
    expect(screen.getByRole('dialog', { name: "DiscLore '97: Lost Formats & Digital Resurrection" })).toBeTruthy();
    vi.restoreAllMocks();
  });
});

describe('sample burns on the empty Burned CD-Rs tab', () => {
  const none = new Set<string>();
  const shelf = (over: Partial<React.ComponentProps<typeof PackShelf>> = {}) => {
    const props = { discs: prebakedDiscs as DiscManifest[], removableIds: none, onPick: vi.fn(), onBurnSample: vi.fn(), ...over };
    render(<PackShelf {...props} />);
    return props;
  };

  it('offers three quick-start buttons beside the empty message', async () => {
    const user = userEvent.setup();
    shelf();
    await user.click(tab(/^Burned/));
    expect(screen.getByText(/No burned CD-Rs yet/)).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Sample burns' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Burn Sample: Halloween',
      'Burn Sample: Gothic fiction',
      'Burn Sample: CD-ROM',
    ]);
    expect(SAMPLE_BURNS.map((s) => s.topic)).toEqual(['Halloween', 'Gothic fiction', 'CD-ROM']);
  });

  it('each button asks for a burn of its topic', async () => {
    const user = userEvent.setup();
    const { onBurnSample } = shelf();
    await user.click(tab(/^Burned/));
    await user.click(screen.getByRole('button', { name: 'Burn Sample: Gothic fiction' }));
    expect(onBurnSample).toHaveBeenLastCalledWith('Gothic fiction');
    await user.click(screen.getByRole('button', { name: 'Burn Sample: CD-ROM' }));
    expect(onBurnSample).toHaveBeenLastCalledWith('CD-ROM');
    await user.click(screen.getByRole('button', { name: 'Burn Sample: Halloween' }));
    expect(onBurnSample).toHaveBeenLastCalledWith('Halloween');
    expect(onBurnSample).toHaveBeenCalledTimes(3);
  });

  it('shows no sample buttons on other tabs, with burned discs, or without a handler', async () => {
    const user = userEvent.setup();
    shelf();
    expect(sampleButtons()).toHaveLength(0); // All tab
    await user.click(tab(/^Built-In/));
    expect(sampleButtons()).toHaveLength(0);
    cleanup();

    const burned = { ...prebakedDiscs[0]!, disc_id: 'topic-lighthouse-ab12', title: 'Lighthouse' };
    shelf({ discs: [...prebakedDiscs, burned], removableIds: new Set([burned.disc_id]) });
    await user.click(tab(/^Burned/));
    expect(sampleButtons()).toHaveLength(0);
    cleanup();

    shelf({ onBurnSample: undefined });
    await user.click(tab(/^Burned/));
    expect(screen.getByText(/No burned CD-Rs yet/)).toBeTruthy();
    expect(sampleButtons()).toHaveLength(0);
  });

  it('HomeLauncher passes the handler through to the shelf', async () => {
    const user = userEvent.setup();
    const onBurnSample = vi.fn();
    render(<HomeLauncher discs={prebakedDiscs as DiscManifest[]} onPickDisc={() => {}} onBurnSample={onBurnSample} />);
    await user.click(tab(/^Burned/));
    await user.click(screen.getByRole('button', { name: 'Burn Sample: CD-ROM' }));
    expect(onBurnSample).toHaveBeenCalledWith('CD-ROM');
  });

  const wiki = (title: string): FetchLike => async () =>
    new Response(
      JSON.stringify({
        title,
        headings: ['History', 'Design', 'Uses', 'Legacy', 'See it today'],
        paragraphs: [
          `${title} is the subject of this sample article, written for the test.`,
          `${title} has a long history that this paragraph describes in some detail.`,
          `${title} is still remembered by many people today.`,
        ],
        metadata: { kind: 'topic', source: ['https:', '', 'en.example.org', 'wiki', title].join('/') },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

  it('in the app, a sample button opens the Burn dialog and burns that topic at once', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn<FetchLike>(wiki('Halloween'));
    const storage = memoryStorage();
    render(<App skipSplash storage={storage} fetch={fetchSpy} />);
    await user.click(tab(/^Burned/));
    await user.click(screen.getByRole('button', { name: 'Burn Sample: Halloween' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Halloween' })).toBeTruthy(), { timeout: 4000 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/topic?q=Halloween');
    expect(screen.queryByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeNull();
    expect(Array.from(storage.map.keys()).some((k) => k.startsWith(KEY_PREFIX + 'topic-'))).toBe(true);
  });

  it('falls back to the offline study outline when the lookup fails', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn<FetchLike>(() => Promise.reject(new TypeError('offline')));
    render(<App skipSplash storage={memoryStorage()} fetch={fetchSpy} />);
    await user.click(tab(/^Burned/));
    await user.click(screen.getByRole('button', { name: 'Burn Sample: CD-ROM' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'CD-ROM' })).toBeTruthy(), { timeout: 4000 });
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/topic?q=CD-ROM');
  });

  it('a normal Burn New Disc dialog does not start by itself', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn<FetchLike>(wiki('x'));
    render(<App skipSplash storage={memoryStorage()} fetch={fetchSpy} />);
    await user.click(screen.getByRole('button', { name: /Burn New CD-R Disc/ }));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Burn New after a sample burn opens an empty dialog again', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn<FetchLike>(() => new Promise(() => {})); // the sample burn never finishes
    render(<App skipSplash storage={memoryStorage()} fetch={fetchSpy} />);
    await user.click(tab(/^Burned/));
    await user.click(screen.getByRole('button', { name: 'Burn Sample: Halloween' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Halloween');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: /Burn New CD-R Disc/ }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
