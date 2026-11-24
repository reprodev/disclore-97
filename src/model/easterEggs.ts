/**
 * DiscLore '97 Easter eggs: pure data and lookups only. No React, no DOM, no audio, no clock, and no
 * unseeded randomness. The components decide when to show these; this module only says what to show.
 */

// ---------------------------------------------------------------------------
// Drive D:\LINER_NOTES.TXT
// ---------------------------------------------------------------------------

/** Clicks on the Drive D: light, in quick succession, that open the liner notes. */
export const LINER_NOTES_CLICKS = 5;
/** The longest pause between those clicks, in milliseconds, before the count starts again. */
export const LINER_NOTES_CLICK_GAP_MS = 1200;

export const LINER_NOTES_TITLE = 'Drive D:\\LINER_NOTES.TXT';

/** The liner notes, one paragraph per entry. The last block holds gentle hints for the other secrets. */
export const LINER_NOTES: readonly string[] = [
  "DiscLore '97 Multimedia Reference & Study Disc. Pressed in 1997 for the home PC, in 256 glorious colours.",
  'Minimum system: a 486DX2/66, 8 MB of RAM, a double-speed CD-ROM drive, a Sound Blaster compatible card, and a little patience while the disc spins up.',
  'Thanks to every librarian, keeper, and late-night modem user who made the encyclopedia worth reading. No floppies were harmed in the making of this disc.',
];

export const LINER_NOTES_HINTS: readonly string[] = [
  'Knock three times on the open desk, and the stars may come out.',
  'Old arcade fingers remember the way: up, up, down, down, and then some.',
  'A few old words still whisper back from the Pinpointer.',
  'The Dictionary keeps an editor’s notebook in its margins.',
  'The dungeon torches are fond of a friendly tap.',
];

/** What the Eject Disc button says, because there is only ever one disc in this box. */
export const EJECT_MESSAGE = 'Please insert Disc 2 (there is no Disc 2).';

// ---------------------------------------------------------------------------
// Konami code
// ---------------------------------------------------------------------------

export const KONAMI_SEQUENCE: readonly string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/** The collector stamp the Konami code toggles in the Home status bar. */
export const ARCHIVE_KEY_STAMP = "Archive Key '97";

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Advances the Konami code by one key. `progress` is how many keys of the sequence have matched so
 * far. Returns the new progress, which equals KONAMI_SEQUENCE.length when the code is complete. A
 * wrong key starts again, keeping the key itself when it can begin (or continue) the sequence.
 */
export function konamiStep(progress: number, key: string): number {
  const k = normalizeKey(key);
  const at = Number.isInteger(progress) && progress >= 0 && progress < KONAMI_SEQUENCE.length ? progress : 0;
  if (KONAMI_SEQUENCE[at] === k) return at + 1;
  // "Up, Up, Up" is still two Ups into the code.
  if (at === 2 && k === 'ArrowUp') return 2;
  return KONAMI_SEQUENCE[0] === k ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Pinpointer whispers
// ---------------------------------------------------------------------------

export type WhisperId = 'xyzzy' | 'iddqd' | 'cow' | 'clippy' | 'y2k' | '42' | 'kiroween' | 'modem';

export interface Whisper {
  id: WhisperId;
  text: string;
}

const WHISPERS: readonly { id: WhisperId; keys: readonly string[]; text: string }[] = [
  { id: 'xyzzy', keys: ['xyzzy'], text: 'A hollow voice says "Fool." Nothing happens, but the disc spins a little faster.' },
  { id: 'iddqd', keys: ['iddqd'], text: 'Degreelessness mode on. The encyclopedia remains, as ever, fully mortal.' },
  { id: 'cow', keys: ['there is no cow level'], text: 'Then this must be the Reference Shelf level. Mind the stacks.' },
  { id: 'clippy', keys: ['clippy'], text: 'It looks like you are searching an encyclopedia. Would you like help with that?' },
  { id: 'y2k', keys: ['y2k'], text: 'Two digits for the year? This disc says relax until 31 December 1999.' },
  { id: '42', keys: ['42'], text: 'The answer is on Disc 1. The question was on a disc nobody pressed.' },
  { id: 'kiroween', keys: ['kiroween'], text: 'The lantern flickers. Try the Haunted Edition, if you dare.' },
  {
    id: 'modem',
    keys: ['dialup', 'dial up', 'dial-up', '56k', 'modem'],
    text: 'Handshake in progress... connected at 56,000 bps. Please do not pick up the phone.',
  },
];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The one-line 1997 whisper for a Pinpointer query, or null. The whole query must match one of the
 * secret words (case and surrounding spaces do not matter), so an ordinary search never sees one.
 */
export function pinpointerWhisper(query: string): Whisper | null {
  const q = normalizeQuery(query);
  if (q === '') return null;
  const hit = WHISPERS.find((w) => w.keys.includes(q));
  return hit ? { id: hit.id, text: hit.text } : null;
}

/** The whisper that comes with a short modem chirp. */
export const MODEM_WHISPER_ID: WhisperId = 'modem';

// ---------------------------------------------------------------------------
// Dictionary editorial notes
// ---------------------------------------------------------------------------

export interface EditorialNote {
  headword: string;
  note: string;
}

const NOTES: Readonly<Record<string, EditorialNote>> = {
  disclore: {
    headword: 'DiscLore',
    note: 'n. A multimedia reference and study disc. Insert, spin up, and read in peace: no pop-ups, no autoplaying video.',
  },
  keepmaze: {
    headword: 'KeepMaze',
    note: 'n. A trivia dungeon in which every locked door is a question about what you just read. Torches sold separately.',
  },
  encarta: {
    headword: 'Encarta',
    note: 'n. A CD-ROM encyclopedia of the 1990s whose look inspired this disc. DiscLore \u201997 is an unaffiliated tribute.',
  },
  clippy: {
    headword: 'Clippy',
    note: 'n. An animated paperclip assistant of 1997, famous for offering help with letters you were not writing.',
  },
  y2k: {
    headword: 'Y2K',
    note: 'n. The Year 2000 problem: two-digit years that might read 2000 as 1900. Editors expect the worst on 1 January.',
  },
  kiroween: {
    headword: 'Kiroween',
    note: 'n. An autumn festival of builders and lanterns. The Haunted Edition is kept in its honour.',
  },
  '1997': {
    headword: '1997',
    note: 'n. The year this disc was pressed: double-speed drives, 56k modems, and screensavers full of stars.',
  },
};

/** The "Editorial Note (1997)" for a Dictionary word, or null. Works offline: it is plain data. */
export function editorialNote(word: string): EditorialNote | null {
  const w = word.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(NOTES, w) ? NOTES[w]! : null;
}

// ---------------------------------------------------------------------------
// KeepMaze torch tap
// ---------------------------------------------------------------------------

export const TORCH_WHISPERS: readonly string[] = [
  'The torch crackles: "Read the article first, adventurer."',
  'A draught from the stairwell smells of old parchment.',
  'Somewhere below, a door remembers the answer.',
  'The flame bows politely. It cannot give hints, only light.',
];

/** The whisper for the n-th tap (0-based), rotating through TORCH_WHISPERS. */
export function torchWhisper(tap: number): string {
  const n = TORCH_WHISPERS.length;
  const i = Number.isFinite(tap) ? ((Math.trunc(tap) % n) + n) % n : 0;
  return TORCH_WHISPERS[i]!;
}

// ---------------------------------------------------------------------------
// Starfield screensaver
// ---------------------------------------------------------------------------

/** Clicks on the bare desktop, in quick succession, that start the screensaver. */
export const STARFIELD_CLICKS = 3;
export const STARFIELD_CLICK_GAP_MS = 500;

export interface Star {
  /** Start position in a 0..100 square, around the centre. */
  x: number;
  y: number;
  /** Radius in the same units. */
  r: number;
  /** Which of the CSS animation lanes the star flies in (0..3). */
  lane: number;
}

/**
 * A deterministic starfield: the same count always gives the same stars. A small linear
 * congruential generator stands in for randomness, so this stays a pure lookup.
 */
export function starfield(count = 96): Star[] {
  const n = Math.max(0, Math.min(400, Math.trunc(count)));
  let s = 1997;
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round((4 + next() * 92) * 10) / 10;
    const y = Math.round((4 + next() * 92) * 10) / 10;
    const r = Math.round((0.25 + next() * 0.55) * 100) / 100;
    stars.push({ x, y, r, lane: i % 4 });
  }
  return stars;
}
