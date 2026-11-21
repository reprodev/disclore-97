import { useEffect, useRef, useState } from 'react';
import { playChime } from '../audio/audio';
import { BevelButton } from './BevelButton';
import { HeroArt, InitBar } from './SplashArt';
import '../styles/splash.css';

/** Status lines shown in order, one per quarter of the boot time. */
export const BOOT_MESSAGES = [
  'Detecting 4x CD-ROM drive (D:)...',
  'Initializing procedural WebAudio synth...',
  'Verifying KeepMaze BFS solver...',
  'Mounting Expansion Packs...',
] as const;

export const BOOT_DURATION_MS = 10000;

/** Two-column spec strip under the progress bar. */
const SPECS: [string, string][] = [
  ['Audio:', 'Procedural WebAudio'],
  ['Atlas:', 'Interactive SVG'],
  ['Maze:', 'BFS Verified'],
  ['Drive:', 'D: CD-ROM, 4x'],
];

export interface BootSplashProps {
  /** Called once when the splash ends, by timer, click, Enter, Escape, or Skip. */
  onDone: () => void;
  /** Auto-advance delay in milliseconds. */
  delayMs?: number;
}

/**
 * Stage 1: a compact boot plaque shown alone on the teal desktop. It advances
 * after 10 seconds, or at once on click, Enter, Escape, or Skip. Reduced motion
 * only simplifies the CSS animation. It never dismisses the splash.
 */
export function BootSplash({ onDone, delayMs = BOOT_DURATION_MS }: BootSplashProps) {
  const finished = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [step, setStep] = useState(0);

  /** The chime plays only for a user gesture, never for the auto-advance timer. */
  const finish = (userInitiated = false) => {
    if (finished.current) return;
    finished.current = true;
    if (userInitiated) playChime();
    doneRef.current();
  };

  useEffect(() => {
    const quarter = delayMs / BOOT_MESSAGES.length;
    const timer = window.setTimeout(() => finish(), delayMs);
    const ticker = window.setInterval(() => setStep((s) => Math.min(s + 1, BOOT_MESSAGES.length - 1)), quarter);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        finish(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      document.removeEventListener('keydown', onKey);
    };
  }, [delayMs]);

  return (
    <div className="boot-splash" onClick={() => finish(true)}>
      <div className="boot-card" role="region" aria-label="DiscLore '97 boot splash">
        <div className="boot-card__frame">
          <div className="boot-hero">
            <HeroArt />
          </div>

          <div className="boot-titleblock">
            <h1 className="boot-title">DiscLore '97</h1>
            <p className="boot-subtitle">Multimedia Encyclopedia &bull; 1997 Edition</p>
            <p className="boot-seal">KeepMaze Engine &bull; Procedural Audio</p>
          </div>

          <div className="boot-console">
            <InitBar durationSec={delayMs / 1000} step={step} message={BOOT_MESSAGES[step]!} />
            <dl className="boot-specs">
              {SPECS.map(([label, value]) => (
                <div key={label} className="boot-specs__row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="boot-footer">
            <span className="boot-plaque__hint">Click or press Enter to continue</span>
            <BevelButton
              onClick={(e) => {
                e.stopPropagation();
                finish(true);
              }}
            >
              Skip
            </BevelButton>
          </div>
        </div>
      </div>
    </div>
  );
}