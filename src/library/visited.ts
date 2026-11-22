import { loadIdList, saveIdList } from './bookmarks';
import type { StorageLike } from './discLibrary';

/** Visited articles live under their own key per disc, like bookmarks. */
export const VISITED_PREFIX = 'disclore97.visited.';
export const MAX_VISITED = 500;

/** Reads the section ids already opened on one disc. Never throws. */
export function loadVisited(storage: StorageLike | undefined, discId: string, validIds?: ReadonlySet<string>): string[] {
  return loadIdList(storage, VISITED_PREFIX, discId, MAX_VISITED, validIds);
}

/** Writes the visited list of one disc. Returns false when storage is missing or refuses. */
export function saveVisited(storage: StorageLike | undefined, discId: string, ids: readonly string[]): boolean {
  return saveIdList(storage, VISITED_PREFIX, discId, ids, MAX_VISITED);
}

/** Adds the id when it is new. Returns the same array when it was already there. */
export function markVisited(ids: readonly string[], sectionId: string): readonly string[] {
  return ids.includes(sectionId) ? ids : [...ids, sectionId].slice(-MAX_VISITED);
}
