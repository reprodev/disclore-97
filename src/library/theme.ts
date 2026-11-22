import type { StorageLike } from './discLibrary';
import { toTheme } from '../model/editions';
import type { Theme } from '../model/editions';

export type { Theme } from '../model/editions';
export { nextTheme } from '../model/editions';

/**
 * The chosen edition is kept under this key. Absent means Classic '97. Older saves may hold
 * "haunted", or "solstice" from the Winter Solstice edition, which now reads as Christmas Edition.
 */
export const THEME_KEY = 'disclore97.theme';
/** The classes that switch the token overrides on, set on the document element. */
export const HAUNTED_CLASS = 'theme-haunted';
export const CHRISTMAS_CLASS = 'theme-christmas';
/** The class the Winter Solstice edition used. It is always taken off. */
const LEGACY_CLASSES = ['theme-solstice'];

/** Reads the saved edition. A legacy value maps to its replacement, and anything else unknown or unreadable gives classic. Never throws. */
export function loadTheme(storage: StorageLike | undefined): Theme {
  try {
    const v = storage?.getItem(THEME_KEY);
    if (v === 'classic') return 'classic';
    return toTheme(v);
  } catch {
    return 'classic';
  }
}

/** Saves the edition (classic removes the key). Returns false when storage is missing or refuses. */
export function saveTheme(storage: StorageLike | undefined, theme: Theme): boolean {
  if (!storage) return false;
  try {
    const t = toTheme(theme);
    if (t === 'classic') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, t);
    return true;
  } catch {
    return false;
  }
}

/** Puts the edition's class on the given element (normally `document.documentElement`) and takes the others off. */
export function applyTheme(root: Element, theme: Theme): void {
  const t = toTheme(theme);
  root.classList.toggle(HAUNTED_CLASS, t === 'haunted');
  root.classList.toggle(CHRISTMAS_CLASS, t === 'christmas');
  root.classList.remove(...LEGACY_CLASSES);
}
