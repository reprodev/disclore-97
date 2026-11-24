// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { topicToSource } from '../../src/adapters/markdown';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { prebakedDiscs } from '../../src/discs';
import { DEMO_DISCS_KEY, loadDemoDiscs, saveDemoDiscs } from '../../src/library/demoDiscs';
import { createDiscLibrary } from '../../src/library/discLibrary';
import type { StorageLike } from '../../src/library/discLibrary';
import { serializeDiscImage } from '../../src/library/discImage';
import { compileDisc } from '../../src/model/compiler';
import { findMentions } from '../../src/model/discSearch';
import type { DiscManifest } from '../../src/model/manifest';

const BUILT_IN_TITLES = prebakedDiscs.map((d) => d.title);

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

/** A real burned disc: the offline outline compiled from a topic, as a topic burn produces offline. */
const burned: DiscManifest = compileDisc(topicToSource('Lighthouses and the keepers who tended their lamps'));

/** Storage with one burned disc in the library, and optionally the Demo Discs setting. */
function storageWith({ withBurned = true, demo }: { withBurned?: boolean; demo?: 'true' | 'false' } = {}) {
  const s = memoryStorage();
  if (withBurned) expect(createDiscLibrary(s).save(burned).saved).toBe(true);
  if (demo) s.setItem(DEMO_DISCS_KEY, demo);
  return s;
}

/** The real app on the built-in discs (no `sources` prop), past the boot splash. */
function renderApp(storage: StorageLike) {
  return render(<App storage={storage} skipSplash />);
}

beforeEach(() => {
  setMuted(true);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  __setContextFactory(null);
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;
const checkbox = () => screen.getByRole('checkbox', { name: 'Demo Discs (4 Built-In)' }) as HTMLInputElement;
const shelfTitles = () => Array.from(document.querySelectorAll('.pack-grid .disc-title')).map((el) => el.textContent);
const tab = (name: RegExp) => screen.getByRole('tab', { name });
const homeWindow = () => document.querySelector('.home-window');
const discWindow = () => document.querySelector('.disc-window');

// ---- Persistence --------------------------------------------------------------------------------
describe('Demo Discs setting (src/library/demoDiscs.ts)', () => {
  it('defaults to on, and only a saved "false" turns it off', () => {
    expect(loadDemoDiscs(undefined)).toBe(true);
    const s = memoryStorage();
    expect(loadDemoDiscs(s)).toBe(true);
    for (const v of ['true', '', '0', 'no', 'FALSE', '{"on":false}']) {
      s.setItem(DEMO_DISCS_KEY, v);
      expect(loadDemoDiscs(s), v).toBe(true);
    }
    s.setItem(DEMO_DISCS_KEY, 'false');
    expect(loadDemoDiscs(s)).toBe(false);
  });

  it('saves "true" or "false" under disclore97.demoDiscs, and never throws', () => {
    const s = memoryStorage();
    expect(DEMO_DISCS_KEY).toBe('disclore97.demoDiscs');
    expect(saveDemoDiscs(s, false)).toBe(true);
    expect(s.map.get(DEMO_DISCS_KEY)).toBe('false');
    expect(saveDemoDiscs(s, true)).toBe(true);
    expect(s.map.get(DEMO_DISCS_KEY)).toBe('true');
    expect(saveDemoDiscs(undefined, false)).toBe(false);
    const refusing: StorageLike = { ...memoryStorage(), setItem: () => { throw new Error('quota'); }, getItem: () => { throw new Error('denied'); } };
    expect(saveDemoDiscs(refusing, false)).toBe(false);
    expect(loadDemoDiscs(refusing)).toBe(true);
  });
});

// ---- Default: on ---------------------------------------------------------------------------------
describe('Demo Discs on (the default)', () => {
  it('mounts the four built-in discs beside the burned ones, with the checkbox ticked', () => {
    renderApp(storageWith());
    expect(checkbox().checked).toBe(true);
    expect(shelfTitles()).toEqual([...BUILT_IN_TITLES, burned.title]);
    expect(tab(/^Built-In \(4\)/)).toBeTruthy();
    expect(tab(/^Burned CD-Rs \(1\)/)).toBeTruthy();
  });
});

// ---- Turning it off ------------------------------------------------------------------------------
describe('turning Demo Discs off', () => {
  it('removes the built-in discs from the Home shelf, keeps the burned disc, and saves the choice', async () => {
    const user = userEvent.setup();
    const storage = storageWith();
    renderApp(storage);
    await user.click(checkbox());
    expect(checkbox().checked).toBe(false);
    expect(shelfTitles()).toEqual([burned.title]);
    expect(tab(/^All \(1\)/)).toBeTruthy();
    expect(tab(/^Built-In \(0\)/)).toBeTruthy();
    expect(storage.map.get(DEMO_DISCS_KEY)).toBe('false');
    // The Built-In tab says why it is empty, and offers the way back.
    await user.click(tab(/^Built-In/));
    expect(screen.getByText('The Demo Discs are turned off.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Turn On Demo Discs' }));
    expect(checkbox().checked).toBe(true);
    expect(storage.map.get(DEMO_DISCS_KEY)).toBe('true');
    await user.click(tab(/^All/));
    expect(shelfTitles()).toHaveLength(5);
  });

  it('takes the built-in discs out of the Pinpointer', async () => {
    const user = userEvent.setup();
    renderApp(storageWith());
    const search = screen.getByRole('combobox');
    await user.type(search, 'castle');
    const hitDiscs = () => Array.from(document.querySelectorAll('.pinpointer__hit .pinpointer__disc')).map((el) => el.textContent);
    expect(hitDiscs()).toContain("DiscLore '97: Ancient Castles & Keeps");
    await user.click(checkbox());
    await user.clear(search);
    await user.type(search, 'castle');
    expect(hitDiscs().filter((t) => BUILT_IN_TITLES.includes(t!))).toEqual([]);
    // The burned disc is still searched.
    await user.clear(search);
    await user.type(search, 'lighthouses');
    expect(hitDiscs().length).toBeGreaterThan(0);
    expect(new Set(hitDiscs())).toEqual(new Set([burned.title]));
  });

  it('takes the built-in discs out of the Dictionary (findMentions over the mounted discs)', async () => {
    const user = userEvent.setup();
    renderApp(storageWith({ demo: 'false' }));
    await user.click(screen.getByRole('button', { name: /^Dictionary\.\.\./ }));
    const dialog = screen.getByRole('dialog', { name: /Dictionary/ });
    await user.type(within(dialog).getByLabelText(/word/i), 'castle');
    const matches = within(dialog).getByRole('region', { name: 'In your discs' });
    for (const t of BUILT_IN_TITLES) expect(matches.textContent).not.toContain(t);
    expect(matches.textContent).toContain('No matches on the mounted discs.');
    // The same search over the built-in discs finds the word, so the dialog really is limited to the mounted ones.
    expect(findMentions([...prebakedDiscs], 'castle').length).toBeGreaterThan(0);
    expect(findMentions([burned], 'castle')).toEqual([]);
  });

  it('draws Did You Know? and Surprise Me! only from the burned disc', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    renderApp(storageWith({ demo: 'false' }));
    const spot = screen.getByRole('region', { name: 'Did You Know?' });
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      seen.push(spot.querySelector('.spotlight__source')!.textContent!);
      const next = within(spot).getByRole('button', { name: 'Next Fact' }) as HTMLButtonElement;
      if (next.disabled) break;
      await user.click(next);
    }
    for (const s of seen) {
      expect(s).toContain(burned.title);
      for (const t of BUILT_IN_TITLES) expect(s).not.toContain(t);
    }
    await user.click(screen.getByRole('button', { name: /^Surprise Me!/ }));
    await waitFor(() => expect(discWindow()).toBeTruthy());
    expect(discWindow()!.querySelector('.window-title-text')!.textContent).toBe(burned.title);
  });

  it('lists only the burned disc under Start > Mounted Discs, and offers the toggle there too', async () => {
    const user = userEvent.setup();
    renderApp(storageWith({ demo: 'false' }));
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    const start = screen.getByRole('menu', { name: 'Start menu' });
    const toggle = within(start).getByRole('menuitemcheckbox', { name: 'Demo Discs (Built-In)' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.click(within(start).getByRole('menuitem', { name: /^Mounted Discs/ }));
    const sub = within(start).getByRole('menu', { name: 'Mounted Discs' });
    expect(within(sub).getAllByRole('menuitem').map((m) => m.textContent)).toEqual([burned.title]);
    // Turning it back on from the Start menu brings the four discs back.
    await user.click(within(start).getByRole('menuitemcheckbox', { name: 'Demo Discs (Built-In)' }));
    expect(checkbox().checked).toBe(true);
    expect(shelfTitles()).toHaveLength(5);
  });

  it('keeps built-in disc ids reserved, so a mounted image cannot take one while the demo discs are off', async () => {
    renderApp(storageWith({ withBurned: false, demo: 'false' }));
    const impostor: DiscManifest = { ...burned, disc_id: 'castles' };
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([serializeDiscImage(impostor)], 'castles.json', { type: 'application/json' })] } });
    const box = await screen.findByRole('dialog', { name: 'Mount Disc Image' }, { timeout: 4000 });
    expect(within(box).getByRole('alert').textContent).toMatch(/same ID \("castles"\) as a built-in disc/);
  });
});

// ---- Leaving a built-in disc ----------------------------------------------------------------------
describe('turning Demo Discs off while a built-in disc is open', () => {
  it('returns to Home from the View menu item, and forgets the built-in disc as the last one used', async () => {
    const user = userEvent.setup();
    const storage = storageWith();
    renderApp(storage);
    await user.click(screen.getByText("DiscLore '97: Ancient Castles & Keeps"));
    expect(discWindow()!.querySelector('.window-title-text')!.textContent).toBe("DiscLore '97: Ancient Castles & Keeps");
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    const item = screen.getByRole('menuitemcheckbox', { name: 'Demo Discs (Built-In)' });
    expect(item.getAttribute('aria-checked')).toBe('true');
    expect(item.textContent).toBe('\u2713Demo Discs (Built-In)');
    await user.click(item);
    expect(discWindow()).toBeNull();
    expect(homeWindow()).toBeTruthy();
    expect(checkbox().checked).toBe(false);
    expect(storage.map.get(DEMO_DISCS_KEY)).toBe('false');
    // "The last disc you opened" no longer points at Castles: a Quick Jump uses the burned disc.
    await user.click(screen.getByRole('button', { name: /^Take a Tour/ }));
    await waitFor(() => expect(discWindow()).toBeTruthy());
    expect(discWindow()!.querySelector('.window-title-text')!.textContent).toBe(burned.title);
    expect(screen.getByRole('region', { name: 'Take a Tour' })).toBeTruthy();
  });

  it('leaves a burned disc open when the demo discs are turned off from its View menu', async () => {
    const user = userEvent.setup();
    renderApp(storageWith());
    await user.click(screen.getByText(burned.title));
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Demo Discs (Built-In)' }));
    expect(discWindow()!.querySelector('.window-title-text')!.textContent).toBe(burned.title);
  });
});

// ---- Zero discs -----------------------------------------------------------------------------------
describe('no discs at all (Demo Discs off, nothing burned or mounted)', () => {
  it('shows a clean empty state: get-started buttons, a Did You Know? note, and dimmed Quick Jumps', async () => {
    const user = userEvent.setup();
    renderApp(storageWith({ withBurned: false, demo: 'false' }));
    expect(checkbox().checked).toBe(false);
    expect(screen.getByText('No discs are available.')).toBeTruthy();
    expect(screen.getByText('Burn a new disc, mount a saved disc image, or turn the Demo Discs back on.')).toBeTruthy();
    const start = screen.getByRole('group', { name: 'Get started' });
    expect(within(start).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Burn New CD-R Disc...',
      'Mount Disc Image (.json)...',
      'Turn On Demo Discs',
    ]);
    // Did You Know? explains itself instead of vanishing, and offers the way back.
    const spot = screen.getByRole('region', { name: 'Did You Know?' });
    expect(spot.textContent).toContain('No facts yet');
    expect(within(spot).getByRole('button', { name: 'Turn On Demo Discs' })).toBeTruthy();
    expect(within(spot).queryByRole('button', { name: 'Open Article' })).toBeNull();
    // Every Quick Jump, including Surprise Me!, is dimmed, with a note that says why.
    for (const name of [/^Interactive Diagrams/, /^KeepMaze Quest/, /^Take a Tour/, /^Study Flashcards/, /^Surprise Me!/]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled, String(name)).toBe(true);
    }
    expect(screen.getByRole('button', { name: /^Surprise Me!/ }).textContent).toContain('needs a mounted disc');
    expect(screen.getByText('No discs are mounted. Burn or mount a disc, or turn on the Demo Discs, to use these.')).toBeTruthy();
    // The Start menu dims Tour and Flashcards and says no discs are mounted.
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    const menu = screen.getByRole('menu', { name: 'Start menu' });
    expect((within(menu).getByRole('menuitem', { name: 'Take a Tour' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(menu).getByRole('menuitem', { name: 'Study Flashcards' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(menu).getByRole('menuitem', { name: /^Mounted Discs/ }));
    expect(within(menu).getByText('No discs are mounted.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('gets started from the empty shelf: Burn opens the Burn dialog, Mount opens the file picker, and Turn On restores the four discs', async () => {
    const user = userEvent.setup();
    const pickerClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const storage = storageWith({ withBurned: false, demo: 'false' });
    renderApp(storage);
    const group = () => screen.getByRole('group', { name: 'Get started' });
    await user.click(within(group()).getByRole('button', { name: 'Mount Disc Image (.json)...' }));
    expect(pickerClick).toHaveBeenCalledTimes(1);
    await user.click(within(group()).getByRole('button', { name: 'Burn New CD-R Disc...' }));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(within(group()).getByRole('button', { name: 'Turn On Demo Discs' }));
    expect(shelfTitles()).toEqual(BUILT_IN_TITLES);
    expect(storage.map.get(DEMO_DISCS_KEY)).toBe('true');
    expect(screen.queryByRole('group', { name: 'Get started' })).toBeNull();
  });

  it('remembers the choice across sessions', () => {
    const storage = storageWith({ withBurned: false });
    renderApp(storage);
    fireEvent.click(checkbox());
    cleanup();
    renderApp(storage);
    expect(checkbox().checked).toBe(false);
    expect(shelfTitles()).toEqual([]);
  });
});

// ---- Only where it means something --------------------------------------------------------------
describe('where the toggle appears', () => {
  it('is not offered when discs come from a sources prop, which has no built-in discs to hide', async () => {
    const user = userEvent.setup();
    render(<App sources={[burned]} storage={memoryStorage()} />);
    expect(screen.queryByRole('checkbox', { name: /Demo Discs/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    expect(screen.queryByRole('menuitemcheckbox', { name: /Demo Discs/ })).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByText(burned.title));
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    expect(screen.queryByRole('menuitemcheckbox', { name: /Demo Discs/ })).toBeNull();
  });

  it('styles the checkbox as a square Win95 box in tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/home.css'), 'utf8');
    const rule = (sel: string) => new RegExp(`\\n${sel.replace(/[.:()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const box = rule('.win95-check__box');
    for (const d of ['appearance: none', 'width: 13px', 'height: 13px', 'border-radius: 0', 'background: var(--color-bevel-hi)', 'box-shadow: inset 1px 1px 0 var(--color-bevel-edge)']) {
      expect(box).toContain(d);
    }
    expect(rule('.win95-check__box:checked::after')).toContain('border: solid var(--color-bevel-edge)');
    expect(rule('.pack-tabs-bar')).toContain('display: flex');
    expect(css).not.toMatch(new RegExp('#' + '[0-9a-fA-F]{3,8}\\b'));
  });
});
