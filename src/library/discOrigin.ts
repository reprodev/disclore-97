import type { DiscManifest } from '../model/manifest';

/** Where a disc came from, for the tag on its Home card. */
export type DiscOrigin = 'Built-In' | 'Wikipedia' | 'GitHub' | 'Web' | 'Markdown' | 'Outline' | 'Disc Image';

const OFFLINE_OUTLINE = /offline study outline/i;

/**
 * Names a disc's origin. A disc that ships with the app is Built-In. A burned or mounted disc is
 * told apart by the kind prefix the compiler gives its id. A topic disc is a Wikipedia article, or
 * an Outline when the lookup failed and the offline study outline was used instead.
 */
export function discOrigin(disc: DiscManifest, builtIn: boolean): DiscOrigin {
  if (builtIn) return 'Built-In';
  if (disc.outline !== undefined) return 'Outline';
  const id = disc.disc_id;
  if (id.startsWith('github-')) return 'GitHub';
  if (id.startsWith('webpage-')) return 'Web';
  if (id.startsWith('markdown-')) return 'Markdown';
  if (id.startsWith('topic-')) {
    const outline = disc.sections.some((s) => s.paragraphs.some((p) => OFFLINE_OUTLINE.test(p)));
    return outline ? 'Outline' : 'Wikipedia';
  }
  return 'Disc Image';
}

/** The badge class for an origin, for example `pack-badge--wikipedia`. */
export function originClassName(origin: DiscOrigin): string {
  switch (origin) {
    case 'Built-In':
      return 'pack-badge--builtin';
    case 'Wikipedia':
      return 'pack-badge--wikipedia';
    case 'GitHub':
      return 'pack-badge--github';
    case 'Web':
      return 'pack-badge--web';
    case 'Markdown':
      return 'pack-badge--markdown';
    case 'Outline':
      return 'pack-badge--outline';
    case 'Disc Image':
      return 'pack-badge--image';
  }
}