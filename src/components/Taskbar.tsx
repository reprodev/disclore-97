import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick, playSpinUp } from '../audio/audio';
import type { DiscManifest } from '../model/manifest';
import { MuteToggle } from './MuteToggle';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
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
}

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
}: TaskbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    if (e.key === 'Escape') setMenuOpen(false);
  };

  const pick = (fn: () => void) => () => {
    playClick();
    setMenuOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="taskbar" role="toolbar" aria-label="Taskbar" onKeyDown={onKeyDown}>
      {menuOpen ? (
        <div className="startmenu" role="menu" aria-label="Start menu">
          <div className="startmenu__banner" aria-hidden="true">
            <span>DiscLore 97</span>
          </div>
          <div className="startmenu__items">
            {discs.map((d) => (
              <button
                key={d.disc_id}
                type="button"
                role="menuitem"
                className="startmenu__item"
                onClick={pick(() => {
                  playSpinUp();
                  onOpenDisc(d.disc_id);
                })}
              >
                <PixelIcon name="cd" size={32} />
                <span>{d.title}</span>
              </button>
            ))}
            <div className="startmenu__sep" role="separator" />
            <button type="button" role="menuitem" className="startmenu__item" onClick={pick(onCloseAll)}>
              <PixelIcon name="key" size={32} />
              <span>Close All Windows</span>
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
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
        >
          <PixelIcon name="cd" size={16} />
          <span className="taskbar__led" aria-hidden="true" />
        </span>
        <MuteToggle />
        <TrayClock />
      </div>
    </div>
  );
}
