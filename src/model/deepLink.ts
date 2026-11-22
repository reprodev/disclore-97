/**
 * Deep links: shareable URLs that open DiscLore '97 on a disc, an article, a view, or a topic burn.
 *
 *   ?disc=<disc_id>
 *   ?disc=<disc_id>&section=<section_id>
 *   ?disc=<disc_id>&view=diagram|timeline|keepmaze|tour|flashcards|gallery
 *   ?topic=<query>
 *   ?notes=<encoded>   (shared Research Notebook notes, see noteShare.ts)
 *
 * Parsing and resolving are pure and never throw. Anything unknown or malformed is ignored.
 * No React and no DOM.
 */
import type { DiscManifest } from './manifest';
import type { View } from './nav';
import { MAX_SHARE_ENCODED } from './noteShare';
import { hasTimeline } from './timeline';

export const DEEP_VIEWS = ['diagram', 'timeline', 'keepmaze', 'tour', 'flashcards', 'gallery'] as const;
export type DeepView = (typeof DEEP_VIEWS)[number];

export interface DeepLink {
  disc?: string;
  section?: string;
  view?: DeepView;
  topic?: string;
  /** The raw ?notes= value. It is only checked for its alphabet and length here: decodeNotes() does the rest. */
  notes?: string;
}

const MAX_ID = 200;
export const MAX_TOPIC = 100;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

function id(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const t = raw.trim();
  return t !== '' && t.length <= MAX_ID && !CONTROL.test(t) ? t : undefined;
}

function topic(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TOPIC).trim();
  return t !== '' ? t : undefined;
}

/** Reads the deep-link parameters out of a query string (with or without the leading "?"). */
export function parseDeepLink(search: string): DeepLink {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(typeof search === 'string' ? search : '');
  } catch {
    return {};
  }
  const out: DeepLink = {};
  const disc = id(params.get('disc'));
  const section = id(params.get('section'));
  const view = params.get('view')?.trim().toLowerCase();
  const t = topic(params.get('topic'));
  const n = params.get('notes')?.trim();
  if (disc) out.disc = disc;
  if (section) out.section = section;
  if (view && (DEEP_VIEWS as readonly string[]).includes(view)) out.view = view as DeepView;
  if (t) out.topic = t;
  if (n && n.length <= MAX_SHARE_ENCODED && /^[A-Za-z0-9_-]+$/.test(n)) out.notes = n;
  return out;
}

/** Whether the link asks for anything at all. */
export const hasDeepLink = (link: DeepLink): boolean =>
  link.disc !== undefined || link.topic !== undefined || link.notes !== undefined;

/**
 * Where a link points among the mounted discs. Null when the disc is unknown. An unknown section,
 * or a view the disc has no content for, falls back to the disc's cover page (view null).
 * A section wins over a view.
 */
export function resolveDeepLink(link: DeepLink, discs: readonly DiscManifest[]): { discId: string; view: View | null } | null {
  if (link.disc === undefined) return null;
  const disc = discs.find((d) => d.disc_id === link.disc);
  if (!disc) return null;
  if (link.section !== undefined) {
    return {
      discId: disc.disc_id,
      view: disc.sections.some((s) => s.section_id === link.section) ? { kind: 'section', section_id: link.section } : null,
    };
  }
  switch (link.view) {
    case 'diagram': {
      const d = disc.diagrams[0];
      return { discId: disc.disc_id, view: d ? { kind: 'diagram', diagram_id: d.diagram_id } : null };
    }
    case 'keepmaze': {
      const d = disc.dungeons[0];
      return { discId: disc.disc_id, view: d ? { kind: 'keepmaze', dungeon_id: d.dungeon_id } : null };
    }
    case 'timeline':
      return { discId: disc.disc_id, view: hasTimeline(disc) ? { kind: 'timeline' } : null };
    case 'tour':
    case 'flashcards':
      return { discId: disc.disc_id, view: disc.sections.length > 0 ? { kind: link.view } : null };
    case 'gallery':
      return { discId: disc.disc_id, view: { kind: 'gallery' } };
    default:
      return { discId: disc.disc_id, view: null };
  }
}

/** The query string (with a leading "?") that reopens a disc and view. A diagram or dungeon shares as its view name. */
export function shareQuery(discId: string, view: View | null): string {
  const p = new URLSearchParams();
  p.set('disc', discId);
  if (view?.kind === 'section') p.set('section', view.section_id);
  else if (view !== null) p.set('view', view.kind);
  return `?${p.toString()}`;
}

/** The query string for a topic burn. */
export function topicQuery(query: string): string {
  const p = new URLSearchParams();
  p.set('topic', query);
  return `?${p.toString()}`;
}
