// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { KeepMazeUI } from '../../src/components/KeepMazeUI';
import { castlesDisc } from '../../src/discs/castles';
import { retroDisc } from '../../src/discs/retro';
import { DAILY_KEY, loadDailyBook } from '../../src/library/dailyChallenge';
import type { StorageLike } from '../../src/library/discLibrary';
import { LAST_VISIT_KEY, loadMastered, loadVictories, MASTERED_PREFIX, VICTORIES_KEY } from '../../src/library/progress';
import { WALLPAPER_KEY } from '../../src/library/wallpaper';
import { buildFlashcards } from '../../src/model/flashcards';
import { solveDungeon } from '../../src/model/solver';

function memoryStorage(init: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(init));
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

// ---- Wallpaper ---------------------------------------------------------------------------------

describe('Display Properties and the desktop wallpaper', () => {
  const work = (c: HTMLElement) => c.querySelector('.desktop__work') as HTMLElement;
  const wallpaperOf = (c: HTMLElement) => work(c).querySelector(':scope > svg.desktop-wallpaper') as SVGElement;
  const dialog = () => screen.getByRole('dialog', { name: 'Display Properties' });

  it('opens from the desktop menu, applies a pick at once, saves it, and resets to the edition default', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { container } = render(<App sources={[castlesDisc]} storage={storage} />);
    fireEvent.contextMenu(work(container));
    await user.click(screen.getByRole('menuitem', { name: 'Display Properties / Change Wallpaper...' }));
    expect(within(dialog()).getAllByRole('radio')).toHaveLength(6);
    expect((within(dialog()).getByRole('radio', { name: /Edition Default/ }) as HTMLInputElement).checked).toBe(true);

    await user.click(within(dialog()).getByRole('radio', { name: /Blueprint Grid/ }));
    expect(work(container).getAttribute('data-wallpaper')).toBe('blueprint');
    expect(wallpaperOf(container).getAttribute('data-wallpaper')).toBe('blueprint');
    expect(wallpaperOf(container).querySelector('.desktop-wallpaper__base--blueprint')).toBeTruthy();
    expect(storage.map.get(WALLPAPER_KEY)).toBe('blueprint');
    // The monitor preview shows the same wallpaper.
    expect(dialog().querySelector('.display-properties__screen svg')!.getAttribute('data-wallpaper')).toBe('blueprint');

    await user.click(within(dialog()).getByRole('button', { name: 'Reset to Edition Default' }));
    expect(work(container).getAttribute('data-wallpaper')).toBe('edition');
    expect(storage.map.has(WALLPAPER_KEY)).toBe(false);
    expect((within(dialog()).getByRole('button', { name: 'Reset to Edition Default' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(dialog()).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Display Properties' })).toBeNull();
  });

  it('opens from the Start menu too, and Escape closes it', async () => {
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: 'Start menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Display Properties...' }));
    expect(dialog()).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Display Properties' })).toBeNull();
  });

  it('restores a saved wallpaper, and an invalid saved value falls back to the edition default', () => {
    const a = render(<App sources={[castlesDisc]} storage={memoryStorage({ [WALLPAPER_KEY]: 'parchment' })} />);
    expect(work(a.container).getAttribute('data-wallpaper')).toBe('parchment');
    cleanup();
    const b = render(<App sources={[castlesDisc]} storage={memoryStorage({ [WALLPAPER_KEY]: 'neon-vaporwave' })} />);
    expect(work(b.container).getAttribute('data-wallpaper')).toBe('edition');
  });

  it('Edition Default follows the edition as it switches, and a fixed wallpaper stays put', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { container } = render(<App sources={[castlesDisc]} storage={storage} />);
    expect(wallpaperOf(container).getAttribute('data-edition')).toBe('classic');
    expect(wallpaperOf(container).querySelector('.desktop-wallpaper__pixel')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Edition: Classic '97/ }));
    expect(wallpaperOf(container).querySelector('.desktop-wallpaper__star')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Edition: Haunted Edition/ }));
    expect(wallpaperOf(container).querySelector('.desktop-wallpaper__flake')).toBeTruthy();
    storage.map.set(WALLPAPER_KEY, 'slate');
    cleanup();
    const again = render(<App sources={[castlesDisc]} storage={storage} />);
    expect(wallpaperOf(again.container).getAttribute('data-edition')).toBe('christmas');
    expect(wallpaperOf(again.container).querySelector('.desktop-wallpaper__base--slate')).toBeTruthy();
    expect(wallpaperOf(again.container).querySelector('.desktop-wallpaper__flake')).toBeNull();
  });
});

describe('layout rules measured in headless Edge', () => {
  const css = (f: string) => readFileSync(resolve(__dirname, '../../src/styles', f), 'utf8');

  it('lets the wallpaper list shrink, so Display Properties never scrolls sideways', () => {
    const s = css('shortcuts.css');
    const list = s.slice(s.indexOf('.display-properties__list {'), s.indexOf('}', s.indexOf('.display-properties__list {')));
    expect(list).toContain('min-width: 0');
    expect(list).toContain('min-inline-size: 0');
    expect(s).toMatch(/\.display-properties__desc\s*\{[^}]*text-overflow: ellipsis/);
  });

  it('keeps the masthead to one row under 1200px, and slims the stage on short victory screens', () => {
    expect(css('home.css')).toMatch(/@media \(max-width: 1199px\)\s*\{\s*\.home-mastery \+ \.home-hero__badge\s*\{\s*display: none;/);
    expect(css('keepmaze.css')).toMatch(/@media \(max-height: 700px\)\s*\{\s*\.keepmaze:has\(\.certificate\) \.keepmaze__stage\s*\{\s*height: 104px;/);
  });
});

// ---- Daily Challenge ---------------------------------------------------------------------------

describe('KeepMaze Daily Challenge', () => {
  const dungeon = castlesDisc.dungeons[0]!;
  const day = (y: number, m: number, d: number) => () => new Date(y, m - 1, d, 9, 30);

  /** Starts a daily run, takes the first exit, and returns the first question's prompt. */
  const firstPrompt = async (today: () => Date, rng: () => number) => {
    const user = userEvent.setup();
    render(<KeepMazeUI disc={castlesDisc} dungeon={dungeon} onOpenSection={() => {}} rng={rng} today={today} />);
    await user.click(screen.getByRole('checkbox', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const exits = screen.getAllByRole('button').filter((b) => b.closest('.keepmaze__exits'));
    await user.click(exits[0]!);
    const prompt = document.querySelector('.keepmaze__prompt')!.textContent!;
    cleanup();
    return prompt;
  };

  it('asks the same questions in the same order all day, whatever the normal generator does', async () => {
    const a = await firstPrompt(day(2026, 11, 23), () => 0.01);
    const b = await firstPrompt(day(2026, 11, 23), () => 0.99);
    expect(b).toBe(a);
  });

  it('a different day gives a different order', async () => {
    const prompts = new Set<string>();
    for (let d = 1; d <= 8; d++) prompts.add(await firstPrompt(day(2026, 11, d), Math.random));
    expect(prompts.size).toBeGreaterThan(1);
  });

  it('a win is timed, stamped on the certificate, counted, and kept as the day\u2019s best', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    let clock = 1_000;
    const now = () => clock;
    const { unmount } = render(
      <KeepMazeUI disc={castlesDisc} dungeon={dungeon} onOpenSection={() => {}} storage={storage} today={day(2026, 11, 23)} now={now} />,
    );
    expect(screen.getByRole('checkbox', { name: 'Daily Challenge (2026-11-23)' })).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /Daily Challenge/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    // Walk the shortest path, answering each door correctly.
    const path = solveDungeon(dungeon).path;
    for (const roomId of path.slice(1)) {
      const dest = dungeon.rooms.find((r) => r.room_id === roomId)!;
      await user.click(within(document.querySelector('.keepmaze__exits') as HTMLElement).getByRole('button', { name: dest.name }));
      const prompt = document.querySelector('.keepmaze__prompt')!.textContent!;
      const q = castlesDisc.trivia.find((t) => t.prompt === prompt)!;
      clock += 15_000;
      await user.click(screen.getByRole('button', { name: q.options[q.correct_index]! }));
    }
    const cert = screen.getByRole('region', { name: 'Victory Certificate' });
    const stamp = cert.querySelector('.certificate__daily')!.textContent!;
    const seconds = (path.length - 1) * 15;
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    expect(stamp).toContain('Daily Challenge 2026-11-23');
    expect(stamp).toContain(`Time: ${time}`);
    expect(stamp).toContain('New daily best!');
    expect(within(cert).getAllByRole('status')).toHaveLength(1);
    const saved = loadDailyBook(storage)['2026-11-23']!.castles!;
    expect(saved.timeMs).toBe(seconds * 1000);
    expect(saved.score).toBeGreaterThan(0);
    expect(storage.map.has(DAILY_KEY)).toBe(true);
    expect(loadVictories(storage).get('castles')).toBe(1);
    unmount();
    // The next visit today shows the day's best on the Welcome card.
    render(<KeepMazeUI disc={castlesDisc} dungeon={dungeon} onOpenSection={() => {}} storage={storage} today={day(2026, 11, 23)} />);
    expect(screen.getByText(`Today's best: ${saved.score} pts in ${time}`)).toBeTruthy();
  });

  it('a normal run gets no daily stamp and records no daily result', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<KeepMazeUI disc={castlesDisc} dungeon={dungeon} onOpenSection={() => {}} storage={storage} rng={() => 0.5} today={day(2026, 11, 23)} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    for (const roomId of solveDungeon(dungeon).path.slice(1)) {
      const dest = dungeon.rooms.find((r) => r.room_id === roomId)!;
      await user.click(within(document.querySelector('.keepmaze__exits') as HTMLElement).getByRole('button', { name: dest.name }));
      const q = castlesDisc.trivia.find((t) => t.prompt === document.querySelector('.keepmaze__prompt')!.textContent)!;
      await user.click(screen.getByRole('button', { name: q.options[q.correct_index]! }));
    }
    expect(screen.getByRole('region', { name: 'Victory Certificate' }).querySelector('.certificate__daily')).toBeNull();
    expect(storage.map.has(DAILY_KEY)).toBe(false);
    expect(loadVictories(storage).get('castles')).toBe(1);
  });
});

// ---- Study Mastery & Continue ------------------------------------------------------------------

describe('Study Mastery & Continue on Home', () => {
  const strip = () => screen.getByRole('region', { name: 'Study Mastery' });

  it('sums progress across discs and continues at the last article', async () => {
    const user = userEvent.setup();
    const cards = buildFlashcards(castlesDisc).map((c) => c.id);
    const target = castlesDisc.sections[2]!;
    const storage = memoryStorage({
      'disclore97.visited.castles': JSON.stringify({ v: 1, sections: [castlesDisc.sections[0]!.section_id, target.section_id] }),
      'disclore97.visited.retro-dialup': JSON.stringify({ v: 1, sections: [retroDisc.sections[0]!.section_id] }),
      [`${MASTERED_PREFIX}castles`]: JSON.stringify({ v: 1, sections: cards.slice(0, 3) }),
      [VICTORIES_KEY]: JSON.stringify({ v: 1, wins: { castles: 2, 'retro-dialup': 1 } }),
      [LAST_VISIT_KEY]: JSON.stringify({ v: 1, discId: 'castles', sectionId: target.section_id }),
    });
    render(<App sources={[castlesDisc, retroDisc]} storage={storage} />);
    const s = strip();
    const total = castlesDisc.sections.length + retroDisc.sections.length;
    const cardTotal = cards.length + buildFlashcards(retroDisc).length;
    expect(s.textContent).toContain(`Read3/${total}`);
    expect(s.textContent).toContain(`Mastered3/${cardTotal}`);
    expect(s.textContent).toContain('Victories3');
    const button = within(s).getByRole('button', { name: 'Continue Studying' });
    expect(button.getAttribute('title')).toBe(`Continue: Ancient Castles & Keeps \u203a ${target.title}`);
    await user.click(button);
    expect(screen.getByRole('heading', { level: 1, name: target.title })).toBeTruthy();
  });

  it('dims Continue Studying until something has been opened, and remembers the next article read', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castlesDisc]} storage={storage} />);
    expect((within(strip()).getByRole('button', { name: 'Continue Studying' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getAllByText(castlesDisc.title)[0]!);
    const first = castlesDisc.sections[1]!;
    await user.click(screen.getAllByRole('button', { name: first.title })[0]!);
    expect(JSON.parse(storage.map.get(LAST_VISIT_KEY)!)).toEqual({ v: 1, discId: 'castles', sectionId: first.section_id });
  });

  it('Got It on a flashcard is saved for the strip', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castlesDisc]} storage={storage} search="?disc=castles&view=flashcards" />);
    await user.click(screen.getByRole('button', { name: /Flip Card/ }));
    await user.click(screen.getByRole('button', { name: /Got It/ }));
    expect(loadMastered(storage, 'castles')).toHaveLength(1);
  });
});
