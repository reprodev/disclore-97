import type { StorageLike } from './discLibrary';

/** The chosen theme is kept under this key. Absent means the classic look. */
export const THEME_KEY = 'disclore97.theme';
export type Theme = 'classic' | 'haunted';
/** The class that switches the token overrides on, set on the document element. */
export const HAUNTED_CLASS = 'theme-haunted';

/** Reads the saved theme. Anything unreadable gives classic. Never throws. */
export function loadTheme(storage: StorageLike | undefined): Theme {
  try {
    return storage?.getItem(THEME_KEY) === 'haunted' ? 'haunted' : 'classic';
  } catch {
    return 'classic';
  }
}

/** Saves the theme (classic removes the key). Returns false when storage is missing or refuses. */
export function saveTheme(storage: StorageLike | undefined, theme: Theme): boolean {
  if (!storage) return false;
  try {
    if (theme === 'haunted') storage.setItem(THEME_KEY, 'haunted');
    else storage.removeItem(THEME_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Puts the theme class on (or takes it off) the given element, normally `document.documentElement`. */
export function applyTheme(root: Element, theme: Theme): void {
  root.classList.toggle(HAUNTED_CLASS, theme === 'haunted');
}
