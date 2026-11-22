/**
 * Inline cross-links: finds mentions of other article titles inside a paragraph and splits the
 * paragraph into plain text and link pieces. The result is plain data, so the UI renders it with
 * ordinary React elements and never needs to build HTML.
 */

export interface LinkTarget {
  section_id: string;
  title: string;
}

export interface Segment {
  text: string;
  /** Set when this piece is a mention of another article. */
  sectionId?: string;
}

/** Titles shorter than this are never linked, so common short words stay plain. */
export const MIN_LINK_TITLE = 4;

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * Splits `text` around the first whole-word, case-insensitive mention of each target title.
 * Each target is linked at most once, longer titles win over shorter ones that overlap them,
 * and mentions never overlap. With no mentions the result is one plain segment.
 */
export function linkSegments(text: string, targets: readonly LinkTarget[]): Segment[] {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; id: string }[] = [];

  const ordered = [...targets]
    .filter((t) => t.title.trim().length >= MIN_LINK_TITLE)
    .sort((a, b) => b.title.length - a.title.length);

  for (const target of ordered) {
    const needle = target.title.trim().toLowerCase();
    let from = 0;
    for (;;) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      const clean = !isWordChar(lower[at - 1]) && !isWordChar(lower[end]);
      const free = ranges.every((r) => end <= r.start || at >= r.end);
      if (clean && free) {
        ranges.push({ start: at, end, id: target.section_id });
        break;
      }
      from = at + 1;
    }
  }

  if (ranges.length === 0) return [{ text }];
  ranges.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
    out.push({ text: text.slice(r.start, r.end), sectionId: r.id });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
