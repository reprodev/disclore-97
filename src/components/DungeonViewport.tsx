import type { ReactElement } from 'react';

export interface DungeonViewportProps {
  /** True while a door is locked (a question is pending or the game has not started). */
  locked: boolean;
  /** True when the player has reached the throne room. */
  victory?: boolean;
  label: string;
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
  ink: 'var(--color-ink)',
};

const pts = (p: readonly (readonly [number, number])[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** A wall torch: an oak haft, an iron cup, a flat glow, and a two-tone flame that flickers in CSS steps. */
function Torch({ x }: { x: number }) {
  return (
    <g className="viewport__torch">
      <rect x={x - 1} y={34} width={3} height={14} fill={T.doorDark} />
      <rect x={x - 3} y={32} width={7} height={3} fill={T.iron} />
      <g className="viewport__flame">
        <circle cx={x + 0.5} cy={27} r={8} fill={T.flame} opacity={0.18} />
        <polygon points={`${x - 4},32 ${x + 0.5},18 ${x + 5},32`} fill={T.flame} />
        <polygon points={`${x - 2},32 ${x + 0.5},23 ${x + 3},32`} fill={T.flameHot} />
      </g>
    </g>
  );
}

/** An arched oak side door in a stone frame, with planks, iron straps, and a ring pull. */
function SideDoor({ cx }: { cx: number }) {
  const planks = [-4, -1, 2].map((dx) => (
    <rect key={dx} x={cx + dx} y={35} width={1} height={27} fill={T.doorDark} />
  ));
  return (
    <g className="viewport__side-door">
      <rect x={cx - 8} y={40} width={16} height={22} fill={T.arch} />
      <circle cx={cx} cy={40} r={8} fill={T.arch} />
      <rect x={cx - 6} y={40} width={12} height={22} fill={T.door} />
      <circle cx={cx} cy={40} r={6} fill={T.door} />
      {planks}
      <rect x={cx - 6} y={44} width={12} height={2} fill={T.iron} />
      <rect x={cx - 6} y={55} width={12} height={2} fill={T.iron} />
      <circle cx={cx + 3} cy={50} r={1.5} fill="none" stroke={T.goldDark} />
    </g>
  );
}

/**
 * Inline SVG dungeon view in the manner of a 1997 MindMaze room: timber rafters, stone-block walls,
 * a framed portrait and a hanging tapestry, two arched oak side doors, flickering wall torches, a woven
 * rug, and the central door that is locked (padlock) or open. Decorative; draws no text.
 */
export function DungeonViewport({ locked, victory = false, label }: DungeonViewportProps) {
  const bricks: ReactElement[] = [];
  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    bricks.push(<rect key={`h${row}`} x={0} y={y + 7} width={120} height={1} fill={T.brick} />);
    for (let x = row % 2 === 0 ? 0 : 8; x < 120; x += 16) {
      bricks.push(<rect key={`v${row}-${x}`} x={x} y={y} width={1} height={7} fill={T.brick} />);
      // Every few blocks is a lighter dressed stone, so the wall reads as blocks, not stripes.
      if ((row * 3 + x / 8) % 5 === 0) {
        bricks.push(<rect key={`b${row}-${x}`} className="viewport__block" x={x + 1} y={y} width={15} height={7} fill={T.block} />);
      }
    }
  }
  const tiles: ReactElement[] = [];
  for (let i = 0; i < 8; i++) {
    tiles.push(<rect key={`t${i}`} x={i * 16 + (i % 2) * 2} y={70} width={1} height={10} fill={T.floorDark} />);
  }
  // Ceiling joists: short timber ends under the main beam.
  const joists: ReactElement[] = [];
  for (let x = 4; x < 120; x += 12) {
    joists.push(<rect key={`j${x}`} x={x} y={5} width={4} height={3} fill={T.door} />);
    joists.push(<rect key={`jd${x}`} x={x} y={7} width={4} height={1} fill={T.doorDark} />);
  }
  // Rug fringe along the near edge.
  const fringe: ReactElement[] = [];
  for (let x = 33; x <= 86; x += 3) {
    fringe.push(<rect key={`f${x}`} x={x} y={79} width={1} height={1} fill={T.parchment} />);
  }

  return (
    <svg
      className="viewport"
      viewBox="0 0 120 80"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={120} height={80} fill={T.wall} />
      {bricks}
      <rect x={0} y={62} width={120} height={18} fill={T.floor} />
      <rect x={0} y={62} width={120} height={2} fill={T.floorDark} />
      {tiles}

      {/* Woven rug in front of the door: crimson field, gold border, diamond pattern, fringe. */}
      <g className="viewport__rug">
        <polygon points={pts([[40, 65], [80, 65], [88, 79], [32, 79]])} fill={T.crimson} />
        <polygon points={pts([[42, 66.5], [78, 66.5], [85, 77.5], [35, 77.5]])} fill={T.goldDark} />
        <polygon points={pts([[44, 68], [76, 68], [82, 76], [38, 76]])} fill={T.crimsonDark} />
        <line x1={41} y1={72} x2={79} y2={72} stroke={T.gold} />
        {[48, 60, 72].map((x) => (
          <polygon key={x} points={pts([[x, 69.5], [x + 3, 72], [x, 74.5], [x - 3, 72]])} fill={T.gold} />
        ))}
        {[54, 66].map((x) => (
          <polygon key={x} points={pts([[x, 70.5], [x + 1.5, 72], [x, 73.5], [x - 1.5, 72]])} fill={T.navy} />
        ))}
        {fringe}
      </g>

      {/* Stone archway */}
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
          {/* Door */}
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
          {/* Padlock */}
          {locked ? (
            <>
              <rect x={56} y={44} width={8} height={2} fill={T.iron} />
              <rect x={56} y={42} width={2} height={4} fill={T.iron} />
              <rect x={62} y={42} width={2} height={4} fill={T.iron} />
              <rect x={54} y={46} width={12} height={9} fill={T.gold} />
              <rect x={54} y={46} width={12} height={2} fill={T.goldDark} />
              <rect x={59} y={49} width={2} height={4} fill={T.void} />
            </>
          ) : (
            <>
              <rect x={62} y={39} width={2} height={7} fill={T.iron} />
              <rect x={56} y={39} width={8} height={2} fill={T.iron} />
              <rect x={54} y={46} width={12} height={9} fill={T.gold} />
              <rect x={59} y={49} width={2} height={4} fill={T.void} />
            </>
          )}
        </>
      )}

      {/* Timber ceiling: the main beam, its joist ends, and corner braces. */}
      <g className="viewport__rafters">
        <rect x={0} y={0} width={120} height={5} fill={T.doorDark} />
        <rect x={0} y={4} width={120} height={1} fill={T.door} />
        {joists}
        <polygon points={pts([[0, 5], [12, 5], [0, 15]])} fill={T.door} />
        <polygon points={pts([[120, 5], [108, 5], [120, 15]])} fill={T.door} />
        <line x1={0} y1={15} x2={12} y2={5} stroke={T.doorDark} />
        <line x1={120} y1={15} x2={108} y2={5} stroke={T.doorDark} />
      </g>

      {/* A small framed portrait above the left door. */}
      <g className="viewport__portrait">
        <rect x={5} y={16} width={14} height={13} fill={T.goldDark} />
        <rect x={6} y={17} width={12} height={11} fill={T.gold} />
        <rect x={7} y={18} width={10} height={9} fill={T.parchment} />
        <polygon points={pts([[8, 27], [12, 23], [16, 27]])} fill={T.navy} />
        <circle cx={12} cy={21.5} r={2} fill={T.doorLight} />
        <rect x={10} y={19} width={4} height={1} fill={T.crimson} />
      </g>

      {/* A hanging tapestry above the right door: navy banner, gold border and emblem, swallowtail hem. */}
      <g className="viewport__tapestry">
        <rect x={100} y={12} width={16} height={1} fill={T.doorDark} />
        <polygon points={pts([[102, 13], [114, 13], [114, 30], [108, 27], [102, 30]])} fill={T.navy} />
        <line x1={103} y1={14} x2={103} y2={28} stroke={T.gold} />
        <line x1={113} y1={14} x2={113} y2={28} stroke={T.gold} />
        <polygon points={pts([[108, 16], [111, 20], [108, 24], [105, 20]])} fill={T.gold} />
        <circle cx={108} cy={20} r={1} fill={T.crimson} />
      </g>

      <SideDoor cx={12} />
      <SideDoor cx={108} />

      <Torch x={27} />
      <Torch x={93} />
    </svg>
  );
}
