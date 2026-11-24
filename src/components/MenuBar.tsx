import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import '../styles/menubar.css';

export interface MenuItemDef {
  label: string;
  onSelect: () => void;
  /** Makes the item a checkable menu item (menuitemcheckbox) with a Win95 check mark when true. */
  checked?: boolean;
}

export interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

export interface MenuBarProps {
  menus: MenuDef[];
}

export function MenuBar({ menus }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [activeItem, setActiveItem] = useState(0);
  const [focusTop, setFocusTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const topRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const close = (refocusTop = true) => {
    const idx = openMenu;
    setOpenMenu(null);
    if (refocusTop && idx !== null) topRefs.current[idx]?.focus();
  };

  useEffect(() => {
    if (openMenu === null) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  useEffect(() => {
    if (openMenu !== null) itemRefs.current[activeItem]?.focus();
  }, [openMenu, activeItem]);

  const openAt = (m: number, item = 0) => {
    setFocusTop(m);
    setActiveItem(item);
    setOpenMenu(m);
  };

  const moveTop = (m: number) => {
    const next = (m + menus.length) % menus.length;
    if (openMenu !== null) openAt(next);
    else {
      setFocusTop(next);
      topRefs.current[next]?.focus();
    }
  };

  const onTopKey = (e: KeyboardEvent, m: number) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        moveTop(m + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveTop(m - 1);
        break;
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        e.preventDefault();
        openAt(m);
        break;
      case 'ArrowUp':
        e.preventDefault();
        openAt(m, Math.max(menus[m].items.length - 1, 0));
        break;
      case 'Escape':
        if (openMenu !== null) {
          e.preventDefault();
          close();
        }
        break;
    }
  };

  const onItemKey = (e: KeyboardEvent, m: number, i: number) => {
    const items = menus[m].items;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveItem((i + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveItem((i - 1 + items.length) % items.length);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveTop(m + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveTop(m - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(m, i);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        setOpenMenu(null);
        break;
    }
  };

  const activate = (m: number, i: number) => {
    menus[m].items[i].onSelect();
    close();
  };

  return (
    <div className="menubar" role="menubar" ref={rootRef}>
      {menus.map((menu, m) => (
        <div className="menubar__entry" key={menu.label}>
          <button
            type="button"
            role="menuitem"
            className="menubar__top"
            aria-haspopup="menu"
            aria-expanded={openMenu === m}
            tabIndex={focusTop === m ? 0 : -1}
            ref={(el) => {
              topRefs.current[m] = el;
            }}
            onClick={() => (openMenu === m ? close(false) : openAt(m))}
            onKeyDown={(e) => onTopKey(e, m)}
          >
            {menu.label}
          </button>
          {openMenu === m && (
            <div className="menubar__menu" role="menu" aria-label={menu.label}>
              {menu.items.map((item, i) => (
                <div
                  key={item.label}
                  role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={item.checked}
                  className={item.checked === undefined ? 'menubar__item' : 'menubar__item menubar__item--check'}
                  tabIndex={activeItem === i ? 0 : -1}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  onMouseEnter={() => setActiveItem(i)}
                  onClick={() => activate(m, i)}
                  onKeyDown={(e) => onItemKey(e, m, i)}
                >
                  {item.checked === undefined ? null : (
                    <span className="menubar__check" aria-hidden="true">
                      {item.checked ? '\u2713' : ''}
                    </span>
                  )}
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MenuBar;
