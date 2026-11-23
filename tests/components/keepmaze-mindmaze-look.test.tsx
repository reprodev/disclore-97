// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { DungeonViewport } from '../../src/components/DungeonViewport';
import { KeepMazeUI } from '../../src/components/KeepMazeUI';
import { saveBest } from '../../src/library/best';
import type { StorageLike } from '../../src/library/discLibrary';
import type { DiscManifest, Dungeon } from '../../src/model/manifest';

const disc: DiscManifest = {
  disc_id: 'mindmaze',
  title: 'MindMaze Disc',
  tagline: 'A tagline',
  sections: [
    { section_id: 'moat', title: 'The Moat', paragraphs: ['Water circles the keep. It was deep.'] },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above the moat.'] },
  ],
  diagrams: [],
  trivia: Array.from({ length: 4 }, (_, i) => ({
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

beforeEach(() => {
  setMuted(true);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  __setContextFactory(null);
});

type User = ReturnType<typeof userEvent.setup>;
const group = () => screen.getByRole('group', { name: 'Trivia question' });
const questionNumber = () => /Question number (\d)/.exec(group().querySelector('p')!.textContent!)![1];

async function setup(storage?: StorageLike) {
  const user = userEvent.setup();
  const view = render(<KeepMazeUI disc={disc} dungeon={dungeon} onOpenSection={() => {}} rng={() => 0.5} storage={storage} />);
  await user.click(screen.getByRole('button', { name: 'Start' }));
  return { user, ...view };
}
async function openDoor(user: User) {
  await user.click(screen.getByRole('button', { name: 'Great Hall' }));
}

// ---- Token rules, read from tokens.css ---------------------------------------------------------
const tokensCss = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
const ROOT_TOKENS = new Set([...tokensCss.slice(0, tokensCss.indexOf(':root.theme')).matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const HEX = new RegExp('#' + '[0-9a-fA-F]{3,8}\\b');

function paintsOf(svg: Element): string[] {
  const out: string[] = [];
  for (const el of svg.querySelectorAll('*')) {
    for (const attr of ['fill', 'stroke']) {
      const v = el.getAttribute(attr);
      if (v !== null) out.push(v);
    }
  }
  return out;
}

// ---- Enriched DungeonViewport room scene -------------------------------------------------------
describe('DungeonViewport medieval room scene', () => {
  const draw = (locked: boolean, victory = false) => {
    const { container } = render(<DungeonViewport locked={locked} victory={victory} label="Dungeon view" />);
    return container.querySelector('svg.viewport')!;
  };

  it('draws rafters, stone blocks, a woven rug, two arched oak side doors, a portrait, a tapestry, and two flickering torches', () => {
    const svg = draw(true);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Dungeon view');
    expect(svg.querySelectorAll('.viewport__rafters')).toHaveLength(1);
    expect(svg.querySelectorAll('.viewport__rafters polygon').length).toBeGreaterThanOrEqual(2);
    expect(svg.querySelectorAll('.viewport__block').length).toBeGreaterThanOrEqual(6);
    expect(svg.querySelectorAll('.viewport__rug polygon').length).toBeGreaterThanOrEqual(6);
    const sideDoors = svg.querySelectorAll('.viewport__side-door');
    expect(sideDoors).toHaveLength(2);
    for (const d of sideDoors) expect(d.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2); // arched top and ring pull
    expect(svg.querySelectorAll('.viewport__portrait')).toHaveLength(1);
    expect(svg.querySelectorAll('.viewport__tapestry')).toHaveLength(1);
    const torches = svg.querySelectorAll('.viewport__torch');
    expect(torches).toHaveLength(2);
    for (const t of torches) expect(t.querySelectorAll('.viewport__flame polygon')).toHaveLength(2);
  });

  it('paints only with tokens from tokens.css: no hex, gradients, filters, images, or text', () => {
    for (const [locked, victory] of [[true, false], [false, false], [false, true]] as const) {
      const svg = draw(locked, victory);
      const paints = paintsOf(svg);
      expect(paints.length).toBeGreaterThan(50);
      for (const p of paints) {
        if (p === 'none') continue;
        const m = /^var\((--color-[a-z0-9-]+)\)$/.exec(p);
        expect(m, `paint ${p}`).not.toBeNull();
        expect(ROOT_TOKENS.has(m![1]), `${m![1]} is defined in tokens.css`).toBe(true);
      }
      expect(svg.outerHTML).not.toMatch(HEX);
      expect(svg.querySelector('linearGradient, radialGradient, filter, image, text, foreignObject')).toBeNull();
      cleanup();
    }
  });

  it('keeps the door cues: a closed padlock when locked, an open shackle when not, and an open gold way on victory', () => {
    const gold = 'var(--color-gold)';
    const shackle = (svg: Element) =>
      Array.from(svg.querySelectorAll('rect')).filter(
        (r) => r.getAttribute('fill') === 'var(--color-bevel-shadow)' && Number(r.getAttribute('y')) >= 39 && Number(r.getAttribute('y')) <= 44 && Number(r.getAttribute('x')) >= 56 && Number(r.getAttribute('x')) <= 62,
      ).length;
    const locked = draw(true);
    const lockedShackle = shackle(locked);
    const lockBody = Array.from(locked.querySelectorAll('rect')).some(
      (r) => r.getAttribute('x') === '54' && r.getAttribute('y') === '46' && r.getAttribute('fill') === gold,
    );
    expect(lockBody).toBe(true);
    cleanup();
    const open = draw(false);
    expect(shackle(open)).not.toBe(lockedShackle);
    cleanup();
    const won = draw(false, true);
    expect(Array.from(won.querySelectorAll('rect')).some((r) => r.getAttribute('fill') === 'var(--color-crimson)' && r.getAttribute('x') === '54')).toBe(true);
    // The way is open: no padlock body on the victory view.
    expect(Array.from(won.querySelectorAll('rect')).some((r) => r.getAttribute('x') === '54' && r.getAttribute('y') === '46')).toBe(false);
  });

  it('flickers the torches in CSS steps and stops them for reduced motion', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/keepmaze.css'), 'utf8');
    expect(css).toMatch(/\.viewport__flame\s*\{[^}]*animation: torch-flicker [^;]*steps\(/);
    expect(css.slice(css.indexOf('prefers-reduced-motion: reduce'))).toMatch(/\.viewport__flame\s*\{\s*animation: none;/);
  });

  it('in the game, the room title and description stay beside the enriched scene', async () => {
    const { user } = await setup();
    expect(screen.getByRole('img', { name: 'Dungeon view: a door' })).toBeTruthy();
    expect(screen.getByText('Gate')).toBeTruthy();
    expect(screen.getByText('A cold gate.')).toBeTruthy();
    await openDoor(user);
    expect(screen.getByRole('img', { name: 'Dungeon view: a locked door' })).toBeTruthy();
  });
});

// ---- Illuminated Q card and A/B/C/D answer strips ----------------------------------------------
describe('illuminated manuscript question card', () => {
  it('shows a decorative drop-cap Q beside the prompt and Peek Hint, hidden from assistive technology', async () => {
    const { user } = await setup();
    await openDoor(user);
    const g = group();
    expect(g.className).toContain('keepmaze__question--manuscript');
    const cap = g.querySelector('.keepmaze__dropcap')!;
    expect(cap.tagName).toBe('SPAN');
    expect(cap.textContent).toBe('Q');
    expect(cap.getAttribute('aria-hidden')).toBe('true');
    // The drop cap comes first, and the prompt is still the group's first paragraph.
    expect(g.firstElementChild).toBe(cap);
    expect(g.querySelector('p')!.textContent).toMatch(/^Question number \d\?$/);
    expect(within(g).getByRole('button', { name: 'Peek Hint' })).toBeTruthy();
  });

  it('leads each answer strip with an aria-hidden A. B. C. D. badge, and names the button by its option text', async () => {
    const { user } = await setup();
    await openDoor(user);
    const n = questionNumber();
    const options = [`Q${n} wrong A`, `Q${n} right`, `Q${n} wrong B`, `Q${n} wrong C`];
    const buttons = options.map((name) => within(group()).getByRole('button', { name }));
    expect(buttons.map((b) => b.querySelector('.keepmaze__letter')!.textContent)).toEqual(['A.', 'B.', 'C.', 'D.']);
    for (const b of buttons) {
      const badge = b.querySelector('.keepmaze__letter')!;
      expect(badge.getAttribute('aria-hidden')).toBe('true');
      expect(b.firstElementChild).toBe(badge);
      expect(b.textContent).toBe(`${badge.textContent}${options[buttons.indexOf(b)]}`);
    }
    // Answering by name still works through the badge.
    await user.click(buttons[1]!);
    expect(screen.queryByRole('group', { name: 'Trivia question' })).toBeNull();
  });

  it('frames the card in stepped navy, gold, and burgundy borders on parchment, with square corners', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/keepmaze.css'), 'utf8');
    const rule = (sel: string) => new RegExp(`${sel.replace(/[.:]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const card = rule('.keepmaze__question--manuscript');
    expect(card).toContain('background: var(--color-parchment)');
    expect(card).toContain('border: 3px solid var(--color-title-bg)');
    expect(card).toContain('outline: 2px solid var(--color-gold)');
    expect(rule('.keepmaze__question--manuscript::before')).toContain('border: 1px solid var(--color-crimson)');
    const cap = rule('.keepmaze__dropcap');
    expect(cap).toContain('font-family: var(--font-display)');
    expect(cap).toContain('border: 2px solid var(--color-title-bg)');
    expect(rule('.keepmaze__letter')).toContain('background: var(--color-title-bg)');
    expect(css).not.toMatch(HEX);
    expect(css).not.toMatch(/gradient\s*\(/);
    for (const m of css.matchAll(/border-radius\s*:\s*([^;]+)/g)) expect(m[1].trim()).toMatch(/^0(px)?$/);
  });
});

// ---- Torch rack and Score Medallion -------------------------------------------------------------
describe('torch rack and score medallion', () => {
  const rack = (c: HTMLElement) => c.querySelector('.keepmaze__trophy .torch-rack') as HTMLElement;
  const medallion = (c: HTMLElement) => c.querySelector('.keepmaze__trophy .medallion') as HTMLElement;

  it('is not shown before Start', () => {
    const { container } = render(<KeepMazeUI disc={disc} dungeon={dungeon} onOpenSection={() => {}} rng={() => 0.5} />);
    expect(container.querySelector('.keepmaze__trophy')).toBeNull();
  });

  it('shows three lit pixel torches and a P medallion beside the mini-map, as decoration only', async () => {
    const { container } = await setup();
    const trophy = container.querySelector('.keepmaze__trophy')!;
    expect(trophy.getAttribute('aria-hidden')).toBe('true');
    expect(trophy.previousElementSibling!.className).toContain('keepmaze__map');
    const slots = rack(container).querySelectorAll('.torch-rack__slot');
    expect(slots).toHaveLength(3);
    for (const s of slots) {
      expect(s.getAttribute('data-lit')).toBe('true');
      expect(s.querySelector('svg.pixel-icon')!.getAttribute('data-icon')).toBe('torch');
    }
    expect(medallion(container).querySelector('.medallion__letter')!.textContent).toBe('P');
    expect(medallion(container).querySelector('.medallion__score')!.textContent).toBe('0 pts');
    expect(medallion(container).textContent).toContain('Streak');
    expect(medallion(container).textContent).toContain('Best');
    expect(medallion(container).textContent).toContain('--');
  });

  it('tracks score and streak, and dims a spent torch to slate after a wrong answer', async () => {
    const { user, container } = await setup();
    await openDoor(user);
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
    expect(medallion(container).querySelector('.medallion__score')!.textContent).toBe('100 pts');
    expect(medallion(container).querySelectorAll('.medallion__value')[0]!.textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Throne' }));
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} wrong A` }));
    const lit = Array.from(rack(container).querySelectorAll('.torch-rack__slot')).map((s) => s.getAttribute('data-lit'));
    expect(lit).toEqual(['true', 'true', 'false']);
    expect(rack(container).getAttribute('data-lit-count')).toBe('2');
    expect(medallion(container).querySelector('.medallion__score')!.textContent).toBe('100 pts');
    expect(medallion(container).querySelectorAll('.medallion__value')[0]!.textContent).toBe('0');

    const css = readFileSync(resolve(__dirname, '../../src/styles/keepmaze.css'), 'utf8');
    expect(css).toMatch(/\.torch-rack__slot\s*\{[^}]*background: var\(--color-gold-dark\)/);
    expect(css).toMatch(/\.torch-rack__slot\[data-lit="false"\]\s*\{[^}]*background: var\(--color-stone-dark\)/);
  });

  it('shows the Personal Best on the medallion, and keeps the Quest card labels as they were', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'mindmaze', { bestScore: 210, bestRank: 'Royal Archivist' });
    const { container } = await setup(storage);
    expect(medallion(container).querySelectorAll('.medallion__value')[1]!.textContent).toBe('210 pts');
    const card = screen.getByRole('region', { name: 'KeepMaze Quest' });
    expect(within(card).getByText('Rooms explored: 1 of 3')).toBeTruthy();
    expect(within(card).getByText('Personal Best: 210 pts (Royal Archivist)')).toBeTruthy();
    expect(screen.getAllByText(/Personal Best:/)).toHaveLength(1);
    expect(Array.from(card.querySelectorAll('dt')).map((d) => d.textContent)).toEqual(['Score', 'Streak', 'Torches']);
    expect(within(card).getByRole('img', { name: '3 of 3 torches lit' })).toBeTruthy();
  });

  it('leaves the Victory view without the rack', async () => {
    const { user, container } = await setup();
    await openDoor(user);
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
    await user.click(screen.getByRole('button', { name: 'Throne' }));
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
    expect(screen.getByRole('region', { name: 'Victory Certificate' })).toBeTruthy();
    expect(container.querySelector('.keepmaze__trophy')).toBeNull();
  });
});
