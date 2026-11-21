import type { ReactElement } from 'react';

export interface DungeonViewportProps {
  /** True while a door is locked (a question is pending or the game has not started). */
  locked: boolean;
  /** True when the player has reached the throne room. */
  victory?: boolean;
  label: string;
}

const T = {
  wall: 'var(--color-stone-dark)',
  brick: 'var(--color-stone)',
  arch: 'var(--color-stone-light)',
  void: 'var(--color-bevel-edge)',
  door: 'var(--color-wood)',
  doorDark: 'var(--color-wood-dark)',
  doorLight: 'var(--color-wood-light)',
  iron: 'var(--color-bevel-shadow)',
  gold: 'var(--color-gold)',
  goldDark: 'var(--color-gold-dark)',
  flame: 'var(--color-flame)',
  flameHot: 'var(--color-flame-hot)',
  floor: 'var(--color-stone)',
  floorDark: 'var(--color-stone-dark)',
  crimson: 'var(--color-crimson)',
};

function Torch({ x }: { x: number }) {
  return (
    <g className="viewport__torch">
      <rect x={x - 1} y={34} width={3} height={14} fill={T.doorDark} />
      <rect x={x - 3} y={32} width={7} height={3} fill={T.iron} />
      <g className="viewport__flame">
        <polygon points={`${x - 4},32 ${x + 0.5},18 ${x + 5},32`} fill={T.flame} />
        <polygon points={`${x - 2},32 ${x + 0.5},23 ${x + 3},32`} fill={T.flameHot} />
      </g>
    </g>
  );
}

/**
 * Inline SVG dungeon view: stone arch, two wall torches, and a door that is
 * locked (padlock) or open. Decorative; draws no text.
 */
export function DungeonViewport({ locked, victory = false, label }: DungeonViewportProps) {
  const bricks: ReactElement[] = [];
  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    bricks.push(<rect key={`h${row}`} x={0} y={y + 7} width={120} height={1} fill={T.brick} />);
    for (let x = row % 2 === 0 ? 0 : 8; x < 120; x += 16) {
      bricks.push(<rect key={`v${row}-${x}`} x={x} y={y} width={1} height={7} fill={T.brick} />);
    }
  }
  const tiles: ReactElement[] = [];
  for (let i = 0; i < 8; i++) {
    tiles.push(<rect key={`t${i}`} x={i * 16 + (i % 2) * 2} y={70} width={1} height={10} fill={T.floorDark} />);
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

      <Torch x={16} />
      <Torch x={104} />
    </svg>
  );
}
