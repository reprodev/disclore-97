// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import type { FetchLike } from '../../src/adapters/types';
import type { StorageLike } from '../../src/library/discLibrary';
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
      paragraphs: [
        'Water circles the Keep Tower and guards the Drawbridge. The keep tower stands behind it.',
        'Nothing is linked in this second paragraph.',
      ],
      facts: ['A moat is a ditch full of water.'],
      plate: 'wall',
    },
    {
      section_id: 'keep',
      title: 'Keep Tower',
      paragraphs: ['The Keep Tower rises above The Moat. It was the last refuge.'],
      plate: 'tower',
    },
    {
      section_id: 'gate',
      title: 'Drawbridge',
      paragraphs: ['A drawbridge crosses the water. It can be raised at night.'],
      plate: 'gate',
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
  sections: [
    {
      section_id: 'modem',
      title: 'The Modem',
      paragraphs: ['A modem screeches, much like a moat guard would. Dial tones follow.'],
    },
  ],
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
    { url: 'https://cdn.example.org/three.png', caption: 'Third picture' },
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  __setContextFactory(null);
});

const bar = () => screen.getByRole('toolbar', { name: 'Navigation' });
const sidebar = (title: string) => screen.getByRole('navigation', { name: title });
const openDisc = (user: ReturnType<typeof userEvent.setup>, title: string) => user.click(screen.getByText(title));
const dialog = () => screen.getByRole('dialog', { name: 'Dictionary' });

// ---- Dictionary -------------------------------------------------------------------------------

describe('Dictionary', () => {
  it('opens from the toolbar and lists matches from every mounted disc while typing, with no network call', async () => {
    const user = userEvent.setup();
    const f = vi.fn<FetchLike>();
    render(<App sources={[castles, retro]} storage={memoryStorage()} fetch={f} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Dictionary' }));
    await user.type(within(dialog()).getByRole('textbox', { name: 'Word' }), 'moat');

    const list = within(dialog()).getByRole('region', { name: 'In your discs' });
    const hits = within(list).getAllByRole('button');
    const text = hits.map((h) => h.textContent ?? '');
    expect(text.some((t) => t.includes('Castle Disc') && t.includes('The Moat') && t.includes('Title'))).toBe(true);
    expect(text.some((t) => t.includes('Quick Fact') && t.includes('A moat is a ditch'))).toBe(true);
    expect(text.some((t) => t.includes('Retro Disc') && t.includes('The Modem'))).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it('opens a matching article in its own disc and closes', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles, retro]} storage={memoryStorage()} fetch={vi.fn<FetchLike>()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Dictionary' }));
    await user.type(within(dialog()).getByRole('textbox', { name: 'Word' }), 'moat');
    const modemHit = within(dialog())
      .getAllByRole('button')
      .find((b) => (b.textContent ?? '').includes('Retro Disc'))!;
    await user.click(modemHit);
    expect(screen.queryByRole('dialog', { name: 'Dictionary' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'The Modem' })).toBeTruthy();
  });

  it('looks the word up on /api/define and shows a plain-text definition', async () => {
    const user = userEvent.setup();
    const f = vi.fn<FetchLike>(async () =>
      json({
        word: 'moat',
        phonetic: '/moʊt/',
        meanings: [{ partOfSpeech: 'noun', definitions: ['A deep ditch around a castle.'] }],
      }),
    );
    render(<App sources={[castles]} storage={memoryStorage()} fetch={f} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Dictionary' }));
    await user.type(within(dialog()).getByRole('textbox', { name: 'Word' }), 'moat');
    await user.click(within(dialog()).getByRole('button', { name: 'Look Up' }));

    const entry = within(dialog()).getByRole('region', { name: 'Definition' });
    await waitFor(() => expect(within(entry).getByText('A deep ditch around a castle.')).toBeTruthy());
    expect(within(entry).getByText('noun')).toBeTruthy();
    expect(f.mock.calls[0]![0]).toBe('/api/define?word=moat');
  });

  it('falls back to the disc matches when the word is not found or the network fails', async () => {
    const user = userEvent.setup();
    const f = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(json({ error: 'not-found' }, 404))
      .mockRejectedValueOnce(new TypeError('offline'));
    render(<App sources={[castles]} storage={memoryStorage()} fetch={f} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Dictionary' }));
    await user.type(within(dialog()).getByRole('textbox', { name: 'Word' }), 'moat');
    await user.click(within(dialog()).getByRole('button', { name: 'Look Up' }));
    await waitFor(() => expect(within(dialog()).getByText(/No dictionary entry was found\. Showing matches/)).toBeTruthy());
    await user.click(within(dialog()).getByRole('button', { name: 'Look Up' }));
    await waitFor(() => expect(within(dialog()).getByText(/not reachable\. Showing matches/)).toBeTruthy());
    expect(within(dialog()).getAllByRole('button').length).toBeGreaterThan(3);
  });

  it('opens from the Home Utilities card and from the View menu', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} fetch={vi.fn<FetchLike>()} />);
    await user.click(screen.getByRole('button', { name: /Dictionary\.\.\./ }));
    expect(dialog()).toBeTruthy();
    const closers = within(dialog()).getAllByRole('button', { name: 'Close' });
    await user.click(closers[closers.length - 1]!);
    expect(screen.queryByRole('dialog', { name: 'Dictionary' })).toBeNull();
    await openDisc(user, 'Castle Disc');
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Dictionary...' }));
    expect(dialog()).toBeTruthy();
  });

  it('opens pre-filled when a word is double-clicked in an article, and looks it up at once', async () => {
    const user = userEvent.setup();
    const f = vi.fn<FetchLike>(async () =>
      json({ word: 'water', meanings: [{ partOfSpeech: 'noun', definitions: ['A clear liquid.'] }] }),
    );
    render(<App sources={[castles]} storage={memoryStorage()} fetch={f} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(sidebar('Castle Disc')).getByRole('button', { name: 'The Moat' }));
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => ' Water ' } as unknown as Selection);
    fireEvent.doubleClick(screen.getByText(/Nothing is linked/));

    expect((within(dialog()).getByRole('textbox', { name: 'Word' }) as HTMLInputElement).value).toBe('Water');
    await waitFor(() => expect(within(dialog()).getByText('A clear liquid.')).toBeTruthy());
    expect(f.mock.calls[0]![0]).toBe('/api/define?word=Water');
  });
});

describe('double-click word pick-up', () => {
  const sections = castles.sections;
  const pick = (value: string) =>
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => value } as unknown as Selection);

  it('reports a single word only', () => {
    const spy = vi.fn();
    render(<ArticleViewer sections={sections} sectionId="moat" onLookUpWord={spy} />);
    const para = screen.getByText(/Nothing is linked/);
    pick('several words');
    fireEvent.doubleClick(para);
    pick('');
    fireEvent.doubleClick(para);
    pick('1234');
    fireEvent.doubleClick(para);
    expect(spy).not.toHaveBeenCalled();
    pick('linked');
    fireEvent.doubleClick(para);
    expect(spy).toHaveBeenCalledWith('linked');
  });

  it('ignores a double-click on a cross-link button', () => {
    const spy = vi.fn();
    render(<ArticleViewer sections={sections} sectionId="moat" onSelectSection={() => undefined} onLookUpWord={spy} />);
    pick('Drawbridge');
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Drawbridge' }));
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---- Media Gallery ----------------------------------------------------------------------------

describe('Media Gallery', () => {
  it('shows every extracted picture with its caption and opens the Picture Viewer at the clicked frame', async () => {
    const user = userEvent.setup();
    render(<App sources={[withMedia]} storage={memoryStorage()} />);
    await openDisc(user, 'Picture Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Gallery' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Media Gallery' })).toBeTruthy();
    const cards = screen.getAllByRole('button', { name: /^Open picture \d/ });
    expect(cards.map((c) => c.textContent)).toEqual(['First picture', 'Second picture', 'Third picture']);
    expect(cards[1]!.querySelector('img')!.getAttribute('referrerpolicy')).toBe('no-referrer');

    await user.click(cards[1]!);
    const viewer = screen.getByRole('dialog', { name: 'Picture Viewer \u2014 Picture Disc' });
    expect(within(viewer).getByText('Frame 2 / 3')).toBeTruthy();
    expect(within(viewer).getByText('Second picture', { selector: 'p' })).toBeTruthy();
    await user.click(within(viewer).getByRole('button', { name: 'Next' }));
    expect(within(viewer).getByText('Frame 3 / 3')).toBeTruthy();
  });

  it('shows each article as a Plate card on a disc with no pictures, and a click opens that article', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(within(bar()).getByRole('button', { name: 'Gallery' }));

    const cards = screen.getAllByRole('button', { name: /^Open article:/ });
    expect(cards.map((c) => c.textContent)).toEqual(['Plate: The Moat', 'Plate: Keep Tower', 'Plate: Drawbridge']);
    expect(cards[0]!.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('dialog', { name: /Picture Viewer/ })).toBeNull();

    await user.click(cards[2]!);
    expect(screen.getByRole('heading', { level: 1, name: 'Drawbridge' })).toBeTruthy();
  });

  it('is in the View menu and the breadcrumb and status bar name it', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openDisc(user, 'Castle Disc');
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Gallery' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Media Gallery' })).toBeTruthy();
    expect(screen.getAllByText(/Media Gallery/).length).toBeGreaterThan(1);
  });
});

// ---- Visited tracking -------------------------------------------------------------------------

describe('Visited sections', () => {
  it('records opened sections under disclore97.visited.<disc_id> and shows a check and an X / Y read note', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    const nav = sidebar('Castle Disc');
    expect(within(nav).getByText('0 / 3 read')).toBeTruthy();
    expect(nav.querySelectorAll('[data-visited]')).toHaveLength(0);

    await user.click(within(nav).getByRole('button', { name: 'The Moat' }));
    await user.click(within(nav).getByRole('button', { name: 'Drawbridge' }));
    await user.click(within(nav).getByRole('button', { name: 'The Moat' }));

    expect(within(nav).getByText('2 / 3 read')).toBeTruthy();
    expect(nav.querySelectorAll('[data-visited]')).toHaveLength(2);
    expect(JSON.parse(storage.map.get('disclore97.visited.castles')!)).toEqual({ v: 1, sections: ['moat', 'gate'] });
    // The accessible names of the entries are unchanged.
    expect(within(nav).getByRole('button', { name: 'The Moat' })).toBeTruthy();
  });

  it('restores visited sections from storage and keeps each disc separate', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem('disclore97.visited.castles', JSON.stringify({ v: 1, sections: ['keep', 'nope'] }));
    render(<App sources={[castles, retro]} storage={storage} />);
    await openDisc(user, 'Castle Disc');
    expect(within(sidebar('Castle Disc')).getByText('1 / 3 read')).toBeTruthy();
    await user.click(within(bar()).getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Close Disc|Close/ }));
    await openDisc(user, 'Retro Disc');
    expect(within(sidebar('Retro Disc')).getByText('0 / 1 read')).toBeTruthy();
  });

  it('counts a section opened from the Dictionary on a freshly opened disc', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles, retro]} storage={storage} fetch={vi.fn<FetchLike>()} />);
    await user.click(screen.getByRole('button', { name: /Dictionary\.\.\./ }));
    await user.type(within(dialog()).getByRole('textbox', { name: 'Word' }), 'modem');
    await user.click(within(dialog()).getAllByRole('button').find((b) => (b.textContent ?? '').includes('The Modem'))!);
    expect(JSON.parse(storage.map.get('disclore97.visited.retro')!)).toEqual({ v: 1, sections: ['modem'] });
  });
});

// ---- Find in Article --------------------------------------------------------------------------

describe('Find in Article', () => {
  const sections = castles.sections;
  const marks = () => Array.from(document.querySelectorAll('mark.article-hit'));
  const finder = () => screen.getByRole('search', { name: 'Find in article' });

  function open(onSelect: (id: string) => void = () => undefined) {
    render(<ArticleViewer sections={sections} sectionId="moat" onSelectSection={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Find in Article' }));
  }

  it('is a toggle in the tool row that opens and closes the find bar', () => {
    render(<ArticleViewer sections={sections} sectionId="moat" />);
    const toggle = screen.getByRole('button', { name: 'Find in Article' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('search')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(finder()).toBeTruthy();
    fireEvent.click(within(finder()).getByRole('button', { name: 'Close find' }));
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('highlights matches with <mark>, keeps cross-links as buttons, and counts them', () => {
    const onSelect = vi.fn();
    open(onSelect);
    fireEvent.change(within(finder()).getByRole('textbox', { name: 'Find in article' }), { target: { value: 'keep' } });

    expect(marks()).toHaveLength(2);
    expect(within(finder()).getByText('1 of 2')).toBeTruthy();
    expect(marks().filter((m) => m.classList.contains('article-hit--current'))).toHaveLength(1);
    // The first match sits inside the Keep Tower cross-link, which is still a button.
    const link = screen.getByRole('button', { name: 'Keep Tower' });
    expect(link.querySelector('mark.article-hit--current')!.textContent).toBe('Keep');
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledWith('keep');
    expect(document.querySelector('.article-viewer')!.innerHTML).not.toContain('&lt;mark');
  });

  it('moves between matches with Next and Prev, wrapping at both ends', () => {
    open();
    fireEvent.change(within(finder()).getByRole('textbox', { name: 'Find in article' }), { target: { value: 'keep' } });
    const current = () => marks().findIndex((m) => m.classList.contains('article-hit--current'));
    expect(current()).toBe(0);
    fireEvent.click(within(finder()).getByRole('button', { name: 'Next match' }));
    expect(within(finder()).getByText('2 of 2')).toBeTruthy();
    expect(current()).toBe(1);
    fireEvent.click(within(finder()).getByRole('button', { name: 'Next match' }));
    expect(within(finder()).getByText('1 of 2')).toBeTruthy();
    fireEvent.click(within(finder()).getByRole('button', { name: 'Previous match' }));
    expect(within(finder()).getByText('2 of 2')).toBeTruthy();
  });

  it('steps with Enter and Shift+Enter in the box', () => {
    open();
    const input = within(finder()).getByRole('textbox', { name: 'Find in article' });
    fireEvent.change(input, { target: { value: 'keep' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(finder()).getByText('2 of 2')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(within(finder()).getByText('1 of 2')).toBeTruthy();
  });

  it('says "No matches" and shows no marks when nothing matches, and ignores a blank query', () => {
    open();
    const input = within(finder()).getByRole('textbox', { name: 'Find in article' });
    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(within(finder()).getByText('No matches')).toBeTruthy();
    expect(marks()).toHaveLength(0);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(marks()).toHaveLength(0);
  });

  it('closes on Escape and removes the highlights', () => {
    open();
    const input = within(finder()).getByRole('textbox', { name: 'Find in article' });
    fireEvent.change(input, { target: { value: 'water' } });
    expect(marks().length).toBeGreaterThan(0);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('search')).toBeNull();
    expect(marks()).toHaveLength(0);
  });

  it('keeps the query on another article and starts again at its first match', () => {
    const { rerender } = render(<ArticleViewer sections={sections} sectionId="moat" />);
    fireEvent.click(screen.getByRole('button', { name: 'Find in Article' }));
    fireEvent.change(within(finder()).getByRole('textbox', { name: 'Find in article' }), { target: { value: 'water' } });
    fireEvent.click(within(finder()).getByRole('button', { name: 'Next match' }));
    rerender(<ArticleViewer sections={sections} sectionId="gate" />);
    expect((within(finder()).getByRole('textbox', { name: 'Find in article' }) as HTMLInputElement).value).toBe('water');
    expect(within(finder()).getByText('1 of 1')).toBeTruthy();
  });
});
