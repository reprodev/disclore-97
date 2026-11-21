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
  onOpenDisc: (discId: string) => void;
  onCloseAll: () => void;
}

/**
 * Bottom taskbar: Start button and menu, the active window's tab, and a tray
 * holding the global Mute control.
 */
export function Taskbar({ discs, active, onOpenDisc, onCloseAll }: TaskbarProps) {
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
          <div className="taskbar__tab" aria-current="true">
            <PixelIcon name={active.icon} />
            <span className="taskbar__tab-text">{active.title}</span>
          </div>
        ) : null}
      </div>

      <div className="taskbar__tray">
        <MuteToggle />
      </div>
    </div>
  );
}
