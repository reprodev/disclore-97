// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { HomeLauncher } from '../../src/components/HomeLauncher';
import { PackShelf } from '../../src/components/PackShelf';
import { discOrigin, originClassName } from '../../src/library/discOrigin';
import { collectFacts, MAX_HITS, pickRandomSection, searchSections } from '../../src/model/discSearch';
import type { DiscManifest } from '../../src/model/manifest';

const mk = (id: string, title: string, sections: DiscManifest['sections']): DiscManifest => ({
  disc_id: id,
  title,
  tagline: `${title} tagline`,
  sections,
  diagrams: [],
  trivia: [],
  dungeons: [],
});

const castles = mk('castles', 'Castles Disc', [
  {
    section_id: 'moat',
    title: 'The Moat',
    paragraphs: ['A moat is a ditch filled with water that slows attackers.'],
    facts: ['Moats were often fed by rivers.', 'Some moats were dry.'],
  },
  {
    section_id: 'keep',
    title: 'The Keep',
    paragraphs: ['The keep was the strongest tower. It held the lord and his stores.'],
  },
]);
const retro = mk('retro-dialup', 'Retro Disc', [
  {
    section_id: 'modem',
    title: 'Modems and the Moat of Noise',
    paragraphs: ['A modem turned bits into screeching sound.'],
    facts: ['A 56k modem was the fastest dial-up.'],
  },
  {
    section_id: 'bbs',
    title: 'Bulletin Boards',
    paragraphs: ['A bulletin board system let callers leave messages.', 'Many ran on one phone line.'],
  },
]);
const burned = mk('github-octo-hello-1a2b', 'Octo Hello', [
  { section_id: 'readme', title: 'About the moat plugin', paragraphs: ['This repository has a moat.'] },
]);
const DISCS = [castles, retro, burned];
const REMOVABLE = new Set([burned.disc_id]);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('discSearch', () => {
  it('finds sections across all discs, best matches first', () => {
    const hits = searchSections(DISCS, 'moat');
    expect(hits.map((h) => h.sectionId)).toEqual(['moat', 'modem', 'readme']);
    // 'The Moat' (title), then 'Modems and the Moat of Noise' (title), then 'About the moat plugin' (title).
    expect(hits[0]).toEqual({ discId: 'castles', discTitle: 'Castles Disc', sectionId: 'moat', sectionTitle: 'The Moat' });
  });

  it('ranks a title match above a facts match above a body match', () => {
    const d = mk('d', 'D', [
      { section_id: 'body', title: 'Zeta', paragraphs: ['A walrus appears here.'] },
      { section_id: 'facts', title: 'Eta', paragraphs: ['Nothing.'], facts: ['The walrus is large.'] },
      { section_id: 'title', title: 'Walrus', paragraphs: ['Nothing.'] },
    ]);
    expect(searchSections([d], 'walrus').map((h) => h.sectionId)).toEqual(['title', 'facts', 'body']);
  });

  it('needs every word, ignores case, and matches body text', () => {
    expect(searchSections(DISCS, 'SCREECHING sound').map((h) => h.sectionId)).toEqual(['modem']);
    expect(searchSections(DISCS, 'screeching castle')).toEqual([]);
  });

  it('returns nothing for a blank or one-character query, and caps the list', () => {
    expect(searchSections(DISCS, '')).toEqual([]);
    expect(searchSections(DISCS, '   ')).toEqual([]);
    expect(searchSections(DISCS, 'm')).toEqual([]);
    const many = mk('m', 'M', Array.from({ length: 20 }, (_, i) => ({ section_id: `s${i}`, title: `Tower ${i}`, paragraphs: ['x'] })));
    expect(searchSections([many], 'tower')).toHaveLength(MAX_HITS);
    expect(searchSections([many], 'tower', 3)).toHaveLength(3);
  });

  it('collects each section’s own facts, or its first sentence, interleaved across discs', () => {
    const facts = collectFacts([castles, retro]);
    expect(facts.map((f) => f.text)).toEqual([
      'Moats were often fed by rivers.', // castles 1
      'A 56k modem was the fastest dial-up.', // retro 1
      'Some moats were dry.', // castles 2
      'A bulletin board system let callers leave messages.', // retro 2 (first sentence)
      'The keep was the strongest tower.', // castles 3 (first sentence)
    ]);
    expect(facts[1]).toMatchObject({ discId: 'retro-dialup', sectionId: 'modem', sectionTitle: 'Modems and the Moat of Noise' });
    expect(collectFacts([])).toEqual([]);
  });

  it('picks a random section across discs, staying inside the list', () => {
    expect(pickRandomSection(DISCS, () => 0)).toMatchObject({ discId: 'castles', sectionId: 'moat' });
    expect(pickRandomSection(DISCS, () => 0.99999)).toMatchObject({ discId: 'github-octo-hello-1a2b', sectionId: 'readme' });
    expect(pickRandomSection(DISCS, () => 1)).toMatchObject({ sectionId: 'readme' });
    expect(pickRandomSection(DISCS, () => Number.NaN)).toMatchObject({ sectionId: 'moat' });
    expect(pickRandomSection([], () => 0.5)).toBeNull();
  });
});

function setup(over: Partial<React.ComponentProps<typeof HomeLauncher>> = {}) {
  const props = {
    discs: DISCS,
    removableIds: REMOVABLE,
    onPickDisc: vi.fn(),
    onOpenSection: vi.fn(),
    random: () => 0,
    ...over,
  };
  render(<HomeLauncher {...props} />);
  return props;
}

const box = () => screen.getByRole('combobox', { name: /Pinpointer/ }) as HTMLInputElement;
const options = () => screen.queryAllByRole('option');

describe('Pinpointer', () => {
  it('is a labelled search box over the shelf', () => {
    setup();
    expect(box().placeholder).toBe('Search all discs...');
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(options()).toEqual([]);
  });

  it('lists matching sections from every disc with a disc name and an origin badge', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(box(), 'moat');
    expect(box().getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('listbox', { name: 'Matching articles' });
    const rows = within(list).getAllByRole('option');
    expect(rows.map((r) => r.querySelector('.pinpointer__title')!.textContent)).toEqual([
      'The Moat',
      'Modems and the Moat of Noise',
      'About the moat plugin',
    ]);
    expect(rows.map((r) => r.querySelector('.pinpointer__disc')!.textContent)).toEqual([
      'Castles Disc',
      'Retro Disc',
      'Octo Hello',
    ]);
    expect(rows.map((r) => r.querySelector('.pack-badge')!.textContent)).toEqual(['Built-In', 'Built-In', 'GitHub']);
    expect(rows[2]!.querySelector('.pack-badge')!.className).toContain('pack-badge--github');
  });

  it('opens the disc at that section when a result is clicked, then clears', async () => {
    const user = userEvent.setup();
    const { onOpenSection, onPickDisc } = setup();
    await user.type(box(), 'bulletin');
    await user.click(screen.getByRole('option', { name: /Bulletin Boards/ }));
    expect(onOpenSection).toHaveBeenCalledTimes(1);
    expect(onOpenSection).toHaveBeenCalledWith('retro-dialup', 'bbs');
    expect(onPickDisc).not.toHaveBeenCalled();
    expect(box().value).toBe('');
    expect(options()).toEqual([]);
  });

  it('moves with the arrow keys and opens the active result with Enter', async () => {
    const user = userEvent.setup();
    const { onOpenSection } = setup();
    await user.type(box(), 'moat');
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}');
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true');
    expect(box().getAttribute('aria-activedescendant')).toBe(options()[1]!.id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(options()[2]!.getAttribute('aria-selected')).toBe('true'); // wraps
    await user.keyboard('{Enter}');
    expect(onOpenSection).toHaveBeenCalledWith('github-octo-hello-1a2b', 'readme');
  });

  it('Escape clears the box and closes the list', async () => {
    const user = userEvent.setup();
    const { onOpenSection } = setup();
    await user.type(box(), 'moat');
    expect(options().length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    expect(box().value).toBe('');
    expect(options()).toEqual([]);
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(onOpenSection).not.toHaveBeenCalled();
  });

  it('closes the list when the box is emptied or loses focus, and for a single character', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(box(), 'moat');
    await user.clear(box());
    expect(options()).toEqual([]);
    await user.type(box(), 'm');
    expect(options()).toEqual([]);
    await user.type(box(), 'oat');
    expect(options().length).toBeGreaterThan(0);
    await user.tab();
    expect(options()).toEqual([]);
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    const { onOpenSection } = setup();
    await user.type(box(), 'zzzzqq');
    expect(screen.getByText('No matching articles.')).toBeTruthy();
    expect(options()).toEqual([]);
    await user.keyboard('{Enter}');
    expect(onOpenSection).not.toHaveBeenCalled();
  });

  it('is hidden when the launcher cannot open sections', () => {
    setup({ onOpenSection: undefined });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Did You Know?' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Surprise Me!/ })).toBeNull();
  });
});

describe('Did You Know? spotlight', () => {
  const spot = () => screen.getByRole('region', { name: 'Did You Know?' });

  it('shows a real fact with its article and disc', () => {
    setup();
    expect(within(spot()).getByRole('heading', { name: 'Did You Know?' })).toBeTruthy();
    expect(within(spot()).getByText('Moats were often fed by rivers.')).toBeTruthy();
    expect(spot().querySelector('cite')!.textContent).toBe('The Moat');
    expect(spot().textContent).toContain('in Castles Disc');
  });

  it('Next Fact steps through the facts from disc to disc and wraps around', async () => {
    const user = userEvent.setup();
    setup();
    const next = within(spot()).getByRole('button', { name: 'Next Fact' });
    const seen = [spot().querySelector('.spotlight__fact')!.textContent];
    for (let i = 0; i < 6; i++) {
      await user.click(next);
      seen.push(spot().querySelector('.spotlight__fact')!.textContent);
    }
    expect(seen.slice(0, 4)).toEqual([
      'Moats were often fed by rivers.',
      'A 56k modem was the fastest dial-up.',
      'This repository has a moat.',
      'Some moats were dry.',
    ]);
    expect(seen[collectFacts(DISCS).length]).toBe(seen[0]); // after one full cycle it wraps to the start
    expect(new Set(seen).size).toBe(collectFacts(DISCS).length); // every fact appears, then it repeats
  });

  it('starts at a random fact', () => {
    setup({ random: () => 0.99 });
    expect(spot().querySelector('.spotlight__fact')!.textContent).toBe('The keep was the strongest tower.');
  });

  it('Open Article jumps to the article behind the fact it shows', async () => {
    const user = userEvent.setup();
    const { onOpenSection } = setup();
    await user.click(within(spot()).getByRole('button', { name: 'Next Fact' }));
    await user.click(within(spot()).getByRole('button', { name: 'Open Article' }));
    expect(onOpenSection).toHaveBeenCalledTimes(1);
    expect(onOpenSection).toHaveBeenCalledWith('retro-dialup', 'modem');
  });

  it('with one fact, Next Fact is disabled; with none, the box is not shown', () => {
    setup({ discs: [mk('one', 'One', [{ section_id: 'a', title: 'A', paragraphs: ['Only one sentence here.'] }])], removableIds: new Set() });
    expect((within(spot()).getByRole('button', { name: 'Next Fact' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup({ discs: [mk('none', 'None', [])], removableIds: new Set() });
    expect(screen.queryByRole('region', { name: 'Did You Know?' })).toBeNull();
  });
});

describe('Surprise Me!', () => {
  it('sits in Quick Jump Modes next to the diagram and KeepMaze cards', () => {
    setup({ onQuickJump: vi.fn() });
    const group = screen.getByText('Quick Jump Modes').closest('fieldset')!;
    const names = within(group)
      .getAllByRole('button')
      .map((b) => b.querySelector('.home-card__title')!.textContent);
    expect(names).toEqual(['Interactive Diagrams', 'KeepMaze Quest', 'Surprise Me!']);
  });

  it('opens a random article from any disc', async () => {
    const user = userEvent.setup();
    const first = setup({ random: () => 0 });
    await user.click(screen.getByRole('button', { name: /Surprise Me!/ }));
    expect(first.onOpenSection).toHaveBeenCalledWith('castles', 'moat');
    cleanup();

    const last = setup({ random: () => 0.9999 });
    await user.click(screen.getByRole('button', { name: /Surprise Me!/ }));
    expect(last.onOpenSection).toHaveBeenCalledWith('github-octo-hello-1a2b', 'readme');
    cleanup();

    const mid = setup({ random: () => 0.5 }); // 5 sections in all: 0.5 lands on index 2, the first retro section
    await user.click(screen.getByRole('button', { name: /Surprise Me!/ }));
    expect(mid.onOpenSection).toHaveBeenCalledWith('retro-dialup', 'modem');
  });

  it('is disabled when no disc has an article', () => {
    setup({ discs: [mk('empty', 'Empty', [])], removableIds: new Set() });
    expect((screen.getByRole('button', { name: /Surprise Me!/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('origin badges', () => {
  it('has a distinct class for each origin', () => {
    expect(originClassName('Built-In')).toBe('pack-badge--builtin');
    expect(originClassName('Wikipedia')).toBe('pack-badge--wikipedia');
    expect(originClassName('GitHub')).toBe('pack-badge--github');
    expect(originClassName('Web')).toBe('pack-badge--web');
    expect(originClassName('Markdown')).toBe('pack-badge--markdown');
    expect(originClassName('Outline')).toBe('pack-badge--outline');
    expect(originClassName('Disc Image')).toBe('pack-badge--image');
  });

  it('puts the class on every card badge', () => {
    const web = mk('webpage-example-com-3c4d', 'Example Page', castles.sections);
    const md = mk('markdown-notes-5e6f', 'Notes', castles.sections);
    const image = mk('my-own-disc-9z8y', 'Some Image', castles.sections);
    const all = [castles, burned, web, md, image];
    render(<PackShelf discs={all} removableIds={new Set([burned, web, md, image].map((d) => d.disc_id))} onPick={() => {}} />);
    const cls = (title: string) =>
      Array.from(document.querySelectorAll('.pack-tile'))
        .find((t) => t.querySelector('.disc-title')!.textContent === title)!
        .querySelector('.pack-badge')!.className;
    expect(cls('Castles Disc')).toBe('pack-badge pack-badge--builtin');
    expect(cls('Octo Hello')).toBe('pack-badge pack-badge--github');
    expect(cls('Example Page')).toBe('pack-badge pack-badge--web');
    expect(cls('Notes')).toBe('pack-badge pack-badge--markdown');
    expect(cls('Some Image')).toBe('pack-badge pack-badge--image');
    expect(discOrigin(castles, true)).toBe('Built-In');
  });

  describe('colors and card alignment in home.css', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/home.css'), 'utf8');
    const rule = (selector: string) => {
      const i = css.indexOf(`${selector} {`);
      expect(i, `${selector} exists`).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };

    it('uses navy, burgundy, antique gold, and slate tokens', () => {
      expect(rule('.pack-badge.pack-badge--builtin')).toContain('background: var(--color-title-bg)');
      expect(rule('.pack-badge.pack-badge--wikipedia')).toContain('background: var(--color-crimson)');
      const gold = css.slice(css.indexOf('.pack-badge.pack-badge--github,'));
      expect(gold.slice(0, gold.indexOf('}'))).toContain('.pack-badge.pack-badge--web');
      expect(gold.slice(0, gold.indexOf('}') + 1)).toContain('background: var(--color-gold-dark)');
      const slate = css.slice(css.indexOf('.pack-badge.pack-badge--markdown,'));
      const slateRule = slate.slice(0, slate.indexOf('}'));
      expect(slateRule).toContain('.pack-badge.pack-badge--outline');
      expect(slateRule).toContain('.pack-badge.pack-badge--image');
      expect(slateRule).toContain('background: var(--color-dungeon-stone)');
    });

    it('stretches the cards in a row and pins each footer to the bottom', () => {
      expect(rule('.pack-grid')).toContain('align-items: stretch');
      expect(rule('.pack-tile')).toContain('flex-direction: column');
      expect(rule('.pack-tile .bevel-button.pack-tile__open')).toContain('flex: 1 1 auto');
      expect(rule('.pack-tile__foot')).toContain('margin-top: auto');
    });
  });
});

describe('discovery inside the app', () => {
  const sources = [castles, retro];

  it('a Pinpointer result opens that disc straight to the article', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.type(screen.getByRole('combobox', { name: /Pinpointer/ }), 'bulletin');
    await user.click(screen.getByRole('option', { name: /Bulletin Boards/ }));
    expect(screen.getByRole('dialog', { name: 'Retro Disc' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Bulletin Boards' })).toBeTruthy();
    expect(screen.getByText('Many ran on one phone line.')).toBeTruthy();
  });

  it('Open Article on the spotlight opens the disc at that article', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<App sources={sources} />);
    await user.click(screen.getByRole('button', { name: 'Open Article' }));
    expect(screen.getByRole('dialog', { name: 'Castles Disc' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'The Moat' })).toBeTruthy();
  });

  it('Surprise Me! opens a random article', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    render(<App sources={sources} />);
    await user.click(screen.getByRole('button', { name: /Surprise Me!/ }));
    expect(screen.getByRole('dialog', { name: 'Retro Disc' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Bulletin Boards' })).toBeTruthy();
  });

  it('the opened article has history, so Back returns to the disc cover', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.type(screen.getByRole('combobox', { name: /Pinpointer/ }), 'keep');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(screen.getByRole('heading', { level: 1, name: 'The Keep' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.queryByRole('heading', { level: 1, name: 'The Keep' })).toBeNull();
  });
});
