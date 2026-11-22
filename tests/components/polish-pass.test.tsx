// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { CiteDialog } from '../../src/components/CiteDialog';
import { KeepMazeUI } from '../../src/components/KeepMazeUI';
import { SHORTCUT_GROUPS } from '../../src/components/ShortcutsDialog';
import { BEST_PREFIX, loadBest, saveBest } from '../../src/library/best';
import type { StorageLike } from '../../src/library/discLibrary';
import { beatsBest, scholarRank, SCHOLAR_RANKS } from '../../src/model/game';
import type { DiscManifest, Dungeon } from '../../src/model/manifest';

// ---- Fixtures ---------------------------------------------------------------------------------

const disc: DiscManifest = {
  disc_id: 'polish',
  title: 'Polish Disc',
  tagline: 'A tagline',
  sections: [
    { section_id: 'moat', title: 'The Moat', paragraphs: ['Water circles the keep. The moat is wide.', 'More text.'] },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above the water.'] },
  ],
  diagrams: [],
  trivia: Array.from({ length: 6 }, (_, i) => ({
    question_id: `q${i}`,
    prompt: `Question number ${i}?`,
    options: [`Q${i} wrong A`, `Q${i} right`, `Q${i} wrong B`, `Q${i} wrong C`],
    correct_index: 1,
    section_id: i % 2 === 0 ? 'moat' : 'keep',
  })),
  dungeons: [
    {
      dungeon_id: 'dng',
      title: 'Test Keep',
      rooms: [
        { room_id: 'entrance', name: 'Gate', description: 'A cold gate.', exits: [{ to: 'hall' }] },
        { room_id: 'hall', name: 'Great Hall', description: 'A long hall.', exits: [{ to: 'entrance' }, { to: 'throne_room' }] },
        { room_id: 'throne_room', name: 'Throne', description: 'The throne.', exits: [{ to: 'hall' }] },
      ],
    },
  ],
};
const dungeon = disc.dungeons[0] as Dungeon;

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

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  __setContextFactory(null);
});

type User = ReturnType<typeof userEvent.setup>;

// ---- KeepMaze Personal Best -------------------------------------------------------------------

describe('Personal Best rules', () => {
  it('orders the ranks from Torchbearer up to Royal Archivist', () => {
    expect([...SCHOLAR_RANKS]).toEqual(['Torchbearer', 'Keep Explorer', 'Court Scholar', 'Royal Archivist']);
    expect(SCHOLAR_RANKS).toContain(scholarRank(210, 2));
  });

  it('beats a best with a higher score, or the same score and a higher rank, and never a lower one', () => {
    const prev = { bestScore: 150, bestRank: 'Keep Explorer' };
    expect(beatsBest(null, 0, 'Torchbearer')).toBe(true);
    expect(beatsBest(prev, 151, 'Torchbearer')).toBe(true);
    expect(beatsBest(prev, 150, 'Court Scholar')).toBe(true);
    expect(beatsBest(prev, 150, 'Keep Explorer')).toBe(false);
    expect(beatsBest(prev, 150, 'Torchbearer')).toBe(false);
    expect(beatsBest(prev, 149, 'Royal Archivist')).toBe(false);
  });
});

describe('Personal Best storage', () => {
  it('round-trips under disclore97.best.<disc_id>', () => {
    const s = memoryStorage();
    expect(BEST_PREFIX).toBe('disclore97.best.');
    expect(loadBest(s, 'a')).toBeNull();
    expect(saveBest(s, 'a', { bestScore: 210, bestRank: 'Royal Archivist' })).toBe(true);
    expect(JSON.parse(s.map.get('disclore97.best.a')!)).toEqual({ v: 1, bestScore: 210, bestRank: 'Royal Archivist' });
    expect(loadBest(s, 'a')).toEqual({ bestScore: 210, bestRank: 'Royal Archivist' });
    expect(loadBest(s, 'b')).toBeNull();
  });

  it('treats malformed data and missing storage as no best, and never throws', () => {
    const s = memoryStorage();
    for (const bad of ['not json', '5', 'null', '{}', '{"bestScore":"x","bestRank":"Torchbearer"}', '{"bestScore":-1,"bestRank":"Torchbearer"}', '{"bestScore":10,"bestRank":"Emperor"}']) {
      s.setItem('disclore97.best.a', bad);
      expect(loadBest(s, 'a')).toBeNull();
    }
    expect(loadBest(undefined, 'a')).toBeNull();
    expect(saveBest(undefined, 'a', { bestScore: 1, bestRank: 'Torchbearer' })).toBe(false);
    const refusing: StorageLike = { ...s, setItem: () => { throw new Error('full'); } };
    expect(saveBest(refusing, 'a', { bestScore: 1, bestRank: 'Torchbearer' })).toBe(false);
  });
});

describe('KeepMaze Personal Best', () => {
  const setup = async (storage?: StorageLike) => {
    const user = userEvent.setup();
    render(<KeepMazeUI disc={disc} dungeon={dungeon} onOpenSection={() => {}} rng={() => 0.5} storage={storage} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    return user;
  };
  const answer = async (user: User, correct: boolean) => {
    const group = screen.getByRole('group', { name: 'Trivia question' });
    const n = /Question number (\d)/.exec(group.querySelector('p')!.textContent!)![1];
    await user.click(screen.getByRole('button', { name: correct ? `Q${n} right` : `Q${n} wrong A` }));
  };
  const go = (user: User, room: string) => user.click(screen.getByRole('button', { name: room }));
  /** A clean run: 100 + 110 = 210 points, Royal Archivist. */
  const cleanRun = async (user: User) => {
    await go(user, 'Great Hall');
    await answer(user, true);
    await go(user, 'Throne');
    await answer(user, true);
  };
  /** A rougher run: 150 points, Keep Explorer. */
  const roughRun = async (user: User) => {
    await go(user, 'Great Hall');
    await answer(user, false);
    await go(user, 'Great Hall');
    await answer(user, true);
    await go(user, 'Throne');
    await user.click(screen.getByRole('button', { name: 'Peek Hint' }));
    await answer(user, true);
  };
  const cert = () => screen.getByRole('region', { name: 'Victory Certificate' });

  it('records the first finished run and shows the New Personal Best! badge', async () => {
    const storage = memoryStorage();
    const user = await setup(storage);
    expect(screen.queryByText(/Personal Best:/)).toBeNull();
    await cleanRun(user);
    expect(within(cert()).getByText('New Personal Best!')).toBeTruthy();
    expect(within(cert()).getByText('Personal Best: 210 pts (Royal Archivist)')).toBeTruthy();
    expect(JSON.parse(storage.map.get('disclore97.best.polish')!)).toEqual({
      v: 1,
      bestScore: 210,
      bestRank: 'Royal Archivist',
    });
  });

  it('replaces a lower best with a higher score and shows the badge', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'polish', { bestScore: 150, bestRank: 'Keep Explorer' });
    const user = await setup(storage);
    await cleanRun(user);
    expect(within(cert()).getByText('New Personal Best!')).toBeTruthy();
    expect(loadBest(storage, 'polish')).toEqual({ bestScore: 210, bestRank: 'Royal Archivist' });
  });

  it('keeps a higher best, shows no badge, and still shows the best on the certificate', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'polish', { bestScore: 210, bestRank: 'Royal Archivist' });
    const user = await setup(storage);
    await roughRun(user);
    expect(within(cert()).getByText('Score').nextElementSibling!.textContent).toBe('150');
    expect(within(cert()).queryByText('New Personal Best!')).toBeNull();
    expect(within(cert()).getByText('Personal Best: 210 pts (Royal Archivist)')).toBeTruthy();
    expect(loadBest(storage, 'polish')).toEqual({ bestScore: 210, bestRank: 'Royal Archivist' });
  });

  it('shows the recorded best in the Quest card while playing', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'polish', { bestScore: 210, bestRank: 'Royal Archivist' });
    await setup(storage);
    const card = screen.getByRole('region', { name: 'KeepMaze Quest' });
    expect(within(card).getByText('Personal Best: 210 pts (Royal Archivist)')).toBeTruthy();
  });

  it('keeps a best per disc: another disc starts with none', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'other-disc', { bestScore: 999, bestRank: 'Royal Archivist' });
    await setup(storage);
    const card = screen.getByRole('region', { name: 'KeepMaze Quest' });
    expect(within(card).queryByText(/Personal Best:/)).toBeNull();
  });

  it('shows nothing and saves nothing without storage', async () => {
    const user = await setup(undefined);
    await cleanRun(user);
    expect(within(cert()).queryByText(/Personal Best/)).toBeNull();
    expect(within(cert()).getByText('Score').nextElementSibling!.textContent).toBe('210');
  });

  it('is saved through the App, so it survives a reload', async () => {
    const storage = memoryStorage();
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={storage} />);
    await user.click(screen.getByText('Polish Disc'));
    await user.click(screen.getByRole('button', { name: 'KeepMaze' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await go(user, 'Great Hall');
    await answer(user, true);
    await go(user, 'Throne');
    await answer(user, true);
    expect(loadBest(storage, 'polish')).toEqual({ bestScore: 210, bestRank: 'Royal Archivist' });
  });
});

// ---- Print ------------------------------------------------------------------------------------

describe('Cite / Print Preview printing', () => {
  const section = disc.sections[0]!;

  it('has a Print... button that calls window.print()', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<CiteDialog section={section} discTitle="Polish Disc" onClose={() => {}} />);
    expect(print).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Print...' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('plays the standard click on Print...', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const audio = await import('../../src/audio/audio');
    const click = vi.spyOn(audio, 'playClick');
    const user = userEvent.setup();
    render(<CiteDialog section={section} discTitle="Polish Disc" onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Print...' }));
    expect(click).toHaveBeenCalled();
  });

  it('marks the page while the sheet is open and clears the mark when it closes', () => {
    const { unmount } = render(<CiteDialog section={section} discTitle="Polish Disc" onClose={() => {}} />);
    expect(document.body.classList.contains('cite-printing')).toBe(true);
    unmount();
    expect(document.body.classList.contains('cite-printing')).toBe(false);
  });

  it('ships print rules that hide the desktop chrome and keep the citation sheet', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/print.css'), 'utf8');
    expect(css).toContain('@media print');
    for (const hidden of ['.desktop > :not(.desktop__work)', '.desktop__work > :not(.modal-layer)', '.window-title-bar', '.cite-dialog__buttons']) {
      expect(css).toContain(hidden);
    }
    expect(css).toMatch(/\.cite-dialog__page \{[^}]*max-height: none/);
    expect(css).toMatch(/var\(--color-paper\)/);
    expect(css).toMatch(/var\(--color-ink\)/);
  });
});

// ---- Keyboard shortcuts -----------------------------------------------------------------------

describe('Keyboard shortcuts', () => {
  const openArticle = async (user: User) => {
    await user.click(screen.getByText('Polish Disc'));
    await user.click(within(screen.getByRole('navigation', { name: 'Polish Disc' })).getByRole('button', { name: 'The Moat' }));
  };
  const key = (init: KeyboardEventInit) => fireEvent.keyDown(document.body, init);

  it('Ctrl+F on an article opens and focuses Find in Article, and stops the browser find', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openArticle(user);
    expect(screen.queryByRole('search')).toBeNull();
    const notPrevented = key({ key: 'f', ctrlKey: true });
    expect(notPrevented).toBe(false);
    const box = within(screen.getByRole('search', { name: 'Find in article' })).getByRole('textbox', { name: 'Find in article' });
    expect(document.activeElement).toBe(box);
    expect(screen.getByRole('button', { name: 'Find in Article' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Cmd+F does the same, and refocuses the bar when it is already open', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openArticle(user);
    expect(key({ key: 'F', metaKey: true })).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Polish Disc' })).getByRole('button', { name: 'The Moat' }));
    (document.activeElement as HTMLElement).blur();
    expect(key({ key: 'f', metaKey: true })).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Find in article' }));
  });

  it('leaves Ctrl+F alone when no article is showing', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    expect(key({ key: 'f', ctrlKey: true })).toBe(true);
    await user.click(screen.getByText('Polish Disc'));
    expect(key({ key: 'f', ctrlKey: true })).toBe(true);
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('leaves Ctrl+F alone while a dialog is open, and ignores plain or shifted f', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openArticle(user);
    expect(key({ key: 'f' })).toBe(true);
    expect(key({ key: 'f', ctrlKey: true, shiftKey: true })).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Dictionary' }));
    expect(key({ key: 'f', ctrlKey: true })).toBe(true);
  });

  it('Ctrl+D opens the Dictionary while a disc is open, and stops the browser bookmark', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await user.click(screen.getByText('Polish Disc'));
    expect(screen.queryByRole('dialog', { name: 'Dictionary' })).toBeNull();
    expect(key({ key: 'd', ctrlKey: true })).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Dictionary' })).toBeTruthy();
    // With the dialog open, another press is still blocked from the browser but opens nothing more.
    expect(key({ key: 'D', metaKey: true })).toBe(false);
    expect(screen.getAllByRole('dialog', { name: 'Dictionary' })).toHaveLength(1);
  });

  it('Ctrl+D does nothing on the Home window with no disc open', () => {
    render(<App sources={[disc]} storage={memoryStorage()} />);
    expect(key({ key: 'd', ctrlKey: true })).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Dictionary' })).toBeNull();
  });
});

describe('Help > Shortcuts... dialog', () => {
  const open = async (user: User) => {
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await user.click(screen.getByText('Polish Disc'));
    await user.click(screen.getByRole('menuitem', { name: 'Help' }));
    await user.click(screen.getByRole('menuitem', { name: 'Shortcuts...' }));
    return screen.getByRole('dialog', { name: 'Keyboard Shortcuts' });
  };

  it('opens from the Help menu and lists every shortcut', async () => {
    const user = userEvent.setup();
    const dlg = await open(user);
    for (const g of SHORTCUT_GROUPS) {
      const region = within(dlg).getByRole('region', { name: g.title });
      expect(within(region).getAllByRole('term')).toHaveLength(g.rows.length);
    }
    const text = dlg.textContent ?? '';
    for (const needle of ['Ctrl+F / Cmd+F', 'Find in Article', 'Ctrl+D / Cmd+D', 'Dictionary', 'Space', 'Picture Viewer', 'Pinpointer', 'Enter', 'Tab / Shift+Tab', 'Esc']) {
      expect(text).toContain(needle);
    }
  });

  it('closes with OK and with Escape', async () => {
    const user = userEvent.setup();
    const dlg = await open(user);
    await user.click(within(dlg).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Help' }));
    await user.click(screen.getByRole('menuitem', { name: 'Shortcuts...' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeNull();
  });

  it('keeps File, Go, and View ahead of Help in the menu bar', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await user.click(screen.getByText('Polish Disc'));
    const tops = within(screen.getByRole('menubar')).getAllByRole('menuitem').map((m) => m.textContent);
    expect(tops).toEqual(['File', 'Go', 'View', 'Help']);
  });
});
