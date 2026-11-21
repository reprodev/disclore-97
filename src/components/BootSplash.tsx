import { useEffect, useRef, useState } from 'react';
import { BevelButton } from './BevelButton';
import { InitBar, SplashArt } from './SplashArt';
import '../styles/splash.css';

/** Status lines shown in order, one per quarter of the boot time. */
export const BOOT_MESSAGES = [
  'Detecting 4x CD-ROM drive (D:)...',
  'Initializing procedural WebAudio synth...',
  'Verifying KeepMaze BFS solver...',
  'Mounting Expansion Packs...',
] as const;

export const BOOT_DURATION_MS = 10000;

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

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };

  useEffect(() => {
    const quarter = delayMs / BOOT_MESSAGES.length;
    const timer = window.setTimeout(finish, delayMs);
    const ticker = window.setInterval(() => setStep((s) => Math.min(s + 1, BOOT_MESSAGES.length - 1)), quarter);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        finish();
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
    <div className="boot-splash" onClick={finish}>
      <div className="boot-plaque" role="region" aria-label="DiscLore '97 boot splash">
        <div className="splash">
          <SplashArt />
          <div className="splash__text">
            <h1 className="splash__title">DiscLore '97 Multimedia Encyclopedia &mdash; 1997 Edition</h1>
            <InitBar durationSec={delayMs / 1000} step={step} message={BOOT_MESSAGES[step]!} />
          </div>
        </div>
        <div className="boot-plaque__footer">
          <span className="boot-plaque__hint">Click or press Enter to continue</span>
          <BevelButton
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
          >
            Skip
          </BevelButton>
        </div>
      </div>
    </div>
  );
}
