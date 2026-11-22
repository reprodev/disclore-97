import type { StorageLike } from './discLibrary';
import { THEMES } from '../model/editions';
import type { Theme } from '../model/editions';

export type { Theme } from '../model/editions';
export { nextTheme } from '../model/editions';

/** The chosen edition is kept under this key. Absent means Classic '97. Older saves hold "haunted". */
export const THEME_KEY = 'disclore97.theme';
/** The classes that switch the token overrides on, set on the document element. */
export const HAUNTED_CLASS = 'theme-haunted';
export const SOLSTICE_CLASS = 'theme-solstice';

/** Reads the saved edition. Anything unknown or unreadable gives classic. Never throws. */
export function loadTheme(storage: StorageLike | undefined): Theme {
  try {
    const v = storage?.getItem(THEME_KEY);
    return THEMES.find((t) => t !== 'classic' && t === v) ?? 'classic';
  } catch {
    return 'classic';
  }
}

/** Saves the edition (classic removes the key). Returns false when storage is missing or refuses. */
export function saveTheme(storage: StorageLike | undefined, theme: Theme): boolean {
  if (!storage) return false;
  try {
    if (theme === 'classic') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Puts the edition's class on the given element (normally `document.documentElement`) and takes the others off. */
export function applyTheme(root: Element, theme: Theme): void {
  root.classList.toggle(HAUNTED_CLASS, theme === 'haunted');
  root.classList.toggle(SOLSTICE_CLASS, theme === 'solstice');
}
