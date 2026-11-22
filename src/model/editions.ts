/**
 * Editions: the three looks of DiscLore '97 and the copy and content that goes with each.
 * Pure data and functions. No React and no DOM.
 */

export type Theme = 'classic' | 'haunted' | 'solstice';

/** The order the Edition control cycles through. */
export const THEMES: readonly Theme[] = ['classic', 'haunted', 'solstice'];

export interface SampleBurn {
  label: string;
  topic: string;
}

export interface Edition {
  id: Theme;
  /** Short name used in menus: "Classic '97", "Haunted Edition", "Winter Solstice". */
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
  solstice: {
    id: 'solstice',
    name: 'Winter Solstice',
    eyebrow: 'Multimedia Encyclopedia \u2022 Winter Solstice Edition',
    bootSubtitle: 'Multimedia Encyclopedia \u2022 Winter Solstice Edition',
    sampleBurns: [burn('Winter solstice'), burn('Aurora'), burn('Lighthouse')],
    // Keeps and hearths: the built-in disc closest to a winter fortress.
    themeDiscIds: ['castles'],
    themeWords: /solstice|winter|aurora|lighthouse|snow|frost|yule|hearth/i,
  },
};

export const editionOf = (theme: Theme): Edition => EDITIONS[theme];

/** The edition after this one, wrapping around. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

/** Whether a disc suits the edition (by id, or by words in its title). The classic edition prefers none. */
export function prefersDisc(theme: Theme, discId: string, discTitle: string): boolean {
  const e = EDITIONS[theme];
  return e.themeDiscIds.includes(discId) || (e.themeWords !== null && e.themeWords.test(discTitle));
}
