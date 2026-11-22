// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { __setContextFactory, setAudioEdition, setMuted } from '../../src/audio/audio';
import { AppErrorBoundary } from '../../src/components/AppErrorBoundary';
import { BOOT_DURATION_MS } from '../../src/components/BootSplash';
import { prebakedDiscs } from '../../src/discs';
import type { StorageLike } from '../../src/library/discLibrary';
import { CHRISTMAS_CLASS, THEME_KEY, applyTheme, loadTheme } from '../../src/library/theme';
import { EDITIONS, editionOf, prefersDisc, toTheme } from '../../src/model/editions';
import type { Theme } from '../../src/model/editions';

function memoryStorage(entries: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(entries));
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  setAudioEdition('classic');
  root.classList.remove('theme-haunted', 'theme-christmas', 'theme-solstice');
});

// ---- The splash hands over to a visible Home ---------------------------------------------------

describe('boot splash to Home', () => {
  /** What a real first visit renders: the built-in discs, the splash, then Home. */
  const expectHome = () => {
    expect(screen.queryByRole('region', { name: "DiscLore '97 boot splash" })).toBeNull();
    expect(screen.getByRole('dialog', { name: "DiscLore '97 Home" })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Desktop shortcuts' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Taskbar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start menu' })).toBeTruthy();
    expect(document.querySelector('.desktop:not(.desktop--boot) .home-window')).not.toBeNull();
  };

  it('after the timer runs out', () => {
    vi.useFakeTimers();
    render(<App skipSplash={false} storage={memoryStorage()} search="" />);
    expect(screen.getByRole('region', { name: "DiscLore '97 boot splash" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(BOOT_DURATION_MS + 50));
    expectHome();
  });

  it('after a click on the splash', async () => {
    const user = userEvent.setup();
    render(<App skipSplash={false} storage={memoryStorage()} search="" />);
    await user.click(screen.getByRole('region', { name: "DiscLore '97 boot splash" }));
    expectHome();
  });

  it('after Skip, and again after Replay Intro Splash', async () => {
    const user = userEvent.setup();
    render(<App skipSplash={false} storage={memoryStorage()} search="" />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expectHome();
    await user.click(screen.getByRole('button', { name: /Replay Intro Splash/ }));
    expect(screen.getByRole('region', { name: "DiscLore '97 boot splash" })).toBeTruthy();
    await user.keyboard('{Enter}');
    expectHome();
  });

  it.each(['haunted', 'christmas', 'solstice', 'not-an-edition'])('in every saved edition, even a legacy or bad one: %s', async (saved) => {
    const user = userEvent.setup();
    render(<App skipSplash={false} storage={memoryStorage({ [THEME_KEY]: saved })} search="" />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expectHome();
    const eyebrow = document.querySelector('.home-hero__eyebrow')!.textContent;
    expect(eyebrow).toBe(editionOf(toTheme(saved)).eyebrow);
  });

  it('with the built-in discs mounted and nothing on screen thrown', async () => {
    const errors = vi.spyOn(console, 'error');
    const user = userEvent.setup();
    render(
      <AppErrorBoundary>
        <App skipSplash={false} storage={memoryStorage()} search="" />
      </AppErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expectHome();
    expect(document.querySelectorAll('.pack-tile')).toHaveLength(prebakedDiscs.length);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
});

// ---- The error boundary ------------------------------------------------------------------------

describe('AppErrorBoundary', () => {
  function Boom(): never {
    throw new Error('render failed: test');
  }

  it('renders its children when nothing fails', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows a Win95 error box with the message instead of a blank screen, and logs the error', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    const box = screen.getByRole('alertdialog', { name: "DiscLore '97 - Error" });
    expect(box.textContent).toContain('stopped drawing the screen');
    expect(box.textContent).toContain('render failed: test');
    expect(document.querySelector('.desktop.app-crash')).not.toBeNull();
    expect(errors.mock.calls.some((c) => String(c[0]).includes("DiscLore '97 stopped drawing the screen"))).toBe(true);
  });

  it('Restart reloads, and Restart in Classic 97 clears only the saved edition first', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRestart = vi.fn();
    localStorage.setItem(THEME_KEY, 'christmas');
    localStorage.setItem('disclore97.notes.castles', 'keep me');
    const user = userEvent.setup();
    render(
      <AppErrorBoundary onRestart={onRestart}>
        <Boom />
      </AppErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: "Restart DiscLore '97" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(THEME_KEY)).toBe('christmas');
    await user.click(screen.getByRole('button', { name: "Restart in Classic '97" }));
    expect(onRestart).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(localStorage.getItem('disclore97.notes.castles')).toBe('keep me');
    localStorage.clear();
  });
});

// ---- Christmas Edition -------------------------------------------------------------------------

describe('Christmas Edition', () => {
  it('replaces Winter Solstice in the edition list, with festive copy and sample burns', () => {
    expect(Object.keys(EDITIONS)).toEqual(['classic', 'haunted', 'christmas']);
    const e = EDITIONS.christmas;
    expect(e.name).toBe('Christmas Edition');
    expect(e.eyebrow).toBe('Multimedia Encyclopedia \u2022 Christmas Edition');
    expect(e.bootSubtitle).toBe('Multimedia Encyclopedia \u2022 Christmas Edition');
    expect(e.sampleBurns.map((s) => s.topic)).toEqual(['Christmas', 'A Christmas Carol', 'Christmas tree']);
    expect(e.sampleBurns.map((s) => s.label)).toEqual(['Burn Sample: Christmas', 'Burn Sample: A Christmas Carol', 'Burn Sample: Christmas tree']);
  });

  it('maps a saved "solstice" to Christmas, and anything unknown to Classic 97', () => {
    expect(toTheme('solstice')).toBe('christmas');
    expect(toTheme('christmas')).toBe('christmas');
    expect(toTheme('haunted')).toBe('haunted');
    for (const bad of [undefined, null, 7, '', 'Christmas', 'winter', {}]) expect(toTheme(bad)).toBe('classic');
    expect(loadTheme(memoryStorage({ [THEME_KEY]: 'solstice' }))).toBe('christmas');
    expect(editionOf('solstice' as Theme).id).toBe('christmas');
    expect(editionOf('bogus' as Theme).id).toBe('classic');
  });

  it('puts theme-christmas on <html> and always clears the old theme-solstice class', () => {
    const el = document.createElement('div');
    el.classList.add('theme-solstice');
    applyTheme(el, 'christmas');
    expect(el.classList.contains(CHRISTMAS_CLASS)).toBe(true);
    expect(el.classList.contains('theme-solstice')).toBe(false);
    applyTheme(el, 'solstice' as Theme);
    expect(el.classList.contains(CHRISTMAS_CLASS)).toBe(true);
    applyTheme(el, 'classic');
    expect(el.classList.contains(CHRISTMAS_CLASS)).toBe(false);
  });

  it('Did You Know? favors festive, historic, and castle discs', () => {
    expect(prefersDisc('christmas', 'castles', 'Ancient Castles')).toBe(true);
    for (const title of ['Christmas', 'A Christmas Carol', 'Yule log', 'History of Advent', 'Winter festivals', 'The Keep at Snowdon']) {
      expect(prefersDisc('christmas', 'burned', title), title).toBe(true);
    }
    expect(prefersDisc('christmas', 'retro-dialup', 'Retro Computing and the Dial-Up Era')).toBe(false);
    expect(prefersDisc('christmas', 'halloween', 'Folklore, Samhain and Halloween')).toBe(false);
  });

  it('a saved Winter Solstice choice opens as the Christmas Edition, and the next save rewrites it', async () => {
    const storage = memoryStorage({ [THEME_KEY]: 'solstice' });
    const user = userEvent.setup();
    render(<App sources={prebakedDiscs} storage={storage} />);
    expect(root.classList.contains('theme-christmas')).toBe(true);
    expect(root.classList.contains('theme-solstice')).toBe(false);
    expect(document.querySelector('.home-hero__eyebrow')!.textContent).toBe('Multimedia Encyclopedia \u2022 Christmas Edition');
    expect(document.querySelector('.home-hero__emblem svg')!.getAttribute('data-edition')).toBe('christmas');
    await user.click(screen.getByRole('button', { name: /Edition: Christmas Edition/ }));
    expect(storage.map.has(THEME_KEY)).toBe(false); // back to Classic '97
    await user.click(screen.getByRole('button', { name: /Edition: Classic '97/ }));
    await user.click(screen.getByRole('button', { name: /Edition: Haunted Edition/ }));
    expect(storage.map.get(THEME_KEY)).toBe('christmas');
  });

  it('the Start menu Edition Switcher lists Christmas Edition', async () => {
    const user = userEvent.setup();
    render(<App sources={prebakedDiscs} storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    await user.click(screen.getByRole('menuitem', { name: /^Edition Switcher/ }));
    const radios = screen.getAllByRole('menuitemradio').map((r) => r.textContent!.replace('\u2022', ''));
    expect(radios).toEqual(["Classic '97", 'Haunted Edition', 'Christmas Edition']);
  });
});
