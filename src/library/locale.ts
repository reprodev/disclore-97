import type { StorageLike } from './discLibrary';
import { DEFAULT_LOCALE, toLocale } from '../i18n';
import type { Locale } from '../i18n';

/** The shell language, saved as its code. */
export const LOCALE_KEY = 'disclore97.locale';

/** Reads the shell language. Missing, unknown, or unreadable values give English. Never throws. */
export function loadLocale(storage: StorageLike | undefined): Locale {
  try {
    return toLocale(storage?.getItem(LOCALE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Saves the shell language. English removes the key. Returns false when storage refuses. */
export function saveLocale(storage: StorageLike | undefined, locale: Locale): boolean {
  if (!storage) return false;
  try {
    if (locale === DEFAULT_LOCALE) storage.removeItem(LOCALE_KEY);
    else storage.setItem(LOCALE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
