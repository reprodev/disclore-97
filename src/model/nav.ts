import type { DiscManifest } from './manifest';

export type View =
  | { kind: 'section'; section_id: string }
  | { kind: 'diagram'; diagram_id: string }
  | { kind: 'keepmaze'; dungeon_id: string };

export interface NavState {
  discId: string | null;
  view: View | null;
}

export const initialNav: NavState = { discId: null, view: null };

/**
 * Selects a section. An unknown id leaves the state unchanged (same object)
 * and reports not-found.
 */
export function selectSection(
  state: NavState,
  disc: DiscManifest | undefined,
  sectionId: string,
): { state: NavState; notFound: string | null } {
  if (!disc || !disc.sections.some((s) => s.section_id === sectionId)) {
    return { state, notFound: `Section not found: ${sectionId}` };
  }
  return { state: { ...state, view: { kind: 'section', section_id: sectionId } }, notFound: null };
}

/** Browser-style history. `null` entries are the disc home (contents) page. */
export interface History {
  entries: (View | null)[];
  index: number;
}

export const initialHistory: History = { entries: [null], index: 0 };

export function sameView(a: View | null, b: View | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'section':
      return a.section_id === (b as typeof a).section_id;
    case 'diagram':
      return a.diagram_id === (b as typeof a).diagram_id;
    case 'keepmaze':
      return a.dungeon_id === (b as typeof a).dungeon_id;
  }
}

export function currentView(h: History): View | null {
  return h.entries[h.index] ?? null;
}

export const canGoBack = (h: History): boolean => h.index > 0;
export const canGoForward = (h: History): boolean => h.index < h.entries.length - 1;

/** Visits a view: drops any forward entries. Visiting the current view changes nothing. */
export function pushView(h: History, view: View | null): History {
  if (sameView(currentView(h), view)) return h;
  const entries = [...h.entries.slice(0, h.index + 1), view];
  return { entries, index: entries.length - 1 };
}

export function goBack(h: History): History {
  return canGoBack(h) ? { ...h, index: h.index - 1 } : h;
}

export function goForward(h: History): History {
  return canGoForward(h) ? { ...h, index: h.index + 1 } : h;
}
