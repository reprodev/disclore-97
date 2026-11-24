import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_KEY_STAMP,
  editorialNote,
  EJECT_MESSAGE,
  KONAMI_SEQUENCE,
  konamiStep,
  LINER_NOTES,
  LINER_NOTES_HINTS,
  LINER_NOTES_TITLE,
  pinpointerWhisper,
  starfield,
  TORCH_WHISPERS,
  torchWhisper,
} from '../../src/model/easterEggs';

const run = (keys: readonly string[], from = 0) => keys.reduce((p, k) => konamiStep(p, k), from);

describe('Konami code', () => {
  it('completes on the exact sequence', () => {
    expect(run(KONAMI_SEQUENCE)).toBe(KONAMI_SEQUENCE.length);
  });

  it('accepts B and A in either case', () => {
    expect(run([...KONAMI_SEQUENCE.slice(0, 8), 'B', 'A'])).toBe(KONAMI_SEQUENCE.length);
  });

  it('starts again on a wrong key, and a third Up still counts as two', () => {
    expect(run(['ArrowUp', 'ArrowUp', 'x'])).toBe(0);
    expect(run(['ArrowUp', 'ArrowDown', 'ArrowUp'])).toBe(1);
    expect(run(['ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI_SEQUENCE.slice(2)])).toBe(KONAMI_SEQUENCE.length);
    expect(run(KONAMI_SEQUENCE.slice(0, 9).concat('b'))).toBe(0);
  });

  it('treats a bad progress value as zero', () => {
    expect(konamiStep(-3, 'ArrowUp')).toBe(1);
    expect(konamiStep(99, 'ArrowUp')).toBe(1);
    expect(konamiStep(Number.NaN, 'q')).toBe(0);
  });

  it("names the Archive Key '97 stamp", () => {
    expect(ARCHIVE_KEY_STAMP).toBe("Archive Key '97");
  });
});

describe('Pinpointer whispers', () => {
  it.each([
    ['xyzzy', 'xyzzy'],
    ['IDDQD', 'iddqd'],
    ['  There is   no cow level ', 'cow'],
    ['clippy', 'clippy'],
    ['Y2K', 'y2k'],
    ['42', '42'],
    ['Kiroween', 'kiroween'],
    ['dialup', 'modem'],
    ['dial-up', 'modem'],
    ['56K', 'modem'],
    ['modem', 'modem'],
  ])('%s whispers (%s)', (query, id) => {
    const w = pinpointerWhisper(query);
    expect(w?.id).toBe(id);
    expect(w!.text.length).toBeGreaterThan(10);
    expect(w!.text).not.toMatch(/\n/);
  });

  it.each(['', '   ', 'castle', 'xyzz', 'xyzzy plugh', '421', 'modems', 'cow level'])('stays quiet for %j', (q) => {
    expect(pinpointerWhisper(q)).toBeNull();
  });
});

describe('Dictionary editorial notes', () => {
  it.each(['disclore', 'keepmaze', 'encarta', 'clippy', 'y2k', 'kiroween', '1997'])('has a note for %s', (w) => {
    const note = editorialNote(w);
    expect(note).not.toBeNull();
    expect(note!.headword.toLowerCase()).toBe(w);
    expect(note!.note.length).toBeGreaterThan(20);
    expect(editorialNote(` ${w.toUpperCase()} `)).toEqual(note);
  });

  it('has nothing for other words, including object keys', () => {
    for (const w of ['castle', '', 'toString', 'constructor', '__proto__', '1998']) expect(editorialNote(w)).toBeNull();
  });

  it('says plainly that the tribute is unaffiliated', () => {
    expect(editorialNote('encarta')!.note).toMatch(/unaffiliated/);
  });
});

describe('KeepMaze torch whispers', () => {
  it('has 3 to 4 short whispers and rotates through them', () => {
    expect(TORCH_WHISPERS.length).toBeGreaterThanOrEqual(3);
    expect(TORCH_WHISPERS.length).toBeLessThanOrEqual(4);
    for (const w of TORCH_WHISPERS) expect(w.length).toBeLessThanOrEqual(80);
    const n = TORCH_WHISPERS.length;
    expect(torchWhisper(0)).toBe(TORCH_WHISPERS[0]);
    expect(torchWhisper(n)).toBe(TORCH_WHISPERS[0]);
    expect(torchWhisper(n + 1)).toBe(TORCH_WHISPERS[1]);
    expect(torchWhisper(-1)).toBe(TORCH_WHISPERS[n - 1]);
    expect(torchWhisper(Number.NaN)).toBe(TORCH_WHISPERS[0]);
  });
});

describe('liner notes and the starfield', () => {
  it('has the liner notes, the eject gag, and a hint for each of the other secrets', () => {
    expect(LINER_NOTES_TITLE).toBe('Drive D:\\LINER_NOTES.TXT');
    expect(LINER_NOTES.length).toBeGreaterThan(0);
    expect(EJECT_MESSAGE).toBe('Please insert Disc 2 (there is no Disc 2).');
    const hints = LINER_NOTES_HINTS.join(' ');
    for (const word of [/three times/, /up, up, down, down/, /Pinpointer/, /Dictionary/, /torch/]) expect(hints).toMatch(word);
  });

  it('draws the same stars every time, inside the frame', () => {
    const a = starfield();
    expect(a).toEqual(starfield());
    expect(a.length).toBe(96);
    for (const s of a) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(100);
      expect(s.r).toBeGreaterThan(0);
      expect([0, 1, 2, 3]).toContain(s.lane);
    }
    expect(starfield(-5)).toEqual([]);
    expect(starfield(10_000)).toHaveLength(400);
  });
});

describe('easterEggs.ts stays a pure lookup module', () => {
  const src = readFileSync(resolve(__dirname, '../../src/model/easterEggs.ts'), 'utf8');
  it('has no imports, DOM, network, audio, clock, or unseeded randomness', () => {
    expect(src).not.toMatch(/^import /m);
    for (const bad of ['document.', 'window.', 'localStorage', 'navigator', 'fetch(', 'AudioContext', 'Math.random', 'Date.now', 'new Date']) {
      expect(src, bad).not.toContain(bad);
    }
  });
});
