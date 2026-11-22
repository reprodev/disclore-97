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
export function HeroArt() {
  return (
    <svg
      className="boot-hero__art"
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

/** Low-opacity engraved backdrop for the Home window. Decorative only. */
export function EngravedWatermarks() {
  return (
    <div className="home-marks" aria-hidden="true">
      <PlanetMark />
      <RingsMark />
      <BookMark />
      <ArchMark />
    </div>
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
