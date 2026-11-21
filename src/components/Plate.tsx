import type { ReactNode } from 'react';
import '../styles/plate.css';

const C = {
  sky: 'var(--color-sky)',
  skyLight: 'var(--color-sky-light)',
  skyDeep: 'var(--color-sky-deep)',
  grass: 'var(--color-forest-light)',
  forest: 'var(--color-forest)',
  stone: 'var(--color-stone)',
  stoneLight: 'var(--color-stone-light)',
  stoneDark: 'var(--color-stone-dark)',
  wood: 'var(--color-wood)',
  woodLight: 'var(--color-wood-light)',
  woodDark: 'var(--color-wood-dark)',
  gold: 'var(--color-gold)',
  crimson: 'var(--color-crimson)',
  ink: 'var(--color-bevel-edge)',
  paper: 'var(--color-paper)',
  surface: 'var(--color-surface)',
  shadow: 'var(--color-bevel-shadow)',
  navy: 'var(--color-title-bg)',
  phos: 'var(--color-phosphor)',
  phosDim: 'var(--color-phosphor-dim)',
  crt: 'var(--color-crt-bg)',
  parch: 'var(--color-parchment)',
  parchDark: 'var(--color-parchment-dark)',
  desktop: 'var(--color-desktop)',
};

/** Row of merlons (crenellation blocks) along a wall top. */
function merlons(x0: number, x1: number, y: number, fill: string): ReactNode[] {
  const out: ReactNode[] = [];
  for (let x = x0, i = 0; x + 4 <= x1; x += 8, i++) {
    out.push(<rect key={`m${x}-${i}`} x={x} y={y} width={4} height={4} fill={fill} />);
  }
  return out;
}

function Outdoor({ children }: { children: ReactNode }) {
  return (
    <>
      <rect x={0} y={0} width={100} height={70} fill={C.sky} />
      <rect x={0} y={0} width={100} height={20} fill={C.skyLight} />
      <rect x={70} y={10} width={16} height={5} fill={C.paper} />
      <rect x={74} y={7} width={10} height={4} fill={C.paper} />
      <rect x={0} y={70} width={100} height={30} fill={C.grass} />
      <rect x={0} y={90} width={100} height={10} fill={C.forest} />
      {children}
    </>
  );
}

function Indoor({ children }: { children: ReactNode }) {
  return (
    <>
      <rect x={0} y={0} width={100} height={100} fill={C.desktop} />
      <rect x={0} y={72} width={100} height={28} fill={C.wood} />
      <rect x={0} y={72} width={100} height={4} fill={C.woodLight} />
      {children}
    </>
  );
}

function Mound() {
  return (
    <Outdoor>
      <polygon points="10,80 30,40 56,40 76,80" fill={C.forest} />
      <polygon points="18,80 32,48 54,48 68,80" fill={C.grass} />
      <rect x={34} y={20} width={18} height={20} fill={C.wood} />
      <rect x={34} y={20} width={18} height={3} fill={C.woodDark} />
      <polygon points="32,20 43,8 54,20" fill={C.crimson} />
      <rect x={40} y={28} width={6} height={8} fill={C.ink} />
      <rect x={78} y={58} width={14} height={14} fill={C.woodLight} />
      <polygon points="76,58 85,48 94,58" fill={C.woodDark} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={4 + i * 4} y={76} width={2} height={10} fill={C.woodDark} />
      ))}
    </Outdoor>
  );
}

function Tower() {
  return (
    <Outdoor>
      <rect x={30} y={26} width={40} height={54} fill={C.stone} />
      <rect x={30} y={26} width={40} height={4} fill={C.stoneLight} />
      {merlons(30, 70, 20, C.stone)}
      <rect x={38} y={38} width={6} height={10} fill={C.ink} />
      <rect x={56} y={38} width={6} height={10} fill={C.gold} />
      <rect x={44} y={60} width={12} height={20} fill={C.woodDark} />
      <rect x={30} y={76} width={40} height={4} fill={C.stoneDark} />
      <rect x={49} y={4} width={2} height={16} fill={C.ink} />
      <polygon points="51,4 63,8 51,12" fill={C.crimson} />
    </Outdoor>
  );
}

function Wall() {
  return (
    <Outdoor>
      <rect x={4} y={34} width={92} height={38} fill={C.stone} />
      <rect x={4} y={34} width={92} height={4} fill={C.stoneLight} />
      {merlons(4, 96, 30, C.stone)}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={14 + i * 30} y={46} width={3} height={10} fill={C.ink} />
      ))}
      <rect x={0} y={20} width={20} height={54} fill={C.stoneDark} />
      <rect x={80} y={20} width={20} height={54} fill={C.stoneDark} />
      <polygon points="-2,20 10,6 22,20" fill={C.crimson} />
      <polygon points="78,20 90,6 102,20" fill={C.crimson} />
      <rect x={6} y={30} width={4} height={8} fill={C.ink} />
      <rect x={90} y={30} width={4} height={8} fill={C.ink} />
    </Outdoor>
  );
}

function Gate() {
  return (
    <Outdoor>
      <rect x={14} y={24} width={72} height={52} fill={C.stone} />
      {merlons(14, 86, 20, C.stone)}
      <rect x={36} y={42} width={28} height={34} fill={C.ink} />
      <polygon points="36,42 50,32 64,42" fill={C.ink} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={39 + i * 5} y={38} width={1} height={38} fill={C.stoneDark} />
      ))}
      <rect x={36} y={52} width={28} height={1} fill={C.stoneDark} />
      <rect x={36} y={62} width={28} height={1} fill={C.stoneDark} />
      <rect x={34} y={74} width={32} height={8} fill={C.wood} />
      <rect x={0} y={80} width={100} height={12} fill={C.skyDeep} />
      <rect x={0} y={84} width={100} height={2} fill={C.sky} />
    </Outdoor>
  );
}

function Siege() {
  return (
    <Outdoor>
      <rect x={66} y={30} width={30} height={46} fill={C.stone} />
      {merlons(66, 96, 26, C.stone)}
      <rect x={76} y={46} width={6} height={10} fill={C.ink} />
      <polygon points="10,78 22,56 34,78" fill={C.woodDark} />
      <line x1={22} y1={56} x2={44} y2={26} stroke={C.wood} />
      <rect x={14} y={60} width={16} height={3} fill={C.wood} />
      <rect x={18} y={58} width={8} height={6} fill={C.stoneDark} />
      <rect x={10} y={42} width={6} height={9} fill={C.stoneDark} />
      <circle cx={48} cy={22} r={4} fill={C.stoneDark} />
      <rect x={8} y={78} width={30} height={3} fill={C.woodDark} />
    </Outdoor>
  );
}

function Computer() {
  return (
    <Indoor>
      <rect x={22} y={14} width={42} height={36} fill={C.surface} />
      <rect x={26} y={18} width={34} height={26} fill={C.crt} />
      <rect x={29} y={22} width={14} height={2} fill={C.phos} />
      <rect x={29} y={27} width={22} height={2} fill={C.phos} />
      <rect x={29} y={32} width={10} height={2} fill={C.phos} />
      <rect x={34} y={50} width={14} height={4} fill={C.shadow} />
      <rect x={68} y={26} width={22} height={46} fill={C.surface} />
      <rect x={72} y={32} width={14} height={3} fill={C.ink} />
      <rect x={72} y={40} width={14} height={3} fill={C.shadow} />
      <rect x={74} y={62} width={3} height={3} fill={C.phos} />
      <rect x={16} y={60} width={48} height={8} fill={C.surface} />
      <rect x={16} y={60} width={48} height={2} fill={C.paper} />
    </Indoor>
  );
}

function Modem() {
  return (
    <Indoor>
      <rect x={16} y={44} width={56} height={22} fill={C.surface} />
      <rect x={16} y={44} width={56} height={3} fill={C.paper} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={22 + i * 8} y={54} width={4} height={4} fill={i % 2 === 0 ? C.phos : C.crimson} />
      ))}
      <rect x={72} y={54} width={22} height={2} fill={C.ink} />
      <rect x={92} y={26} width={2} height={30} fill={C.ink} />
      <rect x={86} y={18} width={14} height={10} fill={C.paper} />
      <rect x={20} y={22} width={30} height={4} fill={C.skyDeep} />
      <rect x={30} y={14} width={20} height={4} fill={C.sky} />
      <rect x={14} y={30} width={40} height={4} fill={C.skyDeep} />
    </Indoor>
  );
}

function Phone() {
  return (
    <Outdoor>
      <rect x={46} y={10} width={4} height={74} fill={C.woodDark} />
      <rect x={34} y={16} width={28} height={3} fill={C.wood} />
      <line x1={0} y1={22} x2={34} y2={18} stroke={C.ink} />
      <line x1={62} y1={18} x2={100} y2={22} stroke={C.ink} />
      <rect x={34} y={14} width={3} height={3} fill={C.stoneLight} />
      <rect x={59} y={14} width={3} height={3} fill={C.stoneLight} />
      <rect x={70} y={56} width={22} height={20} fill={C.paper} />
      <polygon points="68,56 81,44 94,56" fill={C.crimson} />
      <rect x={78} y={64} width={6} height={12} fill={C.woodDark} />
      <line x1={50} y1={22} x2={81} y2={56} stroke={C.ink} />
    </Outdoor>
  );
}

function Disc() {
  return (
    <Indoor>
      <rect x={10} y={18} width={36} height={36} fill={C.navy} />
      <rect x={16} y={18} width={22} height={14} fill={C.stoneLight} />
      <rect x={31} y={20} width={4} height={10} fill={C.ink} />
      <rect x={16} y={40} width={24} height={14} fill={C.paper} />
      <rect x={19} y={44} width={18} height={2} fill={C.shadow} />
      <circle cx={72} cy={42} r={22} fill={C.stoneLight} />
      <circle cx={72} cy={42} r={14} fill={C.sky} />
      <circle cx={72} cy={42} r={10} fill={C.stoneLight} />
      <circle cx={72} cy={42} r={4} fill={C.desktop} />
    </Indoor>
  );
}

function Bbs() {
  return (
    <Indoor>
      <rect x={20} y={12} width={50} height={40} fill={C.surface} />
      <rect x={25} y={17} width={40} height={30} fill={C.crt} />
      <rect x={28} y={21} width={18} height={2} fill={C.phos} />
      <rect x={28} y={26} width={30} height={2} fill={C.phosDim} />
      <rect x={28} y={31} width={24} height={2} fill={C.phos} />
      <rect x={28} y={36} width={14} height={2} fill={C.phosDim} />
      <rect x={28} y={41} width={4} height={3} fill={C.phos} />
      <rect x={74} y={20} width={20} height={14} fill={C.gold} />
      <rect x={78} y={24} width={12} height={2} fill={C.ink} />
      <rect x={78} y={28} width={8} height={2} fill={C.ink} />
      <rect x={76} y={42} width={18} height={10} fill={C.paper} />
      <rect x={20} y={58} width={50} height={8} fill={C.surface} />
    </Indoor>
  );
}

function Browser() {
  return (
    <>
      <rect x={0} y={0} width={100} height={100} fill={C.desktop} />
      <rect x={8} y={10} width={84} height={80} fill={C.surface} />
      <rect x={10} y={12} width={80} height={8} fill={C.navy} />
      <rect x={12} y={14} width={20} height={4} fill={C.paper} />
      <rect x={10} y={24} width={80} height={6} fill={C.paper} />
      <rect x={10} y={34} width={80} height={54} fill={C.shadow} />
      <rect x={12} y={36} width={76} height={50} fill={C.paper} />
      <rect x={16} y={40} width={36} height={6} fill={C.skyDeep} />
      <rect x={16} y={52} width={60} height={2} fill={C.ink} />
      <rect x={16} y={58} width={48} height={2} fill={C.ink} />
      <rect x={16} y={64} width={26} height={2} fill={C.skyDeep} />
      <rect x={56} y={68} width={26} height={14} fill={C.gold} />
      <rect x={60} y={72} width={18} height={2} fill={C.ink} />
    </>
  );
}

function Terminal() {
  return (
    <>
      <rect x={0} y={0} width={100} height={100} fill={C.surface} />
      <rect x={6} y={8} width={88} height={84} fill={C.crt} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={12} y={16 + i * 10} width={22 + ((i * 17) % 40)} height={3} fill={i % 2 ? C.phosDim : C.phos} />
      ))}
      <rect x={12} y={76} width={6} height={4} fill={C.phos} />
      <rect x={22} y={76} width={6} height={4} fill={C.phos} />
    </>
  );
}

function Book() {
  return (
    <>
      <rect x={0} y={0} width={100} height={100} fill={C.parchDark} />
      <rect x={10} y={22} width={38} height={56} fill={C.paper} />
      <rect x={52} y={22} width={38} height={56} fill={C.paper} />
      <rect x={48} y={20} width={4} height={60} fill={C.crimson} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={15} y={30 + i * 9} width={28} height={2} fill={C.shadow} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={57} y={30 + i * 9} width={28} height={2} fill={C.shadow} />
      ))}
    </>
  );
}

const PLATES: Record<string, () => ReactNode> = {
  mound: Mound,
  tower: Tower,
  wall: Wall,
  gate: Gate,
  siege: Siege,
  computer: Computer,
  modem: Modem,
  phone: Phone,
  disc: Disc,
  bbs: Bbs,
  browser: Browser,
  terminal: Terminal,
  book: Book,
};

export interface PlateProps {
  /** Plate key. Unknown or missing keys draw the default book plate. */
  kind?: string;
  /** Short caption under the plate. */
  caption: string;
}

/** An inline SVG illustration plate with a printed-page frame. Flat colors only. */
export function Plate({ kind, caption }: PlateProps) {
  const Art = (kind !== undefined && PLATES[kind]) || Book;
  return (
    <figure className="plate">
      <svg
        className="plate__art"
        viewBox="0 0 100 100"
        role="img"
        aria-label={caption}
        shapeRendering="crispEdges"
        preserveAspectRatio="xMidYMid meet"
      >
        <Art />
      </svg>
      <figcaption className="plate__caption">{caption}</figcaption>
    </figure>
  );
}
