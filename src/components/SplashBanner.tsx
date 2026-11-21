import '../styles/splash.css';

const BLOCKS = 20;
const STEP = 0.08;

const C = {
  ink: 'var(--color-bevel-edge)',
  disc: 'var(--color-stone-light)',
  ring1: 'var(--color-sky)',
  ring2: 'var(--color-crimson-light)',
  ring3: 'var(--color-gold)',
  hub: 'var(--color-surface)',
  hole: 'var(--color-title-bg)',
  glare: 'var(--color-paper)',
  gold: 'var(--color-gold)',
  goldDark: 'var(--color-gold-dark)',
  crimson: 'var(--color-crimson)',
  stone: 'var(--color-stone-light)',
};

/** Original pixel-art CD-ROM next to a heraldic crest. Flat token colors only. */
function SplashArt() {
  return (
    <svg
      className="splash__art"
      viewBox="0 0 96 56"
      role="img"
      aria-label="A CD-ROM disc beside a castle crest"
      shapeRendering="crispEdges"
    >
      {/* CD-ROM */}
      <circle cx={26} cy={28} r={24} fill={C.ink} />
      <circle cx={26} cy={28} r={22} fill={C.disc} />
      <circle cx={26} cy={28} r={18} fill={C.ring1} />
      <circle cx={26} cy={28} r={14} fill={C.ring2} />
      <circle cx={26} cy={28} r={10} fill={C.ring3} />
      <circle cx={26} cy={28} r={7} fill={C.hub} />
      <circle cx={26} cy={28} r={3} fill={C.hole} />
      <polygon points="12,16 20,10 22,12 14,20" fill={C.glare} />
      <rect x={32} y={44} width={6} height={2} fill={C.glare} />

      {/* Crest */}
      <polygon points="56,6 90,6 90,32 73,52 56,32" fill={C.goldDark} />
      <polygon points="58,8 88,8 88,31 73,49 58,31" fill={C.gold} />
      <polygon points="60,10 86,10 86,30 73,46 60,30" fill={C.crimson} />
      <rect x={67} y={19} width={12} height={15} fill={C.stone} />
      <rect x={67} y={16} width={3} height={3} fill={C.stone} />
      <rect x={72} y={16} width={3} height={3} fill={C.stone} />
      <rect x={77} y={16} width={2} height={3} fill={C.stone} />
      <rect x={71} y={26} width={4} height={8} fill={C.ink} />
      <rect x={68} y={22} width={2} height={3} fill={C.ink} />
      <rect x={76} y={22} width={2} height={3} fill={C.ink} />
    </svg>
  );
}

/**
 * 1997 AutoPlay splash header for the disc selection window. The init bar is
 * CSS-only and never delays the disc buttons below it.
 */
export function SplashBanner() {
  return (
    <header className="splash">
      <SplashArt />
      <div className="splash__text">
        <h1 className="splash__title">DiscLore '97 Multimedia Encyclopedia &mdash; AutoPlay Ready</h1>
        <div
          className="splash__bar"
          role="progressbar"
          aria-label="Initializing multimedia drivers"
          aria-busy="true"
        >
          <div className="splash__track" aria-hidden="true">
            {Array.from({ length: BLOCKS }, (_, i) => (
              <span key={i} className="splash__block" style={{ animationDelay: `${(i * STEP).toFixed(2)}s` }} />
            ))}
          </div>
        </div>
        <p className="splash__init">Initializing multimedia drivers...</p>
      </div>
    </header>
  );
}
