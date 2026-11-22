import { toTheme } from '../model/editions';
import type { Theme } from '../model/editions';
import '../styles/splash.css';

const C = {
  night: 'var(--color-night)',
  nightLight: 'var(--color-night-light)',
  star: 'var(--color-paper)',
  starGold: 'var(--color-gold-light)',
  orbit: 'var(--color-sky-deep)',
  sky: 'var(--color-sky)',
  gold: 'var(--color-gold)',
  goldDark: 'var(--color-gold-dark)',
  crimson: 'var(--color-crimson)',
  crimsonLight: 'var(--color-crimson-light)',
  ink: 'var(--color-bevel-edge)',
  stone: 'var(--color-stone)',
  stoneLight: 'var(--color-stone-light)',
  stoneDark: 'var(--color-stone-dark)',
  forest: 'var(--color-forest)',
  forestDark: 'var(--color-forest-dark)',
  forestLight: 'var(--color-forest-light)',
  crimsonDark: 'var(--color-crimson-dark)',
  wood: 'var(--color-wood)',
  woodDark: 'var(--color-wood-dark)',
  surface: 'var(--color-surface)',
  shadow: 'var(--color-bevel-shadow)',
  paper: 'var(--color-paper)',
  crt: 'var(--color-crt-bg)',
  phos: 'var(--color-phosphor)',
  phosDim: 'var(--color-phosphor-dim)',
};

const STARS: [number, number][] = [
  [8, 8], [22, 16], [40, 6], [60, 12], [78, 5], [122, 6], [140, 12], [160, 5],
  [178, 10], [192, 20], [12, 30], [190, 40], [72, 22], [130, 26],
];

/** Merlon blocks along a wall top. */
function merlons(xs: number[], y: number, w: number, fill: string) {
  return xs.map((x) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={3} fill={fill} />);
}

/**
 * Wide original 1997 title-card illustration on a deep night field: a glowing
 * CD-ROM inside compass and orbit rings, a castle keep silhouette on the left,
 * and a CRT terminal on the right. Flat token colors only.
 */
function ClassicHero() {
  return (
    <svg
      className="boot-hero__art"
      data-edition="classic"
      viewBox="0 0 200 80"
      role="img"
      aria-label="A glowing CD-ROM disc in orbit rings between a castle keep and a CRT terminal"
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={200} height={80} fill={C.night} />
      {STARS.map(([x, y]) => (
        <rect key={`s${x}-${y}`} x={x} y={y} width={1} height={1} fill={C.star} />
      ))}
      <rect x={48} y={10} width={2} height={2} fill={C.starGold} />
      <rect x={150} y={8} width={2} height={2} fill={C.starGold} />

      {/* Compass star, orbit rings, and ring ticks */}
      <polygon points="100,2 104,36 138,40 104,44 100,78 96,44 62,40 96,36" fill={C.nightLight} />
      <circle cx={100} cy={40} r={35} fill="none" stroke={C.orbit} />
      <circle cx={100} cy={40} r={30} fill="none" stroke={C.nightLight} />
      <rect x={99} y={4} width={2} height={4} fill={C.gold} />
      <rect x={99} y={72} width={2} height={4} fill={C.gold} />
      <rect x={63} y={39} width={4} height={2} fill={C.gold} />
      <rect x={133} y={39} width={4} height={2} fill={C.gold} />

      {/* Glowing CD-ROM: stepped flat halo, then the disc */}
      <circle cx={100} cy={40} r={27} fill={C.nightLight} />
      <circle cx={100} cy={40} r={24} fill={C.orbit} />
      <circle cx={100} cy={40} r={22} fill={C.sky} />
      <circle cx={100} cy={40} r={21} fill={C.ink} />
      <circle cx={100} cy={40} r={20} fill={C.stoneLight} />
      <circle cx={100} cy={40} r={17} fill={C.sky} />
      <circle cx={100} cy={40} r={14} fill={C.crimsonLight} />
      <circle cx={100} cy={40} r={11} fill={C.gold} />
      <circle cx={100} cy={40} r={8} fill={C.surface} />
      <circle cx={100} cy={40} r={3} fill={C.night} />
      <polygon className="hero-glint" points="88,28 96,24 98,26 90,32" fill={C.paper} />

      {/* Ground */}
      <rect x={0} y={66} width={200} height={14} fill={C.forestDark} />
      <rect x={0} y={66} width={200} height={2} fill={C.forest} />

      {/* Castle keep silhouette */}
      <rect x={6} y={48} width={60} height={18} fill={C.stoneDark} />
      {merlons([6, 14, 22, 52, 58], 45, 4, C.stoneDark)}
      <rect x={8} y={34} width={12} height={32} fill={C.stoneDark} />
      {merlons([8, 12, 16], 31, 3, C.stoneDark)}
      <rect x={52} y={34} width={12} height={32} fill={C.stoneDark} />
      {merlons([52, 56, 60], 31, 3, C.stoneDark)}
      <rect x={26} y={22} width={22} height={44} fill={C.stoneDark} />
      <rect x={26} y={22} width={2} height={44} fill={C.stone} />
      {merlons([26, 31, 36, 41, 45], 19, 3, C.stoneDark)}
      <rect x={36} y={8} width={1} height={11} fill={C.paper} />
      <polygon points="37,8 47,11 37,14" fill={C.crimson} />
      <rect className="hero-torch" x={35} y={30} width={4} height={7} fill={C.gold} />
      <rect className="hero-torch hero-torch--b" x={30} y={44} width={3} height={5} fill={C.gold} />
      <rect className="hero-torch" x={42} y={44} width={3} height={5} fill={C.gold} />
      <rect className="hero-torch hero-torch--b" x={13} y={42} width={2} height={5} fill={C.gold} />
      <rect className="hero-torch" x={57} y={42} width={2} height={5} fill={C.gold} />
      <rect x={33} y={54} width={8} height={12} fill={C.ink} />
      <polygon points="33,54 37,50 41,54" fill={C.ink} />

      {/* CRT terminal */}
      <rect x={140} y={22} width={48} height={36} fill={C.surface} />
      <rect x={140} y={22} width={48} height={1} fill={C.paper} />
      <rect x={140} y={22} width={1} height={36} fill={C.paper} />
      <rect x={140} y={57} width={48} height={1} fill={C.shadow} />
      <rect x={187} y={22} width={1} height={36} fill={C.shadow} />
      <rect x={145} y={27} width={38} height={26} fill={C.crt} />
      <rect x={148} y={30} width={18} height={2} fill={C.phos} />
      <rect x={148} y={35} width={26} height={2} fill={C.phosDim} />
      <rect x={148} y={40} width={14} height={2} fill={C.phos} />
      <rect x={148} y={45} width={22} height={2} fill={C.phosDim} />
      <rect className="hero-cursor" x={148} y={49} width={4} height={3} fill={C.phos} />
      <rect x={156} y={58} width={16} height={4} fill={C.surface} />
      <rect x={150} y={62} width={28} height={4} fill={C.shadow} />
      <rect x={182} y={54} width={3} height={2} fill={C.crimsonLight} />

      {/* Gold frame line */}
      <rect x={0} y={0} width={200} height={1} fill={C.goldDark} />
      <rect x={0} y={79} width={200} height={1} fill={C.goldDark} />
    </svg>
  );
}

// ---- Engraved watermarks for the Home screen -------------------------------------------------
// Flat line art in the sepia watermark ink: strokes and faint tints only, no gradients, no images.

const W = {
  ink: 'var(--color-watermark-ink)',
  tint: 'var(--color-parchment-tint)',
};

const MARK_PROPS = {
  fill: 'none',
  stroke: W.ink,
  strokeWidth: 0.9,
  strokeLinejoin: 'miter' as const,
} as const;

/** A ringed planet with latitude bands, hatching, a small moon, and a few stars. */
function PlanetMark() {
  const bands: [number, number][] = [
    [34, 20.8],
    [42, 23.7],
    [50, 23.7],
    [58, 20.8],
  ];
  return (
    <svg className="home-mark home-mark--planet" viewBox="0 0 120 90" focusable="false" {...MARK_PROPS}>
      {[
        [8, 10], [22, 26], [100, 40], [14, 70], [92, 74], [70, 8],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x! - 2} ${y}H${x! + 2}M${x} ${y! - 2}V${y! + 2}`} />
      ))}
      <circle cx={56} cy={46} r={24} fill={W.tint} />
      {bands.map(([y, hw]) => (
        <line key={y} x1={56 - hw} y1={y} x2={56 + hw} y2={y} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={64 + i * 3} y1={62 - i * 2} x2={70 + i * 3} y2={55 - i * 2} />
      ))}
      <ellipse cx={56} cy={46} rx={46} ry={11} transform="rotate(-16 56 46)" />
      <ellipse cx={56} cy={46} rx={40} ry={8.5} transform="rotate(-16 56 46)" />
      <circle cx={104} cy={18} r={5} fill={W.tint} />
      <circle cx={102.5} cy={16.5} r={1.2} />
    </svg>
  );
}

/** An open encyclopedia volume with ruled lines of text on both pages. */
function BookMark() {
  return (
    <svg className="home-mark home-mark--book" viewBox="0 0 120 80" focusable="false" {...MARK_PROPS}>
      <path d="M6 26V66L58 72L60 70L62 72L114 66V26" />
      <polygon points="10,22 58,28 58,68 10,62" fill={W.tint} />
      <polygon points="62,28 110,22 110,62 62,68" fill={W.tint} />
      <line x1={60} y1={26} x2={60} y2={70} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <line x1={15} y1={30.6 + i * 5} x2={53} y2={35.4 + i * 5} />
          <line x1={67} y1={35.4 + i * 5} x2={105} y2={30.6 + i * 5} />
        </g>
      ))}
    </svg>
  );
}

/** A classical arch beside a keep silhouette with battlements. */
function ArchMark() {
  return (
    <svg className="home-mark home-mark--arch" viewBox="0 0 120 90" focusable="false" {...MARK_PROPS}>
      <line x1={8} y1={82} x2={112} y2={82} />
      <line x1={14} y1={86} x2={106} y2={86} />
      <path d="M24 82V44A21 21 0 0 1 66 44V82" />
      <path d="M30 82V46A15 15 0 0 1 60 46V82" />
      <rect x={20} y={42} width={10} height={3} fill={W.tint} />
      <rect x={60} y={42} width={10} height={3} fill={W.tint} />
      <polygon points="41,22 49,22 47,29 43,29" fill={W.tint} />
      <rect x={78} y={36} width={26} height={46} fill={W.tint} />
      {[78, 85, 92, 99].map((x) => (
        <rect key={x} x={x} y={31} width={5} height={5} fill={W.tint} />
      ))}
      <path d="M87 82V70A4 4 0 0 1 95 70V82" />
      <rect x={88} y={48} width={6} height={10} />
    </svg>
  );
}

/** A CD in orbit: dotted rings, an orbit track, and little satellites. */
function RingsMark() {
  return (
    <svg className="home-mark home-mark--rings" viewBox="0 0 120 120" focusable="false" {...MARK_PROPS}>
      <circle cx={60} cy={60} r={52} strokeDasharray="2 3" />
      <circle cx={60} cy={60} r={42} />
      <ellipse cx={60} cy={60} rx={56} ry={18} transform="rotate(25 60 60)" />
      <circle cx={60} cy={60} r={20} fill={W.tint} />
      <circle cx={60} cy={60} r={14} />
      <circle cx={60} cy={60} r={5} />
      {[
        [112, 60], [26, 92], [86, 14],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} fill={W.tint} />
      ))}
    </svg>
  );
}

const BLOCKS = 20;

export interface InitBarProps {
  /** Seconds for the bar to fill. Blocks appear evenly across this time. */
  durationSec: number;
  /** Which status message is showing (0-based). Used to step the bar when motion is reduced. */
  step: number;
  /** Status line under the bar. Announced politely when it changes. */
  message: string;
}

/**
 * Boot progress bar: 20 blocks that fill in over `durationSec` using CSS
 * animation. With reduced motion, the animation is off and the bar advances
 * in four steps tied to the status messages instead.
 */
export function InitBar({ durationSec, step, message }: InitBarProps) {
  return (
    <>
      <div
        className="splash__bar"
        role="progressbar"
        aria-label="Initializing multimedia drivers"
        aria-busy="true"
        data-step={step}
      >
        <div className="splash__track" aria-hidden="true">
          {Array.from({ length: BLOCKS }, (_, i) => (
            <span
              key={i}
              className="splash__block"
              style={{ animationDelay: `${((i * durationSec) / BLOCKS).toFixed(2)}s` }}
            />
          ))}
        </div>
      </div>
      <p className="splash__init" role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}

// ---- Haunted Edition and Christmas Edition artwork -------------------------------------------
// Same rules as the classic art: flat token colors, stepped shapes, no gradients, no images.

const HAUNT_STARS: [number, number][] = [
  [8, 8], [22, 16], [40, 6], [60, 12], [96, 5], [132, 8], [186, 8], [192, 24], [12, 32], [76, 20], [118, 22],
];

/** A haunted keep against a low amber crescent moon, with bats and a flickering lantern. */
function HauntedHero() {
  return (
    <svg
      className="boot-hero__art"
      data-edition="haunted"
      viewBox="0 0 200 80"
      role="img"
      aria-label="A haunted keep under an amber crescent moon, with bats and a flickering lantern"
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={200} height={80} fill={C.night} />
      {HAUNT_STARS.map(([x, y]) => (
        <rect key={`s${x}-${y}`} x={x} y={y} width={1} height={1} fill={C.star} />
      ))}

      {/* Crescent moon with a stepped flat halo */}
      <circle cx={152} cy={22} r={19} fill={C.nightLight} />
      <circle cx={152} cy={22} r={16} fill={C.goldDark} />
      <path d="M156 8A14 14 0 1 0 156 36A11 11 0 1 1 156 8Z" fill={C.starGold} />

      {/* Bats */}
      {[
        [118, 14],
        [176, 40],
        [30, 18],
      ].map(([x, y]) => (
        <polygon key={`b${x}`} points={`${x! - 5},${y! - 2} ${x! - 2},${y!} ${x},${y! - 2} ${x! + 2},${y!} ${x! + 5},${y! - 2} ${x! + 3},${y! + 2} ${x},${y! + 1} ${x! - 3},${y! + 2}`} fill={C.ink} />
      ))}

      {/* Hill and ground */}
      <polygon points="0,66 34,58 70,64 130,60 200,66 200,80 0,80" fill={C.ink} />
      <rect x={0} y={72} width={200} height={8} fill={C.forestDark} />

      {/* The keep: two pointed towers, a tall center tower, and a crimson pennant */}
      <rect x={70} y={34} width={46} height={32} fill={C.ink} />
      {merlons([70, 76, 82, 100, 106, 112], 31, 4, C.ink)}
      <rect x={62} y={24} width={14} height={42} fill={C.ink} />
      <polygon points="62,24 69,8 76,24" fill={C.ink} />
      <rect x={110} y={24} width={14} height={42} fill={C.ink} />
      <polygon points="110,24 117,8 124,24" fill={C.ink} />
      <rect x={84} y={16} width={18} height={50} fill={C.ink} />
      <polygon points="84,16 93,0 102,16" fill={C.ink} />
      <rect x={93} y={0} width={1} height={6} fill={C.paper} />
      <polygon points="94,1 102,3 94,5" fill={C.crimson} />
      <rect className="hero-torch" x={90} y={26} width={4} height={6} fill={C.gold} />
      <rect className="hero-torch hero-torch--b" x={67} y={32} width={3} height={5} fill={C.gold} />
      <rect className="hero-torch" x={115} y={32} width={3} height={5} fill={C.gold} />
      <rect className="hero-torch hero-torch--b" x={78} y={46} width={3} height={5} fill={C.gold} />
      <rect className="hero-torch" x={105} y={46} width={3} height={5} fill={C.gold} />
      <rect x={89} y={54} width={8} height={12} fill={C.crimsonDark} />
      <polygon points="89,54 93,50 97,54" fill={C.crimsonDark} />

      {/* Lantern on a post */}
      <rect x={21} y={44} width={2} height={28} fill={C.ink} />
      <rect x={14} y={42} width={8} height={2} fill={C.ink} />
      <rect x={15} y={36} width={1} height={6} fill={C.ink} />
      <rect x={12} y={28} width={10} height={9} fill={C.stoneDark} />
      <rect className="hero-torch" x={14} y={30} width={6} height={5} fill={C.starGold} />
      <polygon points="11,28 17,23 23,28" fill={C.ink} />

      {/* Gold frame line */}
      <rect x={0} y={0} width={200} height={1} fill={C.goldDark} />
      <rect x={0} y={79} width={200} height={1} fill={C.goldDark} />
    </svg>
  );
}

const CHRISTMAS_STARS: [number, number][] = [
  [6, 6], [18, 30], [34, 8], [52, 4], [70, 24], [88, 6], [108, 26], [124, 4], [140, 22], [152, 6], [172, 10], [186, 4], [194, 24], [62, 34], [118, 14],
];
/** Snowflakes falling over the scene. */
const SNOW: [number, number][] = [
  [10, 44], [26, 52], [44, 40], [66, 48], [92, 38], [104, 50], [128, 42], [146, 50], [166, 40], [182, 52], [196, 44], [80, 56], [138, 58],
];

/** Snow-dusted evergreens under a starry winter night, a lit festive keep and cottage, and a golden star. */
function ChristmasHero() {
  const pine = (x: number, base: number, h: number, key: string) => (
    <g key={key}>
      <rect x={x - 1} y={base - 3} width={2} height={4} fill={C.woodDark} />
      <polygon points={`${x - h * 0.45},${base - 2} ${x},${base - h * 0.55} ${x + h * 0.45},${base - 2}`} fill={C.forestDark} />
      <polygon points={`${x - h * 0.45},${base - 2} ${x - h * 0.2},${base - h * 0.2} ${x - h * 0.05},${base - 2}`} fill={C.paper} />
      <polygon points={`${x - h * 0.34},${base - h * 0.32} ${x},${base - h * 0.8} ${x + h * 0.34},${base - h * 0.32}`} fill={C.forest} />
      <polygon points={`${x + h * 0.34},${base - h * 0.32} ${x + h * 0.12},${base - h * 0.5} ${x + h * 0.04},${base - h * 0.32}`} fill={C.paper} />
      <polygon points={`${x - h * 0.22},${base - h * 0.6} ${x},${base - h} ${x + h * 0.22},${base - h * 0.6}`} fill={C.forestDark} />
      <polygon points={`${x - 2},${base - h * 0.88} ${x},${base - h} ${x + 2},${base - h * 0.88}`} fill={C.paper} />
    </g>
  );
  return (
    <svg
      className="boot-hero__art"
      data-edition="christmas"
      viewBox="0 0 200 80"
      role="img"
      aria-label="Snow-dusted evergreens under a starry winter night, a lit festive keep and cottage with warm amber windows, and a golden star"
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={200} height={80} fill={C.night} />
      {CHRISTMAS_STARS.map(([x, y]) => (
        <rect key={`s${x}-${y}`} x={x} y={y} width={1} height={1} fill={C.star} />
      ))}

      {/* The golden star: an eight-point star with a stepped flat halo */}
      <circle cx={100} cy={16} r={12} fill={C.nightLight} />
      <polygon
        className="hero-glint"
        points="100,4 102.6,12.4 108.5,7.5 104.4,14.6 112,16 104.4,17.4 108.5,24.5 102.6,19.6 100,28 97.4,19.6 91.5,24.5 95.6,17.4 88,16 95.6,14.6 91.5,7.5 97.4,12.4"
        fill={C.starGold}
      />
      <rect x={98} y={14} width={4} height={4} fill={C.paper} />

      {/* Falling snow */}
      {SNOW.map(([x, y]) => (
        <rect key={`f${x}-${y}`} x={x} y={y} width={1} height={1} fill={C.paper} />
      ))}

      {/* Snowy ground and drifts */}
      <polygon points="0,64 40,58 90,63 140,60 200,64 200,80 0,80" fill={C.paper} />
      <rect x={0} y={72} width={200} height={8} fill={C.stoneLight} />

      {/* Snow-dusted evergreens */}
      {pine(12, 70, 30, 'p1')}
      {pine(32, 72, 24, 'p2')}
      {pine(52, 70, 34, 'p3')}
      {pine(184, 70, 28, 'p4')}

      {/* A festive keep with a cranberry banner and warm amber windows */}
      <rect x={74} y={40} width={40} height={30} fill={C.stoneDark} />
      {merlons([74, 80, 86, 92, 98, 104, 110], 37, 3, C.stoneDark)}
      <rect x={74} y={37} width={40} height={1} fill={C.paper} />
      <rect x={86} y={28} width={16} height={42} fill={C.stoneDark} />
      {merlons([86, 91, 96, 100], 25, 3, C.stoneDark)}
      <rect x={86} y={25} width={16} height={1} fill={C.paper} />
      <rect x={93} y={34} width={3} height={14} fill={C.crimson} />
      <rect className="hero-torch" x={90} y={33} width={2} height={4} fill={C.gold} />
      <rect className="hero-torch hero-torch--b" x={97} y={33} width={2} height={4} fill={C.gold} />
      <rect className="hero-torch" x={78} y={46} width={3} height={5} fill={C.gold} />
      <rect className="hero-torch hero-torch--b" x={107} y={46} width={3} height={5} fill={C.gold} />
      <rect x={90} y={58} width={8} height={12} fill={C.woodDark} />
      <polygon points="90,58 94,54 98,58" fill={C.woodDark} />
      {/* A holly wreath over the door */}
      <circle cx={94} cy={52} r={3} fill={C.forest} />
      <circle cx={94} cy={52} r={1.5} fill={C.stoneDark} />
      <rect x={93} y={54} width={2} height={1} fill={C.crimson} />

      {/* A cottage with a snowy roof, a chimney, and lit amber windows */}
      <rect x={130} y={52} width={34} height={18} fill={C.wood} />
      <polygon points="126,52 147,38 168,52" fill={C.crimsonDark} />
      <polygon points="126,52 147,38 168,52 164,52 147,41 130,52" fill={C.paper} />
      <rect x={156} y={38} width={5} height={9} fill={C.stoneDark} />
      <rect x={155} y={37} width={7} height={2} fill={C.paper} />
      <rect className="hero-torch" x={134} y={56} width={7} height={6} fill={C.starGold} />
      <rect x={137} y={56} width={1} height={6} fill={C.woodDark} />
      <rect className="hero-torch hero-torch--b" x={153} y={56} width={7} height={6} fill={C.starGold} />
      <rect x={156} y={56} width={1} height={6} fill={C.woodDark} />
      <rect x={144} y={60} width={6} height={10} fill={C.woodDark} />

      {/* Gold frame line */}
      <rect x={0} y={0} width={200} height={1} fill={C.goldDark} />
      <rect x={0} y={79} width={200} height={1} fill={C.goldDark} />
    </svg>
  );
}

export interface HeroArtProps {
  /** The edition on show. Defaults to Classic '97. */
  edition?: Theme;
}

/**
 * The wide title-card illustration. Classic '97 draws the castle, CD-ROM, and CRT. The Haunted
 * Edition draws a haunted keep under a crescent moon, and the Christmas Edition draws snowy
 * evergreens, a lit keep and cottage, and a golden star. An unknown edition draws Classic '97.
 */
export function HeroArt({ edition = 'classic' }: HeroArtProps) {
  const e = toTheme(edition);
  if (e === 'haunted') return <HauntedHero />;
  if (e === 'christmas') return <ChristmasHero />;
  return <ClassicHero />;
}

// ---- Edition watermarks ----------------------------------------------------------------------

/** Rounds to one decimal so the point lists stay short. */
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A gothic lantern on a hook: pointed cap, glass panes with a flame, and a footed base. */
function LanternMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--lantern home-mark--slot${slot}`} viewBox="0 0 120 120" focusable="false" {...MARK_PROPS}>
      <circle cx={60} cy={9} r={6} />
      <line x1={60} y1={15} x2={60} y2={24} />
      <polygon points="44,34 60,22 76,34" fill={W.tint} />
      <rect x={41} y={34} width={38} height={5} fill={W.tint} />
      <path d="M46 39L43 92H77L74 39" fill={W.tint} />
      <rect x={50} y={44} width={20} height={44} />
      <line x1={60} y1={44} x2={60} y2={88} />
      <line x1={50} y1={62} x2={70} y2={62} />
      <line x1={50} y1={76} x2={70} y2={76} />
      <polygon points="60,50 54,68 60,78 66,68" fill={W.tint} />
      <rect x={39} y={92} width={42} height={6} fill={W.tint} />
      <path d="M43 98L40 108M77 98L80 108M60 98V110" />
    </svg>
  );
}

/** A crescent moon with a few stars. */
function MoonMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--moon home-mark--slot${slot}`} viewBox="0 0 120 90" focusable="false" {...MARK_PROPS}>
      {[
        [14, 14], [28, 64], [100, 20], [108, 70], [92, 46],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x! - 2.5} ${y}H${x! + 2.5}M${x} ${y! - 2.5}V${y! + 2.5}`} />
      ))}
      <path d="M72 8A38 38 0 1 0 72 82A30 30 0 1 1 72 8Z" fill={W.tint} />
      <path d="M66 22A24 24 0 0 0 66 68" strokeDasharray="2 3" />
    </svg>
  );
}

/** A bat with spread wings, doubling as a gargoyle silhouette on a ledge. */
function BatMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--bat home-mark--slot${slot}`} viewBox="0 0 120 90" focusable="false" {...MARK_PROPS}>
      <path d="M54 40Q42 16 6 24Q16 32 14 44Q24 38 28 52Q40 44 54 54Z" fill={W.tint} />
      <path d="M66 40Q78 16 114 24Q104 32 106 44Q96 38 92 52Q80 44 66 54Z" fill={W.tint} />
      <ellipse cx={60} cy={50} rx={8} ry={15} fill={W.tint} />
      <circle cx={60} cy={30} r={8} fill={W.tint} />
      <polygon points="53,26 51,14 58,22" fill={W.tint} />
      <polygon points="67,26 69,14 62,22" fill={W.tint} />
      <circle cx={57} cy={30} r={1.2} />
      <circle cx={63} cy={30} r={1.2} />
      <path d="M57 35L58.5 38L60 35L61.5 38L63 35" />
      <path d="M56 64L60 76L64 64" />
      <line x1={20} y1={84} x2={100} y2={84} />
    </svg>
  );
}

/** A closed tome with a banded spine, corner guards, and a clasp. */
function TomeMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--tome home-mark--slot${slot}`} viewBox="0 0 120 80" focusable="false" {...MARK_PROPS}>
      <rect x={14} y={10} width={92} height={58} fill={W.tint} />
      <rect x={14} y={10} width={12} height={58} />
      {[18, 32, 46, 60].map((y) => (
        <line key={y} x1={14} y1={y} x2={26} y2={y} />
      ))}
      <rect x={32} y={16} width={68} height={46} />
      <polygon points="66,24 82,39 66,54 50,39" />
      <circle cx={66} cy={39} r={5} />
      {[
        [32, 16, 1, 1], [100, 16, -1, 1], [32, 62, 1, -1], [100, 62, -1, -1],
      ].map(([x, y, dx, dy]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y! + dy! * 8}V${y}H${x! + dx! * 8}`} />
      ))}
      <rect x={104} y={32} width={8} height={14} fill={W.tint} />
      <line x1={14} y1={72} x2={106} y2={72} />
    </svg>
  );
}

/** An eight-point holiday star in a dotted ring, with a small glowing center. */
function StarMark({ slot }: { slot: number }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const angle = ((i * 22.5 - 90) * Math.PI) / 180;
    const r = i % 2 === 1 ? 11 : i % 4 === 0 ? 40 : 27;
    return `${r1(60 + r * Math.cos(angle))},${r1(45 + r * Math.sin(angle))}`;
  }).join(' ');
  return (
    <svg className={`home-mark home-mark--star home-mark--slot${slot}`} viewBox="0 0 120 90" focusable="false" {...MARK_PROPS}>
      <circle cx={60} cy={45} r={43} strokeDasharray="2 3" />
      <polygon points={pts} fill={W.tint} />
      <circle cx={60} cy={45} r={7} />
      {[
        [14, 12], [106, 14], [18, 78], [102, 76],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x! - 2.5} ${y}H${x! + 2.5}M${x} ${y! - 2.5}V${y! + 2.5}`} />
      ))}
    </svg>
  );
}

/** A six-armed snowflake crystal with branching arms. */
function SnowflakeMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--snowflake home-mark--slot${slot}`} viewBox="0 0 120 120" focusable="false" {...MARK_PROPS}>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <g key={k} transform={`rotate(${k * 60} 60 60)`}>
          <line x1={60} y1={60} x2={60} y2={10} />
          <line x1={60} y1={22} x2={51} y2={13} />
          <line x1={60} y1={22} x2={69} y2={13} />
          <line x1={60} y1={36} x2={52} y2={28} />
          <line x1={60} y1={36} x2={68} y2={28} />
          <polygon points="60,6 63,10 60,14 57,10" fill={W.tint} />
        </g>
      ))}
      <polygon points="60,50 69,55 69,65 60,70 51,65 51,55" fill={W.tint} />
    </svg>
  );
}

/** A single evergreen tree with a star on top, baubles, and a tub. */
function TreeMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--tree home-mark--slot${slot}`} viewBox="0 0 120 80" focusable="false" {...MARK_PROPS}>
      <polygon points="60,3 62,8 67,8 63,11 65,16 60,13 55,16 57,11 53,8 58,8" fill={W.tint} />
      <polygon points="60,14 44,34 52,34 38,52 48,52 32,68 88,68 72,52 82,52 68,34 76,34" fill={W.tint} />
      <path d="M46 30Q60 36 72 28M40 48Q60 56 78 46M36 64Q60 70 84 62" />
      {[
        [52, 40], [68, 42], [46, 58], [62, 60], [76, 58],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2} />
      ))}
      <rect x={54} y={68} width={12} height={8} fill={W.tint} />
      <line x1={20} y1={77} x2={100} y2={77} />
    </svg>
  );
}

/** A lit candle in a holder, with a flame and two holly leaves. */
function CandleMark({ slot }: { slot: number }) {
  return (
    <svg className={`home-mark home-mark--candle home-mark--slot${slot}`} viewBox="0 0 120 90" focusable="false" {...MARK_PROPS}>
      <path d="M60 6Q68 16 60 26Q52 16 60 6Z" fill={W.tint} />
      <path d="M60 14Q63 19 60 23Q57 19 60 14Z" />
      <line x1={60} y1={26} x2={60} y2={30} />
      <rect x={50} y={30} width={20} height={40} fill={W.tint} />
      <path d="M54 34V44M66 30V38Q66 41 64 41" />
      <ellipse cx={60} cy={74} rx={26} ry={5} fill={W.tint} />
      <path d="M86 74Q98 72 96 82" />
      <path d="M28 66Q36 56 46 62Q38 70 28 66Z" fill={W.tint} />
      <path d="M92 66Q84 56 74 62Q82 70 92 66Z" fill={W.tint} />
      <circle cx={46} cy={66} r={2.4} />
      <circle cx={74} cy={66} r={2.4} />
    </svg>
  );
}

export interface EngravedWatermarksProps {
  /** The edition on show. Defaults to Classic '97. */
  edition?: Theme;
}

/**
 * Low-opacity engraved backdrop for the Home window. Decorative only. Classic '97 has a planet, orbiting
 * CD rings, an open book, and an arch and keep. The Haunted Edition has a crescent moon, a gothic lantern,
 * a tome, and a bat. The Christmas Edition has a holiday star, a snowflake, an evergreen tree, and a candle.
 * An unknown edition shows the Classic '97 marks.
 */
export function EngravedWatermarks({ edition = 'classic' }: EngravedWatermarksProps) {
  const e = toTheme(edition);
  return (
    <div className="home-marks" aria-hidden="true" data-edition={e}>
      {e === 'haunted' ? (
        <>
          <MoonMark slot={1} />
          <LanternMark slot={2} />
          <TomeMark slot={3} />
          <BatMark slot={4} />
        </>
      ) : e === 'christmas' ? (
        <>
          <StarMark slot={1} />
          <SnowflakeMark slot={2} />
          <TreeMark slot={3} />
          <CandleMark slot={4} />
        </>
      ) : (
        <>
          <PlanetMark />
          <RingsMark />
          <BookMark />
          <ArchMark />
        </>
      )}
    </div>
  );
}
