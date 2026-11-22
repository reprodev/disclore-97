import type { StorageLike } from './discLibrary';

/** Bookmarks live under their own key per disc, apart from the burned-disc library keys. */
export const BOOKMARK_PREFIX = 'disclore97.bookmarks.';
export const MAX_BOOKMARKS = 100;

/**
 * Reads a per-disc list of section ids stored under `prefix + discId`, oldest first. Anything
 * unreadable, duplicated, or (when `validIds` is given) not a section of the disc is dropped.
 * Never throws. Bookmarks and visited sections share this format.
 */
export function loadIdList(
  storage: StorageLike | undefined,
  prefix: string,
  discId: string,
  max: number,
  validIds?: ReadonlySet<string>,
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(prefix + discId);
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
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Writes a per-disc id list. Returns false when storage is missing or refuses. */
export function saveIdList(
  storage: StorageLike | undefined,
  prefix: string,
  discId: string,
  ids: readonly string[],
  max: number,
): boolean {
  if (!storage) return false;
  try {
    if (ids.length === 0) storage.removeItem(prefix + discId);
    else storage.setItem(prefix + discId, JSON.stringify({ v: 1, sections: ids.slice(0, max) }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the bookmarked section ids of one disc, oldest first. Anything unreadable, duplicated,
 * or (when `validIds` is given) not a section of the disc is dropped. Never throws.
 */
export function loadBookmarks(
  storage: StorageLike | undefined,
  discId: string,
  validIds?: ReadonlySet<string>,
): string[] {
  return loadIdList(storage, BOOKMARK_PREFIX, discId, MAX_BOOKMARKS, validIds);
}

/** Writes the bookmark list of one disc. Returns false when storage is missing or refuses. */
export function saveBookmarks(storage: StorageLike | undefined, discId: string, ids: readonly string[]): boolean {
  return saveIdList(storage, BOOKMARK_PREFIX, discId, ids, MAX_BOOKMARKS);
}

/** Adds the id when absent, removes it when present. */
export function toggleBookmark(ids: readonly string[], sectionId: string): string[] {
  return ids.includes(sectionId) ? ids.filter((id) => id !== sectionId) : [...ids, sectionId].slice(-MAX_BOOKMARKS);
}
