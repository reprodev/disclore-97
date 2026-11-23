// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { DungeonViewport, ROOM_VARIANTS, roomVariant } from '../../src/components/DungeonViewport';
import type { RoomVariant } from '../../src/components/DungeonViewport';
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

// ---- Torch rack and Score Medallion: the only Score, Streak, Torches, and Personal Best -------
describe('torch rack and score medallion', () => {
  const trophy = (c: HTMLElement) => c.querySelector('.keepmaze__hud-cluster .keepmaze__trophy') as HTMLElement;
  const slots = (c: HTMLElement) => Array.from(trophy(c).querySelectorAll('.torch-rack__slot'));
  const statValue = (label: string) => {
    const card = screen.getByRole('region', { name: 'KeepMaze Quest' });
    return Array.from(card.querySelectorAll('dt')).find((d) => d.textContent === label)!.nextElementSibling!.textContent;
  };

  it('sits beside the mini-map and is readable, not decoration: three lit torches, a P coin, Score and Streak', async () => {
    const { container } = await setup();
    const t = trophy(container);
    expect(t.getAttribute('aria-hidden')).toBeNull();
    expect(t.previousElementSibling!.className).toContain('keepmaze__map');
    expect(slots(container)).toHaveLength(3);
    for (const s of slots(container)) {
      expect(s.getAttribute('data-lit')).toBe('true');
      expect(s.querySelector('svg.pixel-icon')!.getAttribute('data-icon')).toBe('torch');
    }
    expect(within(t).getByRole('img', { name: '3 of 3 torches lit' })).toBeTruthy();
    const coin = t.querySelector('svg.medallion__coin')!;
    expect(coin.getAttribute('aria-hidden')).toBe('true');
    expect(coin.querySelector('.medallion__letter')!.textContent).toBe('P');
    expect(statValue('Score')).toBe('0');
    expect(statValue('Streak')).toBe('0');
    expect(t.querySelector('.medallion__best--none')!.textContent).toBe('No best yet');
  });

  it('tracks score and streak, and dims a spent torch to slate after a wrong answer', async () => {
    const { user, container } = await setup();
    await openDoor(user);
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
    expect(statValue('Score')).toBe('100');
    expect(statValue('Streak')).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Throne' }));
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} wrong A` }));
    expect(slots(container).map((s) => s.getAttribute('data-lit'))).toEqual(['true', 'true', 'false']);
    expect(within(trophy(container)).getByRole('img', { name: '2 of 3 torches lit' })).toBeTruthy();
    expect(statValue('Score')).toBe('100');
    expect(statValue('Streak')).toBe('0');

    const css = readFileSync(resolve(__dirname, '../../src/styles/keepmaze.css'), 'utf8');
    expect(css).toMatch(/\.torch-rack__slot\s*\{[^}]*background: var\(--color-gold-dark\)/);
    expect(css).toMatch(/\.torch-rack__slot\[data-lit="false"\]\s*\{[^}]*background: var\(--color-stone-dark\)/);
    // "pts" is drawn by CSS, so the Score value stays a bare number for every existing test.
    expect(css).toMatch(/\.medallion__score dd::after\s*\{[^}]*content: " pts"/);
  });

  it('shows the Personal Best once, on the medallion', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'mindmaze', { bestScore: 210, bestRank: 'Royal Archivist' });
    const { container } = await setup(storage);
    expect(trophy(container).querySelector('.medallion__best')!.textContent).toBe('Personal Best: 210 pts (Royal Archivist)');
    expect(screen.getAllByText(/Personal Best:/)).toHaveLength(1);
    expect(trophy(container).querySelector('.medallion__best--none')).toBeNull();
  });
});

// ---- Hero stage and zero-dead-space console --------------------------------------------------
describe('hero stage and console layout', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/keepmaze.css'), 'utf8');
  const rule = (sel: string) => new RegExp(`(?:^|\\n)${sel.replace(/[.[\]"=>]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const panel = (c: HTMLElement) => c.querySelector('.keepmaze__console > .keepmaze__panel') as HTMLElement;

  it('puts the room panorama across the top and the console strip below it', async () => {
    const { container } = await setup();
    const root = container.querySelector('.keepmaze')!;
    expect(Array.from(root.children).map((el) => el.className.split(' ')[0])).toEqual(['keepmaze__stage', 'keepmaze__console']);
    expect(root.querySelector('.keepmaze__stage svg.viewport')!.getAttribute('viewBox')).toBe('0 0 440 200');
    const strip = screen.getByRole('region', { name: 'KeepMaze Quest' });
    expect(strip.className).toContain('keepmaze__console');
    expect(Array.from(strip.children).map((el) => el.className)).toEqual(['keepmaze__hud-cluster', 'keepmaze__panel']);
    const hud = strip.querySelector('.keepmaze__hud-cluster')!;
    expect(hud.querySelector('.keepmaze__map svg')).toBeTruthy();
    expect(within(hud as HTMLElement).getByRole('list', { name: 'Mini-map legend' }).textContent).toBe('CurrentVisitedUnexplored');
    expect(within(hud as HTMLElement).getByText('Rooms explored: 1 of 3')).toBeTruthy();
  });

  it('sizes the stage as a wide panorama and lets the console fill the rest of the pane', () => {
    const stage = rule('.keepmaze__stage');
    expect(stage).toContain('aspect-ratio: 440 / 200');
    expect(stage).toContain('min-height: 200px');
    expect(stage).toContain('max-height: 300px');
    expect(rule('.keepmaze')).toContain('min-height: 100%');
    expect(rule('.keepmaze')).toContain('background: var(--color-dungeon-bg)');
    expect(rule('.keepmaze__console')).toContain('flex: 1 1 auto');
    expect(rule('.keepmaze > .certificate')).toContain('flex: 1 1 auto');
    expect(rule('.viewport')).toContain('height: 100%');
  });

  it('shows a styled Welcome card in the ivory panel before Start, with the HUD already in place', () => {
    const { container } = render(<KeepMazeUI disc={disc} dungeon={dungeon} onOpenSection={() => {}} rng={() => 0.5} />);
    const p = panel(container);
    expect(p.getAttribute('data-mode')).toBe('welcome');
    expect(p.querySelector('.quest-card__title')!.textContent).toBe('KeepMaze Quest');
    const welcome = p.querySelector('.keepmaze__panel-body .keepmaze__welcome') as HTMLElement;
    expect(within(welcome).getByRole('heading', { level: 2, name: 'Test Keep' })).toBeTruthy();
    expect(within(welcome).getByText(/Reach the Throne Room/)).toBeTruthy();
    expect(within(welcome).getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(container.querySelector('.keepmaze__hud-cluster .keepmaze__trophy')).toBeTruthy();
  });

  it('shows the room card with Moves, Incorrect, Restart, and Exits in the same panel while exploring', async () => {
    const { container } = await setup();
    const p = panel(container);
    expect(p.getAttribute('data-mode')).toBe('room');
    const card = p.querySelector('.keepmaze__panel-body .keepmaze__room-card') as HTMLElement;
    expect(within(card).getByText('Gate')).toBeTruthy();
    expect(within(card).getByText('A cold gate.')).toBeTruthy();
    expect(within(card).getByText('Moves: 0')).toBeTruthy();
    expect(within(card).getByText('Incorrect: 0')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Restart' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Great Hall' })).toBeTruthy();
  });

  it('shows the illuminated Q card in the same panel during a question, with the exits kept as context', async () => {
    const { user, container } = await setup();
    await openDoor(user);
    const p = panel(container);
    expect(p.getAttribute('data-mode')).toBe('question');
    const body = p.querySelector('.keepmaze__panel-body')!;
    expect(body.querySelector('.keepmaze__question--manuscript .keepmaze__dropcap')).toBeTruthy();
    const exit = within(body.querySelector('.keepmaze__room-card') as HTMLElement).getByRole('button', { name: 'Great Hall' });
    expect((exit as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses one ivory manuscript look for every panel: navy caption bar, gold and burgundy trim', () => {
    const p = rule('.keepmaze__panel');
    expect(p).toContain('background: var(--color-paper)');
    expect(p).toContain('border: 2px solid var(--color-title-bg)');
    const bar = rule('.quest-card__title');
    expect(bar).toContain('background: var(--color-title-bg)');
    expect(bar).toContain('border-bottom: 2px solid var(--color-gold)');
    const body = rule('.keepmaze__panel-body');
    expect(body).toContain('border: 1px solid var(--color-crimson)');
    expect(body).toContain('outline: 1px solid var(--color-gold)');
    const plaque = rule('.keepmaze__trophy');
    expect(plaque).toContain('background: var(--color-paper)');
    expect(plaque).toContain('border: 2px solid var(--color-gold-dark)');
    expect(plaque).toContain('outline: 1px solid var(--color-crimson)');
  });

  it('never shows Score, Streak, Torches, Rooms explored, or Personal Best twice', async () => {
    const storage = memoryStorage();
    saveBest(storage, 'mindmaze', { bestScore: 210, bestRank: 'Royal Archivist' });
    const { user, container } = await setup(storage);
    const check = () => {
      const labels = Array.from(container.querySelectorAll('dt')).map((d) => d.textContent);
      expect(labels.filter((l) => l === 'Score')).toHaveLength(1);
      expect(labels.filter((l) => l === 'Streak')).toHaveLength(1);
      expect(labels.filter((l) => l === 'Torches')).toHaveLength(1);
      expect(screen.getAllByRole('img', { name: /torches lit$/ })).toHaveLength(1);
      expect(screen.getAllByText(/^Rooms explored:/)).toHaveLength(1);
      expect(screen.getAllByText(/Personal Best:/)).toHaveLength(1);
      expect(container.querySelectorAll('.medallion__coin')).toHaveLength(1);
    };
    check();
    await openDoor(user);
    check();
  });

  it('gives the Victory view the stage and the certificate, without the console', async () => {
    const { user, container } = await setup();
    await openDoor(user);
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
    await user.click(screen.getByRole('button', { name: 'Throne' }));
    await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
    const cert = screen.getByRole('region', { name: 'Victory Certificate' });
    expect(screen.queryByRole('region', { name: 'KeepMaze Quest' })).toBeNull();
    expect(container.querySelector('.keepmaze__stage svg.viewport')).toBeTruthy();
    expect(within(cert).getByRole('button', { name: 'Restart' })).toBeTruthy();
  });
});

// ---- Room variants -------------------------------------------------------------------------------
describe('room scene variants', () => {
  const svgOf = (variant: RoomVariant, locked = true) => {
    const { container } = render(<DungeonViewport locked={locked} label="Dungeon view" variant={variant} />);
    return container.querySelector('svg.viewport')!;
  };

  it('picks a scene from the room name, then the reserved ids, then a stable hash', () => {
    const cases: [string, string, RoomVariant][] = [
      ['entrance', 'Drawbridge Gate', 'gate'],
      ['gatehouse', 'Gatehouse Passage', 'gate'],
      ['cellar', 'Storage Cellar', 'passage'],
      ['graveyard_path', 'Graveyard Path', 'passage'],
      ['spectral_library', 'Spectral Library', 'library'],
      ['solar', 'Solar Chamber', 'library'],
      ['watchtower', 'Round Watchtower', 'tower'],
      ['crypt_stairs', 'Crypt Stairs', 'tower'],
      ['great_hall', 'Great Hall', 'hall'],
      ['throne_room', 'The Last Lantern', 'hall'],
      ['entrance', 'Power-On Foyer', 'gate'],
    ];
    for (const [room_id, name, want] of cases) expect(roomVariant({ room_id, name }), name).toBe(want);
    expect(roomVariant(undefined)).toBe('hall');
  });

  it('gives compiled "Hall of <article>" rooms varied, deterministic scenes', () => {
    const rooms = Array.from({ length: 10 }, (_, i) => ({ room_id: `room-${i + 1}`, name: `Hall of Topic ${i + 1}` }));
    const first = rooms.map(roomVariant);
    expect(rooms.map(roomVariant)).toEqual(first);
    expect(new Set(first).size).toBeGreaterThanOrEqual(3);
    for (const v of first) expect(ROOM_VARIANTS).toContain(v);
    // A keyword in the article title still wins over the hash.
    expect(roomVariant({ room_id: 'room-x', name: 'Hall of the Old Library' })).toBe('library');
  });

  it('draws each variant with its own furniture', () => {
    const marks: Record<RoomVariant, [string, number][]> = {
      gate: [['.viewport__portcullis', 2], ['.viewport__chain', 2], ['.viewport__drawbridge', 1], ['.viewport__archway', 1]],
      passage: [['.viewport__vault circle', 4], ['.viewport__grating', 2], ['.viewport__wall-chain', 2], ['.viewport__moss', 1]],
      library: [['.viewport__shelf', 2], ['.viewport__book', 30], ['.viewport__lectern', 1]],
      tower: [['.viewport__lancet', 1], ['.viewport__star', 6], ['.viewport__moon', 1], ['.viewport__stair', 1], ['.viewport__banner', 1]],
      hall: [['.viewport__rafters', 1], ['.viewport__rug', 1], ['.viewport__portrait', 1], ['.viewport__tapestry', 1], ['.viewport__side-door', 2]],
    };
    for (const variant of ROOM_VARIANTS) {
      const svg = svgOf(variant);
      expect(svg.getAttribute('data-variant')).toBe(variant);
      expect(svg.querySelectorAll(`.viewport__scene--${variant}`)).toHaveLength(1);
      for (const [sel, min] of marks[variant]) {
        expect(svg.querySelectorAll(sel).length, `${variant} ${sel}`).toBeGreaterThanOrEqual(min);
      }
      // Furniture from the other scenes does not leak in.
      for (const other of ROOM_VARIANTS.filter((o) => o !== variant)) {
        expect(svg.querySelector(marks[other][0]![0]), `${variant} has no ${marks[other][0]![0]}`).toBeNull();
      }
      cleanup();
    }
    // The library's scroll cubbies and the tower's night sky.
    const lib = svgOf('library');
    expect(Array.from(lib.querySelectorAll('.viewport__shelf circle')).some((c) => c.getAttribute('fill') === 'var(--color-parchment)')).toBe(true);
    cleanup();
    const tower = svgOf('tower');
    expect(tower.querySelector('.viewport__lancet polygon[fill="var(--color-night)"]')).toBeTruthy();
  });

  it('keeps the central door, its padlock cue, and two torches in every variant, in tokens only', () => {
    for (const variant of ROOM_VARIANTS) {
      for (const [locked, state] of [[true, 'locked'], [false, 'open']] as const) {
        const svg = svgOf(variant, locked);
        expect(svg.querySelectorAll('.viewport__door')).toHaveLength(1);
        expect(svg.querySelector('.viewport__padlock')!.getAttribute('data-state')).toBe(state);
        expect(svg.querySelectorAll('.viewport__torch')).toHaveLength(2);
        for (const p of paintsOf(svg)) {
          if (p === 'none') continue;
          const m = /^var\((--color-[a-z0-9-]+)\)$/.exec(p);
          expect(m, `${variant} paint ${p}`).not.toBeNull();
          expect(ROOT_TOKENS.has(m![1]), `${m![1]} is defined in tokens.css`).toBe(true);
        }
        expect(svg.outerHTML).not.toMatch(HEX);
        expect(svg.querySelector('linearGradient, radialGradient, filter, image, text, foreignObject')).toBeNull();
        cleanup();
      }
    }
    const { container } = render(<DungeonViewport locked={false} victory label="Dungeon view" variant="library" />);
    expect(container.querySelector('.viewport__padlock')).toBeNull();
  });

  it('changes the scene as the player moves from room to room', async () => {
    const tourDungeon: Dungeon = {
      dungeon_id: 'tour',
      title: 'Tour Keep',
      rooms: [
        { room_id: 'entrance', name: 'Drawbridge Gate', description: 'The gate.', exits: [{ to: 'tunnel' }] },
        { room_id: 'tunnel', name: 'Damp Corridor', description: 'A corridor.', exits: [{ to: 'books' }] },
        { room_id: 'books', name: 'Old Library', description: 'Shelves.', exits: [{ to: 'spire' }] },
        { room_id: 'spire', name: 'North Tower', description: 'A tower.', exits: [{ to: 'throne_room' }] },
        { room_id: 'throne_room', name: 'Throne Hall', description: 'The throne.', exits: [{ to: 'spire' }] },
      ],
    };
    const user = userEvent.setup();
    const { container } = render(<KeepMazeUI disc={disc} dungeon={tourDungeon} onOpenSection={() => {}} rng={() => 0.5} />);
    const variant = () => container.querySelector('.keepmaze__stage svg.viewport')!.getAttribute('data-variant');
    expect(variant()).toBe('gate');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const seen = [variant()];
    for (const next of ['Damp Corridor', 'Old Library', 'North Tower', 'Throne Hall']) {
      await user.click(screen.getByRole('button', { name: next }));
      await user.click(screen.getByRole('button', { name: `Q${questionNumber()} right` }));
      seen.push(variant());
    }
    expect(seen).toEqual(['gate', 'passage', 'library', 'tower', 'hall']);
    expect(screen.getByRole('img', { name: 'Dungeon view: the way is open' })).toBeTruthy();
  });
});
