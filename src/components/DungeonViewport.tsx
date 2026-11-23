import type { ReactElement } from 'react';

/** The five room scenes a KeepMaze room can be drawn as. */
export type RoomVariant = 'gate' | 'passage' | 'library' | 'tower' | 'hall';
export const ROOM_VARIANTS: readonly RoomVariant[] = ['gate', 'passage', 'library', 'tower', 'hall'];

export interface DungeonViewportProps {
  /** True while a door is locked (a question is pending or the game has not started). */
  locked: boolean;
  /** True when the player has reached the throne room. */
  victory?: boolean;
  label: string;
  /** Which room scene surrounds the central door. Defaults to the great hall. */
  variant?: RoomVariant;
}

/** Name keywords, checked in order: the first match picks the scene. */
const VARIANT_RULES: readonly (readonly [RoomVariant, RegExp])[] = [
  ['gate', /entrance|gate|drawbridge|portcullis|barbican|moat|bridge|foyer|dock/],
  ['tower', /tower|turret|spire|belfry|stair|observ|battlement|rampart|wall walk|roof|bell/],
  ['library', /librar|archive|reading|scriptor|study|book|scroll|stacks|annex|chronicle|solar/],
  ['passage', /passage|corridor|tunnel|crypt|cellar|vault|catacomb|path|maze|undercroft|storage|closet|armou?ry|bay|lab\b/],
  ['hall', /hall|throne|chamber|feast|court|chapel|parlou?r|lounge|gallery|clearing|patch/],
];

/** FNV-1a, 32-bit: a small, stable string hash for the fallback scene. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Picks a room's scene, deterministically. The room name decides first (a "Gatehouse" is a gate, a
 * "Spectral Library" a library). Compiled rooms are all named "Hall of <article>", so that generic
 * prefix is ignored. Then the reserved ids decide (the entrance is a gate, the throne room a hall), and
 * anything else gets a scene from a hash of its id, so the rooms of one dungeon do not all look alike.
 */
export function roomVariant(room: { room_id: string; name: string } | undefined): RoomVariant {
  if (!room) return 'hall';
  const name = room.name.toLowerCase().replace(/^hall of\s+/, '');
  const id = room.room_id.toLowerCase().replace(/[_-]+/g, ' ');
  for (const text of [name, id]) {
    for (const [variant, re] of VARIANT_RULES) if (re.test(text)) return variant;
  }
  return ROOM_VARIANTS[fnv1a(room.room_id) % ROOM_VARIANTS.length]!;
}

/** Every paint in the scene is a token from tokens.css. No hex values, no gradients. */
const T = {
  wall: 'var(--color-stone-dark)',
  brick: 'var(--color-stone)',
  block: 'var(--color-dungeon-stone)',
  arch: 'var(--color-stone-light)',
  void: 'var(--color-bevel-edge)',
  door: 'var(--color-wood)',
  doorDark: 'var(--color-wood-dark)',
  doorLight: 'var(--color-wood-light)',
  iron: 'var(--color-bevel-shadow)',
  gold: 'var(--color-gold)',
  goldDark: 'var(--color-gold-dark)',
  goldLight: 'var(--color-gold-light)',
  flame: 'var(--color-flame)',
  flameHot: 'var(--color-flame-hot)',
  floor: 'var(--color-stone)',
  floorDark: 'var(--color-stone-dark)',
  crimson: 'var(--color-crimson)',
  crimsonDark: 'var(--color-crimson-dark)',
  navy: 'var(--color-title-bg)',
  parchment: 'var(--color-parchment)',
  night: 'var(--color-night)',
  nightLight: 'var(--color-night-light)',
  moss: 'var(--color-forest-dark)',
  dungeonBg: 'var(--color-dungeon-bg)',
  plaster: 'var(--color-parchment-dark)',
  plasterLight: 'var(--color-parchment-tint)',
  forest: 'var(--color-forest)',
  sky: 'var(--color-sky-deep)',
};

type Pt = readonly [number, number];
const pts = (p: readonly Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

const W = 440;
const H = 200;
/** The floor line: the central door and every scene stand on it. */
const FLOOR = 155;

/**
 * The wall and floor run past the 440 x 200 frame on every side (the bleed). The view letterboxes
 * with `meet`, so on a pane wider or taller than the scene the bleed shows as more stone, never an
 * empty band, and nothing inside the frame is ever cropped.
 */
const BLEED_X = 400;
const BLEED_Y = 64;
/** Left edge and full width of the bleed, for anything that spans the whole painted area. */
const LEFT = -BLEED_X;
const SPAN = W + 2 * BLEED_X;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** What a stone wall is made of: its face, its mortar joints, and its occasional dressed blocks. */
interface Stone {
  face: string;
  mortar: string;
  dressed: string;
}
const GREY_STONE: Stone = { face: T.wall, mortar: T.brick, dressed: T.block };
const SLATE_STONE: Stone = { face: T.dungeonBg, mortar: T.block, dressed: T.wall };
const PALE_STONE: Stone = { face: T.brick, mortar: T.wall, dressed: T.arch };

/**
 * A stone-block wall from `top` to `bottom`, across the whole bleed. `every` sets how often a block is
 * a dressed stone; `damp` adds moss and drips.
 */
function Wall({ stone, every, top = -BLEED_Y, bottom = FLOOR, damp = false }: { stone: Stone; every: number; top?: number; bottom?: number; damp?: boolean }) {
  const out: ReactElement[] = [<rect key="face" x={LEFT} y={top} width={SPAN} height={bottom - top} fill={stone.face} />];
  for (let row = 0, y = top; y < bottom; row++, y += 16) {
    const h = Math.min(15, bottom - y);
    if (y + 15 < bottom) out.push(<rect key={`h${row}`} x={LEFT} y={y + 15} width={SPAN} height={1} fill={stone.mortar} />);
    for (let x = LEFT + (row % 2 === 0 ? 0 : 16); x < W + BLEED_X; x += 32) {
      out.push(<rect key={`v${row}-${x}`} x={x} y={y} width={1} height={h} fill={stone.mortar} />);
      if (mod(row * 3 + x / 16, every) === 0) {
        out.push(<rect key={`b${row}-${x}`} className="viewport__block" x={x + 1} y={y} width={31} height={h} fill={stone.dressed} />);
      }
      // Damp stone: moss at the foot of some blocks, and a drip line.
      if (damp && mod(row * 5 + x / 16, 7) === 0 && h === 15) {
        out.push(<rect key={`m${row}-${x}`} className="viewport__moss" x={x + 4} y={y + 12} width={12} height={3} fill={T.moss} />);
        out.push(<rect key={`d${row}-${x}`} x={x + 20} y={y + 2} width={1} height={10} fill={T.sky} />);
      }
    }
  }
  return <g className="viewport__wall">{out}</g>;
}

type FloorKind = 'flags' | 'slate' | 'cobbles' | 'boards';

/** The floor, from the floor line down through the bleed, in one of four materials. */
function Floor({ kind }: { kind: FloorKind }) {
  const bottom = H + BLEED_Y;
  const face = kind === 'slate' ? T.block : kind === 'cobbles' ? T.arch : kind === 'boards' ? T.doorDark : T.floor;
  const line = kind === 'slate' ? T.dungeonBg : kind === 'cobbles' ? T.brick : kind === 'boards' ? T.door : T.floorDark;
  const marks: ReactElement[] = [];
  if (kind === 'cobbles') {
    // Rounded setts in staggered rows.
    for (let row = 0, y = FLOOR + 6; y < bottom; row++, y += 9) {
      for (let x = LEFT + (row % 2) * 7; x < W + BLEED_X; x += 14) {
        marks.push(<rect key={`c${row}-${x}`} x={x + 1} y={y} width={11} height={6} fill={line} />);
        marks.push(<rect key={`ch${row}-${x}`} x={x + 3} y={y + 1} width={5} height={1} fill={T.floor} />);
      }
    }
  } else if (kind === 'boards') {
    // Long oak boards running towards the door, with staggered butt joints.
    for (let y = FLOOR + 8; y < bottom; y += 8) marks.push(<rect key={`bl${y}`} x={LEFT} y={y} width={SPAN} height={1} fill={line} />);
    for (let row = 0, y = FLOOR + 3; y < bottom; row++, y += 8) {
      for (let x = LEFT + mod(row * 37, 96); x < W + BLEED_X; x += 96) marks.push(<rect key={`bj${row}-${x}`} x={x} y={y} width={1} height={5} fill={line} />);
    }
  } else {
    for (let i = LEFT / 32; i < (W + BLEED_X) / 32; i++) {
      marks.push(<rect key={`t${i}`} x={i * 32 + mod(i, 2) * 6} y={FLOOR + 22} width={1} height={bottom - FLOOR - 22} fill={line} />);
    }
    marks.push(<rect key="r1" x={LEFT} y={FLOOR + 22} width={SPAN} height={1} fill={line} />);
    marks.push(<rect key="r2" x={LEFT} y={H + 20} width={SPAN} height={1} fill={line} />);
  }
  return (
    <g className={`viewport__floor viewport__floor--${kind}`}>
      <rect x={LEFT} y={FLOOR} width={SPAN} height={bottom - FLOOR} fill={face} />
      <rect x={LEFT} y={FLOOR} width={SPAN} height={3} fill={line} />
      {marks}
    </g>
  );
}

/** Deterministic star field for the open-sky scenes. */
function stars(count: number, x0: number, x1: number, y0: number, y1: number, cls: string): ReactElement[] {
  const out: ReactElement[] = [];
  for (let k = 0; k < count; k++) {
    const x = x0 + mod(k * 97 + 13, x1 - x0);
    const y = y0 + mod(k * 53 + 7, y1 - y0);
    out.push(<rect key={`${cls}${k}`} className={cls} x={x} y={y} width={2} height={2} fill={k % 3 === 0 ? T.parchment : T.goldLight} />);
  }
  return out;
}

/** A wall torch: an oak haft, an iron cup, a flat glow, and a two-tone flame that flickers in CSS steps. */
function Torch({ x }: { x: number }) {
  return (
    <g className="viewport__torch" transform={`translate(${x} 0) scale(2)`}>
      <rect x={-1} y={34} width={3} height={14} fill={T.doorDark} />
      <rect x={-3} y={32} width={7} height={3} fill={T.iron} />
      <g className="viewport__flame">
        <circle cx={0.5} cy={27} r={8} fill={T.flame} opacity={0.18} />
        <polygon points={pts([[-4, 32], [0.5, 18], [5, 32]])} fill={T.flame} />
        <polygon points={pts([[-2, 32], [0.5, 23], [3, 32]])} fill={T.flameHot} />
      </g>
    </g>
  );
}

/** The central door in its stone arch, locked (padlock) or open, or the open gold way on victory. */
function CentralDoor({ locked, victory }: { locked: boolean; victory: boolean }) {
  // Drawn in the original 120 x 80 door space, scaled 2.5x about the room's centre line.
  return (
    <g className="viewport__door" transform="translate(70 0) scale(2.5)">
      <rect x={34} y={30} width={52} height={32} fill={T.arch} />
      <circle cx={60} cy={30} r={26} fill={T.arch} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={34 + (i % 2) * 2} y={34 + i * 4} width={4} height={2} fill={T.brick} />
      ))}
      <circle cx={60} cy={32} r={21} fill={T.void} />
      <rect x={39} y={32} width={42} height={30} fill={T.void} />

      {victory ? (
        <>
          <rect x={41} y={30} width={38} height={32} fill={T.goldDark} />
          <circle cx={60} cy={32} r={19} fill={T.goldDark} />
          <rect x={47} y={34} width={26} height={28} fill={T.gold} />
          <circle cx={60} cy={36} r={13} fill={T.gold} />
          <rect x={54} y={44} width={12} height={18} fill={T.crimson} />
          <rect x={52} y={40} width={16} height={5} fill={T.goldDark} />
        </>
      ) : (
        <>
          <rect x={41} y={32} width={38} height={30} fill={T.door} />
          <circle cx={60} cy={34} r={19} fill={T.door} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={46 + i * 6} y={18} width={1} height={44} fill={T.doorDark} />
          ))}
          <rect x={41} y={40} width={38} height={4} fill={T.iron} />
          <rect x={41} y={54} width={38} height={4} fill={T.iron} />
          <rect x={43} y={41} width={2} height={2} fill={T.doorLight} />
          <rect x={75} y={41} width={2} height={2} fill={T.doorLight} />
          <rect x={43} y={55} width={2} height={2} fill={T.doorLight} />
          <rect x={75} y={55} width={2} height={2} fill={T.doorLight} />
          {locked ? (
            <g className="viewport__padlock" data-state="locked">
              <rect x={56} y={44} width={8} height={2} fill={T.iron} />
              <rect x={56} y={42} width={2} height={4} fill={T.iron} />
              <rect x={62} y={42} width={2} height={4} fill={T.iron} />
              <rect x={54} y={46} width={12} height={9} fill={T.gold} />
              <rect x={54} y={46} width={12} height={2} fill={T.goldDark} />
              <rect x={59} y={49} width={2} height={4} fill={T.void} />
            </g>
          ) : (
            <g className="viewport__padlock" data-state="open">
              <rect x={62} y={39} width={2} height={7} fill={T.iron} />
              <rect x={56} y={39} width={8} height={2} fill={T.iron} />
              <rect x={54} y={46} width={12} height={9} fill={T.gold} />
              <rect x={59} y={49} width={2} height={4} fill={T.void} />
            </g>
          )}
        </>
      )}
    </g>
  );
}

// ---- hall: timber rafters, a woven rug, a framed portrait, a navy tapestry, twin side doors ----

/** An arched oak side door in a stone frame, with planks, iron straps, and a ring pull. */
function SideDoor({ cx }: { cx: number }) {
  return (
    <g className="viewport__side-door">
      <rect x={cx - 22} y={95} width={44} height={FLOOR - 95} fill={T.arch} />
      <circle cx={cx} cy={95} r={22} fill={T.arch} />
      <rect x={cx - 17} y={95} width={34} height={FLOOR - 95} fill={T.door} />
      <circle cx={cx} cy={95} r={17} fill={T.door} />
      {[-9, -1, 7].map((dx) => (
        <rect key={dx} x={cx + dx} y={80} width={2} height={FLOOR - 80} fill={T.doorDark} />
      ))}
      <rect x={cx - 17} y={106} width={34} height={4} fill={T.iron} />
      <rect x={cx - 17} y={138} width={34} height={4} fill={T.iron} />
      <circle cx={cx + 9} cy={124} r={4} fill="none" stroke={T.goldDark} />
    </g>
  );
}

/** A heraldic shield on the plaster, for the hall's side walls. */
function Shield({ cx, field, charge }: { cx: number; field: string; charge: string }) {
  return (
    <g className="viewport__shield">
      <polygon points={pts([[cx - 14, 40], [cx + 14, 40], [cx + 14, 60], [cx, 76], [cx - 14, 60]])} fill={T.goldDark} />
      <polygon points={pts([[cx - 11, 43], [cx + 11, 43], [cx + 11, 59], [cx, 72], [cx - 11, 59]])} fill={field} />
      <rect x={cx - 2} y={45} width={4} height={24} fill={charge} />
      <rect x={cx - 9} y={53} width={18} height={4} fill={charge} />
    </g>
  );
}

/** Warm plaster above a stone wainscot, crossed by half-timber posts, with a wooden chair rail. */
function HallWalls() {
  const posts: ReactElement[] = [];
  for (let x = LEFT + 20; x < W + BLEED_X; x += 120) {
    posts.push(<rect key={`p${x}`} x={x} y={12} width={6} height={86} fill={T.doorDark} />);
  }
  const cracks: ReactElement[] = [];
  for (let k = 0; k < 18; k++) {
    const x = LEFT + mod(k * 131 + 40, SPAN);
    const y = 24 + mod(k * 29, 60);
    cracks.push(<rect key={`k${k}`} x={x} y={y} width={8} height={1} fill={T.plasterLight} />);
  }
  return (
    <g className="viewport__plaster">
      <rect x={LEFT} y={-BLEED_Y} width={SPAN} height={BLEED_Y + 100} fill={T.plaster} />
      {cracks}
      {posts}
      <Wall stone={GREY_STONE} every={5} top={100} />
      <rect className="viewport__chair-rail" x={LEFT} y={96} width={SPAN} height={4} fill={T.door} />
      <rect x={LEFT} y={99} width={SPAN} height={1} fill={T.doorDark} />
    </g>
  );
}

function HallScene() {
  const fringe: ReactElement[] = [];
  for (let x = 122; x <= 316; x += 8) fringe.push(<rect key={`f${x}`} x={x} y={198} width={2} height={2} fill={T.parchment} />);
  return (
    <>
      <HallWalls />
      <Floor kind="flags" />
      <Shield cx={-90} field={T.crimson} charge={T.gold} />
      <Shield cx={-250} field={T.navy} charge={T.gold} />
      <Shield cx={530} field={T.navy} charge={T.gold} />
      <Shield cx={690} field={T.crimson} charge={T.gold} />
      <g className="viewport__rug">
        <polygon points={pts([[150, 165], [290, 165], [320, 198], [120, 198]])} fill={T.crimson} />
        <polygon points={pts([[156, 168], [284, 168], [310, 195], [130, 195]])} fill={T.goldDark} />
        <polygon points={pts([[162, 171], [278, 171], [300, 192], [140, 192]])} fill={T.crimsonDark} />
        <line x1={140} y1={181} x2={300} y2={181} stroke={T.gold} />
        {[180, 220, 260].map((x) => (
          <polygon key={x} points={pts([[x, 175], [x + 9, 181], [x, 187], [x - 9, 181]])} fill={T.gold} />
        ))}
        {[200, 240].map((x) => (
          <polygon key={x} points={pts([[x, 177], [x + 4, 181], [x, 185], [x - 4, 181]])} fill={T.navy} />
        ))}
        {fringe}
      </g>
      <g className="viewport__portrait">
        <rect x={84} y={34} width={36} height={42} fill={T.goldDark} />
        <rect x={87} y={37} width={30} height={36} fill={T.gold} />
        <rect x={90} y={40} width={24} height={30} fill={T.parchment} />
        <polygon points={pts([[92, 70], [102, 57], [112, 70]])} fill={T.navy} />
        <circle cx={102} cy={52} r={5} fill={T.doorLight} />
        <rect x={97} y={45} width={10} height={3} fill={T.crimson} />
      </g>
      <g className="viewport__tapestry">
        <rect x={316} y={20} width={40} height={3} fill={T.doorDark} />
        <polygon points={pts([[320, 23], [352, 23], [352, 88], [336, 78], [320, 88]])} fill={T.navy} />
        <line x1={324} y1={26} x2={324} y2={82} stroke={T.gold} />
        <line x1={348} y1={26} x2={348} y2={82} stroke={T.gold} />
        <polygon points={pts([[336, 34], [345, 50], [336, 66], [327, 50]])} fill={T.gold} />
        <circle cx={336} cy={50} r={3} fill={T.crimson} />
      </g>
      <SideDoor cx={48} />
      <SideDoor cx={392} />
    </>
  );
}

/** The hall's ceiling sits in front of the central arch. */
function HallFront() {
  const joists: ReactElement[] = [];
  for (let x = 6 - 28 * 15; x < W + BLEED_X; x += 28) {
    joists.push(<rect key={`j${x}`} x={x} y={12} width={10} height={6} fill={T.door} />);
    joists.push(<rect key={`jd${x}`} x={x} y={16} width={10} height={2} fill={T.doorDark} />);
  }
  return (
    <>
      <g className="viewport__rafters">
        {/* The ceiling boards run up into the bleed above the frame. */}
        <rect x={-BLEED_X} y={-BLEED_Y} width={W + 2 * BLEED_X} height={BLEED_Y + 12} fill={T.doorDark} />
        <rect x={-BLEED_X} y={10} width={W + 2 * BLEED_X} height={2} fill={T.door} />
        {joists}
        <polygon points={pts([[0, 12], [36, 12], [0, 42]])} fill={T.door} />
        <polygon points={pts([[W, 12], [W - 36, 12], [W, 42]])} fill={T.door} />
        <line x1={0} y1={42} x2={36} y2={12} stroke={T.doorDark} />
        <line x1={W} y1={42} x2={W - 36} y2={12} stroke={T.doorDark} />
      </g>
    </>
  );
}

// ---- gate: a voussoir archway, two iron portcullises, drawbridge chains and planks ----

function Portcullis({ x, w, raisedTo }: { x: number; w: number; raisedTo: number }) {
  const bars: ReactElement[] = [];
  for (let bx = x + 4; bx < x + w; bx += 10) {
    bars.push(<rect key={`b${bx}`} x={bx} y={56} width={2} height={raisedTo - 56} fill={T.iron} />);
    bars.push(<polygon key={`s${bx}`} points={pts([[bx - 1, raisedTo], [bx + 3, raisedTo], [bx + 1, raisedTo + 5]])} fill={T.iron} />);
  }
  for (let by = 64; by < raisedTo; by += 14) bars.push(<rect key={`r${by}`} x={x} y={by} width={w} height={2} fill={T.iron} />);
  return (
    <g className="viewport__portcullis">
      <rect x={x - 6} y={48} width={w + 12} height={FLOOR - 48} fill={T.arch} />
      <circle cx={x + w / 2} cy={56} r={w / 2 + 6} fill={T.arch} />
      <rect x={x} y={56} width={w} height={FLOOR - 56} fill={T.void} />
      <circle cx={x + w / 2} cy={56} r={w / 2} fill={T.void} />
      {bars}
    </g>
  );
}

function Chain({ from, to }: { from: Pt; to: Pt }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const links = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 9);
  const out: ReactElement[] = [<line key="l" x1={x1} y1={y1} x2={x2} y2={y2} stroke={T.iron} />];
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    out.push(<circle key={i} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r={2.5} fill="none" stroke={T.iron} />);
  }
  return <g className="viewport__chain">{out}</g>;
}

function GateScene() {
  const joints: ReactElement[] = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI + (k * Math.PI) / 12;
    const c = Math.cos(a);
    const s = Math.sin(a);
    joints.push(
      <line key={k} x1={220 + c * 66} y1={75 + s * 66} x2={220 + c * 76} y2={75 + s * 76} stroke={T.wall} />,
    );
  }
  const planks: ReactElement[] = [];
  for (let i = 1; i < 8; i++) planks.push(<line key={i} x1={160 + i * 15} y1={160} x2={140 + i * 20} y2={H} stroke={T.doorDark} />);
  // Crenellated curtain wall against the open night: merlons every 32 units along the wall top.
  const merlons: ReactElement[] = [];
  for (let x = LEFT; x < W + BLEED_X; x += 32) merlons.push(<rect key={`m${x}`} x={x} y={26} width={18} height={14} fill={T.wall} />);
  // The gatehouse rises above the curtain wall, with its own merlons.
  const towerMerlons: ReactElement[] = [];
  for (let x = 132; x < 308; x += 26) towerMerlons.push(<rect key={`t${x}`} x={x} y={-14} width={16} height={14} fill={T.wall} />);
  return (
    <>
      <g className="viewport__sky">
        <rect x={LEFT} y={-BLEED_Y} width={SPAN} height={BLEED_Y + 40} fill={T.sky} />
        {stars(34, LEFT, W + BLEED_X, -BLEED_Y + 4, 24, 'viewport__sky-star')}
      </g>
      <g className="viewport__battlements">
        {merlons}
        <rect x={130} y={0} width={180} height={40} fill={T.wall} />
        {towerMerlons}
      </g>
      <Wall stone={GREY_STONE} every={4} top={40} />
      <rect x={LEFT} y={40} width={SPAN} height={2} fill={T.brick} />
      <Floor kind="cobbles" />
      <Portcullis x={-130} w={80} raisedTo={FLOOR - 20} />
      <Portcullis x={490} w={80} raisedTo={100} />
      <g className="viewport__archway">
        <circle cx={220} cy={75} r={76} fill={T.brick} />
        <rect x={144} y={75} width={152} height={FLOOR - 75} fill={T.brick} />
        {joints}
        <polygon points={pts([[212, 0], [228, 0], [225, 11], [215, 11]])} fill={T.arch} />
      </g>
      <Portcullis x={30} w={80} raisedTo={118} />
      <Portcullis x={330} w={80} raisedTo={FLOOR - 6} />
      <g className="viewport__drawbridge">
        <polygon points={pts([[160, 158], [280, 158], [300, H], [140, H]])} fill={T.door} />
        {planks}
        <rect x={150} y={176} width={140} height={3} fill={T.iron} />
      </g>
    </>
  );
}

/** The drawbridge chains run from wall pulleys down to the bridge, in front of the arch. */
function GateFront() {
  return (
    <>
      <Chain from={[150, 28]} to={[166, 172]} />
      <Chain from={[290, 28]} to={[274, 172]} />
      <circle className="viewport__pulley" cx={150} cy={28} r={5} fill={T.iron} />
      <circle className="viewport__pulley" cx={290} cy={28} r={5} fill={T.iron} />
    </>
  );
}

// ---- passage: a vaulted corridor of damp stone, iron gratings, wall chains on brackets ----

function WallChain({ x }: { x: number }) {
  const links: ReactElement[] = [];
  for (let i = 0; i < 6; i++) links.push(<circle key={i} cx={x} cy={90 + i * 7} r={2.5} fill="none" stroke={T.iron} />);
  return (
    <g className="viewport__wall-chain">
      <rect x={x - 6} y={80} width={12} height={6} fill={T.iron} />
      <rect x={x - 1} y={84} width={2} height={4} fill={T.void} />
      {links}
      <circle cx={x} cy={138} r={6} fill="none" stroke={T.iron} />
    </g>
  );
}

function PassageScene() {
  const grate: ReactElement[] = [];
  for (let x = 184; x <= 256; x += 8) grate.push(<rect key={`gx${x}`} x={x} y={168} width={2} height={24} fill={T.iron} />);
  for (let y = 168; y <= 190; y += 8) grate.push(<rect key={`gy${y}`} x={182} y={y} width={78} height={2} fill={T.iron} />);
  const windowBars: ReactElement[] = [];
  for (let x = 46; x <= 94; x += 8) windowBars.push(<rect key={`w${x}`} x={x} y={36} width={2} height={28} fill={T.iron} />);
  const wingBars: ReactElement[] = [];
  for (const x0 of [-200, 580]) {
    wingBars.push(<rect key={`wf${x0}`} x={x0} y={32} width={62} height={34} fill={T.block} />);
    wingBars.push(<rect key={`wv${x0}`} x={x0 + 4} y={36} width={54} height={28} fill={T.void} />);
    for (let x = x0 + 6; x <= x0 + 54; x += 8) wingBars.push(<rect key={`wb${x0}-${x}`} x={x} y={36} width={2} height={28} fill={T.iron} />);
  }
  return (
    <>
      {/* Dark slate dungeon stone, damp with moss and drips. */}
      <Wall stone={SLATE_STONE} every={3} damp />
      {/* Vault ribs: concentric arcs whose lower halves the floor hides; the outer ones reach the bleed. */}
      <g className="viewport__vault">
        {[205, 172, 140, 108].map((r) => (
          <circle key={r} cx={220} cy={FLOOR} r={r} fill="none" stroke={T.arch} strokeWidth={4} />
        ))}
        {[250, 300, 360, 430].map((r) => (
          <circle key={r} className="viewport__rib" cx={220} cy={FLOOR} r={r} fill="none" stroke={T.wall} strokeWidth={5} />
        ))}
      </g>
      <Floor kind="slate" />
      <g className="viewport__grating">{wingBars}</g>
      <WallChain x={-60} />
      <WallChain x={500} />
      <g className="viewport__perspective">
        <line x1={155} y1={FLOOR} x2={0} y2={H} stroke={T.floorDark} />
        <line x1={285} y1={FLOOR} x2={W} y2={H} stroke={T.floorDark} />
      </g>
      <g className="viewport__grating">
        <rect x={180} y={166} width={82} height={28} fill={T.void} />
        {grate}
      </g>
      <g className="viewport__grating">
        <rect x={40} y={32} width={62} height={34} fill={T.arch} />
        <rect x={44} y={36} width={54} height={28} fill={T.void} />
        {windowBars}
      </g>
      <WallChain x={70} />
      <WallChain x={370} />
    </>
  );
}

// ---- library: tall bookshelves with coloured spines, scroll cubbies, and a lectern ----

const SPINE_COLORS = [T.crimson, T.forest, T.sky, T.goldDark, T.navy, T.doorLight, T.crimsonDark, T.moss];
const SPINE_W = [6, 8, 5, 7, 9, 6, 4, 8];
const SPINE_H = [22, 19, 24, 20, 17, 23, 21, 18];

function Shelf({ x, w, cubbyRows = 0 }: { x: number; w: number; cubbyRows?: number }) {
  const out: ReactElement[] = [];
  const top = 14;
  const rowH = 28;
  out.push(<rect key="case" x={x} y={top} width={w} height={FLOOR - top} fill={T.door} />);
  out.push(<rect key="back" x={x + 4} y={top + 4} width={w - 8} height={FLOOR - top - 4} fill={T.doorDark} />);
  for (let row = 0; row < 5; row++) {
    const y = top + 4 + row * rowH;
    const bottom = y + rowH - 3;
    out.push(<rect key={`board${row}`} x={x + 2} y={bottom} width={w - 4} height={3} fill={T.doorLight} />);
    if (row < cubbyRows) {
      // Scroll cubbies: square pigeonholes, each holding a rolled scroll seen end-on.
      for (let cx = x + 6; cx + 20 <= x + w - 4; cx += 22) {
        out.push(<rect key={`c${row}-${cx}`} x={cx} y={y + 2} width={20} height={rowH - 6} fill={T.void} />);
        out.push(<circle key={`s${row}-${cx}`} cx={cx + 10} cy={y + 2 + (rowH - 6) / 2} r={6} fill={T.parchment} stroke={T.goldDark} />);
        out.push(<circle key={`sc${row}-${cx}`} cx={cx + 10} cy={y + 2 + (rowH - 6) / 2} r={2} fill={T.doorLight} />);
      }
      continue;
    }
    let bx = x + 6;
    let i = row * 3;
    while (bx < x + w - 10) {
      const bw = SPINE_W[i % SPINE_W.length]!;
      const bh = SPINE_H[(i * 5) % SPINE_H.length]!;
      out.push(<rect key={`k${row}-${bx}`} className="viewport__book" x={bx} y={bottom - bh} width={bw} height={bh} fill={SPINE_COLORS[i % SPINE_COLORS.length]} />);
      if (i % 2 === 0) out.push(<rect key={`kb${row}-${bx}`} x={bx} y={bottom - bh + 4} width={bw} height={1} fill={T.gold} />);
      bx += bw + 1;
      i++;
    }
  }
  return <g className="viewport__shelf">{out}</g>;
}

/** Warm oak panelling: dark stiles and rails framing lighter raised panels, under a gold cornice. */
function WoodPanels() {
  const out: ReactElement[] = [<rect key="face" x={LEFT} y={-BLEED_Y} width={SPAN} height={BLEED_Y + FLOOR} fill={T.door} />];
  const rails = [-BLEED_Y, 8, 70, 120, FLOOR - 6];
  for (let x = LEFT; x < W + BLEED_X; x += 48) {
    out.push(<rect key={`s${x}`} x={x} y={-BLEED_Y} width={5} height={BLEED_Y + FLOOR} fill={T.doorDark} />);
    for (let r = 0; r < rails.length - 1; r++) {
      const y0 = rails[r]! + 6;
      const y1 = rails[r + 1]! - 2;
      if (y1 - y0 > 10) out.push(<rect key={`p${x}-${r}`} className="viewport__panel" x={x + 10} y={y0} width={33} height={y1 - y0} fill="none" stroke={T.doorLight} />);
    }
  }
  for (const y of rails) out.push(<rect key={`r${y}`} x={LEFT} y={y} width={SPAN} height={4} fill={T.doorDark} />);
  out.push(<rect key="cornice" x={LEFT} y={2} width={SPAN} height={3} fill={T.goldDark} />);
  return <g className="viewport__panelling">{out}</g>;
}

function LibraryScene() {
  return (
    <>
      <WoodPanels />
      <Floor kind="boards" />
      <g className="viewport__runner">
        <polygon points={pts([[170, FLOOR], [270, FLOOR], [330, H + BLEED_Y], [110, H + BLEED_Y]])} fill={T.crimson} />
        <line x1={176} y1={FLOOR} x2={122} y2={H + BLEED_Y} stroke={T.gold} strokeWidth={2} />
        <line x1={264} y1={FLOOR} x2={318} y2={H + BLEED_Y} stroke={T.gold} strokeWidth={2} />
      </g>
      <Shelf x={10} w={118} />
      <Shelf x={312} w={118} cubbyRows={2} />
      <Shelf x={-130} w={118} />
      <Shelf x={-270} w={118} cubbyRows={1} />
      <Shelf x={452} w={118} />
      <Shelf x={592} w={118} cubbyRows={1} />
      <g className="viewport__lectern">
        <rect x={346} y={150} width={8} height={42} fill={T.doorDark} />
        <rect x={332} y={190} width={36} height={6} fill={T.doorDark} />
        <polygon points={pts([[324, 152], [374, 142], [378, 150], [328, 160]])} fill={T.door} />
        <polygon points={pts([[332, 148], [351, 144], [351, 153], [334, 156]])} fill={T.parchment} />
        <polygon points={pts([[351, 144], [370, 140], [372, 149], [351, 153]])} fill={T.parchment} />
        <line x1={351} y1={144} x2={351} y2={164} stroke={T.crimson} />
      </g>
    </>
  );
}

// ---- tower: a gothic lancet window onto a starry night, spiral-stair trim, and a banner ----

/** A tall pointed gothic window, from the sill nearly up to the vault. */
const LANCET: readonly Pt[] = [[50, 140], [50, 48], [53, 32], [62, 19], [80, 7], [98, 19], [107, 32], [110, 48], [110, 140]];
const STARS: readonly Pt[] = [[60, 70], [72, 48], [88, 40], [66, 100], [100, 92], [58, 124], [96, 118], [76, 82]];

function TowerScene() {
  const frame = LANCET.map(([x, y]) => [x < 80 ? x - 7 : x > 80 ? x + 7 : x, y === 140 ? 146 : y - 7] as const);
  const steps: ReactElement[] = [];
  for (let i = 0; i < 7; i++) {
    const x = 312 + i * 18;
    const y = FLOOR - (i + 1) * 14;
    // Each tread runs on into the bleed, so the stair climbs off the side of a wide pane.
    steps.push(<rect key={`st${i}`} x={x} y={y} width={W + BLEED_X - x} height={14} fill={T.arch} />);
    steps.push(<rect key={`sr${i}`} x={x} y={y + 12} width={W + BLEED_X - x} height={2} fill={T.brick} />);
  }
  return (
    <>
      {/* Pale tower stone, lighter than the other rooms, so the night window stands out. */}
      <Wall stone={PALE_STONE} every={4} />
      <Floor kind="flags" />
      {/* A second, plain lancet further along the tower wall. */}
      <g className="viewport__lancet viewport__lancet--far" transform="translate(-230 0)">
        <polygon points={pts(frame)} fill={T.arch} />
        <polygon points={pts(LANCET)} fill={T.night} />
        {stars(7, 54, 106, 40, 128, 'viewport__far-star')}
        <rect x={79} y={14} width={2} height={126} fill={T.arch} />
      </g>
      <g className="viewport__lancet">
        <polygon points={pts(frame)} fill={T.arch} />
        <polygon points={pts(LANCET)} fill={T.night} />
        {STARS.map(([x, y], i) => (
          <rect key={i} className="viewport__star" x={x} y={y} width={2} height={2} fill={i % 2 === 0 ? T.goldLight : T.parchment} />
        ))}
        <circle className="viewport__moon" cx={92} cy={60} r={10} fill={T.goldLight} />
        <circle cx={97} cy={56} r={9} fill={T.night} />
        <rect x={79} y={12} width={2} height={128} fill={T.arch} />
        <rect x={50} y={96} width={60} height={2} fill={T.arch} />
        <rect x={42} y={140} width={76} height={6} fill={T.arch} />
        <rect x={50} y={130} width={60} height={10} fill={T.nightLight} />
      </g>
      <g className="viewport__stair">
        {steps}
        <line x1={312} y1={FLOOR - 24} x2={W} y2={FLOOR - 24 - (W - 312) * (14 / 18)} stroke={T.iron} strokeWidth={2} />
      </g>
      <g className="viewport__banner">
        <rect x={316} y={8} width={40} height={3} fill={T.doorDark} />
        <polygon points={pts([[320, 11], [352, 11], [352, 70], [336, 82], [320, 70]])} fill={T.crimson} />
        <line x1={324} y1={14} x2={324} y2={66} stroke={T.gold} />
        <line x1={348} y1={14} x2={348} y2={66} stroke={T.gold} />
        <polygon points={pts([[326, 40], [336, 30], [346, 40], [346, 46], [336, 36], [326, 46]])} fill={T.gold} />
        <circle cx={336} cy={56} r={4} fill={T.navy} />
      </g>
    </>
  );
}

/** Each scene draws a back layer behind the central door, and optionally a front layer over it. */
const SCENES: Record<RoomVariant, { Back: () => ReactElement; Front?: () => ReactElement }> = {
  gate: { Back: GateScene, Front: GateFront },
  passage: { Back: PassageScene },
  library: { Back: LibraryScene },
  tower: { Back: TowerScene },
  hall: { Back: HallScene, Front: HallFront },
};

/**
 * Inline SVG dungeon room in the manner of a 1997 MindMaze screen, as a wide panorama (440 x 200).
 * Each room is drawn as one of five scenes around the same central door, which is locked (padlock),
 * open, or the open gold way on victory. Two wall torches flicker in every scene. Decorative; no text.
 */
export function DungeonViewport({ locked, victory = false, label, variant = 'hall' }: DungeonViewportProps) {
  const { Back, Front } = SCENES[variant] ?? SCENES.hall;
  return (
    <svg
      className="viewport"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      data-variant={variant}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={-BLEED_X} y={-BLEED_Y} width={W + 2 * BLEED_X} height={H + 2 * BLEED_Y} fill={T.wall} />
      <g className={`viewport__scene viewport__scene--${variant}`}>
        <Back />
      </g>
      <CentralDoor locked={locked} victory={victory} />
      {Front ? (
        <g className={`viewport__front viewport__front--${variant}`}>
          <Front />
        </g>
      ) : null}
      <Torch x={140} />
      <Torch x={300} />
    </svg>
  );
}
