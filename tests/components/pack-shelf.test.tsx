// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { topicToSource } from '../../src/adapters/markdown';
import { HomeLauncher } from '../../src/components/HomeLauncher';
import { discOrigin } from '../../src/library/discOrigin';
import { readFileText } from '../../src/library/discImage';
import { createDiscLibrary, KEY_PREFIX } from '../../src/library/discLibrary';
import type { StorageLike } from '../../src/library/discLibrary';
import { compileDisc } from '../../src/model/compiler';
import type { DiscManifest } from '../../src/model/manifest';

const mk = (id: string, title: string, tagline = `${title} tagline`): DiscManifest => ({
  disc_id: id,
  title,
  tagline,
  sections: [{ section_id: 's1', title: 'Alpha', paragraphs: ['Alpha text'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
});

const castles = mk('castles', 'Castles Disc');
const retro = mk('retro-dialup', 'Retro Disc');
const gh = mk('github-octo-hello-1a2b', 'Octo Hello');
const web = mk('webpage-example-com-3c4d', 'Example Page');
const md = mk('markdown-notes-5e6f', 'Notes');
const wiki = compileDisc({
  title: 'Lighthouse',
  headings: ['History', 'Design', 'Lenses', 'Keepers', 'Modern use'],
  paragraphs: ['A lighthouse is a tower with a bright light that guides ships at sea.'],
  metadata: { kind: 'topic', source: 'Wikipedia: Lighthouse' },
});
const outline = compileDisc(topicToSource('Tide pools'));
const image = mk('my-own-disc-9z8y', 'Some Image Disc');
const BURNED = [gh, web, md, wiki, outline, image];
const ALL = [castles, retro, ...BURNED];

function setup(over: Partial<React.ComponentProps<typeof HomeLauncher>> = {}) {
  const props = {
    discs: ALL,
    removableIds: new Set(BURNED.map((d) => d.disc_id)),
    onPickDisc: vi.fn(),
    onSaveDiscImage: vi.fn(),
    onRemoveDisc: vi.fn(),
    ...over,
  };
  render(<HomeLauncher {...props} />);
  return props;
}

const tab = (name: RegExp | string) => screen.getByRole('tab', { name });
const cards = () => within(screen.getByRole('list', { name: 'Discs' })).getAllByRole('listitem');
const titles = () => cards().map((c) => c.querySelector('.disc-title')!.textContent);

afterEach(cleanup);

describe('discOrigin', () => {
  it('names the origin of each kind of disc', () => {
    expect(discOrigin(castles, true)).toBe('Built-In');
    expect(discOrigin(gh, false)).toBe('GitHub');
    expect(discOrigin(web, false)).toBe('Web');
    expect(discOrigin(md, false)).toBe('Markdown');
    expect(discOrigin(wiki, false)).toBe('Wikipedia');
    expect(discOrigin(outline, false)).toBe('Outline');
    expect(discOrigin(image, false)).toBe('Disc Image');
  });

  it('a built-in disc is Built-In whatever its id looks like', () => {
    expect(discOrigin(gh, true)).toBe('Built-In');
  });

  it('the compiled ids are what the tags expect', () => {
    expect(wiki.disc_id.startsWith('topic-')).toBe(true);
    expect(outline.disc_id.startsWith('topic-')).toBe(true);
  });
});

describe('Expansion Pack tabs', () => {
  it('shows All, Built-In, and Burned CD-Rs tabs with counts', () => {
    setup();
    expect(screen.getByRole('tablist', { name: 'Expansion Pack filter' })).toBeTruthy();
    expect(tab('All (8)').getAttribute('aria-selected')).toBe('true');
    expect(tab('Built-In (2)').getAttribute('aria-selected')).toBe('false');
    expect(tab('Burned CD-Rs (6)').getAttribute('aria-selected')).toBe('false');
    expect(cards()).toHaveLength(8);
  });

  it('filters the shelf and keeps the panel labelled by the active tab', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(tab(/^Built-In/));
    expect(titles()).toEqual(['Castles Disc', 'Retro Disc']);
    expect(tab(/^Built-In/).getAttribute('aria-selected')).toBe('true');
    expect(tab(/^All/).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tab(/^Built-In/).id);

    await user.click(tab(/^Burned/));
    expect(titles()).toEqual(['Octo Hello', 'Example Page', 'Notes', 'Lighthouse', 'Tide pools', 'Some Image Disc']);

    await user.click(tab(/^All/));
    expect(cards()).toHaveLength(8);
  });

  it('moves between tabs with the arrow keys, Home, and End', () => {
    setup();
    const all = tab(/^All/);
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(tab(/^Built-In/).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(/^Built-In/));
    fireEvent.keyDown(tab(/^Built-In/), { key: 'End' });
    expect(tab(/^Burned/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/^Burned/), { key: 'ArrowRight' });
    expect(tab(/^All/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/^All/), { key: 'ArrowLeft' });
    expect(tab(/^Burned/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/^Burned/), { key: 'Home' });
    expect(tab(/^All/).getAttribute('aria-selected')).toBe('true');
    // Only the selected tab is in the Tab order.
    expect(tab(/^Burned/).tabIndex).toBe(-1);
  });

  it('with only built-in discs, the Burned tab is empty and says what to do', async () => {
    const user = userEvent.setup();
    setup({ discs: [castles, retro], removableIds: new Set() });
    expect(tab('All (2)')).toBeTruthy();
    expect(tab('Burned CD-Rs (0)')).toBeTruthy();
    await user.click(tab(/^Burned/));
    expect(screen.queryByRole('list', { name: 'Discs' })).toBeNull();
    expect(screen.getByText(/No burned CD-Rs yet/)).toBeTruthy();
  });

  it('treats every disc as built-in when no removable ids are given', () => {
    setup({ removableIds: undefined });
    expect(tab('Built-In (8)')).toBeTruthy();
    expect(tab('Burned CD-Rs (0)')).toBeTruthy();
  });

  it('says so when there are no discs at all', () => {
    setup({ discs: [], removableIds: new Set() });
    expect(screen.getByText('No discs are available.')).toBeTruthy();
  });
});

describe('disc cards', () => {
  it('opens a disc when its card is clicked', async () => {
    const user = userEvent.setup();
    const { onPickDisc } = setup();
    await user.click(screen.getByText('Castles Disc'));
    expect(onPickDisc).toHaveBeenCalledWith('castles');
    expect(onPickDisc).toHaveBeenCalledTimes(1);
  });

  it('shows the title, tagline, and a one-line stats summary', () => {
    setup({ discs: [castles], removableIds: new Set() });
    expect(screen.getByText('Castles Disc')).toBeTruthy();
    expect(screen.getByText('Castles Disc tagline')).toBeTruthy();
    expect(screen.getByText('1 section \u2022 0 diagrams \u2022 0 trivia \u2022 0 dungeons')).toBeTruthy();
  });

  it('tags each card with where the disc came from', () => {
    setup();
    const tag = (title: string) =>
      cards().find((c) => c.querySelector('.disc-title')!.textContent === title)!.querySelector('.pack-badge')!.textContent;
    expect(tag('Castles Disc')).toBe('Built-In');
    expect(tag('Retro Disc')).toBe('Built-In');
    expect(tag('Octo Hello')).toBe('GitHub');
    expect(tag('Example Page')).toBe('Web');
    expect(tag('Notes')).toBe('Markdown');
    expect(tag('Lighthouse')).toBe('Wikipedia');
    expect(tag('Tide pools')).toBe('Outline');
    expect(tag('Some Image Disc')).toBe('Disc Image');
  });

  it('gives Save .json and Eject to burned cards only', () => {
    setup();
    for (const c of cards()) {
      const burned = BURNED.some((d) => d.title === c.querySelector('.disc-title')!.textContent);
      expect(within(c).queryAllByRole('button', { name: 'Save .json' })).toHaveLength(burned ? 1 : 0);
      expect(within(c).queryAllByRole('button', { name: 'Eject' })).toHaveLength(burned ? 1 : 0);
    }
    expect(screen.getAllByRole('button', { name: 'Save .json' })).toHaveLength(6);
  });

  it('Save .json exports that disc without opening it', async () => {
    const user = userEvent.setup();
    const { onSaveDiscImage, onPickDisc, onRemoveDisc } = setup();
    const card = cards().find((c) => c.textContent!.includes('Octo Hello'))!;
    await user.click(within(card).getByRole('button', { name: 'Save .json' }));
    expect(onSaveDiscImage).toHaveBeenCalledTimes(1);
    expect(onSaveDiscImage).toHaveBeenCalledWith(gh);
    expect(onPickDisc).not.toHaveBeenCalled();
    expect(onRemoveDisc).not.toHaveBeenCalled();
  });

  it('Eject removes that disc without opening it', async () => {
    const user = userEvent.setup();
    const { onSaveDiscImage, onPickDisc, onRemoveDisc } = setup();
    const card = cards().find((c) => c.textContent!.includes('Example Page'))!;
    await user.click(within(card).getByRole('button', { name: 'Eject' }));
    expect(onRemoveDisc).toHaveBeenCalledTimes(1);
    expect(onRemoveDisc).toHaveBeenCalledWith(web.disc_id);
    expect(onPickDisc).not.toHaveBeenCalled();
    expect(onSaveDiscImage).not.toHaveBeenCalled();
  });

  it('a click on a mini-button never reaches the card button', () => {
    const { onPickDisc } = setup();
    const card = cards().find((c) => c.textContent!.includes('Notes'))!;
    fireEvent.click(within(card).getByRole('button', { name: 'Save .json' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Eject' }));
    expect(onPickDisc).not.toHaveBeenCalled();
  });

  it('hides a mini-button when its handler is not given', () => {
    setup({ onSaveDiscImage: undefined, onRemoveDisc: undefined });
    expect(screen.queryByRole('button', { name: 'Save .json' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eject' })).toBeNull();
  });
});

describe('layout rules in home.css', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/home.css'), 'utf8');
  const rule = (selector: string) => {
    const i = css.indexOf(`${selector} {`);
    expect(i, `${selector} exists`).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
  };

  it('lays the cards out in two columns, one on narrow screens, inside a scrolling shelf', () => {
    expect(rule('.pack-grid')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    const narrow = css.slice(css.indexOf('@media (max-width: 720px)'));
    expect(narrow).toContain('.pack-grid');
    expect(narrow).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule('.pack-shelf')).toContain('overflow-y: auto');
  });

  it('locks the Home window so only the shelf and a short right column scroll', () => {
    expect(rule('.home-window .window-content')).toContain('overflow: hidden');
    expect(rule('.home')).toContain('min-height: 0');
    expect(rule('.home__grid')).toContain('grid-template-rows: minmax(0, 1fr)');
    expect(rule('.home__side')).toContain('overflow-y: auto');
  });

  it('clamps card text to two lines', () => {
    expect(rule('.pack-tile .disc-tagline')).toContain('-webkit-line-clamp: 2');
    expect(rule('.pack-tile .disc-title')).toContain('-webkit-line-clamp: 2');
  });
});

describe('Home cards inside the app', () => {
  const memoryStorage = (): StorageLike & { map: Map<string, string> } => {
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
  };

  let blobs: Blob[];
  let names: string[];
  beforeEach(() => {
    blobs = [];
    names = [];
    Object.defineProperty(URL, 'createObjectURL', {
      value: (b: Blob) => {
        blobs.push(b);
        return 'blob:disc';
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('a burned disc shows up on the Burned tab, and Save .json downloads its disc image', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    createDiscLibrary(storage).save(outline);
    render(<App sources={[castles, retro]} storage={storage} />);

    expect(tab('All (3)')).toBeTruthy();
    expect(tab('Built-In (2)')).toBeTruthy();
    expect(tab('Burned CD-Rs (1)')).toBeTruthy();
    await user.click(tab(/^Burned/));
    const card = cards()[0]!;
    expect(within(card).getByText('Outline')).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: 'Save .json' }));
    expect(names).toEqual([`${outline.disc_id}.json`]);
    expect(JSON.parse(await readFileText(blobs[0]!))).toEqual(outline);
    // The disc did not open: the Home window is still showing.
    expect(screen.queryByRole('menuitem', { name: 'File' })).toBeNull();
  });

  it('Eject removes the disc from the library and the shelf', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    createDiscLibrary(storage).save(outline);
    render(<App sources={[castles, retro]} storage={storage} />);
    expect(storage.map.has(KEY_PREFIX + outline.disc_id)).toBe(true);

    await user.click(tab(/^Burned/));
    await user.click(within(cards()[0]!).getByRole('button', { name: 'Eject' }));

    expect(storage.map.has(KEY_PREFIX + outline.disc_id)).toBe(false);
    expect(tab('Burned CD-Rs (0)')).toBeTruthy();
    expect(tab('All (2)')).toBeTruthy();
    expect(screen.getByText(/No burned CD-Rs yet/)).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'File' })).toBeNull();
  });
});
