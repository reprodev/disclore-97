import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick } from '../audio/audio';

export interface DesktopMenuItem {
  label: string;
  onSelect: () => void;
  /** Draws a separator line above the item. */
  separator?: boolean;
}

export interface DesktopContextMenuProps {
  /** Where the right-click landed, relative to the desktop. */
  x: number;
  y: number;
  items: readonly DesktopMenuItem[];
  onClose: () => void;
}

/**
 * The desktop's right-click menu. It opens at the pointer, moved back inside the desktop when it
 * would hang off an edge. An item click, a click outside, or Escape closes it; the arrow keys,
 * Home, and End move between items.
 */
export function DesktopContextMenu({ x, y, items, onClose }: DesktopContextMenuProps) {
  const ref = useRef<HTMLUListElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the whole menu on screen: shift it left or up when the pointer was near an edge.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    menu.querySelector<HTMLButtonElement>('button')?.focus();
    const host = menu.offsetParent as HTMLElement | null;
    if (!host) return;
    const left = Math.max(0, Math.min(x, host.clientWidth - menu.offsetWidth - 2));
    const top = Math.max(0, Math.min(y, host.clientHeight - menu.offsetHeight - 2));
    setPos({ left, top });
  }, [x, y]);

  // A press anywhere outside the menu closes it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      go(at - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(buttons.length - 1);
    } else if (e.key === 'Tab') {
      onClose();
    }
  };

  return (
    <ul
      ref={ref}
      className="desktop-menu"
      role="menu"
      aria-label="Desktop"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <li key={item.label} role="none">
          {item.separator ? <div className="desktop-menu__rule" role="separator" /> : null}
          <button
            type="button"
            role="menuitem"
            className="desktop-menu__item"
            onClick={() => {
              playClick();
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
