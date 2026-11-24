import { useEffect, useMemo } from 'react';
import { starfield } from '../model/easterEggs';
import '../styles/eastereggs.css';

export interface StarfieldProps {
  /** Ends the screensaver. Called on any click, Escape, or other key press. */
  onExit: () => void;
}

const LANES = [0, 1, 2, 3] as const;

/**
 * The 1997 Starfield screensaver: token-coloured stars flying out from the centre in flat SVG.
 * It stands still under prefers-reduced-motion. Any click or key press ends it at once.
 */
export function Starfield({ onExit }: StarfieldProps) {
  const stars = useMemo(() => starfield(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      onExit();
    };
    // Capture, so the key that ends the screensaver does nothing else on the page.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onExit]);

  return (
    <div
      className="starfield"
      role="dialog"
      aria-modal="true"
      aria-label="Starfield screensaver. Press any key or click to return."
      // Exit on the click itself, so the press never reaches a window underneath.
      onClick={(e) => {
        e.stopPropagation();
        onExit();
      }}
    >
      <svg className="starfield__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        {LANES.map((lane) => (
          <g key={lane} className={`starfield__lane starfield__lane--${lane}`}>
            {stars
              .filter((s) => s.lane === lane)
              .map((s, i) => (
                <circle key={i} className="starfield__star" cx={s.x} cy={s.y} r={s.r} />
              ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
