import type { StorageLike } from './discLibrary';

/** Research Notebook notes live under their own key per disc. */
export const NOTES_PREFIX = 'disclore97.notes.';
export const MAX_NOTE_CHARS = 20000;

/** Reads one disc's notebook text. Anything unreadable gives an empty string. Never throws. */
export function loadNotes(storage: StorageLike | undefined, discId: string): string {
  if (!storage) return '';
  try {
    const raw = storage.getItem(NOTES_PREFIX + discId);
    if (typeof raw !== 'string') return '';
    const p: unknown = JSON.parse(raw);
    const text = typeof p === 'object' && p !== null ? (p as { text?: unknown }).text : undefined;
    return typeof text === 'string' ? text.slice(0, MAX_NOTE_CHARS) : '';
  } catch {
    return '';
  }
}

/** Writes one disc's notebook text (an empty text removes the key). Returns false when storage refuses. */
export function saveNotes(storage: StorageLike | undefined, discId: string, text: string): boolean {
  if (!storage) return false;
  try {
    if (text === '') storage.removeItem(NOTES_PREFIX + discId);
    else storage.setItem(NOTES_PREFIX + discId, JSON.stringify({ v: 1, text: text.slice(0, MAX_NOTE_CHARS) }));
    return true;
  } catch {
    return false;
  }
}

/** One notebook line for a fact: `[Section title] fact`. */
export function formatNote(sectionTitle: string, fact: string): string {
  return `[${sectionTitle.trim()}] ${fact.trim()}`;
}

/** Adds a line to the end of the notes, on its own line. Over the size limit, the oldest lines go first. */
export function appendNote(notes: string, line: string): string {
  const base = notes.replace(/\s+$/, '');
  let next = base === '' ? line : `${base}\n${line}`;
  while (next.length > MAX_NOTE_CHARS && next.includes('\n')) next = next.slice(next.indexOf('\n') + 1);
  return next.slice(-MAX_NOTE_CHARS);
}

/** File name for the exported notebook: `<disc-id>-notes.txt`. */
export function notesFileName(discId: string): string {
  const base = discId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'disc'}-notes.txt`;
}
