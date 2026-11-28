// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { FetchLike } from '../../src/adapters/types';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { BootSplash } from '../../src/components/BootSplash';
import { DidYouKnow } from '../../src/components/DidYouKnow';
import { Taskbar } from '../../src/components/Taskbar';
import type { StorageLike } from '../../src/library/discLibrary';
import { HAUNTED_CLASS, CHRISTMAS_CLASS, THEME_KEY, applyTheme, loadTheme, nextTheme, saveTheme } from '../../src/library/theme';
import { DEEP_VIEWS, hasDeepLink, parseDeepLink, resolveDeepLink, shareQuery, topicQuery } from '../../src/model/deepLink';
import { EDITIONS, THEMES, editionOf, prefersDisc } from '../../src/model/editions';
import type { DiscManifest } from '../../src/model/manifest';

// ---- Fixtures ---------------------------------------------------------------------------------

const castles: DiscManifest = {
  disc_id: 'castles',
  title: 'Castle Disc',
  tagline: 'Stone and water',
  sections: [
    { section_id: 'moat', title: 'The Moat', paragraphs: ['Water circles the keep. It guards the wall.'], facts: ['Moats are ditches of water.'], timeline: [{ when: '1100s', event: 'Wide moats appear.' }] },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above the moat.'], facts: ['Keeps were built of stone.'] },
  ],
  diagrams: [
    {
      diagram_id: 'plan',
      title: 'The Plan',
      viewBox: '0 0 100 100',
      shapes: [{ kind: 'rect', x: 0, y: 0, width: 100, height: 100, fill: 'var(--color-parchment)', stroke: 'none' }],
      hotspots: [{ label: 'Water ring', x: 30, y: 40, section_id: 'moat' }],
    },
  ],
  trivia: [{ question_id: 'q0', prompt: 'What circles the keep?', options: ['Fire', 'Water'], correct_index: 1, section_id: 'moat' }],
  dungeons: [
    {
      dungeon_id: 'dng',
      title: 'Test Keep',
      rooms: [
        { room_id: 'entrance', name: 'Gate', description: 'A gate.', exits: [{ to: 'throne_room' }] },
        { room_id: 'throne_room', name: 'Throne', description: 'The throne.', exits: [{ to: 'entrance' }] },
      ],
    },
  ],
};

const halloween: DiscManifest = {
  disc_id: 'halloween',
  title: 'Folklore, Samhain and Halloween',
  tagline: 'Spooky',
  sections: [{ section_id: 'samhain', title: 'Samhain', paragraphs: ['Samhain marks the end of harvest.'], facts: ['Samhain is celebrated on 31 October.'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

/** A disc with no diagram, no dungeon, and no dated events. */
const bare: DiscManifest = {
  disc_id: 'bare',
  title: 'Bare Disc',
  tagline: 'Nothing extra',
  sections: [{ section_id: 'only', title: 'Only Section', paragraphs: ['Plain text.'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

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

const root = document.documentElement;
beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  root.classList.remove(HAUNTED_CLASS, CHRISTMAS_CLASS);
  __setContextFactory(null);
});

type User = ReturnType<typeof userEvent.setup>;
const startButton = () => screen.getByRole('button', { name: 'Start menu' });
const startMenu = () => screen.getByRole('menu', { name: 'Start menu' });
const openStart = async (user: User) => {
  await user.click(startButton());
  return startMenu();
};
const item = (name: string | RegExp) => within(startMenu()).getByRole('menuitem', { name });

// ---- Start menu -------------------------------------------------------------------------------

describe('Start menu', () => {
  const app = (extra: Partial<React.ComponentProps<typeof App>> = {}) =>
    render(<App sources={[castles, bare]} storage={memoryStorage()} fetch={vi.fn<FetchLike>()} {...extra} />);

  it('opens from the Start button with aria-expanded, a DiscLore 97 side strip, and every item', async () => {
    const user = userEvent.setup();
    app();
    expect(startButton().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu', { name: 'Start menu' })).toBeNull();
    const menu = await openStart(user);
    expect(startButton().getAttribute('aria-expanded')).toBe('true');
    expect(menu.querySelector('.startmenu__banner')!.textContent).toBe('DiscLore 97');
    const names = within(menu).getAllByRole('menuitem').map((m) => m.textContent);
    expect(names).toEqual([
      'Mounted Discs\u25BA',
      'Burn New CD-R Disc...',
      'Mount Disc Image (.json)...',
      'Dictionary...',
      'Take a Tour',
      'Study Flashcards',
      'Display Properties...',
      'Edition Switcher\u25BA',
      'About / ReadMe.txt',
      'Replay Intro Splash',
      'Close All Windows',
    ]);
  });

  it('puts the focus on the first item when it opens', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    expect(document.activeElement).toBe(item(/^Mounted Discs/));
  });

  it('closes on Escape and returns the focus to the Start button', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'Start menu' })).toBeNull();
    expect(startButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(startButton());
  });

  it('closes on a click outside, and the Start button toggles it', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu', { name: 'Start menu' })).toBeNull();
    await openStart(user);
    await user.click(startButton());
    expect(screen.queryByRole('menu', { name: 'Start menu' })).toBeNull();
  });

  it('Mounted Discs is a submenu that opens any mounted disc and closes the menu', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    const mounted = item(/^Mounted Discs/);
    expect(mounted.getAttribute('aria-haspopup')).toBe('menu');
    expect(mounted.getAttribute('aria-expanded')).toBe('false');
    await user.click(mounted);
    expect(mounted.getAttribute('aria-expanded')).toBe('true');
    const sub = within(startMenu()).getByRole('menu', { name: 'Mounted Discs' });
    expect(within(sub).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Castle Disc', 'Bare Disc']);
    await user.click(within(sub).getByRole('menuitem', { name: 'Bare Disc' }));
    expect(screen.queryByRole('menu', { name: 'Start menu' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Bare Disc' })).toBeTruthy();
  });

  it('Burn New CD-R Disc... opens the Burn dialog', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    await user.click(item('Burn New CD-R Disc...'));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
    expect(screen.queryByRole('menu', { name: 'Start menu' })).toBeNull();
  });

  it('Mount Disc Image (.json)... opens the file picker', async () => {
    const user = userEvent.setup();
    app();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    await openStart(user);
    await user.click(item('Mount Disc Image (.json)...'));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('Dictionary... opens the Dictionary', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    await user.click(item('Dictionary...'));
    expect(screen.getByRole('dialog', { name: 'Dictionary' })).toBeTruthy();
  });

  it('Take a Tour and Study Flashcards open the first disc into that view', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    await user.click(item('Take a Tour'));
    expect(screen.getByRole('region', { name: 'Take a Tour' })).toBeTruthy();
    expect(screen.getByText('Stop 1 of 2')).toBeTruthy();
    await openStart(user);
    await user.click(item('Study Flashcards'));
    expect(screen.getByRole('region', { name: 'Study Flashcards' })).toBeTruthy();
  });

  it('About / ReadMe.txt opens the Notepad, and Replay Intro Splash plays the boot splash', async () => {
    const user = userEvent.setup();
    app();
    await openStart(user);
    await user.click(item('About / ReadMe.txt'));
    expect(screen.getByRole('dialog', { name: 'ReadMe.txt - Notepad' })).toBeTruthy();
    await openStart(user);
    await user.click(item('Replay Intro Splash'));
    expect(screen.getByRole('region', { name: "DiscLore '97 boot splash" })).toBeTruthy();
  });

  it('Close All Windows closes the open disc', async () => {
    const user = userEvent.setup();
    app();
    await user.click(screen.getByText('Castle Disc'));
    expect(screen.getByRole('navigation', { name: 'Castle Disc' })).toBeTruthy();
    await openStart(user);
    await user.click(item('Close All Windows'));
    expect(screen.queryByRole('navigation', { name: 'Castle Disc' })).toBeNull();
  });

  it('the Edition Switcher submenu shows the current edition and switches it', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    app({ storage });
    await openStart(user);
    await user.click(item(/^Edition Switcher/));
    const sub = within(startMenu()).getByRole('menu', { name: 'Edition Switcher' });
    const radios = within(sub).getAllByRole('menuitemradio');
    expect(radios.map((r) => r.textContent!.replace('\u2022', ''))).toEqual(["Classic '97", 'Haunted Edition', 'Christmas Edition']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    await user.click(radios[2]!);
    expect(root.classList.contains(CHRISTMAS_CLASS)).toBe(true);
    expect(storage.map.get(THEME_KEY)).toBe('christmas');
    await openStart(user);
    await user.click(item(/^Edition Switcher/));
    const again = within(within(startMenu()).getByRole('menu', { name: 'Edition Switcher' })).getAllByRole('menuitemradio');
    expect(again.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
  });

  describe('keyboard', () => {
    it('Down and Up move through the items and wrap around', async () => {
      const user = userEvent.setup();
      app();
      await openStart(user);
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(item('Burn New CD-R Disc...'));
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(item('Close All Windows'));
      fireEvent.keyDown(document.activeElement!, { key: 'Home' });
      expect(document.activeElement).toBe(item(/^Mounted Discs/));
      fireEvent.keyDown(document.activeElement!, { key: 'End' });
      expect(document.activeElement).toBe(item('Close All Windows'));
    });

    it('Right opens a submenu and moves into it, and Left closes it and comes back', async () => {
      const user = userEvent.setup();
      app();
      await openStart(user);
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      const sub = await screen.findByRole('menu', { name: 'Mounted Discs' });
      await waitFor(() => expect(document.activeElement).toBe(within(sub).getAllByRole('menuitem')[0]));
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(within(sub).getAllByRole('menuitem')[1]);
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
      expect(screen.queryByRole('menu', { name: 'Mounted Discs' })).toBeNull();
      expect(document.activeElement).toBe(item(/^Mounted Discs/));
    });

    it('Enter on a focused item runs it', async () => {
      const user = userEvent.setup();
      app();
      await openStart(user);
      item('Dictionary...').focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog', { name: 'Dictionary' })).toBeTruthy();
    });
  });

  it('dims an item that has no action', () => {
    render(<Taskbar discs={[castles]} active={null} onOpenDisc={() => undefined} onCloseAll={() => undefined} startActions={{ onTour: () => undefined }} />);
    fireEvent.click(startButton());
    expect((item('Take a Tour') as HTMLButtonElement).disabled).toBe(false);
    expect((item('Dictionary...') as HTMLButtonElement).disabled).toBe(true);
    expect((item(/^Edition Switcher/) as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---- Deep links -------------------------------------------------------------------------------

describe('deep link parsing', () => {
  it('reads disc, section, view, and topic, with or without the leading question mark', () => {
    expect(parseDeepLink('?disc=castles&section=moat')).toEqual({ disc: 'castles', section: 'moat' });
    expect(parseDeepLink('disc=castles&view=tour')).toEqual({ disc: 'castles', view: 'tour' });
    expect(parseDeepLink('?topic=Winter%20solstice')).toEqual({ topic: 'Winter solstice' });
    expect(parseDeepLink('?disc=castles&view=GALLERY')).toEqual({ disc: 'castles', view: 'gallery' });
    for (const v of DEEP_VIEWS) expect(parseDeepLink(`?disc=a&view=${v}`).view).toBe(v);
  });

  it('ignores unknown views, empty values, control characters, and overlong values', () => {
    expect(parseDeepLink('?disc=a&view=nonsense')).toEqual({ disc: 'a' });
    expect(parseDeepLink('?disc=&section=%20&topic=')).toEqual({});
    expect(parseDeepLink('?disc=a%00b')).toEqual({});
    expect(parseDeepLink(`?disc=${'x'.repeat(201)}`)).toEqual({});
    expect(parseDeepLink('')).toEqual({});
    expect(parseDeepLink('?other=1')).toEqual({});
    expect(hasDeepLink({})).toBe(false);
    expect(hasDeepLink({ section: 'x' })).toBe(false);
    expect(hasDeepLink({ disc: 'a' })).toBe(true);
    expect(hasDeepLink({ topic: 'a' })).toBe(true);
  });

  it('cleans a topic: collapses spaces, drops control characters, and caps it at 100 characters', () => {
    expect(parseDeepLink('?topic=%20%20tide%20%20%0Apools%20').topic).toBe('tide pools');
    expect(parseDeepLink(`?topic=${'a'.repeat(300)}`).topic).toHaveLength(100);
  });

  it('never throws, whatever the input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const link = parseDeepLink(s);
        resolveDeepLink(link, [castles, bare]);
        return true;
      }),
      { numRuns: 200 },
    );
    expect(() => parseDeepLink(undefined as unknown as string)).not.toThrow();
  });
});

describe('deep link resolving', () => {
  const discs = [castles, bare];
  it('returns null for an unknown disc or no disc', () => {
    expect(resolveDeepLink({ disc: 'nope' }, discs)).toBeNull();
    expect(resolveDeepLink({ topic: 'x' }, discs)).toBeNull();
    expect(resolveDeepLink({}, discs)).toBeNull();
  });

  it('opens a known disc on its cover, an article, or a view', () => {
    expect(resolveDeepLink({ disc: 'castles' }, discs)).toEqual({ discId: 'castles', view: null });
    expect(resolveDeepLink({ disc: 'castles', section: 'keep' }, discs)).toEqual({ discId: 'castles', view: { kind: 'section', section_id: 'keep' } });
    expect(resolveDeepLink({ disc: 'castles', view: 'diagram' }, discs)!.view).toEqual({ kind: 'diagram', diagram_id: 'plan' });
    expect(resolveDeepLink({ disc: 'castles', view: 'keepmaze' }, discs)!.view).toEqual({ kind: 'keepmaze', dungeon_id: 'dng' });
    expect(resolveDeepLink({ disc: 'castles', view: 'timeline' }, discs)!.view).toEqual({ kind: 'timeline' });
    expect(resolveDeepLink({ disc: 'castles', view: 'tour' }, discs)!.view).toEqual({ kind: 'tour' });
    expect(resolveDeepLink({ disc: 'castles', view: 'flashcards' }, discs)!.view).toEqual({ kind: 'flashcards' });
    expect(resolveDeepLink({ disc: 'castles', view: 'gallery' }, discs)!.view).toEqual({ kind: 'gallery' });
  });

  it('falls back to the cover for an unknown section or a view the disc has no content for', () => {
    expect(resolveDeepLink({ disc: 'castles', section: 'ghost' }, discs)).toEqual({ discId: 'castles', view: null });
    expect(resolveDeepLink({ disc: 'bare', view: 'diagram' }, discs)!.view).toBeNull();
    expect(resolveDeepLink({ disc: 'bare', view: 'keepmaze' }, discs)!.view).toBeNull();
    expect(resolveDeepLink({ disc: 'bare', view: 'timeline' }, discs)!.view).toBeNull();
  });

  it('a section wins over a view, even when the section is unknown', () => {
    expect(resolveDeepLink({ disc: 'castles', section: 'moat', view: 'tour' }, discs)!.view).toEqual({ kind: 'section', section_id: 'moat' });
    expect(resolveDeepLink({ disc: 'castles', section: 'ghost', view: 'tour' }, discs)!.view).toBeNull();
  });

  it('a share query reopens the same place', () => {
    const views = [null, { kind: 'section' as const, section_id: 'moat' }, { kind: 'timeline' as const }, { kind: 'tour' as const }, { kind: 'flashcards' as const }, { kind: 'gallery' as const }, { kind: 'diagram' as const, diagram_id: 'plan' }, { kind: 'keepmaze' as const, dungeon_id: 'dng' }];
    for (const v of views) {
      const back = resolveDeepLink(parseDeepLink(shareQuery('castles', v)), discs)!;
      expect(back.discId).toBe('castles');
      expect(back.view).toEqual(v);
    }
    expect(shareQuery('a b', { kind: 'section', section_id: 'x&y' })).toBe('?disc=a+b&section=x%26y');
    expect(parseDeepLink(topicQuery('Winter solstice & more'))).toEqual({ topic: 'Winter solstice & more' });
  });
});

describe('deep links on load', () => {
  const launch = (search: string, extra: Partial<React.ComponentProps<typeof App>> = {}) =>
    render(<App sources={[castles, bare]} storage={memoryStorage()} fetch={vi.fn<FetchLike>()} search={search} {...extra} />);

  it('?disc=<id>&section=<id> opens straight to that article', () => {
    launch('?disc=castles&section=keep');
    expect(screen.getByRole('heading', { level: 1, name: 'Keep Tower' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Castle Disc' })).toBeTruthy();
  });

  it('?disc=<id> opens that disc on its cover', () => {
    launch('?disc=bare');
    expect(screen.getByRole('navigation', { name: 'Bare Disc' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Only Section' })).toBeNull();
  });

  it('?disc=<id>&view=... opens each view', () => {
    const cases: [string, () => void][] = [
      ['tour', () => expect(screen.getByRole('region', { name: 'Take a Tour' })).toBeTruthy()],
      ['flashcards', () => expect(screen.getByRole('region', { name: 'Study Flashcards' })).toBeTruthy()],
      ['gallery', () => expect(screen.getByRole('region', { name: 'Media Gallery' })).toBeTruthy()],
      ['timeline', () => expect(screen.getByRole('heading', { level: 1, name: 'Explore History' })).toBeTruthy()],
      ['keepmaze', () => expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy()],
    ];
    for (const [view, check] of cases) {
      const { unmount } = launch(`?disc=castles&view=${view}`);
      check();
      unmount();
    }
  });

  it('ignores an unknown disc, an unknown section, and a view the disc cannot show, without throwing', () => {
    const a = launch('?disc=nope&section=moat');
    expect(screen.queryByRole('navigation', { name: /Disc$/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: "DiscLore '97" })).toBeTruthy();
    a.unmount();
    const b = launch('?disc=castles&section=ghost');
    expect(screen.getByRole('navigation', { name: 'Castle Disc' })).toBeTruthy();
    expect(document.querySelector('article.article-viewer')).toBeNull();
    b.unmount();
    launch('?disc=bare&view=diagram');
    expect(screen.getByRole('navigation', { name: 'Bare Disc' })).toBeTruthy();
  });

  it('a link to a disc skips the boot splash, and no link keeps it', () => {
    const a = launch('?disc=castles', { skipSplash: false });
    expect(screen.queryByRole('region', { name: "DiscLore '97 boot splash" })).toBeNull();
    a.unmount();
    launch('', { skipSplash: undefined, sources: undefined, storage: memoryStorage() });
    expect(screen.getByRole('region', { name: "DiscLore '97 boot splash" })).toBeTruthy();
  });

  it('Back from a linked article returns to the cover, like a normal visit', async () => {
    const user = userEvent.setup();
    launch('?disc=castles&section=moat');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(document.querySelector('article.article-viewer')).toBeNull();
  });

  it('?topic=<query> skips the splash and starts the topic burn at once', async () => {
    const fetchSpy = vi.fn<FetchLike>(async () => new Response(JSON.stringify({ error: 'not-found' }), { status: 404 }));
    render(<App storage={memoryStorage()} fetch={fetchSpy} search="?topic=Winter%20solstice" />);
    expect(screen.queryByRole('region', { name: "DiscLore '97 boot splash" })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0]![0])).toBe('/api/topic?q=Winter%20solstice');
  });
});

describe('Copy Share Link', () => {
  const open = async (user: User) => {
    render(<App sources={[castles]} storage={memoryStorage()} search="?disc=castles&section=moat" />);
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
  };

  it('copies a link to the current disc and article and says so', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open(user);
    await user.click(screen.getByRole('menuitem', { name: 'Copy Share Link' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = String(writeText.mock.calls[0]![0]);
    expect(url.endsWith('?disc=castles&section=moat')).toBe(true);
    expect(url.split('?')).toHaveLength(2);
    await waitFor(() => expect(screen.getByText('Link copied to the clipboard.')).toBeTruthy());
  });

  it('shows the link in a message box when the clipboard is not available', async () => {
    const user = userEvent.setup();
    // user-event installs its own clipboard, so replace it with one that refuses.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('denied'); }) }, configurable: true });
    await open(user);
    await user.click(screen.getByRole('menuitem', { name: 'Copy Share Link' }));
    const box = await screen.findByRole('dialog', { name: 'Copy Share Link' });
    expect(within(box).getByText(/\?disc=castles&section=moat$/)).toBeTruthy();
  });
});

// ---- Editions ---------------------------------------------------------------------------------

describe('edition storage', () => {
  it('saves under disclore97.theme, reads old "haunted" saves, and ignores anything else', () => {
    const s = memoryStorage();
    expect(THEME_KEY).toBe('disclore97.theme');
    expect(loadTheme(s)).toBe('classic');
    s.setItem(THEME_KEY, 'haunted');
    expect(loadTheme(s)).toBe('haunted');
    saveTheme(s, 'christmas');
    expect(s.map.get(THEME_KEY)).toBe('christmas');
    expect(loadTheme(s)).toBe('christmas');
    // The Winter Solstice edition became the Christmas Edition: an old save still loads, as Christmas.
    s.setItem(THEME_KEY, 'solstice');
    expect(loadTheme(s)).toBe('christmas');
    saveTheme(s, 'classic');
    expect(s.map.has(THEME_KEY)).toBe(false);
    for (const bad of ['', 'classic', 'Haunted', 'winter', '{"x":1}']) {
      s.setItem(THEME_KEY, bad);
      expect(loadTheme(s)).toBe('classic');
    }
    expect(loadTheme(undefined)).toBe('classic');
    expect(saveTheme(undefined, 'haunted')).toBe(false);
  });

  it('applyTheme keeps exactly one edition class on the element', () => {
    const el = document.createElement('div');
    applyTheme(el, 'haunted');
    expect([HAUNTED_CLASS, CHRISTMAS_CLASS].filter((c) => el.classList.contains(c))).toEqual([HAUNTED_CLASS]);
    applyTheme(el, 'christmas');
    expect([HAUNTED_CLASS, CHRISTMAS_CLASS].filter((c) => el.classList.contains(c))).toEqual([CHRISTMAS_CLASS]);
    applyTheme(el, 'classic');
    expect(el.classList.contains(HAUNTED_CLASS) || el.classList.contains(CHRISTMAS_CLASS)).toBe(false);
  });

  it('cycles Classic, Haunted, Christmas Edition, and back', () => {
    expect([...THEMES]).toEqual(['classic', 'haunted', 'christmas']);
    expect(nextTheme('classic')).toBe('haunted');
    expect(nextTheme('haunted')).toBe('christmas');
    expect(nextTheme('christmas')).toBe('classic');
  });
});

describe('edition copy and content', () => {
  const home = (theme?: string) => {
    const storage = memoryStorage();
    if (theme) storage.setItem(THEME_KEY, theme);
    return render(<App sources={[castles, halloween]} storage={storage} fetch={vi.fn<FetchLike>()} />);
  };
  const eyebrow = () => document.querySelector('.home-hero__eyebrow')!.textContent;

  it('the Home masthead eyebrow follows the edition', () => {
    const a = home();
    expect(eyebrow()).toBe('Multimedia Encyclopedia \u2022 1997 Edition');
    a.unmount();
    const b = home('haunted');
    expect(eyebrow()).toBe('Multimedia Encyclopedia \u2022 Haunted Edition');
    b.unmount();
    home('christmas');
    expect(eyebrow()).toBe('Multimedia Encyclopedia \u2022 Christmas Edition');
  });

  it('the boot splash subtitle follows the edition', () => {
    for (const [theme, text] of [
      ['classic', 'Multimedia Encyclopedia \u2022 1997 Edition'],
      ['haunted', 'Multimedia Encyclopedia \u2022 Haunted Edition'],
      ['christmas', 'Multimedia Encyclopedia \u2022 Christmas Edition'],
    ] as const) {
      const { unmount } = render(<BootSplash onDone={() => undefined} edition={theme} />);
      expect(document.querySelector('.boot-subtitle')!.textContent).toBe(text);
      unmount();
    }
    render(<BootSplash onDone={() => undefined} />);
    expect(document.querySelector('.boot-subtitle')!.textContent).toBe(EDITIONS.classic.bootSubtitle);
  });

  it('the Home card cycles the edition, and the Start menu and View menu agree', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles, halloween]} storage={storage} />);
    await user.click(screen.getByRole('button', { name: /Edition: Classic '97/ }));
    expect(root.classList.contains(HAUNTED_CLASS)).toBe(true);
    expect(eyebrow()).toBe('Multimedia Encyclopedia \u2022 Haunted Edition');
    await user.click(screen.getByRole('button', { name: /Edition: Haunted Edition/ }));
    expect(root.classList.contains(CHRISTMAS_CLASS)).toBe(true);
    expect(root.classList.contains(HAUNTED_CLASS)).toBe(false);
    expect(storage.map.get(THEME_KEY)).toBe('christmas');
    await user.click(screen.getByRole('button', { name: /Edition: Christmas Edition/ }));
    expect(root.classList.contains(CHRISTMAS_CLASS)).toBe(false);
    expect(storage.map.has(THEME_KEY)).toBe(false);
    await user.click(screen.getByText('Castle Disc'));
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: "Edition: Classic '97" }));
    expect(root.classList.contains(HAUNTED_CLASS)).toBe(true);
  });

  it('the empty Burned CD-Rs tab offers sample burns for the edition', async () => {
    const want: Record<string, string[]> = {
      classic: ['Halloween', 'Gothic fiction', 'CD-ROM'],
      haunted: ['Halloween', 'Gothic fiction', 'Ghostlore'],
      christmas: ['Christmas', 'A Christmas Carol', 'Christmas tree'],
    };
    for (const theme of THEMES) {
      const user = userEvent.setup();
      const { unmount } = home(theme === 'classic' ? undefined : theme);
      await user.click(screen.getByRole('tab', { name: /^Burned/ }));
      const group = screen.getByRole('group', { name: 'Sample burns' });
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(want[theme]!.map((t) => `Burn Sample: ${t}`));
      expect(EDITIONS[theme].sampleBurns.map((s) => s.topic)).toEqual(want[theme]);
      unmount();
    }
  });

  it('a sample burn button asks for that edition topic', async () => {
    const user = userEvent.setup();
    home('christmas');
    await user.click(screen.getByRole('tab', { name: /^Burned/ }));
    await user.click(screen.getByRole('button', { name: 'Burn Sample: A Christmas Carol' }));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
  });

  describe('Did You Know? bias', () => {
    const first = (edition: 'classic' | 'haunted' | 'christmas', discs: DiscManifest[]) => {
      const { container, unmount } = render(<DidYouKnow discs={discs} onOpenSection={() => undefined} random={() => 0} edition={edition} />);
      const text = container.querySelector('.spotlight__fact')!.textContent;
      unmount();
      return text;
    };

    it('starts from the edition theme disc when one is mounted', () => {
      expect(first('classic', [castles, halloween])).toBe('Moats are ditches of water.');
      expect(first('haunted', [castles, halloween])).toBe('Samhain is celebrated on 31 October.');
      expect(first('christmas', [halloween, castles])).toBe('Moats are ditches of water.');
      expect(first('classic', [halloween, castles])).toBe('Samhain is celebrated on 31 October.');
    });

    it('falls back to any fact when no theme disc is mounted, and Next Fact still walks every disc', async () => {
      expect(first('haunted', [castles, bare])).toBe('Moats are ditches of water.');
      const user = userEvent.setup();
      render(<DidYouKnow discs={[castles, halloween]} onOpenSection={() => undefined} random={() => 0} edition="haunted" />);
      const fact = () => document.querySelector('.spotlight__fact')!.textContent;
      const seen = new Set([fact()]);
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: 'Next Fact' }));
        seen.add(fact());
      }
      expect(seen.size).toBe(3);
    });

    it('prefersDisc matches built-in ids and burned discs by title', () => {
      expect(prefersDisc('haunted', 'halloween', 'x')).toBe(true);
      expect(prefersDisc('haunted', 'burned-1', 'Gothic fiction')).toBe(true);
      expect(prefersDisc('christmas', 'burned-2', 'A Christmas Carol')).toBe(true);
      expect(prefersDisc('christmas', 'burned-3', 'History of the Yule log')).toBe(true);
      expect(prefersDisc('christmas', 'castles', 'Castle Disc')).toBe(true);
      expect(prefersDisc('christmas', 'retro-dialup', 'Retro Computing')).toBe(false);
      expect(prefersDisc('classic', 'halloween', 'Halloween')).toBe(false);
      expect(editionOf('classic').themeDiscIds).toEqual([]);
    });
  });
});

describe('Edition tokens', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
  const blockOf = (selector: string) => {
    const start = css.indexOf(selector);
    expect(start, selector).toBeGreaterThan(css.indexOf(':root {'));
    return css.slice(start, css.indexOf('}', start));
  };
  const vars = (text: string) => new Map(Array.from(text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)).map((m) => [m[1]!, m[2]!.trim()]));
  const classic = vars(css.slice(0, css.indexOf('}')));
  const haunted = vars(blockOf(':root.theme-haunted'));
  const christmas = vars(blockOf(':root.theme-christmas'));

  const luminance = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  it('Christmas Edition overrides only existing tokens, and the same set as Haunted', () => {
    for (const name of christmas.keys()) expect(classic.has(name), name).toBe(true);
    expect([...christmas.keys()].sort()).toEqual([...haunted.keys()].sort());
    for (const [name, value] of christmas) {
      if (name.startsWith('--color-')) expect(value, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('Christmas Edition differs from Classic in its main tokens: evergreen pine, frost-ivory, candle gold, cranberry', () => {
    for (const name of ['--color-title-bg', '--color-desktop', '--color-paper', '--color-gold', '--color-crimson', '--color-surface']) {
      expect(christmas.get(name), name).not.toBe(classic.get(name));
      expect(christmas.get(name), name).not.toBe(haunted.get(name));
    }
    // Evergreen: the green channel leads on the title bar and the desktop.
    for (const name of ['--color-title-bg', '--color-desktop']) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(christmas.get(name)!.slice(i, i + 2), 16));
      expect(g!).toBeGreaterThan(r!);
      expect(g!).toBeGreaterThan(b!);
    }
  });

  it.each([
    ['Haunted', () => haunted],
    ['Christmas Edition', () => christmas],
  ])('%s keeps ink, title text, and crimson above 7:1 contrast', (_name, get) => {
    const t = (n: string) => get().get(n)!;
    for (const surface of ['--color-paper', '--color-surface', '--color-tooltip-bg', '--color-parchment', '--color-gold-light']) {
      expect(contrast(t('--color-ink'), t(surface)), surface).toBeGreaterThanOrEqual(7);
    }
    expect(contrast(t('--color-title-text'), t('--color-title-bg'))).toBeGreaterThanOrEqual(7);
    expect(contrast(t('--color-crimson'), t('--color-paper'))).toBeGreaterThanOrEqual(7);
    expect(contrast(t('--color-crimson-dark'), t('--color-gold-light'))).toBeGreaterThanOrEqual(7);
    expect(contrast(t('--color-title-text'), t('--color-desktop'))).toBeGreaterThanOrEqual(7);
  });

  it('adds no radius, gradient, blur, or box-shadow', () => {
    expect(blockOf(':root.theme-christmas')).not.toMatch(/radius|gradient|blur|box-shadow/i);
  });
});
