// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { SHOW_INTERVAL_MS, TourView } from '../../src/components/TourView';
import type { StorageLike } from '../../src/library/discLibrary';
import { HAUNTED_CLASS, THEME_KEY, applyTheme, loadTheme, saveTheme } from '../../src/library/theme';
import { buildFlashcards, flipCard, gotIt, initDeck, needReview, REVIEW_GAP } from '../../src/model/flashcards';
import { pickQuickJump } from '../../src/model/nav';
import type { DiscManifest } from '../../src/model/manifest';

// ---- Fixtures ---------------------------------------------------------------------------------

const deckDisc: DiscManifest = {
  disc_id: 'deck',
  title: 'Deck Disc',
  tagline: 'Cards',
  sections: [
    {
      section_id: 'moat',
      title: 'The Moat',
      paragraphs: ['Water circles the keep. It guards the wall.'],
      facts: ['A moat is a ditch full of water.', 'Some moats held fish.'],
      timeline: [{ when: '1100s', event: 'Wide moats appear.' }],
    },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above the moat. It was the last refuge.'] },
    { section_id: 'gate', title: 'Drawbridge', paragraphs: ['A drawbridge crosses the water.'] },
  ],
  diagrams: [],
  trivia: [
    { question_id: 'q0', prompt: 'What circles the keep?', options: ['Fire', 'Water'], correct_index: 1, section_id: 'moat' },
    { question_id: 'q1', prompt: 'What does the keep guard?', options: ['The last refuge', 'A pond'], correct_index: 0, section_id: 'keep' },
  ],
  dungeons: [],
};
// Cards: t:q0, t:q1, f:moat:0, f:moat:1, f:keep:0, f:gate:0.
const CARDS = 6;

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
  document.documentElement.classList.remove(HAUNTED_CLASS);
  setMuted(false);
  __setContextFactory(null);
});

type User = ReturnType<typeof userEvent.setup>;
const bar = () => screen.getByRole('toolbar', { name: 'Navigation' });
const openDisc = (user: User, title: string) => user.click(screen.getByText(title));

// ---- Flashcards -------------------------------------------------------------------------------

describe('Flashcard deck model', () => {
  it('builds trivia cards (prompt to the right option) and Quick Fact cards (title cue to the fact)', () => {
    const cards = buildFlashcards(deckDisc);
    expect(cards.map((c) => c.id)).toEqual(['t:q0', 't:q1', 'f:moat:0', 'f:moat:1', 'f:keep:0', 'f:gate:0']);
    expect(cards[0]).toMatchObject({ kind: 'trivia', front: 'What circles the keep?', back: 'Water', hint: 'The Moat', section_id: 'moat' });
    expect(cards[2]).toMatchObject({ kind: 'fact', back: 'A moat is a ditch full of water.', hint: 'The Moat' });
    expect(cards[2]!.front).toContain('The Moat');
    // An article with no Quick Facts still gives a card, from its first sentence.
    expect(cards[4]!.back).toBe('The keep rises above the moat.');
  });

  it('Need Review puts the card back behind REVIEW_GAP others, and Got It masters it', () => {
    const cards = buildFlashcards(deckDisc);
    let d = flipCard(initDeck(cards));
    expect(d.flipped).toBe(true);
    d = needReview(d);
    expect(d.flipped).toBe(false);
    expect(d.queue.indexOf('t:q0')).toBe(REVIEW_GAP);
    expect(d.queue).toHaveLength(CARDS);
    d = gotIt(d);
    expect(d.mastered).toEqual(['t:q1']);
    expect(d.queue).not.toContain('t:q1');
  });
});

describe('Study Flashcards view', () => {
  const view = () => screen.getByRole('region', { name: 'Study Flashcards' });
  const status = () => within(view()).getByText(/^Card \d+ of \d+/).textContent;
  const open = async (user: User) => {
    render(<App sources={[deckDisc]} storage={memoryStorage()} />);
    await openDisc(user, 'Deck Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Flashcards' }));
  };
  const button = (name: string) => within(view()).getByRole('button', { name }) as HTMLButtonElement;

  it('shows card X of Y with the mastered count, and the question side first', async () => {
    const user = userEvent.setup();
    await open(user);
    expect(status()).toBe(`Card 1 of ${CARDS} \u2022 Mastered: 0 / ${CARDS}`);
    expect(within(view()).getByRole('group', { name: 'Card question' })).toBeTruthy();
    expect(within(view()).getByText('What circles the keep?')).toBeTruthy();
    expect(within(view()).getByText('From: The Moat')).toBeTruthy();
    expect(button('Need Review').disabled).toBe(true);
    expect(button('Got It').disabled).toBe(true);
  });

  it('Flip Card shows the answer and enables Need Review and Got It', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(button('Flip Card'));
    expect(within(view()).getByRole('group', { name: 'Card answer' })).toBeTruthy();
    expect(within(view()).getByText('Water')).toBeTruthy();
    expect(button('Got It').disabled).toBe(false);
    await user.click(button('Flip Card'));
    expect(within(view()).getByText('What circles the keep?')).toBeTruthy();
  });

  it('Space flips the card, but not while a button has the focus', async () => {
    const user = userEvent.setup();
    await open(user);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(within(view()).getByText('Water')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(within(view()).getByText('What circles the keep?')).toBeTruthy();
    const notPrevented = fireEvent.keyDown(button('Got It'), { key: ' ' });
    expect(notPrevented).toBe(true);
    expect(within(view()).getByText('What circles the keep?')).toBeTruthy();
  });

  it('Got It masters the card and moves on', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(button('Flip Card'));
    await user.click(button('Got It'));
    expect(status()).toBe(`Card 2 of ${CARDS} \u2022 Mastered: 1 / ${CARDS}`);
    expect(within(view()).getByText('What does the keep guard?')).toBeTruthy();
    expect(within(view()).getByRole('group', { name: 'Card question' })).toBeTruthy();
  });

  it('Need Review re-queues the card a few cards later without mastering it', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(button('Flip Card'));
    await user.click(button('Need Review'));
    expect(status()).toBe(`Card 2 of ${CARDS} \u2022 Mastered: 0 / ${CARDS}`);
    // Three more cards are mastered, and the first card comes back next.
    for (let i = 0; i < REVIEW_GAP; i++) {
      await user.click(button('Flip Card'));
      await user.click(button('Got It'));
    }
    expect(within(view()).getByText('What circles the keep?')).toBeTruthy();
    expect(status()).toBe(`Card 1 of ${CARDS} \u2022 Mastered: 3 / ${CARDS}`);
  });

  it('shows Deck complete and Restart Deck once every card is mastered', async () => {
    const user = userEvent.setup();
    await open(user);
    expect(screen.queryByRole('button', { name: 'Restart Deck' })).toBeNull();
    for (let i = 0; i < CARDS; i++) {
      await user.click(button('Flip Card'));
      await user.click(button('Got It'));
    }
    expect(within(view()).getByRole('heading', { name: 'Deck complete!' })).toBeTruthy();
    expect(status()).toBe(`Card ${CARDS} of ${CARDS} \u2022 Mastered: ${CARDS} / ${CARDS}`);
    expect(screen.queryByRole('button', { name: 'Flip Card' })).toBeNull();
    await user.click(button('Restart Deck'));
    expect(status()).toBe(`Card 1 of ${CARDS} \u2022 Mastered: 0 / ${CARDS}`);
    expect(within(view()).getByText('What circles the keep?')).toBeTruthy();
  });

  it('Open Source Article opens the card article, and Back keeps the deck progress', async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(button('Flip Card'));
    await user.click(button('Got It'));
    await user.click(button('Open Source Article'));
    expect(screen.getByRole('heading', { level: 1, name: 'Keep Tower' })).toBeTruthy();
    await user.click(within(bar()).getByRole('button', { name: 'Back' }));
    expect(status()).toBe(`Card 2 of ${CARDS} \u2022 Mastered: 1 / ${CARDS}`);
  });

  it('is in the View menu, and the Home Quick Jump row opens it', async () => {
    const user = userEvent.setup();
    render(<App sources={[deckDisc]} storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: /Study Flashcards/ }));
    expect(screen.getByRole('region', { name: 'Study Flashcards' })).toBeTruthy();
    expect(pickQuickJump([deckDisc], null, 'flashcards')).toMatchObject({ view: { kind: 'flashcards' } });
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    expect(screen.getByRole('menuitem', { name: 'Flashcards' })).toBeTruthy();
  });
});

// ---- Media Show -------------------------------------------------------------------------------

describe('Media Show', () => {
  class FakeUtterance {
    lang = '';
    rate = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly text: string) {}
  }
  let spoken: FakeUtterance[];
  const speak = vi.fn((u: FakeUtterance) => void spoken.push(u));
  const cancel = vi.fn();
  const installSpeech = () => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    Object.defineProperty(window, 'speechSynthesis', { value: { speak, cancel }, configurable: true });
  };
  /** Ends the narration that is playing now: the last utterance of the latest speak call. */
  const finishNarration = () => act(() => spoken[spoken.length - 1]!.onend?.());

  beforeEach(() => {
    spoken = [];
    speak.mockClear();
    cancel.mockClear();
  });

  const onStop = vi.fn();
  function Harness({ start = 0 }: { start?: number }) {
    const [stop, setStop] = useState(start);
    return (
      <TourView
        disc={deckDisc}
        stop={stop}
        onStop={(i) => {
          onStop(i);
          setStop(i);
        }}
        onOpenSection={() => undefined}
      />
    );
  }
  beforeEach(() => onStop.mockClear());

  const tour = () => screen.getByRole('region', { name: 'Take a Tour' });
  const stopLabel = () => within(tour()).getByText(/^Stop \d+ of \d+$/).textContent;
  const showButton = () => within(tour()).getByRole('button', { name: /^(Play|Pause) Show$/ });
  const press = (el: HTMLElement) => act(() => void fireEvent.click(el));

  describe('with no narration (silent)', () => {
    it('Play Show advances every 5 seconds and stops at the final stop', () => {
      vi.useFakeTimers();
      render(<Harness />);
      expect(showButton().textContent).toBe('Play Show');
      press(showButton());
      expect(showButton().textContent).toBe('Pause Show');
      expect(showButton().getAttribute('aria-pressed')).toBe('true');
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS - 1));
      expect(stopLabel()).toBe('Stop 1 of 3');
      act(() => void vi.advanceTimersByTime(1));
      expect(stopLabel()).toBe('Stop 2 of 3');
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS));
      expect(stopLabel()).toBe('Stop 3 of 3');
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS));
      expect(stopLabel()).toBe('Stop 3 of 3');
      expect(showButton().textContent).toBe('Play Show');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('Pause Show stops the advance', () => {
      vi.useFakeTimers();
      render(<Harness />);
      press(showButton());
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS));
      expect(stopLabel()).toBe('Stop 2 of 3');
      press(showButton());
      expect(showButton().textContent).toBe('Play Show');
      expect(vi.getTimerCount()).toBe(0);
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS * 3));
      expect(stopLabel()).toBe('Stop 2 of 3');
    });

    it('a manual Previous or Next ends the show', () => {
      vi.useFakeTimers();
      render(<Harness />);
      press(showButton());
      press(within(tour()).getByRole('button', { name: 'Next' }));
      expect(stopLabel()).toBe('Stop 2 of 3');
      expect(showButton().textContent).toBe('Play Show');
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS * 2));
      expect(stopLabel()).toBe('Stop 2 of 3');
      press(showButton());
      press(within(tour()).getByRole('button', { name: 'Previous' }));
      expect(stopLabel()).toBe('Stop 1 of 3');
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS * 2));
      expect(stopLabel()).toBe('Stop 1 of 3');
    });

    it('Play Show from the last stop starts again from the first', () => {
      vi.useFakeTimers();
      render(<Harness start={2} />);
      press(showButton());
      expect(stopLabel()).toBe('Stop 1 of 3');
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS));
      expect(stopLabel()).toBe('Stop 2 of 3');
    });

    it('leaves no timer behind when the tour closes', () => {
      vi.useFakeTimers();
      const { unmount } = render(<Harness />);
      press(showButton());
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS * 3));
      expect(onStop).not.toHaveBeenCalled();
    });

    it('uses the timer when sound is muted, even though speech exists', () => {
      vi.useFakeTimers();
      installSpeech();
      setMuted(true);
      render(<Harness />);
      press(showButton());
      expect(speak).not.toHaveBeenCalled();
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS));
      expect(stopLabel()).toBe('Stop 2 of 3');
    });
  });

  describe('with narration', () => {
    it('narrates the stop and moves on when the narration ends, not on a timer', () => {
      vi.useFakeTimers();
      installSpeech();
      render(<Harness />);
      press(showButton());
      expect(spoken.map((u) => u.text)).toEqual(['The Moat', 'A moat is a ditch full of water.', '1100s: Wide moats appear.']);
      act(() => void vi.advanceTimersByTime(SHOW_INTERVAL_MS * 4));
      expect(stopLabel()).toBe('Stop 1 of 3');
      finishNarration();
      expect(stopLabel()).toBe('Stop 2 of 3');
      expect(spoken[spoken.length - 1]!.text).toBe('The keep rises above the moat.');
      expect(showButton().textContent).toBe('Pause Show');
    });

    it('stops after the final stop has been narrated', () => {
      vi.useFakeTimers();
      installSpeech();
      render(<Harness start={1} />);
      press(showButton());
      finishNarration();
      expect(stopLabel()).toBe('Stop 3 of 3');
      finishNarration();
      expect(stopLabel()).toBe('Stop 3 of 3');
      expect(showButton().textContent).toBe('Play Show');
    });

    it('Pause Show silences the narration and does not advance', () => {
      installSpeech();
      render(<Harness />);
      press(showButton());
      press(showButton());
      expect(cancel).toHaveBeenCalled();
      expect(stopLabel()).toBe('Stop 1 of 3');
      expect(showButton().textContent).toBe('Play Show');
      expect(onStop).not.toHaveBeenCalled();
    });

    it('a manual Next silences the narration and ends the show without a double advance', () => {
      installSpeech();
      render(<Harness />);
      press(showButton());
      press(within(tour()).getByRole('button', { name: 'Next' }));
      expect(stopLabel()).toBe('Stop 2 of 3');
      expect(onStop).toHaveBeenCalledTimes(1);
      expect(showButton().textContent).toBe('Play Show');
      expect(cancel).toHaveBeenCalled();
    });

    it('muting during the show pauses it instead of advancing', () => {
      installSpeech();
      render(<Harness />);
      press(showButton());
      act(() => setMuted(true));
      expect(stopLabel()).toBe('Stop 1 of 3');
      expect(showButton().textContent).toBe('Play Show');
      expect(cancel).toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();
    });

    it('closing the tour mid-narration stops the voice and does not move the tour', () => {
      installSpeech();
      const { unmount } = render(<Harness />);
      press(showButton());
      cancel.mockClear();
      unmount();
      expect(cancel).toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();
    });

    it('turns Read Stop Aloud off while the show plays', () => {
      installSpeech();
      render(<Harness />);
      press(showButton());
      expect((within(tour()).getByRole('button', { name: 'Read Stop Aloud' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

// ---- Haunted Edition --------------------------------------------------------------------------

describe('Haunted Edition theme', () => {
  const root = document.documentElement;

  it('saves under disclore97.theme and only the haunted theme is stored', () => {
    const s = memoryStorage();
    expect(THEME_KEY).toBe('disclore97.theme');
    expect(loadTheme(s)).toBe('classic');
    expect(saveTheme(s, 'haunted')).toBe(true);
    expect(s.map.get('disclore97.theme')).toBe('haunted');
    expect(loadTheme(s)).toBe('haunted');
    saveTheme(s, 'classic');
    expect(s.map.has('disclore97.theme')).toBe(false);
    s.setItem('disclore97.theme', 'something else');
    expect(loadTheme(s)).toBe('classic');
    expect(loadTheme(undefined)).toBe('classic');
    expect(saveTheme(undefined, 'haunted')).toBe(false);
  });

  it('applyTheme toggles the class on the given element', () => {
    const el = document.createElement('div');
    applyTheme(el, 'haunted');
    expect(el.classList.contains(HAUNTED_CLASS)).toBe(true);
    applyTheme(el, 'classic');
    expect(el.classList.contains(HAUNTED_CLASS)).toBe(false);
  });

  it('the View menu toggle switches the class on <html> and saves the choice', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[deckDisc]} storage={storage} />);
    await openDisc(user, 'Deck Disc');
    expect(root.classList.contains('theme-haunted')).toBe(false);
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Haunted Edition (Off)' }));
    expect(root.classList.contains('theme-haunted')).toBe(true);
    expect(storage.map.get('disclore97.theme')).toBe('haunted');
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Haunted Edition (On)' }));
    expect(root.classList.contains('theme-haunted')).toBe(false);
    expect(storage.map.has('disclore97.theme')).toBe(false);
  });

  it('is restored from storage on the next visit, and removed when the app closes', () => {
    const storage = memoryStorage();
    storage.setItem('disclore97.theme', 'haunted');
    const first = render(<App sources={[deckDisc]} storage={storage} />);
    expect(root.classList.contains('theme-haunted')).toBe(true);
    first.unmount();
    expect(root.classList.contains('theme-haunted')).toBe(false);
    render(<App sources={[deckDisc]} storage={storage} />);
    expect(root.classList.contains('theme-haunted')).toBe(true);
  });

  it('the Home window has a compact toggle too', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[deckDisc]} storage={storage} />);
    await user.click(screen.getByRole('button', { name: /Haunted Edition: Off/ }));
    expect(root.classList.contains('theme-haunted')).toBe(true);
    expect(storage.map.get('disclore97.theme')).toBe('haunted');
    expect(screen.getByRole('button', { name: /Haunted Edition: On/ })).toBeTruthy();
  });
});

describe('Haunted Edition tokens', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
  const start = css.indexOf(':root.theme-haunted');
  const block = css.slice(start, css.indexOf('}', start));
  const root = css.slice(0, css.indexOf('}'));
  const vars = (text: string) => new Map(Array.from(text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)).map((m) => [m[1]!, m[2]!.trim()]));
  const theme = vars(block);
  const classic = vars(root);

  const luminance = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  it('is defined once, after :root, and only overrides tokens that already exist', () => {
    expect(start).toBeGreaterThan(css.indexOf(':root {'));
    expect(css.match(/theme-haunted/g)!.length).toBeGreaterThanOrEqual(1);
    expect(theme.size).toBeGreaterThan(20);
    for (const name of theme.keys()) expect(classic.has(name), name).toBe(true);
  });

  it('uses amber accents, deep crimson, midnight indigo, and bone-ivory paper', () => {
    for (const name of ['--color-gold', '--color-crimson', '--color-title-bg', '--color-desktop', '--color-paper', '--color-night']) {
      expect(theme.get(name), name).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.get(name)).not.toBe(classic.get(name));
    }
  });

  it('keeps high-contrast ink on its paper, surfaces, and tooltip, and light text on the title bar', () => {
    const t = (n: string) => theme.get(n)!;
    for (const surface of ['--color-paper', '--color-surface', '--color-tooltip-bg', '--color-parchment']) {
      expect(contrast(t('--color-ink'), t(surface)), surface).toBeGreaterThanOrEqual(7);
    }
    expect(contrast(t('--color-title-text'), t('--color-title-bg'))).toBeGreaterThanOrEqual(7);
    expect(contrast(t('--color-crimson'), t('--color-paper'))).toBeGreaterThanOrEqual(7);
  });

  it('adds no radius, gradient, or blur', () => {
    expect(block).not.toMatch(/radius|gradient|blur|box-shadow/i);
  });
});
