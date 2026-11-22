import type { StorageLike } from './discLibrary';

/** Bookmarks live under their own key per disc, apart from the burned-disc library keys. */
export const BOOKMARK_PREFIX = 'disclore97.bookmarks.';
export const MAX_BOOKMARKS = 100;

const keyFor = (discId: string): string => BOOKMARK_PREFIX + discId;

/**
 * Reads the bookmarked section ids of one disc, oldest first. Anything unreadable, duplicated,
 * or (when `validIds` is given) not a section of the disc is dropped. Never throws.
 */
export function loadBookmarks(
  storage: StorageLike | undefined,
  discId: string,
  validIds?: ReadonlySet<string>,
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(keyFor(discId));
    if (typeof raw !== 'string') return [];
    const parsed: unknown = JSON.parse(raw);
    const list =
      typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { sections?: unknown }).sections)
        ? ((parsed as { sections: unknown[] }).sections)
        : [];
    const out: string[] = [];
    for (const id of list) {
      if (typeof id !== 'string' || out.includes(id)) continue;
      if (validIds && !validIds.has(id)) continue;
      out.push(id);
      if (out.length >= MAX_BOOKMARKS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Writes the bookmark list of one disc. Returns false when storage is missing or refuses. */
export function saveBookmarks(storage: StorageLike | undefined, discId: string, ids: readonly string[]): boolean {
  if (!storage) return false;
  try {
    if (ids.length === 0) storage.removeItem(keyFor(discId));
    else storage.setItem(keyFor(discId), JSON.stringify({ v: 1, sections: ids.slice(0, MAX_BOOKMARKS) }));
    return true;
  } catch {
    return false;
  }
}

/** Adds the id when absent, removes it when present. */
export function toggleBookmark(ids: readonly string[], sectionId: string): string[] {
  return ids.includes(sectionId) ? ids.filter((id) => id !== sectionId) : [...ids, sectionId].slice(-MAX_BOOKMARKS);
}
