import { fnv1a32 } from './prng';
import type { SourceKind } from '../source';

const DISC_ID_MAX = 48;

export function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function hash4(s: string): string {
  return fnv1a32(s).toString(36).padStart(4, '0').slice(-4);
}

/** Disc id: starts with the Source_Kind, ends with a 4-character hash, at most 48 characters. */
export function discId(kind: SourceKind, identity: string): string {
  const id = identity.trim().toLowerCase();
  const room = DISC_ID_MAX - kind.length - 6;
  const head = slug(id).slice(0, room).replace(/-+$/, '');
  const hash = hash4(kind + id);
  return head ? `${kind}-${head}-${hash}` : `${kind}-${hash}`;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

export interface IdAllocator {
  section(title: string): string;
  diagram(): string;
  trivia(): string;
  dungeon(): string;
  hall(): string;
}

export const ENTRANCE_ID = 'entrance';
export const THRONE_ID = 'throne_room';

/** Counter-backed ids, so every id is unique in its scope without a duplicate check. */
export function createIdAllocator(): IdAllocator {
  let sections = 0;
  let diagrams = 0;
  let questions = 0;
  let dungeons = 0;
  let halls = 0;
  return {
    section(title: string): string {
      sections += 1;
      const s = slug(title).slice(0, 24).replace(/-+$/, '');
      return s ? `s${two(sections)}-${s}` : `s${two(sections)}`;
    },
    diagram: () => `diagram-${++diagrams}`,
    trivia: () => `q-${two(++questions)}`,
    dungeon: () => `dungeon-${++dungeons}`,
    hall: () => `hall_${two(++halls)}`,
  };
}
