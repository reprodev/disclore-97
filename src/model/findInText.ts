/**
 * Find in Article: pure text splitting for match highlighting. No React and no DOM.
 */

export interface FindPiece {
  text: string;
  /** True when this piece is a match for the query. */
  hit: boolean;
}

/** The query as it is matched: trimmed, lowercase. Empty means "no search". */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Splits `text` into alternating plain and matching pieces. Matching ignores case and never overlaps. */
export function splitByQuery(text: string, query: string): FindPiece[] {
  const needle = normalizeQuery(query);
  if (needle === '' || text === '') return [{ text, hit: false }];
  const lower = text.toLowerCase();
  // Lowercasing can change string length for a few characters. Fall back to plain text then.
  if (lower.length !== text.length) return [{ text, hit: false }];
  const out: FindPiece[] = [];
  let pos = 0;
  for (;;) {
    const at = lower.indexOf(needle, pos);
    if (at === -1) break;
    if (at > pos) out.push({ text: text.slice(pos, at), hit: false });
    out.push({ text: text.slice(at, at + needle.length), hit: true });
    pos = at + needle.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
  return out.length > 0 ? out : [{ text, hit: false }];
}

/** How many matches `query` has in `text`. */
export function countMatches(text: string, query: string): number {
  return splitByQuery(text, query).filter((p) => p.hit).length;
}
