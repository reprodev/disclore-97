// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import { HotspotViewer } from '../../src/components/HotspotViewer';
import { KeepMazeUI } from '../../src/components/KeepMazeUI';
import { BOOKMARK_PREFIX } from '../../src/library/bookmarks';
import type { StorageLike } from '../../src/library/discLibrary';
import type { Diagram, DiscManifest, Dungeon } from '../../src/model/manifest';

// ---- Fixtures ---------------------------------------------------------------------------------

const disc: DiscManifest = {
  disc_id: 'gameplay',
  title: 'Gameplay Disc',
  tagline: 'A tagline',
  sections: [
    {
      section_id: 'moat',
      title: 'The Moat',
      paragraphs: [
        'Water circles the Keep Tower and guards the Drawbridge. The keep tower stands behind it.',
        'Nothing is linked in this second paragraph.',
      ],
      facts: ['Moats can be wet or dry.', 'Some moats held fish.'],
      timeline: [
        { when: '1100s', event: 'Wide moats appear.' },
        { when: '1066', event: 'Normans arrive.' },
      ],
    },
    {
      section_id: 'keep',
      title: 'Keep Tower',
      paragraphs: ['The Keep Tower rises above The Moat. It was the last refuge.', 'The Drawbridge and the drawbridge again.'],
      facts: ['Keeps were built of stone.'],
      timeline: [
        { when: 'Late 900s', event: 'First stone towers.' },
        { when: 'Middle Ages', event: 'Keeps grow taller.' },
      ],
    },
    {
      section_id: 'gate',
      title: 'Drawbridge',
      paragraphs: ['A drawbridge crosses the water. It can be raised at night.'],
    },
  ],
  diagrams: [
    {
      diagram_id: 'plan',
      title: 'The Plan',
      viewBox: '0 0 100 100',
      shapes: [{ kind: 'rect', x: 0, y: 0, width: 100, height: 100, fill: 'var(--color-parchment)', stroke: 'none' }],
      hotspots: [
        { label: 'Water ring', x: 30, y: 40, section_id: 'moat' },
        { label: 'Bridge', x: 80, y: 60, section_id: 'gate' },
      ],
    },
  ],
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

const bare: DiscManifest = {
  disc_id: 'bare',
  title: 'Bare Disc',
  tagline: 'No dates',
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

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  __setContextFactory(null);
});

const sidebar = () => screen.getByRole('navigation', { name: 'Gameplay Disc' });
const article = () => document.querySelector('article.article-viewer') as HTMLElement;
const heading1 = () => screen.getByRole('heading', { level: 1 });

async function openDisc(user: ReturnType<typeof userEvent.setup>, title = 'Gameplay Disc') {
  await user.click(screen.getByText(title));
}
async function openSection(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(within(sidebar()).getByRole('button', { name: title }));
}

// ---- Disc-wide Timeline ----------------------------------------------------------------------

describe('Explore History timeline', () => {
  it('has a toolbar button beside Diagram and KeepMaze, enabled when a section has dated events', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc, bare]} storage={memoryStorage()} />);
    await openDisc(user);
    const bar = screen.getByRole('toolbar', { name: 'Navigation' });
    const labels = within(bar).getAllByRole('button').map((b) => b.textContent);
    expect(labels.slice(-3)).toEqual(['Diagram', 'Timeline', 'KeepMaze']);
    expect((within(bar).getByRole('button', { name: 'Timeline' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('is disabled when no section has any timeline entries', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc, bare]} storage={memoryStorage()} />);
    await openDisc(user, 'Bare Disc');
    expect((screen.getByRole('button', { name: 'Timeline' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens a strip of century columns with every event, oldest first, and each article as a badge', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    await user.click(screen.getByRole('button', { name: 'Timeline' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Explore History' })).toBeTruthy();
    expect(screen.getByText(/4 events from Gameplay Disc, oldest first/)).toBeTruthy();
    const strip = screen.getByRole('list', { name: 'Chronology' });
    const eras = Array.from(strip.querySelectorAll('.timeline__era-title')).map((h) => h.textContent);
    expect(eras).toEqual(['900s', '1000s', '1100s', 'Other dates']);
    const events = Array.from(strip.querySelectorAll('.timeline__event')).map((b) => [
      b.querySelector('.timeline__when')!.textContent,
      b.querySelector('.timeline__text')!.textContent,
      b.querySelector('.timeline__badge')!.textContent,
    ]);
    expect(events).toEqual([
      ['Late 900s', 'First stone towers.', 'Keep Tower'],
      ['1066', 'Normans arrive.', 'The Moat'],
      ['1100s', 'Wide moats appear.', 'The Moat'],
      ['Middle Ages', 'Keeps grow taller.', 'Keep Tower'],
    ]);
    expect(screen.getByText('Timeline', { selector: '.breadcrumb__current' })).toBeTruthy();
  });

  it('clicking an event opens its article, and Back returns to the timeline', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    await user.click(screen.getByRole('button', { name: /Normans arrive/ }));
    expect(heading1().textContent).toBe('The Moat');
    expect(screen.queryByRole('heading', { name: 'Explore History' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Explore History' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(heading1().textContent).toBe('The Moat');
  });

  it('can be opened from the View menu, too', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Timeline' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Explore History' })).toBeTruthy();
  });
});

// ---- Diagram pin preview ---------------------------------------------------------------------

describe('diagram pin preview', () => {
  const diagram = disc.diagrams[0] as Diagram;
  const tipFor = (name: string) =>
    screen.getByRole('button', { name }).closest('.tooltip-wrap')!.querySelector('[role="tooltip"]') as HTMLElement;

  it('shows the article title and first Quick Fact when a pin is hovered', () => {
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} />);
    const tip = tipFor('Water ring');
    expect(tip.hasAttribute('hidden')).toBe(true);
    fireEvent.pointerEnter(tip.closest('.tooltip-wrap')!);
    expect(tip.hasAttribute('hidden')).toBe(false);
    expect(tip.querySelector('.pin-card__title')!.textContent).toBe('The Moat');
    expect(tip.querySelector('.pin-card__fact')!.textContent).toBe('Moats can be wet or dry.');
    fireEvent.pointerLeave(tip.closest('.tooltip-wrap')!);
    expect(tip.hasAttribute('hidden')).toBe(true);
  });

  it('shows the same card when a pin gets keyboard focus, and hides it on blur', () => {
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} />);
    const pin = screen.getByRole('button', { name: 'Water ring' });
    const tip = tipFor('Water ring');
    act(() => pin.focus());
    expect(tip.hasAttribute('hidden')).toBe(false);
    expect(tip.textContent).toContain('The Moat');
    expect(tip.textContent).toContain('Moats can be wet or dry.');
    act(() => pin.blur());
    expect(tip.hasAttribute('hidden')).toBe(true);
  });

  it('falls back to the first sentence when the article has no Quick Facts, and opens left near the right edge', () => {
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} />);
    const tip = tipFor('Bridge');
    fireEvent.pointerEnter(tip.closest('.tooltip-wrap')!);
    expect(tip.querySelector('.pin-card__title')!.textContent).toBe('Drawbridge');
    expect(tip.querySelector('.pin-card__fact')!.textContent).toBe('A drawbridge crosses the water.');
    expect(tip.className).toContain('tooltip-bubble--end');
    expect(tipFor('Water ring').className).not.toContain('tooltip-bubble--end');
  });

  it('keeps the plain label tooltip when no sections are given', () => {
    render(<HotspotViewer diagram={diagram} onNavigate={() => {}} />);
    const tip = tipFor('Water ring');
    expect(tip.textContent).toBe('Water ring');
    expect(tip.querySelector('.pin-card__title')).toBeNull();
  });

  it('still opens the article on click', () => {
    const picked: string[] = [];
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={(id) => picked.push(id)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bridge' }));
    expect(picked).toEqual(['gate']);
  });

  it('in the app, the diagram view shows the preview cards', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    await user.click(screen.getByRole('button', { name: 'Diagram' }));
    const tip = tipFor('Water ring');
    fireEvent.pointerEnter(tip.closest('.tooltip-wrap')!);
    expect(tip.textContent).toContain('Moats can be wet or dry.');
  });
});

// ---- KeepMaze MindMaze -----------------------------------------------------------------------

describe('KeepMaze Knowledge Score, Streak, and Torches', () => {
  const dungeon = disc.dungeons[0] as Dungeon;
  const stat = (label: string) => {
    const card = screen.getByRole('region', { name: 'KeepMaze Quest' });
    const dt = Array.from(card.querySelectorAll('dt')).find((d) => d.textContent === label)!;
    return dt.nextElementSibling as HTMLElement;
  };
  const torchLabel = () => stat('Torches').querySelector('[role="img"]')!.getAttribute('aria-label');

  const setup = async () => {
    const user = userEvent.setup();
    render(<KeepMazeUI disc={disc} dungeon={dungeon} onOpenSection={() => {}} rng={() => 0.5} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    return user;
  };
  const answer = async (user: ReturnType<typeof userEvent.setup>, correct: boolean) => {
    const group = screen.getByRole('group', { name: 'Trivia question' });
    const n = /Question number (\d)/.exec(group.querySelector('p')!.textContent!)![1];
    await user.click(screen.getByRole('button', { name: correct ? `Q${n} right` : `Q${n} wrong A` }));
  };
  const go = (user: ReturnType<typeof userEvent.setup>, room: string) => user.click(screen.getByRole('button', { name: room }));

  it('starts at Score 0, Streak 0, and three lit torches in the Quest card', async () => {
    await setup();
    expect(stat('Score').textContent).toBe('0');
    expect(stat('Streak').textContent).toBe('0');
    expect(torchLabel()).toBe('3 of 3 torches lit');
    expect(stat('Torches').querySelectorAll('[data-lit="true"]')).toHaveLength(3);
  });

  it('a right answer adds 100, then 110 with the streak bonus', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    await answer(user, true);
    expect(stat('Score').textContent).toBe('100');
    expect(stat('Streak').textContent).toBe('1');
    await go(user, 'Throne');
    await answer(user, true);
    // The game is won, so the Quest card is replaced by the certificate (checked below).
    expect(screen.getByRole('region', { name: 'Victory Certificate' })).toBeTruthy();
  });

  it('a wrong answer resets the streak and dims a torch, and keeps the score', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    await answer(user, true);
    await go(user, 'Throne');
    await answer(user, false);
    expect(stat('Score').textContent).toBe('100');
    expect(stat('Streak').textContent).toBe('0');
    expect(torchLabel()).toBe('2 of 3 torches lit');
    expect(stat('Torches').querySelectorAll('[data-lit="false"]')).toHaveLength(1);
    expect(screen.getByText('Incorrect: 1')).toBeTruthy();
  });

  it('Peek Hint cuts the answer to 50 points and says so', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    expect(screen.queryByText(/Hint used/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Peek Hint' }));
    expect(screen.getByText('Hint used: a right answer is worth 50 points.')).toBeTruthy();
    await answer(user, true);
    expect(stat('Score').textContent).toBe('50');
    expect(stat('Streak').textContent).toBe('1');
    // The next question starts fresh: no hint note, and the streak bonus applies.
    await go(user, 'Throne');
    expect(screen.queryByText(/Hint used/)).toBeNull();
  });

  it('closing the hint does not take the hint back', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    await user.click(screen.getByRole('button', { name: 'Peek Hint' }));
    await user.click(screen.getByRole('button', { name: 'Peek Hint' }));
    expect(screen.getByText(/Hint used/)).toBeTruthy();
    await answer(user, true);
    expect(stat('Score').textContent).toBe('50');
  });

  it('never soft-locks: with no torches left you can still answer and finish the maze', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    for (let i = 0; i < 5; i++) {
      await answer(user, false);
      await go(user, 'Great Hall');
    }
    expect(torchLabel()).toBe('0 of 3 torches lit');
    expect(stat('Score').textContent).toBe('0');
    expect(screen.getByRole('group', { name: 'Trivia question' })).toBeTruthy();
    await answer(user, true);
    await go(user, 'Throne');
    await answer(user, true);
    expect(screen.getByRole('region', { name: 'Victory Certificate' })).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('stamps Score, Best Streak, and Scholar Rank on the Victory Certificate', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    await answer(user, true);
    await go(user, 'Throne');
    await answer(user, true);
    const cert = screen.getByRole('region', { name: 'Victory Certificate' });
    const value = (label: string) =>
      Array.from(cert.querySelectorAll('dt')).find((d) => d.textContent === label)!.nextElementSibling!.textContent;
    expect(value('Score')).toBe('210');
    expect(value('Best streak')).toBe('2');
    expect(value('Moves')).toBe('2');
    expect(value('Incorrect answers')).toBe('0');
    expect(cert.querySelector('.certificate__rank')!.textContent).toBe('Scholar Rank: Royal Archivist');
    // The existing status line is unchanged.
    expect(screen.getByRole('status').textContent).toBe('Victory! You reached the throne room in 2 moves with 0 incorrect answers.');
  });

  it('a rougher run earns a lower rank and a smaller score', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    await answer(user, false);
    await go(user, 'Great Hall');
    await answer(user, true); // 100, streak 1
    await go(user, 'Throne');
    await user.click(screen.getByRole('button', { name: 'Peek Hint' }));
    await answer(user, true); // 50
    const cert = screen.getByRole('region', { name: 'Victory Certificate' });
    expect(Array.from(cert.querySelectorAll('dd')).map((d) => d.textContent)).toEqual(['2', '1', '150', '2']);
    expect(cert.querySelector('.certificate__rank')!.textContent).toBe('Scholar Rank: Keep Explorer');
  });

  it('Restart clears score, streak, and torches', async () => {
    const user = await setup();
    await go(user, 'Great Hall');
    await answer(user, false);
    await user.click(screen.getAllByRole('button', { name: 'Restart' })[0]!);
    expect(stat('Score').textContent).toBe('0');
    expect(stat('Streak').textContent).toBe('0');
    expect(torchLabel()).toBe('3 of 3 torches lit');
  });
});

// ---- Cross-links -----------------------------------------------------------------------------

describe('inline cross-links', () => {
  const links = () => Array.from(article().querySelectorAll('button.article-xlink'));

  it('turns mentions of other articles into buttons, once per target per paragraph', () => {
    render(<ArticleViewer sections={disc.sections} sectionId="moat" onSelectSection={() => {}} />);
    const first = article().querySelectorAll('p.article-paragraph')[0] as HTMLElement;
    const found = Array.from(first.querySelectorAll('button.article-xlink')).map((b) => b.textContent);
    expect(found).toEqual(['Keep Tower', 'Drawbridge']); // the second "keep tower" stays plain text
    expect(first.textContent).toBe('Water circles the Keep Tower and guards the Drawbridge. The keep tower stands behind it.');
    const second = article().querySelectorAll('p.article-paragraph')[1] as HTMLElement;
    expect(second.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not link the article to itself', () => {
    render(<ArticleViewer sections={disc.sections} sectionId="keep" onSelectSection={() => {}} />);
    const texts = links().map((b) => b.textContent);
    expect(texts).toContain('The Moat');
    expect(texts).toContain('Drawbridge');
    expect(texts).not.toContain('Keep Tower');
  });

  it('links each target at most once in each paragraph, matching case-insensitively', () => {
    render(<ArticleViewer sections={disc.sections} sectionId="keep" onSelectSection={() => {}} />);
    const second = article().querySelectorAll('p.article-paragraph')[1] as HTMLElement;
    expect(Array.from(second.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Drawbridge']);
    expect(second.textContent).toBe('The Drawbridge and the drawbridge again.');
  });

  it('calls onSelectSection with the target when a link is clicked', () => {
    const picked: string[] = [];
    render(<ArticleViewer sections={disc.sections} sectionId="moat" onSelectSection={(id) => picked.push(id)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drawbridge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Tower' }));
    expect(picked).toEqual(['gate', 'keep']);
  });

  it('adds no links when the viewer cannot navigate', () => {
    render(<ArticleViewer sections={disc.sections} sectionId="moat" />);
    expect(links()).toHaveLength(0);
    expect(article().textContent).toContain('Water circles the Keep Tower and guards the Drawbridge.');
  });

  it('builds plain text and buttons only, never markup from the text', () => {
    const tricky: DiscManifest['sections'] = [
      { section_id: 'a', title: 'Alpha Page', paragraphs: ['<img src=x onerror=alert(1)> Beta Page & <b>bold</b>'] },
      { section_id: 'b', title: 'Beta Page', paragraphs: ['x'] },
    ];
    render(<ArticleViewer sections={tricky} sectionId="a" onSelectSection={() => {}} />);
    expect(article().querySelector('img')).toBeNull();
    expect(article().querySelector('b')).toBeNull();
    expect(links().map((b) => b.textContent)).toEqual(['Beta Page']);
    expect(article().textContent).toContain('<img src=x onerror=alert(1)> Beta Page & <b>bold</b>');
  });

  it('in the app, a link opens the target with normal Back and Forward history', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    await openSection(user, 'The Moat');
    expect(heading1().textContent).toBe('The Moat');

    await user.click(within(article()).getByRole('button', { name: 'Keep Tower' }));
    expect(heading1().textContent).toBe('Keep Tower');
    await user.click(within(article()).getByRole('button', { name: 'Drawbridge' }));
    expect(heading1().textContent).toBe('Drawbridge');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(heading1().textContent).toBe('Keep Tower');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(heading1().textContent).toBe('The Moat');
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(heading1().textContent).toBe('Keep Tower');
  });
});

// ---- Bookmarks -------------------------------------------------------------------------------

describe('bookmarks', () => {
  const key = `${BOOKMARK_PREFIX}gameplay`;
  const stored = (s: ReturnType<typeof memoryStorage>) => (s.map.has(key) ? (JSON.parse(s.map.get(key)!) as { sections: string[] }).sections : null);
  const bookmarksList = () => screen.queryByRole('region', { name: 'Bookmarks' });

  it('has a Bookmark toggle in the article tools, off by default', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    expect(bookmarksList()).toBeNull();
    await openSection(user, 'The Moat');
    const tools = screen.getByRole('group', { name: 'Article tools' });
    const button = within(tools).getByRole('button', { name: 'Bookmark' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('saves a bookmark per disc and section in storage, and shows it in the sidebar', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[disc]} storage={storage} />);
    await openDisc(user);
    await openSection(user, 'The Moat');
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));

    expect(screen.getByRole('button', { name: 'Bookmarked' }).getAttribute('aria-pressed')).toBe('true');
    expect(stored(storage)).toEqual(['moat']);
    const list = bookmarksList()!;
    expect(within(list).getByRole('heading', { name: 'Bookmarks' })).toBeTruthy();
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['The Moat']);
  });

  it('the sidebar list jumps straight to a bookmarked article', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    await openDisc(user);
    await openSection(user, 'The Moat');
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    await openSection(user, 'Drawbridge');
    expect(heading1().textContent).toBe('Drawbridge');
    expect(screen.getByRole('button', { name: 'Bookmark' }).getAttribute('aria-pressed')).toBe('false');

    await user.click(within(bookmarksList()!).getByRole('button', { name: 'Go to bookmark: The Moat' }));
    expect(heading1().textContent).toBe('The Moat');
    expect(screen.getByRole('button', { name: 'Bookmarked' })).toBeTruthy();
  });

  it('keeps bookmarks in order, and removing one updates storage and the list', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[disc]} storage={storage} />);
    await openDisc(user);
    await openSection(user, 'Keep Tower');
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    await openSection(user, 'The Moat');
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    expect(stored(storage)).toEqual(['keep', 'moat']);
    expect(within(bookmarksList()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep Tower', 'The Moat']);

    await user.click(screen.getByRole('button', { name: 'Bookmarked' }));
    expect(stored(storage)).toEqual(['keep']);
    expect(within(bookmarksList()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep Tower']);
    await openSection(user, 'Keep Tower');
    await user.click(screen.getByRole('button', { name: 'Bookmarked' }));
    expect(stored(storage)).toBeNull();
    expect(bookmarksList()).toBeNull();
  });

  it('survives a reload: a new session reads the bookmarks back', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const first = render(<App sources={[disc]} storage={storage} />);
    await openDisc(user);
    await openSection(user, 'Drawbridge');
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    first.unmount();

    render(<App sources={[disc]} storage={storage} />);
    await openDisc(user);
    expect(within(bookmarksList()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Drawbridge']);
    await user.click(within(bookmarksList()!).getByRole('button', { name: 'Go to bookmark: Drawbridge' }));
    expect(screen.getByRole('button', { name: 'Bookmarked' })).toBeTruthy();
  });

  it('keeps each disc’s bookmarks apart, and ignores sections that no longer exist', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem(key, JSON.stringify({ v: 1, sections: ['moat', 'deleted-section'] }));
    storage.setItem(`${BOOKMARK_PREFIX}bare`, JSON.stringify({ v: 1, sections: ['only'] }));
    render(<App sources={[disc, bare]} storage={storage} />);
    await openDisc(user);
    expect(within(bookmarksList()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['The Moat']);
  });

  it('never throws when storage refuses writes: the bookmark still shows for the session', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    render(<App sources={[disc]} storage={storage} />);
    await openDisc(user);
    await openSection(user, 'The Moat');
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    expect(screen.getByRole('button', { name: 'Bookmarked' })).toBeTruthy();
    expect(bookmarksList()).not.toBeNull();
  });
});

describe('design-system rules for the new styles', () => {
  it('uses no hex colors, gradients, blurs, rounded corners, or images', () => {
    for (const file of ['timeline.css', 'tooltip.css', 'article.css', 'keepmaze.css', 'browser.css']) {
      const css = readFileSync(resolve(__dirname, '../../src/styles', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css, file).not.toMatch(/gradient\s*\(/i);
      expect(css, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css, file).not.toMatch(/url\(/i);
      for (const m of css.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/gi)) {
        expect((m[1]!.match(/-?\d*\.?\d+/g) ?? []).every((n) => parseFloat(n) === 0), `${file}: ${m[0]}`).toBe(true);
      }
    }
  });
});
