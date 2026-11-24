// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import * as audio from '../../src/audio/audio';
import { DictionaryDialog } from '../../src/components/DictionaryDialog';
import { KeepMazeUI } from '../../src/components/KeepMazeUI';
import { Pinpointer } from '../../src/components/Pinpointer';
import { Taskbar } from '../../src/components/Taskbar';
import { castlesDisc } from '../../src/discs/castles';
import { retroDisc } from '../../src/discs/retro';
import type { StorageLike } from '../../src/library/discLibrary';
import { ARCHIVE_KEY_STAMP, EJECT_MESSAGE, TORCH_WHISPERS } from '../../src/model/easterEggs';

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

const KONAMI = '{ArrowUp}{ArrowUp}{ArrowDown}{ArrowDown}{ArrowLeft}{ArrowRight}{ArrowLeft}{ArrowRight}ba';

beforeEach(() => {
  audio.setMuted(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---- Drive D:\LINER_NOTES.TXT ------------------------------------------------------------------

describe('Drive D: liner notes and the eject gag', () => {
  const taskbar = () => render(<Taskbar discs={[]} active={null} onOpenDisc={() => {}} onCloseAll={() => {}} driveActive />);
  const drive = () => screen.getByRole('img', { name: /^Drive D: \(CD-ROM\)/ });

  it('opens after five quick clicks, with a soft chime and hints for the other secrets', async () => {
    const chime = vi.spyOn(audio, 'playLinerChime');
    const user = userEvent.setup();
    taskbar();
    for (let i = 0; i < 4; i++) await user.click(drive());
    expect(screen.queryByRole('dialog', { name: 'Drive D:\\LINER_NOTES.TXT' })).toBeNull();
    await user.click(drive());
    const dialog = screen.getByRole('dialog', { name: 'Drive D:\\LINER_NOTES.TXT' });
    expect(chime).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('list', { name: 'Hints' }).children.length).toBeGreaterThanOrEqual(5);
    const closes = within(dialog).getAllByRole('button', { name: 'Close' });
    await user.click(closes[closes.length - 1]!);
    expect(screen.queryByRole('dialog', { name: 'Drive D:\\LINER_NOTES.TXT' })).toBeNull();
  });

  it('needs the clicks close together', () => {
    taskbar();
    // Event time stamps follow the clock, so five clicks five seconds apart never add up.
    vi.useFakeTimers({ toFake: ['Date', 'performance'] });
    try {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(drive());
        vi.advanceTimersByTime(5000);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(screen.queryByRole('dialog', { name: 'Drive D:\\LINER_NOTES.TXT' })).toBeNull();
  });

  it('Eject Disc pulses the Drive D: light and asks for a Disc 2 that does not exist', async () => {
    const eject = vi.spyOn(audio, 'playEject');
    const user = userEvent.setup();
    taskbar();
    for (let i = 0; i < 5; i++) await user.click(drive());
    expect(drive().getAttribute('data-eject')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Eject Disc' }));
    expect(eject).toHaveBeenCalledTimes(1);
    expect(screen.getByText(EJECT_MESSAGE)).toBeTruthy();
    expect(drive().getAttribute('data-eject')).toBe('true');
    expect(drive().getAttribute('data-seek')).toBe('true');
    await waitFor(() => expect(drive().getAttribute('data-eject')).toBe('false'), { timeout: 3000 });
  });

  it('Escape closes it', async () => {
    const user = userEvent.setup();
    taskbar();
    for (let i = 0; i < 5; i++) await user.click(drive());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Drive D:\\LINER_NOTES.TXT' })).toBeNull();
  });
});

// ---- Starfield screensaver ---------------------------------------------------------------------

describe('Starfield screensaver', () => {
  const app = () => render(<App sources={[castlesDisc]} storage={memoryStorage()} />);
  const starfield = () => screen.queryByRole('dialog', { name: /Starfield screensaver/ });

  it('starts on a triple-click of the bare desktop and ends on any key', async () => {
    const user = userEvent.setup();
    const { container } = app();
    const desk = container.querySelector('.desktop__work') as HTMLElement;
    await user.tripleClick(desk);
    expect(starfield()).toBeTruthy();
    expect(starfield()!.querySelectorAll('circle.starfield__star').length).toBeGreaterThan(50);
    await user.keyboard('x');
    expect(starfield()).toBeNull();
  });

  it('ends on a click or Escape', async () => {
    const user = userEvent.setup();
    const { container } = app();
    const desk = container.querySelector('.desktop__work') as HTMLElement;
    await user.tripleClick(desk);
    await user.click(starfield()!);
    expect(starfield()).toBeNull();
    await user.tripleClick(desk);
    await user.keyboard('{Escape}');
    expect(starfield()).toBeNull();
  });

  it('ignores triple-clicks on icons and windows', async () => {
    const user = userEvent.setup();
    const { container } = app();
    await user.tripleClick(container.querySelector('.home-status') as HTMLElement);
    await user.tripleClick(screen.getAllByRole('button', { name: /ReadMe/ })[0]!);
    expect(starfield()).toBeNull();
  });

  it('is token-coloured, square, and stands still under reduced motion', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/eastereggs.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/border-radius:\s*[1-9]/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.starfield__lane\s*\{\s*animation:\s*none/);
    expect(css).toMatch(/\.starfield__star\s*\{\s*fill:\s*var\(--color-/);
  });
});

// ---- Konami code -------------------------------------------------------------------------------

describe('Konami code', () => {
  const homeStatus = () => screen.getByRole('group', { name: 'Home status bar' });

  it("toggles the Archive Key '97 stamp in the Home status bar with a retro arpeggio", async () => {
    const arp = vi.spyOn(audio, 'playKonamiArpeggio');
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage()} />);
    expect(within(homeStatus()).queryByText(ARCHIVE_KEY_STAMP)).toBeNull();
    await user.keyboard(KONAMI);
    expect(within(homeStatus()).getByText(ARCHIVE_KEY_STAMP)).toBeTruthy();
    expect(arp).toHaveBeenCalledTimes(1);
    await user.keyboard(KONAMI);
    expect(within(homeStatus()).queryByText(ARCHIVE_KEY_STAMP)).toBeNull();
    expect(arp).toHaveBeenCalledTimes(2);
  });

  it('ignores the code while typing in a field', async () => {
    const arp = vi.spyOn(audio, 'playKonamiArpeggio');
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage()} />);
    await user.click(screen.getByRole('combobox', { name: /Pinpointer/ }));
    await user.keyboard(KONAMI);
    expect(within(homeStatus()).queryByText(ARCHIVE_KEY_STAMP)).toBeNull();
    expect(arp).not.toHaveBeenCalled();
  });

  it('ignores the code while a dialog is open', async () => {
    const user = userEvent.setup();
    render(<App sources={[castlesDisc]} storage={memoryStorage()} />);
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('img', { name: /^Drive D:/ }));
    expect(screen.getByRole('dialog', { name: 'Drive D:\\LINER_NOTES.TXT' })).toBeTruthy();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
      fireEvent.keyDown(document.body, { key });
    }
    expect(within(homeStatus()).queryByText(ARCHIVE_KEY_STAMP)).toBeNull();
  });
});

// ---- Pinpointer whispers -----------------------------------------------------------------------

describe('Pinpointer whispers and the modem chirp', () => {
  const setup = () => {
    const onBurnTopic = vi.fn<(t: string) => void>();
    const onOpenSection = vi.fn<(d: string, s: string) => void>();
    render(<Pinpointer discs={[castlesDisc, retroDisc]} onOpenSection={onOpenSection} onBurnTopic={onBurnTopic} />);
    return { onBurnTopic, onOpenSection, input: screen.getByRole('combobox', { name: /Pinpointer/ }) };
  };

  it('whispers quietly without blocking the Burn CD-R row', async () => {
    const user = userEvent.setup();
    const { onBurnTopic, input } = setup();
    await user.type(input, 'xyzzy');
    expect(screen.getByText(/A hollow voice says "Fool\."/)).toBeTruthy();
    const options = screen.getAllByRole('option');
    expect(options[options.length - 1]!.textContent).toBe('Burn CD-R for "xyzzy" (Wikipedia)...');
    expect(screen.queryByText('No matching articles.')).toBeNull();
    await user.keyboard('{Enter}');
    expect(onBurnTopic).toHaveBeenCalledWith('xyzzy');
  });

  it('keeps real search results alongside a whisper', async () => {
    const user = userEvent.setup();
    const { onOpenSection, input } = setup();
    await user.type(input, 'modem');
    expect(document.querySelector('[data-whisper="modem"]')).toBeTruthy();
    const hits = screen.getAllByRole('option').filter((o) => !o.textContent!.startsWith('Burn CD-R'));
    expect(hits.length).toBeGreaterThan(0);
    await user.click(hits[0]!);
    expect(onOpenSection).toHaveBeenCalledTimes(1);
  });

  it('chirps once when a dial-up word is typed, again when the whisper is clicked, and never for others', async () => {
    const chirp = vi.spyOn(audio, 'playModemChirp');
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, 'y2k');
    expect(chirp).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '56k');
    expect(chirp).toHaveBeenCalledTimes(1);
    await user.click(document.querySelector('[data-whisper="modem"]') as HTMLElement);
    expect(chirp).toHaveBeenCalledTimes(2);
  });

  it('a muted chirp makes no sound', () => {
    const created: string[] = [];
    audio.__setContextFactory(
      () =>
        ({
          state: 'running',
          currentTime: 0,
          sampleRate: 8000,
          destination: {},
          resume: () => Promise.resolve(),
          createGain: () => {
            created.push('gain');
            return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} };
          },
        }) as unknown as AudioContext,
    );
    audio.setMuted(true);
    audio.playModemChirp();
    expect(created).toHaveLength(0);
    audio.setMuted(false);
    audio.__setContextFactory(null);
  });
});

// ---- Dictionary editorial notes ----------------------------------------------------------------

describe('Dictionary editorial notes', () => {
  it('shows an Editorial Note (1997) card while typing a secret word', async () => {
    const user = userEvent.setup();
    render(<DictionaryDialog discs={[castlesDisc]} onClose={() => {}} onOpenSection={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'KeepMaze');
    const card = screen.getByRole('region', { name: 'Editorial Note (1997)' });
    expect(card.textContent).toMatch(/trivia dungeon/);
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'castle');
    expect(screen.queryByRole('region', { name: 'Editorial Note (1997)' })).toBeNull();
  });

  it('shows the note even when the dictionary is offline', async () => {
    const offline = () => Promise.reject(new TypeError('offline'));
    render(<DictionaryDialog discs={[]} initialWord="encarta" onClose={() => {}} onOpenSection={() => {}} fetch={offline} />);
    await screen.findByText('The dictionary is not reachable.');
    expect(screen.getByRole('region', { name: 'Editorial Note (1997)' }).textContent).toMatch(/unaffiliated tribute/);
  });

  it('works for words the online lookup refuses, like y2k and 1997', async () => {
    const user = userEvent.setup();
    render(<DictionaryDialog discs={[]} onClose={() => {}} onOpenSection={() => {}} />);
    await user.type(screen.getByRole('textbox'), '1997');
    expect(screen.getByRole('region', { name: 'Editorial Note (1997)' }).textContent).toMatch(/pressed/);
  });
});

// ---- KeepMaze torch tap ------------------------------------------------------------------------

describe('KeepMaze torch tap', () => {
  it('knocks softly and rotates whispers without changing score, streak, or torches', async () => {
    const knock = vi.spyOn(audio, 'playWoodKnock');
    const user = userEvent.setup();
    const dungeon = castlesDisc.dungeons[0]!;
    const { container } = render(<KeepMazeUI disc={castlesDisc} dungeon={dungeon} onOpenSection={() => {}} rng={() => 0.5} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const stats = () => ({
      score: container.querySelector('.medallion__score dd')!.textContent,
      streak: container.querySelector('.medallion__streak dd')!.textContent,
      torches: screen.getByRole('img', { name: /torches lit/ }).getAttribute('aria-label'),
    });
    const before = stats();
    const rack = container.querySelector('.torch-rack') as HTMLElement;
    const seen: string[] = [];
    for (let i = 0; i < TORCH_WHISPERS.length + 1; i++) {
      await user.click(rack);
      seen.push(container.querySelector('.keepmaze__whisper')!.textContent!);
    }
    expect(knock).toHaveBeenCalledTimes(TORCH_WHISPERS.length + 1);
    expect(seen.slice(0, TORCH_WHISPERS.length)).toEqual([...TORCH_WHISPERS]);
    expect(seen[TORCH_WHISPERS.length]).toBe(TORCH_WHISPERS[0]);
    expect(stats()).toEqual(before);
    expect(before.torches).toBe('3 of 3 torches lit');
    // The caption still reads KeepMaze Quest, and no second status region appears.
    expect(screen.getByText('KeepMaze Quest')).toBeTruthy();
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });
});
