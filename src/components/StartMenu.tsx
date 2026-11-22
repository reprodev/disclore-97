import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick, playSpinUp } from '../audio/audio';
import { EDITIONS, THEMES } from '../model/editions';
import type { Theme } from '../model/editions';
import type { DiscManifest } from '../model/manifest';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import '../styles/taskbar.css';

/** What the Start menu can do. An action that is left out is dimmed. */
export interface StartMenuActions {
  onBurnNew?: () => void;
  onMountImage?: () => void;
  onOpenDictionary?: () => void;
  onTour?: () => void;
  onFlashcards?: () => void;
  onOpenReadMe?: () => void;
  onReplaySplash?: () => void;
  /** Picks an edition. With theme, the Edition submenu shows which one is on. */
  onSetTheme?: (theme: Theme) => void;
  theme?: Theme;
}

export interface StartMenuProps extends StartMenuActions {
  discs: DiscManifest[];
  onOpenDisc: (discId: string) => void;
  onCloseAll: () => void;
  /** Closes the menu and returns the focus to the Start button. */
  onClose: () => void;
}

type Submenu = 'discs' | 'edition' | null;

/**
 * The Win95 Start menu: a vertical "DiscLore 97" strip beside a list of programs. The Mounted Discs
 * and Edition items open submenus. Up and Down move through the items, Right opens a submenu and
 * Left closes it, Enter or Space runs the item, and Escape closes the menu.
 */
export function StartMenu({
  discs,
  onOpenDisc,
  onCloseAll,
  onClose,
  onBurnNew,
  onMountImage,
  onOpenDictionary,
  onTour,
  onFlashcards,
  onOpenReadMe,
  onReplaySplash,
  onSetTheme,
  theme = 'classic',
}: StartMenuProps) {
  const [sub, setSub] = useState<Submenu>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Open with the first item focused, so the keyboard works at once.
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
  }, []);

  /** Runs an action: click sound, close the menu, then the action. */
  const run = (fn?: () => void) => () => {
    if (!fn) return;
    playClick();
    onClose();
    fn();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
    const inSub = target.closest('.startmenu__sub') !== null;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        // Stay inside the open submenu while the focus is in it.
        const scope = inSub ? items.filter((i) => i.closest('.startmenu__sub') === target.closest('.startmenu__sub')) : items.filter((i) => !i.closest('.startmenu__sub'));
        const list = scope.length > 0 ? scope : items;
        const i = list.indexOf(target);
        const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[next]?.focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'ArrowRight': {
        const key = target.getAttribute('data-submenu') as Submenu;
        if (key) {
          e.preventDefault();
          setSub(key);
          // Move into the submenu once it has rendered.
          window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>(`.startmenu__sub [role^="menuitem"]`)?.focus(), 0);
        }
        break;
      }
      case 'ArrowLeft':
        if (inSub) {
          e.preventDefault();
          const owner = rootRef.current?.querySelector<HTMLElement>(`[data-submenu="${sub}"]`);
          setSub(null);
          owner?.focus();
        }
        break;
    }
  };

  const item = (label: string, icon: IconName, fn: (() => void) | undefined, hint?: string) => (
    <button
      type="button"
      role="menuitem"
      className="startmenu__item"
      disabled={fn === undefined}
      onClick={run(fn)}
      title={hint}
    >
      <PixelIcon name={icon} size={32} />
      <span>{label}</span>
    </button>
  );

  const toggleSub = (key: Exclude<Submenu, null>) => () => {
    playClick();
    setSub((s) => (s === key ? null : key));
  };

  return (
    <div ref={rootRef} className="startmenu" role="menu" aria-label="Start menu" onKeyDown={onKeyDown}>
      <div className="startmenu__banner" aria-hidden="true">
        <span>DiscLore 97</span>
      </div>
      <div className="startmenu__items">
        <button
          type="button"
          role="menuitem"
          className="startmenu__item"
          aria-haspopup="menu"
          aria-expanded={sub === 'discs'}
          data-submenu="discs"
          onClick={toggleSub('discs')}
        >
          <PixelIcon name="cd" size={32} />
          <span>Mounted Discs</span>
          <span className="startmenu__arrow" aria-hidden="true">
            {'\u25BA'}
          </span>
        </button>
        {sub === 'discs' ? (
          <div className="startmenu__sub" role="menu" aria-label="Mounted Discs">
            {discs.length === 0 ? <p className="startmenu__empty">No discs are mounted.</p> : null}
            {discs.map((d) => (
              <button
                key={d.disc_id}
                type="button"
                role="menuitem"
                className="startmenu__item"
                onClick={run(() => {
                  playSpinUp();
                  onOpenDisc(d.disc_id);
                })}
              >
                <PixelIcon name="cd" size={16} />
                <span>{d.title}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="startmenu__sep" role="separator" />
        {item('Burn New CD-R Disc...', 'cd', onBurnNew)}
        {item('Mount Disc Image (.json)...', 'cd', onMountImage)}
        {item('Dictionary...', 'book', onOpenDictionary)}
        {item('Take a Tour', 'castle', onTour)}
        {item('Study Flashcards', 'key', onFlashcards)}
        <button
          type="button"
          role="menuitem"
          className="startmenu__item"
          aria-haspopup="menu"
          aria-expanded={sub === 'edition'}
          data-submenu="edition"
          disabled={onSetTheme === undefined}
          onClick={toggleSub('edition')}
        >
          <PixelIcon name="torch" size={32} />
          <span>Edition Switcher</span>
          <span className="startmenu__arrow" aria-hidden="true">
            {'\u25BA'}
          </span>
        </button>
        {sub === 'edition' && onSetTheme ? (
          <div className="startmenu__sub" role="menu" aria-label="Edition Switcher">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={t === theme}
                className="startmenu__item"
                onClick={run(() => onSetTheme(t))}
              >
                <span className="startmenu__check" aria-hidden="true">
                  {t === theme ? '\u2022' : ''}
                </span>
                <span>{EDITIONS[t].name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="startmenu__sep" role="separator" />
        {item('About / ReadMe.txt', 'notepad', onOpenReadMe)}
        {item('Replay Intro Splash', 'key', onReplaySplash)}
        <div className="startmenu__sep" role="separator" />
        {item('Close All Windows', 'key', onCloseAll)}
      </div>
    </div>
  );
}
