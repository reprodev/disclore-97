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

/** File name for the exported notebook: `<disc-id>-notes.txt`, or `.md` for the Markdown export. */
export function notesFileName(discId: string, ext: 'txt' | 'md' = 'txt'): string {
  const base = discId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'disc'}-notes.${ext}`;
}

/** The Markdown export: a `# <Disc Title> — Research Notes` heading, a blank line, then the notes. */
export function notesMarkdown(discTitle: string, text: string): string {
  const title = discTitle.replace(/\s+/g, ' ').trim() || 'Untitled Disc';
  const body = text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  return `# ${title} \u2014 Research Notes\n\n${body}\n`;
}

/** Longest quote "+ Quote" adds, so one selection cannot fill the pad. */
export const MAX_QUOTE_CHARS = 500;

/** A selection as one quoted line: whitespace collapsed, straight quotes kept, capped with an ellipsis. Empty in gives empty out. */
export function quoteText(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t === '') return '';
  const body = t.length > MAX_QUOTE_CHARS ? `${t.slice(0, MAX_QUOTE_CHARS - 3).trimEnd()}...` : t;
  return `"${body}"`;
}

// ---- Notes pinned to the desktop -----------------------------------------------------------------

/** Disc ids whose notebooks are pinned to the Win95 desktop, oldest first. */
export const PINNED_NOTES_KEY = 'disclore97.pinnedNotes';
export const MAX_PINNED_NOTES = 12;

/** Reads the pinned notebook disc ids. Anything unreadable or duplicated is dropped. Never throws. */
export function loadPinnedNotes(storage: StorageLike | undefined): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PINNED_NOTES_KEY);
    if (typeof raw !== 'string') return [];
    const p: unknown = JSON.parse(raw);
    const list = typeof p === 'object' && p !== null && Array.isArray((p as { discs?: unknown }).discs) ? (p as { discs: unknown[] }).discs : [];
    const out: string[] = [];
    for (const id of list) {
      if (typeof id !== 'string' || id === '' || out.includes(id)) continue;
      out.push(id);
      if (out.length >= MAX_PINNED_NOTES) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Writes the pinned list (an empty list removes the key). Returns false when storage is missing or refuses. */
export function savePinnedNotes(storage: StorageLike | undefined, ids: readonly string[]): boolean {
  if (!storage) return false;
  try {
    if (ids.length === 0) storage.removeItem(PINNED_NOTES_KEY);
    else storage.setItem(PINNED_NOTES_KEY, JSON.stringify({ v: 1, discs: ids.slice(0, MAX_PINNED_NOTES) }));
    return true;
  } catch {
    return false;
  }
}

/** Pins a disc's notes when unpinned, unpins them when pinned. */
export function togglePinnedNotes(ids: readonly string[], discId: string): string[] {
  return ids.includes(discId) ? ids.filter((id) => id !== discId) : [...ids, discId].slice(-MAX_PINNED_NOTES);
}

/**
 * A short disc name for a desktop label: without the "DiscLore '97:" prefix, cut at the first
 * " & ", " and ", ":", ",", or " - ", and capped at 20 characters.
 */
export function shortDiscTitle(title: string): string {
  let t = title.replace(/\s+/g, ' ').trim().replace(/^DiscLore\s*'97\s*:\s*/i, '');
  const cutAt = t.search(/ & | and |:|,| - /);
  if (cutAt > 0) t = t.slice(0, cutAt);
  t = t.trim();
  if (t.length > 20) t = `${t.slice(0, 19).trimEnd()}\u2026`;
  return t || 'Disc';
}
