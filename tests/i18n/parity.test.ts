import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, LOCALE_INFO, LOCALES, MESSAGE_KEYS, t, TABLES, toLocale } from '../../src/i18n';
import type { Locale } from '../../src/i18n';
import { loadLocale, LOCALE_KEY, saveLocale } from '../../src/library/locale';
import type { StorageLike } from '../../src/library/discLibrary';

const en = TABLES.en;
const placeholders = (s: string) => [...s.matchAll(/\{([a-z]+)\}/gi)].map((m) => m[1]).sort();

describe('i18n key parity', () => {
  it('offers the twelve regional and world editions, English first', () => {
    expect([...LOCALES]).toEqual(['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh', 'ar']);
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('has one dictionary file per locale, and no stray files', () => {
    const files = readdirSync(resolve(__dirname, '../../src/i18n/locales'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    expect(files).toEqual([...LOCALES].sort());
  });

  it('English defines exactly the declared keys', () => {
    expect(Object.keys(en).sort()).toEqual([...MESSAGE_KEYS].sort());
  });

  it.each(LOCALES.map((l) => [l]))('%s has exactly the same keys as English, none empty, with the same placeholders', (locale) => {
    const table = TABLES[locale as Locale];
    expect(Object.keys(table).sort()).toEqual(Object.keys(en).sort());
    for (const key of MESSAGE_KEYS) {
      const value = table[key];
      expect(typeof value, `${locale}.${key}`).toBe('string');
      expect(value.trim(), `${locale}.${key} is empty`).not.toBe('');
      expect(value, `${locale}.${key} has markup`).not.toMatch(/[<>]/);
      expect(placeholders(value), `${locale}.${key} placeholders`).toEqual(placeholders(en[key]));
    }
  });

  it('non-English editions are real translations, not copies of English', () => {
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      const same = MESSAGE_KEYS.filter((k) => TABLES[locale][k] === en[k]);
      // Brand and product words (KeepMaze, OK, Start) may stay the same; most strings must not.
      expect(same.length, `${locale} copies ${same.join(', ')}`).toBeLessThan(MESSAGE_KEYS.length * 0.15);
    }
  });
});

describe('locale metadata', () => {
  it('names each language in its own script and marks only Arabic right to left', () => {
    for (const locale of LOCALES) {
      const info = LOCALE_INFO[locale];
      expect(info.code).toBe(locale);
      expect(info.name.trim()).not.toBe('');
      expect(['ltr', 'rtl']).toContain(info.dir);
    }
    expect(LOCALES.filter((l) => LOCALE_INFO[l].dir === 'rtl')).toEqual(['ar']);
    expect(LOCALE_INFO.ja.name).toBe('日本語');
    expect(LOCALE_INFO.ar.name).toBe('العربية');
  });
});

describe('t()', () => {
  it('translates, fills placeholders, and falls back to English for unknown locales', () => {
    expect(t('en', 'menu_file')).toBe('File');
    expect(t('fr', 'menu_file')).toBe('Fichier');
    expect(t('de', 'km_moves', { n: 3 })).toBe('Züge: 3');
    expect(t('ja', 'km_torchesLit', { n: 2, total: 3 })).toBe('たいまつ 3 本中 2 本が点灯');
    expect(t('xx', 'menu_file')).toBe('File');
    expect(t(undefined, 'menu_view')).toBe('View');
    expect(t('en', 'km_moves')).toBe('Moves: {n}');
    expect(t('en', 'km_moves', { other: 1 })).toBe('Moves: {n}');
  });

  it('reads locale values safely', () => {
    for (const bad of [null, '', 'EN', 'en-US', 'klingon', 42, '__proto__']) expect(toLocale(bad)).toBe('en');
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('sv')).toBe(false);
  });
});

describe('locale storage', () => {
  const memory = (init: Record<string, string> = {}): StorageLike & { map: Map<string, string> } => {
    const map = new Map(Object.entries(init));
    return {
      map,
      get length() {
        return map.size;
      },
      key: (i) => [...map.keys()][i] ?? null,
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
  };

  it('saves under disclore97.locale, removes it for English, and falls back on junk or refusal', () => {
    const s = memory();
    expect(loadLocale(s)).toBe('en');
    expect(saveLocale(s, 'ar')).toBe(true);
    expect(s.map.get(LOCALE_KEY)).toBe('ar');
    expect(loadLocale(s)).toBe('ar');
    saveLocale(s, 'en');
    expect(s.map.has(LOCALE_KEY)).toBe(false);
    expect(loadLocale(memory({ [LOCALE_KEY]: '<script>' }))).toBe('en');
    const throwing: StorageLike = {
      get length(): number {
        throw new Error('x');
      },
      key: () => {
        throw new Error('x');
      },
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => {
        throw new Error('x');
      },
    };
    expect(loadLocale(throwing)).toBe('en');
    expect(saveLocale(throwing, 'fr')).toBe(false);
  });
});

describe('src/i18n stays plain data', () => {
  it('the dictionaries import nothing but the shared type, and hold no hex colours or URLs', () => {
    const dir = resolve(__dirname, '../../src/i18n/locales');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(resolve(dir, f), 'utf8');
      const imports = src.match(/^import .*$/gm) ?? [];
      expect(imports, f).toEqual(["import type { TranslationTable } from '../keys';"]);
      expect(src, f).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(src, f).not.toMatch(/https?:/);
    }
  });
});
