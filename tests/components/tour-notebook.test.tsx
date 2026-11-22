// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import { appendNote, formatNote, loadNotes, MAX_NOTE_CHARS, NOTES_PREFIX, notesFileName, saveNotes } from '../../src/library/notebook';
import type { StorageLike } from '../../src/library/discLibrary';
import { pickQuickJump } from '../../src/model/nav';
import type { DiscManifest } from '../../src/model/manifest';

// ---- Fixtures ---------------------------------------------------------------------------------

const castles: DiscManifest = {
  disc_id: 'castles',
  title: 'Castle Disc',
  tagline: 'Stone and water',
  sections: [
    {
      section_id: 'moat',
      title: 'The Moat',
      paragraphs: ['Water circles the keep. It guards the wall.'],
      facts: ['A moat is a ditch full of water.', 'Some moats held fish.'],
      timeline: [{ when: '1100s', event: 'Wide moats appear.' }],
      plate: 'wall',
    },
    {
      section_id: 'keep',
      title: 'Keep Tower',
      paragraphs: ['The keep rises above the moat. It was the last refuge.'],
      plate: 'tower',
    },
    {
      section_id: 'gate',
      title: 'Drawbridge',
      paragraphs: ['A drawbridge crosses the water. It can be raised at night.'],
      facts: ['Drawbridges rise on chains.'],
    },
  ],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

const retro: DiscManifest = {
  disc_id: 'retro',
  title: 'Retro Disc',
  tagline: 'Beige boxes',
  sections: [{ section_id: 'modem', title: 'The Modem', paragraphs: ['A modem screeches. Dial tones follow.'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

const withMedia: DiscManifest = {
  ...castles,
  disc_id: 'pics',
  title: 'Picture Disc',
  media: [
    { url: 'https://cdn.example.org/one.png', caption: 'First picture' },
    { url: 'https://cdn.example.org/two.png', caption: 'Second picture' },
  ],
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

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  __setContextFactory(null);
});

type User = ReturnType<typeof userEvent.setup>;
const bar = () => screen.getByRole('toolbar', { name: 'Navigation' });
const sidebar = (title: string) => screen.getByRole('navigation', { name: title });
const openDisc = (user: User, title: string) => user.click(screen.getByText(title));
const tour = () => screen.getByRole('region', { name: 'Take a Tour' });
const stopLabel = () => within(tour()).getByText(/^Stop \d+ of \d+$/).textContent;

// ---- Take a Tour ------------------------------------------------------------------------------

describe('Take a Tour', () => {
  it('opens from the toolbar on the first stop with progress, title, plate, fact, and a dated badge', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Tour' }));

    expect(stopLabel()).toBe('Stop 1 of 3');
    const progress = within(tour()).getByRole('progressbar', { name: 'Tour progress' });
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('3');
    expect(within(tour()).getByRole('heading', { level: 1, name: 'The Moat' })).toBeTruthy();
    expect(within(tour()).getByText('A moat is a ditch full of water.')).toBeTruthy();
    expect(within(tour()).getByText('1100s: Wide moats appear.')).toBeTruthy();
    expect(tour().querySelector('svg.plate__art')).not.toBeNull();
  });

  it('steps with Next and Previous, and disables them at the ends', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Tour' }));
    const prev = () => within(tour()).getByRole('button', { name: 'Previous' }) as HTMLButtonElement;
    const next = () => within(tour()).getByRole('button', { name: 'Next' }) as HTMLButtonElement;
    expect(prev().disabled).toBe(true);
    await user.click(next());
    expect(stopLabel()).toBe('Stop 2 of 3');
    expect(within(tour()).getByRole('heading', { level: 1, name: 'Keep Tower' })).toBeTruthy();
    // No Quick Fact: the first sentence is the spotlight, and there is no dated badge.
    expect(within(tour()).getByText('The keep rises above the moat.')).toBeTruthy();
    expect(tour().querySelector('.tour__badge')).toBeNull();
    await user.click(next());
    expect(stopLabel()).toBe('Stop 3 of 3');
    expect(next().disabled).toBe(true);
    await user.click(prev());
    expect(stopLabel()).toBe('Stop 2 of 3');
  });

  it('plays the slide click when it steps', async () => {
    const audio = await import('../../src/audio/audio');
    const click = vi.spyOn(audio, 'playSlideClick');
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Tour' }));
    await user.click(within(tour()).getByRole('button', { name: 'Next' }));
    expect(click).toHaveBeenCalled();
  });

  it('Open Full Article opens the stop article, and Back returns to the same stop', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Tour' }));
    await user.click(within(tour()).getByRole('button', { name: 'Next' }));
    await user.click(within(tour()).getByRole('button', { name: 'Open Full Article' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Keep Tower' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Take a Tour' })).toBeNull();
    await user.click(within(bar()).getByRole('button', { name: 'Back' }));
    expect(stopLabel()).toBe('Stop 2 of 3');
  });

  it('shows disc pictures by stop index modulo the picture count, with a plate when a picture is missing', async () => {
    const user = userEvent.setup();
    render(<App sources={[withMedia]} storage={memoryStorage()} />);
    await openDisc(user, 'Picture Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Tour' }));
    const src = () => within(tour()).getByRole('img', { name: /picture$/ }).getAttribute('src');
    expect(src()).toBe('https://cdn.example.org/one.png');
    await user.click(within(tour()).getByRole('button', { name: 'Next' }));
    expect(src()).toBe('https://cdn.example.org/two.png');
    await user.click(within(tour()).getByRole('button', { name: 'Next' }));
    expect(src()).toBe('https://cdn.example.org/one.png');
    fireEvent.error(within(tour()).getByRole('img', { name: 'First picture' }));
    expect(tour().querySelector('svg.plate__art')).not.toBeNull();
  });

  it('is also in the View menu and the breadcrumb names it', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Tour' }));
    expect(stopLabel()).toBe('Stop 1 of 3');
    expect(screen.getAllByText(/Take a Tour/).length).toBeGreaterThan(1);
  });

  it('the Home Quick Jump row opens the first disc straight into its Tour', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles, retro]} storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: /Take a Tour/ }));
    expect(stopLabel()).toBe('Stop 1 of 3');
    expect(within(tour()).getByText(/Take a Tour . Castle Disc/)).toBeTruthy();
  });

  it('the Home row uses the last disc you opened', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles, retro]} storage={memoryStorage()} />);
    await openDisc(user, 'Retro Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Close Disc' }));
    await user.click(screen.getByRole('button', { name: /Take a Tour/ }));
    expect(stopLabel()).toBe('Stop 1 of 1');
    expect(within(tour()).getByRole('heading', { level: 1, name: 'The Modem' })).toBeTruthy();
  });

  it('pickQuickJump finds the first disc with articles', () => {
    expect(pickQuickJump([castles, retro], 'retro', 'tour')?.disc.disc_id).toBe('retro');
    expect(pickQuickJump([castles, retro], null, 'tour')).toMatchObject({ view: { kind: 'tour' } });
    expect(pickQuickJump([], null, 'tour')).toBeNull();
  });

  describe('Read Stop Aloud', () => {
    class FakeUtterance {
      lang = '';
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(readonly text: string) {}
    }

    it('is disabled when narration is not available', async () => {
      const user = userEvent.setup();
      render(<App sources={[castles]} storage={memoryStorage()} />);
      await openDisc(user, 'Castle Disc');
      await user.click(within(bar()).getByRole('button', { name: 'Tour' }));
      expect((within(tour()).getByRole('button', { name: 'Read Stop Aloud' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('speaks the title, the fact, and the dated event with speech.ts, and stops when asked', async () => {
      const spoken: string[] = [];
      const speak = vi.fn((u: FakeUtterance) => void spoken.push(u.text));
      const cancel = vi.fn();
      vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
      Object.defineProperty(window, 'speechSynthesis', { value: { speak, cancel }, configurable: true });
      const user = userEvent.setup();
      render(<App sources={[castles]} storage={memoryStorage()} />);
      await openDisc(user, 'Castle Disc');
      await user.click(within(bar()).getByRole('button', { name: 'Tour' }));
      await user.click(within(tour()).getByRole('button', { name: 'Read Stop Aloud' }));
      expect(spoken).toEqual(['The Moat', 'A moat is a ditch full of water.', '1100s: Wide moats appear.']);
      const stop = within(tour()).getByRole('button', { name: 'Stop Reading' });
      expect(stop.getAttribute('aria-pressed')).toBe('true');
      await user.click(stop);
      expect(cancel).toHaveBeenCalled();
      expect(within(tour()).getByRole('button', { name: 'Read Stop Aloud' })).toBeTruthy();
    });
  });
});

// ---- Notebook storage -------------------------------------------------------------------------

describe('Notebook storage helpers', () => {
  it('round-trips under disclore97.notes.<disc_id> and keeps discs apart', () => {
    const s = memoryStorage();
    expect(NOTES_PREFIX).toBe('disclore97.notes.');
    expect(loadNotes(s, 'a')).toBe('');
    expect(saveNotes(s, 'a', 'hello\nworld')).toBe(true);
    expect(JSON.parse(s.map.get('disclore97.notes.a')!)).toEqual({ v: 1, text: 'hello\nworld' });
    expect(loadNotes(s, 'a')).toBe('hello\nworld');
    expect(loadNotes(s, 'b')).toBe('');
    saveNotes(s, 'a', '');
    expect(s.map.has('disclore97.notes.a')).toBe(false);
  });

  it('treats malformed data and missing storage as empty, and never throws', () => {
    const s = memoryStorage();
    for (const bad of ['not json', '5', 'null', '{}', '{"text":5}']) {
      s.setItem('disclore97.notes.a', bad);
      expect(loadNotes(s, 'a')).toBe('');
    }
    expect(loadNotes(undefined, 'a')).toBe('');
    expect(saveNotes(undefined, 'a', 'x')).toBe(false);
    const refusing: StorageLike = { ...s, setItem: () => { throw new Error('full'); } };
    expect(saveNotes(refusing, 'a', 'x')).toBe(false);
  });

  it('formats and appends lines, keeping the pad within its size limit', () => {
    expect(formatNote(' The Moat ', ' A fact. ')).toBe('[The Moat] A fact.');
    expect(appendNote('', 'one')).toBe('one');
    expect(appendNote('one\n\n', 'two')).toBe('one\ntwo');
    const long = Array.from({ length: 300 }, (_, i) => `line ${i} ${'x'.repeat(100)}`).join('\n');
    const out = appendNote(long, 'newest');
    expect(out.length).toBeLessThanOrEqual(MAX_NOTE_CHARS);
    expect(out.endsWith('\nnewest')).toBe(true);
    expect(notesFileName('My Disc!')).toBe('my-disc-notes.txt');
  });
});

// ---- + Note and the Notebook dialog ------------------------------------------------------------

describe('+ Note', () => {
  it('shows a + Note button on each Quick Fact only when the viewer can add notes', () => {
    const { rerender } = render(<ArticleViewer sections={castles.sections} sectionId="moat" />);
    expect(screen.queryByRole('button', { name: /Add to Notebook/ })).toBeNull();
    const add = vi.fn();
    rerender(<ArticleViewer sections={castles.sections} sectionId="moat" onAddNote={add} />);
    const buttons = screen.getAllByRole('button', { name: /^Add to Notebook:/ });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toBe('+ Note');
    fireEvent.click(buttons[1]!);
    expect(add).toHaveBeenCalledWith('The Moat', 'Some moats held fish.');
    expect(screen.getByText('Added to Notebook.')).toBeTruthy();
  });

  it('appends the fact with its section title to the disc notes in localStorage', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles, retro]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(sidebar('Castle Disc')).getByRole('button', { name: 'The Moat' }));
    await user.click(screen.getByRole('button', { name: 'Add to Notebook: A moat is a ditch full of water.' }));
    await user.click(screen.getByRole('button', { name: 'Add to Notebook: Some moats held fish.' }));
    expect(screen.getByText('Added to Notebook.')).toBeTruthy();
    expect(JSON.parse(storage.map.get('disclore97.notes.castles')!)).toEqual({
      v: 1,
      text: '[The Moat] A moat is a ditch full of water.\n[The Moat] Some moats held fish.',
    });
    expect(storage.map.has('disclore97.notes.retro')).toBe(false);
  });

  it('the confirmation clears when you move to another article', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(sidebar('Castle Disc')).getByRole('button', { name: 'The Moat' }));
    await user.click(screen.getAllByRole('button', { name: /^Add to Notebook:/ })[0]!);
    expect(screen.getByText('Added to Notebook.')).toBeTruthy();
    await user.click(within(sidebar('Castle Disc')).getByRole('button', { name: 'Drawbridge' }));
    expect(screen.queryByText('Added to Notebook.')).toBeNull();
  });
});

describe('Notebook dialog', () => {
  const pad = () => screen.getByRole('textbox', { name: 'Study pad' }) as HTMLTextAreaElement;
  const dialog = () => screen.getByRole('dialog', { name: /^Research Notebook/ });

  it('opens from the toolbar and from the View menu and shows the saved notes with counts', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'first line\nsecond');
    render(<App sources={[castles]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    expect(dialog().getAttribute('aria-label') ?? dialog().textContent).toContain('Castle Disc');
    expect(pad().value).toBe('first line\nsecond');
    expect(within(dialog()).getByText('17 characters, 2 lines')).toBeTruthy();
    const closers = within(dialog()).getAllByRole('button', { name: 'Close' });
    await user.click(closers[closers.length - 1]!);
    expect(screen.queryByRole('dialog', { name: /^Research Notebook/ })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Notebook...' }));
    expect(pad().value).toBe('first line\nsecond');
  });

  it('opens from the Home Utilities card for the first disc', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'castle notes');
    saveNotes(storage, 'retro', 'retro notes');
    render(<App sources={[castles, retro]} storage={storage} />);
    await user.click(screen.getByRole('button', { name: /Notebook\.\.\./ }));
    expect(pad().value).toBe('castle notes');
  });

  it('saves edits at once and keeps them after the dialog is reopened', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    expect(within(dialog()).getByText('0 characters, 0 lines')).toBeTruthy();
    fireEvent.change(pad(), { target: { value: 'my own note' } });
    expect(within(dialog()).getByText('11 characters, 1 line')).toBeTruthy();
    expect(JSON.parse(storage.map.get('disclore97.notes.castles')!)).toEqual({ v: 1, text: 'my own note' });
    await user.keyboard('{Escape}');
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    expect(pad().value).toBe('my own note');
  });

  it('shows a fact added with + Note in the pad', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(sidebar('Castle Disc')).getByRole('button', { name: 'Drawbridge' }));
    await user.click(screen.getByRole('button', { name: 'Add to Notebook: Drawbridges rise on chains.' }));
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    expect(pad().value).toBe('[Drawbridge] Drawbridges rise on chains.');
  });

  it('Clear empties the pad and removes the saved notes', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'something');
    render(<App sources={[castles]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Clear' }));
    expect(pad().value).toBe('');
    expect(storage.map.has('disclore97.notes.castles')).toBe(false);
    expect((within(dialog()).getByRole('button', { name: 'Export (.txt)' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Export (.txt) saves the pad as a text file named after the disc', async () => {
    const blobs: Blob[] = [];
    const names: string[] = [];
    Object.defineProperty(URL, 'createObjectURL', { value: (b: Blob) => (blobs.push(b), 'blob:notes'), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', '[The Moat] A fact.');
    render(<App sources={[castles]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Export (.txt)' }));

    expect(names).toEqual(['castles-notes.txt']);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.type).toBe('text/plain');
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blobs[0]!);
    });
    expect(text).toBe('[The Moat] A fact.');
    await waitFor(() => expect(within(dialog()).getByText('Notebook exported (.txt).')).toBeTruthy());
  });

  it('says so when the browser cannot save the file', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'x');
    render(<App sources={[castles]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Export (.txt)' }));
    expect(within(dialog()).getByText('This browser could not save the file.')).toBeTruthy();
  });
});
