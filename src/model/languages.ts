/**
 * Wikipedia languages a disc can be burned in: pure data. This list is the allowlist for the
 * /api/topic `lang` parameter, the `DiscManifest.language` field, and the Read Aloud voice. Only
 * these codes ever become part of a Wikipedia host name, so no caller can point a lookup anywhere else.
 */

export const WIKI_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh', 'ar', 'sv', 'tr'] as const;
export type WikiLanguage = (typeof WIKI_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: WikiLanguage = 'en';

/** Each language's name in its own language, for selectors and badges. */
export const LANGUAGE_NAMES: Readonly<Record<WikiLanguage, string>> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ar: 'العربية',
  sv: 'Svenska',
  tr: 'Türkçe',
};

/** The BCP 47 tag the browser's speech voices use for each language. */
export const SPEECH_TAGS: Readonly<Record<WikiLanguage, string>> = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-BR',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ar: 'ar-SA',
  sv: 'sv-SE',
  tr: 'tr-TR',
};

/** Languages written right to left. */
const RTL: ReadonlySet<WikiLanguage> = new Set<WikiLanguage>(['ar']);

export function isWikiLanguage(value: unknown): value is WikiLanguage {
  return typeof value === 'string' && (WIKI_LANGUAGES as readonly string[]).includes(value);
}

/** Any value, read as a known language. Unknown or missing values are English. */
export function toWikiLanguage(value: unknown): WikiLanguage {
  return isWikiLanguage(value) ? value : DEFAULT_LANGUAGE;
}

/** The speech tag for a disc language, for example `fr` gives `fr-FR`. Unknown values give `en-US`. */
export function speechTag(language: unknown): string {
  return SPEECH_TAGS[toWikiLanguage(language)];
}

/**
 * The `lang` and `dir` attributes for a block of disc text (an article, a tour stop, a card) shown
 * inside a shell in `shellLocale`. Nothing is added while both are English, so the English page is
 * unchanged. Otherwise the disc text always states its own language and direction, so an English
 * disc in an Arabic shell still reads left to right.
 */
export function discTextAttrs(discLanguage: unknown, shellLocale: string): { lang?: string; dir?: 'ltr' | 'rtl' } {
  const lang = toWikiLanguage(discLanguage);
  if (lang === DEFAULT_LANGUAGE && shellLocale === DEFAULT_LANGUAGE) return {};
  return { lang, dir: isRtl(lang) ? 'rtl' : 'ltr' };
}

/** Whether text in this language runs right to left. */
export function isRtl(language: unknown): boolean {
  return RTL.has(toWikiLanguage(language));
}
