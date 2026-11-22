/**
 * Editions: the three looks of DiscLore '97 and the copy and content that goes with each.
 * Pure data and functions. No React and no DOM.
 */

export type Theme = 'classic' | 'haunted' | 'christmas';

/** The order the Edition control cycles through. */
export const THEMES: readonly Theme[] = ['classic', 'haunted', 'christmas'];

/** Edition ids from earlier versions, and the edition each one became. */
export const LEGACY_THEMES: Readonly<Record<string, Theme>> = { solstice: 'christmas' };

/** Any value to a known edition: a current id, a legacy id, or else Classic '97. Never throws. */
export function toTheme(value: unknown): Theme {
  if (typeof value !== 'string') return 'classic';
  if ((THEMES as readonly string[]).includes(value)) return value as Theme;
  return LEGACY_THEMES[value] ?? 'classic';
}

export interface SampleBurn {
  label: string;
  topic: string;
}

export interface Edition {
  id: Theme;
  /** Short name used in menus: "Classic '97", "Haunted Edition", "Christmas Edition". */
  name: string;
  /** Line above the DISCLORE 97 title on the Home window. */
  eyebrow: string;
  /** Line under the title on the boot splash. */
  bootSubtitle: string;
  /** Quick-start burns offered while the library has no burned discs. */
  sampleBurns: readonly SampleBurn[];
  /** Built-in discs that suit this edition. Did You Know? starts from them. */
  themeDiscIds: readonly string[];
  /** A burned disc whose title matches also counts as a theme disc. */
  themeWords: RegExp | null;
}

const burn = (topic: string): SampleBurn => ({ label: `Burn Sample: ${topic}`, topic });

export const EDITIONS: Record<Theme, Edition> = {
  classic: {
    id: 'classic',
    name: "Classic '97",
    eyebrow: 'Multimedia Encyclopedia \u2022 1997 Edition',
    bootSubtitle: 'Multimedia Encyclopedia \u2022 1997 Edition',
    sampleBurns: [burn('Halloween'), burn('Gothic fiction'), burn('CD-ROM')],
    themeDiscIds: [],
    themeWords: null,
  },
  haunted: {
    id: 'haunted',
    name: 'Haunted Edition',
    eyebrow: 'Multimedia Encyclopedia \u2022 Haunted Edition',
    bootSubtitle: 'Multimedia Encyclopedia \u2022 Haunted Edition',
    sampleBurns: [burn('Halloween'), burn('Gothic fiction'), burn('Ghostlore')],
    themeDiscIds: ['halloween'],
    themeWords: /halloween|samhain|ghost|gothic|haunt|folklore|spook|vampire|witch/i,
  },
  christmas: {
    id: 'christmas',
    name: 'Christmas Edition',
    eyebrow: 'Multimedia Encyclopedia \u2022 Christmas Edition',
    bootSubtitle: 'Multimedia Encyclopedia \u2022 Christmas Edition',
    sampleBurns: [burn('Christmas'), burn('A Christmas Carol'), burn('Christmas tree')],
    // Festive, historic, and castle discs: great halls and feasts suit the season.
    themeDiscIds: ['castles'],
    themeWords: /christmas|yule|carol|advent|nativity|festive|holiday|winter|snow|castle|keep|histor/i,
  },
};

/** The edition's copy and content. An unknown or legacy id gets its replacement, or Classic '97, so this never returns undefined. */
export const editionOf = (theme: Theme): Edition => EDITIONS[toTheme(theme)];

/** The edition after this one, wrapping around. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(toTheme(theme)) + 1) % THEMES.length]!;
}

/** Whether a disc suits the edition (by id, or by words in its title). The classic edition prefers none. */
export function prefersDisc(theme: Theme, discId: string, discTitle: string): boolean {
  const e = editionOf(theme);
  return e.themeDiscIds.includes(discId) || (e.themeWords !== null && e.themeWords.test(discTitle));
}
