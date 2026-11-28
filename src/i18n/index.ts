/**
 * The DiscLore '97 shell in twelve languages: the classic 1997 regional editions plus major world
 * languages. Pure data and lookups. English is the default and the fallback for anything missing.
 */
import type { MessageKey, TranslationTable } from './keys';
import { ar } from './locales/ar';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { zh } from './locales/zh';

export type { MessageKey, TranslationTable } from './keys';
export { MESSAGE_KEYS } from './keys';

export const LOCALES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export interface LocaleInfo {
  code: Locale;
  /** The language's own name, for the Language dialog. */
  name: string;
  /** Text direction of the shell in this language. */
  dir: 'ltr' | 'rtl';
}

export const LOCALE_INFO: Readonly<Record<Locale, LocaleInfo>> = {
  en: { code: 'en', name: 'English', dir: 'ltr' },
  fr: { code: 'fr', name: 'Français', dir: 'ltr' },
  de: { code: 'de', name: 'Deutsch', dir: 'ltr' },
  es: { code: 'es', name: 'Español', dir: 'ltr' },
  it: { code: 'it', name: 'Italiano', dir: 'ltr' },
  pt: { code: 'pt', name: 'Português', dir: 'ltr' },
  nl: { code: 'nl', name: 'Nederlands', dir: 'ltr' },
  pl: { code: 'pl', name: 'Polski', dir: 'ltr' },
  ja: { code: 'ja', name: '日本語', dir: 'ltr' },
  ko: { code: 'ko', name: '한국어', dir: 'ltr' },
  zh: { code: 'zh', name: '中文', dir: 'ltr' },
  ar: { code: 'ar', name: 'العربية', dir: 'rtl' },
};

export const TABLES: Readonly<Record<Locale, TranslationTable>> = { en, fr, de, es, it, pt, nl, pl, ja, ko, zh, ar };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Any value, read as a known locale. Unknown or missing values are English. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export type MessageVars = Readonly<Record<string, string | number>>;

/**
 * The string for a key in a locale, with `{name}` placeholders filled from `vars`. A locale or key
 * that is missing or empty falls back to English. Unknown placeholders are left as written.
 */
export function t(locale: unknown, key: MessageKey, vars?: MessageVars): string {
  const table = TABLES[toLocale(locale)];
  const raw = table[key] || en[key] || key;
  if (!vars) return raw;
  return raw.replace(/\{([a-z]+)\}/gi, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}
