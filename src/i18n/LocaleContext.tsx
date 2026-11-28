import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, t } from './index';
import type { Locale, MessageKey, MessageVars } from './index';

/** The shell's language. Components outside a provider (for example in tests) read English. */
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** A translate function bound to the current locale: `tr('menu_file')`, `tr('km_moves', { n: 3 })`. */
export function useT(): (key: MessageKey, vars?: MessageVars) => string {
  const locale = useContext(LocaleContext);
  return (key, vars) => t(locale, key, vars);
}
