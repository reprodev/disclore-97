// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { DesktopIcons, RECYCLE_BIN_MESSAGE } from '../../src/components/DesktopIcons';
import { castlesDisc } from '../../src/discs/castles';
import { retroDisc } from '../../src/discs/retro';
import type { StorageLike } from '../../src/library/discLibrary';

function memoryStorage(init: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(init));
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

const css = (file: string) => readFileSync(resolve(__dirname, '../../src/styles', file), 'utf8');
const app = (storage = memoryStorage()) => render(<App sources={[castlesDisc, retroDisc]} storage={storage} />);
const shortcuts = () => screen.getByRole('group', { name: 'Desktop shortcuts' });
const desk = (container: HTMLElement) => container.querySelector('.desktop__work') as HTMLElement;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('desktop shortcuts', () => {
  it('keeps the desktop clean: only the utilities, with no built-in disc shortcuts by default', () => {
    app();
    const names = within(shortcuts())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(['Burn CD-R', 'Dictionary', 'ReadMe.txt', 'Recycle Bin']);
  });

  it('shows the built-in disc shortcuts first only when they are switched on', () => {
    render(
      <DesktopIcons discs={[castlesDisc, retroDisc]} onOpenDisc={() => {}} onOpenReadMe={() => {}} onBurnNew={() => {}} onOpenDictionary={() => {}} discShortcuts />,
    );
    const names = within(shortcuts())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(["Castles '97", "Retro '97", 'Burn CD-R', 'Dictionary', 'ReadMe.txt', 'Recycle Bin']);
  });

  it('keeps pinned Notes.txt shortcuts, before the Recycle Bin', () => {
    app(memoryStorage({ 'disclore97.pinnedNotes': JSON.stringify({ v: 1, discs: ['castles'] }) }));
    const names = within(shortcuts())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names.slice(-2)).toEqual(['Ancient Castles Notes.txt', 'Recycle Bin']);
  });

  it('Burn CD-R opens the Burn dialog on double-click', async () => {
    const user = userEvent.setup();
    app();
    await user.dblClick(within(shortcuts()).getByRole('button', { name: 'Burn CD-R' }));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
  });

  it('Dictionary opens the Dictionary on Enter', async () => {
    const user = userEvent.setup();
    app();
    within(shortcuts()).getByRole('button', { name: 'Dictionary' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Dictionary' })).toBeTruthy();
  });

  it('ReadMe still opens as before, and an enabled Castles shortcut opens its disc', async () => {
    const user = userEvent.setup();
    app();
    await user.dblClick(within(shortcuts()).getByRole('button', { name: 'ReadMe.txt' }));
    expect(screen.getByRole('dialog', { name: /ReadMe\.txt/ })).toBeTruthy();
    cleanup();
    const onOpenDisc = vi.fn();
    render(<DesktopIcons discs={[castlesDisc]} onOpenDisc={onOpenDisc} onOpenReadMe={() => {}} discShortcuts />);
    await user.dblClick(within(shortcuts()).getByRole('button', { name: "Castles '97" }));
    expect(onOpenDisc).toHaveBeenCalledWith('castles');
  });
});

describe('Recycle Bin', () => {
  it('opens a small Win95 message box that says it is empty, and OK closes it', async () => {
    const user = userEvent.setup();
    app();
    await user.dblClick(within(shortcuts()).getByRole('button', { name: 'Recycle Bin' }));
    const box = screen.getByRole('dialog', { name: 'Recycle Bin' });
    expect(within(box).getByRole('alert').textContent).toBe(RECYCLE_BIN_MESSAGE);
    expect(RECYCLE_BIN_MESSAGE).toBe('Recycle Bin is empty \u2014 nothing from 1997 is ever truly thrown away.');
    await user.click(within(box).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Recycle Bin' })).toBeNull();
  });

  it('Escape closes it too', async () => {
    const user = userEvent.setup();
    app();
    within(shortcuts()).getByRole('button', { name: 'Recycle Bin' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Recycle Bin' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Recycle Bin' })).toBeNull();
  });
});

describe('desktop right-click menu', () => {
  const menu = () => screen.queryByRole('menu', { name: 'Desktop' });
  const ITEMS = [
    'Burn New CD-R Disc...',
    'Mount Disc Image (.json)...',
    'Starfield Screensaver',
    'Display Properties / Change Wallpaper...',
    'About / ReadMe.txt',
  ];

  it('opens on the bare desktop with its five items, and Escape closes it', async () => {
    const user = userEvent.setup();
    const { container } = app();
    fireEvent.contextMenu(desk(container), { clientX: 40, clientY: 60 });
    expect(within(menu()!).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(ITEMS);
    expect(document.activeElement?.textContent).toBe(ITEMS[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe(ITEMS[1]);
    await user.keyboard('{Escape}');
    expect(menu()).toBeNull();
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    const { container } = app();
    fireEvent.contextMenu(desk(container));
    expect(menu()).toBeTruthy();
    await user.click(screen.getByRole('group', { name: 'Home status bar' }));
    expect(menu()).toBeNull();
  });

  it('opens on the empty window area too, which is what the pointer meets with Home minimized', async () => {
    const user = userEvent.setup();
    const { container } = app();
    await user.click(screen.getAllByRole('button', { name: 'Minimize' })[0]!);
    const browser = container.querySelector('.disc-browser') as HTMLElement;
    fireEvent.contextMenu(browser);
    expect(menu()).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.tripleClick(browser);
    expect(screen.getByRole('dialog', { name: /Starfield screensaver/ })).toBeTruthy();
  });

  it('does not open over icons or windows', () => {
    const { container } = app();
    fireEvent.contextMenu(within(shortcuts()).getByRole('button', { name: 'Recycle Bin' }));
    fireEvent.contextMenu(container.querySelector('.home-status') as HTMLElement);
    expect(menu()).toBeNull();
  });

  it('Burn New CD-R Disc... opens the Burn dialog and closes the menu', async () => {
    const user = userEvent.setup();
    const { container } = app();
    fireEvent.contextMenu(desk(container));
    await user.click(screen.getByRole('menuitem', { name: ITEMS[0] }));
    expect(menu()).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
  });

  it('Mount Disc Image (.json)... opens the file picker', async () => {
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    const { container } = app();
    fireEvent.contextMenu(desk(container));
    await user.click(screen.getByRole('menuitem', { name: ITEMS[1] }));
    expect(pick).toHaveBeenCalled();
    expect(menu()).toBeNull();
  });

  it('Starfield Screensaver starts the screensaver, and About opens the ReadMe', async () => {
    const user = userEvent.setup();
    const { container } = app();
    fireEvent.contextMenu(desk(container));
    await user.click(screen.getByRole('menuitem', { name: ITEMS[2] }));
    expect(screen.getByRole('dialog', { name: /Starfield screensaver/ })).toBeTruthy();
    await user.keyboard('x');
    fireEvent.contextMenu(desk(container));
    await user.click(screen.getByRole('menuitem', { name: ITEMS[4] }));
    expect(screen.getByRole('dialog', { name: /ReadMe\.txt/ })).toBeTruthy();
  });
});

describe('edition-aware wallpaper', () => {
  const wallpaper = (theme: string) => {
    const { container } = app(memoryStorage({ 'disclore97.theme': theme }));
    const svg = desk(container).querySelector('svg.desktop-wallpaper') as SVGElement;
    return svg;
  };

  it.each([
    ['classic', 'desktop-wallpaper__pixel'],
    ['haunted', 'desktop-wallpaper__star'],
    ['christmas', 'desktop-wallpaper__flake'],
  ])('%s draws its own quiet pattern behind the desktop', (theme, cls) => {
    const svg = wallpaper(theme);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('data-edition')).toBe(theme);
    const pattern = svg.querySelector('pattern')!;
    expect(pattern).toBeTruthy();
    expect(pattern.querySelector(`.${cls}`)).toBeTruthy();
    expect(svg.querySelector('rect[fill]')!.getAttribute('fill')).toBe(`url(#${pattern.id})`);
    cleanup();
  });

  it('is token-coloured, faint, square, and never catches the pointer', () => {
    const s = css('shortcuts.css');
    expect(s).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(s).not.toMatch(/gradient\(/);
    expect(s).not.toMatch(/border-radius:\s*[1-9]/);
    const rule = s.slice(s.indexOf('.desktop-wallpaper {'), s.indexOf('}', s.indexOf('.desktop-wallpaper {')));
    for (const d of ['position: absolute', 'z-index: -1', 'pointer-events: none']) expect(rule).toContain(d);
    for (const m of s.matchAll(/(?:fill|stroke)-opacity:\s*([\d.]+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(0.2);
    expect(s).toMatch(/\.desktop__work\s*\{\s*isolation: isolate/);
  });
});

describe('layout rules for short and narrow screens', () => {
  it('the icon column stops above the taskbar, tightens on short screens, and scrolls rather than spill', () => {
    const s = css('shortcuts.css');
    expect(s).toMatch(/\.desktop-icons\s*\{\s*bottom: 6px;\s*overflow-x: hidden;\s*overflow-y: auto;/);
    expect(s).toMatch(/@media \(max-height: 700px\)\s*\{\s*\.desktop-icons\s*\{\s*gap: 4px;/);
  });

  it('the mobile strip wraps onto a second row instead of overflowing sideways', () => {
    const d = css('desktop.css');
    const mobile = d.slice(d.indexOf('@media (max-width: 767px)'));
    const rule = mobile.slice(mobile.indexOf('.desktop__work .desktop-icons {'), mobile.indexOf('}', mobile.indexOf('.desktop__work .desktop-icons {')));
    expect(rule).toContain('flex-wrap: wrap');
  });

  it('the tray clock is at the far right of the taskbar and gives way under 768px', () => {
    const { container } = app();
    const tray = container.querySelector('.taskbar__tray')!;
    expect(tray.lastElementChild?.className).toBe('taskbar__clock');
    expect(tray.lastElementChild?.textContent).toMatch(/^\d{2}:\d{2}$/);
    const t = css('taskbar.css');
    const mobile = t.slice(t.indexOf('@media (max-width: 767px)'));
    expect(mobile).toMatch(/\.taskbar__clock,\s*\.taskbar__drive\s*\{\s*display: none;/);
  });
});
