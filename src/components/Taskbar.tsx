import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick } from '../audio/audio';
import { LINER_NOTES_CLICK_GAP_MS, LINER_NOTES_CLICKS } from '../model/easterEggs';
import type { DiscManifest } from '../model/manifest';
import { LinerNotesDialog } from './LinerNotesDialog';
import { AmbienceToggle } from './AmbienceToggle';
import { MuteToggle } from './MuteToggle';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import { StartMenu } from './StartMenu';
import type { StartMenuActions } from './StartMenu';
import '../styles/taskbar.css';

export interface ActiveWindowInfo {
  title: string;
  icon: IconName;
}

export interface TaskbarProps {
  discs: DiscManifest[];
  /** Topmost open window, shown as the active tab. Null when none is open. */
  active: ActiveWindowInfo | null;
  /** True when the active window is minimized: its tab is shown raised. */
  minimized?: boolean;
  /** Clicking the tab minimizes a visible window or restores a minimized one. */
  onToggleActive?: () => void;
  onOpenDisc: (discId: string) => void;
  onCloseAll: () => void;
  /** True while the ReadMe.txt Notepad window is open: it gets its own tab. */
  readMeOpen?: boolean;
  /** True when the Notepad window is minimized: its tab is shown raised. */
  readMeMinimized?: boolean;
  onToggleReadMe?: () => void;
  /** Lights the Drive D: indicator while a disc is in the drive. */
  driveActive?: boolean;
  /** What the Start menu items do. An item with no action is dimmed. */
  startActions?: StartMenuActions;
  /** Bumped on every disc seek (open, burn, navigation). Each new value flashes the Drive D: LED briefly. */
  activityKey?: number;
}

/** How long the Drive D: LED flashes after a seek, in milliseconds. */
export const SEEK_PULSE_MS = 700;

/** Local time as HH:MM, 24-hour. */
export function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** System tray clock. Re-reads the time every second, but re-renders only when the minute changes. */
function TrayClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const text = formatClock(now);
  return (
    <time className="taskbar__clock" dateTime={text} title={now.toDateString()}>
      {text}
    </time>
  );
}

/**
 * Bottom taskbar: Start button and menu, the active window's tab, and a tray
 * holding the global Mute control.
 */
export function Taskbar({
  discs,
  active,
  minimized = false,
  onToggleActive,
  onOpenDisc,
  onCloseAll,
  readMeOpen = false,
  readMeMinimized = false,
  onToggleReadMe,
  driveActive = false,
  startActions,
  activityKey = 0,
}: TaskbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  // The LED flashes while the latest activity key has not yet been settled by its timer.
  const [settledKey, setSettledKey] = useState(activityKey);
  const seeking = activityKey !== settledKey;
  useEffect(() => {
    if (activityKey === settledKey) return;
    const id = window.setTimeout(() => setSettledKey(activityKey), SEEK_PULSE_MS);
    return () => window.clearTimeout(id);
  }, [activityKey, settledKey]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);

  // Easter egg: five quick clicks on the Drive D: light open its liner notes.
  const [linerOpen, setLinerOpen] = useState(false);
  const driveClicks = useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  const onDriveClick = (e: { timeStamp: number }) => {
    const now = e.timeStamp;
    const c = driveClicks.current;
    c.count = now - c.last <= LINER_NOTES_CLICK_GAP_MS ? c.count + 1 : 1;
    c.last = now;
    if (c.count >= LINER_NOTES_CLICKS) {
      c.count = 0;
      setLinerOpen(true);
    }
  };
  // Eject Disc pulses the LED for a little longer than a seek, then it settles again.
  const [ejectPulse, setEjectPulse] = useState(0);
  const [settledEject, setSettledEject] = useState(0);
  const ejecting = ejectPulse !== settledEject;
  useEffect(() => {
    if (ejectPulse === settledEject) return;
    const id = window.setTimeout(() => setSettledEject(ejectPulse), SEEK_PULSE_MS * 2);
    return () => window.clearTimeout(id);
  }, [ejectPulse, settledEject]);
  const flashing = seeking || ejecting;

  // Close the menu when the pointer goes down anywhere outside the taskbar.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      startRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="taskbar" role="toolbar" aria-label="Taskbar" onKeyDown={onKeyDown}>
      {menuOpen ? (
        <StartMenu
          {...startActions}
          discs={discs}
          onOpenDisc={onOpenDisc}
          onCloseAll={onCloseAll}
          onClose={() => {
            setMenuOpen(false);
            startRef.current?.focus();
          }}
        />
      ) : null}

      <button
        type="button"
        ref={startRef}
        className="taskbar__start"
        aria-label="Start menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-pressed={menuOpen ? 'true' : 'false'}
        onClick={() => {
          playClick();
          setMenuOpen((o) => !o);
        }}
      >
        <PixelIcon name="cd" />
        <span aria-hidden="true">Start</span>
      </button>

      <div className="taskbar__tabs">
        {active ? (
          <button
            type="button"
            className="taskbar__tab"
            aria-pressed={!minimized}
            aria-label={`${active.title} (window)`}
            data-minimized={minimized ? 'true' : 'false'}
            onClick={() => {
              playClick();
              onToggleActive?.();
            }}
          >
            <PixelIcon name={active.icon} />
            <span className="taskbar__tab-text" aria-hidden="true">
              {active.title}
            </span>
          </button>
        ) : null}
        {readMeOpen ? (
          <button
            type="button"
            className="taskbar__tab"
            aria-pressed={!readMeMinimized}
            aria-label="ReadMe.txt - Notepad (window)"
            data-minimized={readMeMinimized ? 'true' : 'false'}
            onClick={() => {
              playClick();
              onToggleReadMe?.();
            }}
          >
            <PixelIcon name="notepad" />
            <span className="taskbar__tab-text" aria-hidden="true">
              ReadMe.txt - Notepad
            </span>
          </button>
        ) : null}
      </div>

      <div className="taskbar__tray">
        <span
          className="taskbar__drive"
          role="img"
          aria-label={driveActive ? 'Drive D: (CD-ROM), disc loaded' : 'Drive D: (CD-ROM), empty'}
          title="Drive D: (CD-ROM)"
          data-active={driveActive ? 'true' : 'false'}
          data-seek={flashing ? 'true' : 'false'}
          data-eject={ejecting ? 'true' : 'false'}
          onClick={onDriveClick}
        >
          <PixelIcon name="cd" size={16} />
          {/* Keyed by the activity so each new seek restarts the flash from its first step. */}
          <span key={flashing ? `${activityKey}-${ejectPulse}` : 'steady'} className="taskbar__led" aria-hidden="true" />
        </span>
        <AmbienceToggle />
        <MuteToggle />
        <TrayClock />
      </div>
      {linerOpen ? (
        <LinerNotesDialog onClose={() => setLinerOpen(false)} onEject={() => setEjectPulse((n) => n + 1)} />
      ) : null}
    </div>
  );
}
