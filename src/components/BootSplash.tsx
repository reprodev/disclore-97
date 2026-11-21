import { useEffect, useRef } from 'react';
import { BevelButton } from './BevelButton';
import { InitBar, SplashArt } from './SplashArt';
import '../styles/splash.css';

export interface BootSplashProps {
  /** Called once when the splash ends, by timer, click, Enter, or Skip. */
  onDone: () => void;
  /** Auto-advance delay in milliseconds. */
  delayMs?: number;
}

/**
 * Stage 1: a compact boot plaque shown alone on the teal desktop. It advances
 * after about 1.6 s, or at once on click, Enter, or Skip. With reduced motion
 * it advances immediately.
 */
export function BootSplash({ onDone, delayMs = 1600 }: BootSplashProps) {
  const finished = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      doneRef.current();
    };

    const reduced =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      finish();
      return;
    }

    const timer = window.setTimeout(finish, delayMs);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [delayMs]);

  const advance = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };

  return (
    <div className="boot-splash" onClick={advance}>
      <div className="boot-plaque" role="region" aria-label="DiscLore '97 boot splash">
        <div className="splash">
          <SplashArt />
          <div className="splash__text">
            <h1 className="splash__title">DiscLore '97 Multimedia Encyclopedia &mdash; 1997 Edition</h1>
            <InitBar />
          </div>
        </div>
        <div className="boot-plaque__footer">
          <span className="boot-plaque__hint">Click or press Enter to continue</span>
          <BevelButton
            onClick={(e) => {
              e.stopPropagation();
              advance();
            }}
          >
            Skip
          </BevelButton>
        </div>
      </div>
    </div>
  );
}
