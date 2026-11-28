import { useId } from 'react';
import type { ReactElement } from 'react';
import type { Theme } from '../model/editions';
import { DEFAULT_WALLPAPER } from '../model/wallpapers';
import type { WallpaperId } from '../model/wallpapers';

export interface DesktopWallpaperProps {
  edition: Theme;
  /** The chosen wallpaper. Edition Default follows the edition. */
  wallpaper?: WallpaperId;
  /** Extra class, for example for the small preview in Display Properties. */
  className?: string;
}

/** The pattern tile for the edition default: a Win95 pixel weave, faint stars, or faint snowflakes. */
function editionTile(edition: Theme, id: string): ReactElement {
  if (edition === 'haunted') {
    return (
      <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
        <polygon className="desktop-wallpaper__star" points="12,6 13,10 17,11 13,12 12,16 11,12 7,11 11,10" />
        <rect className="desktop-wallpaper__star" x="46" y="22" width="2" height="2" />
        <polygon className="desktop-wallpaper__star" points="54,46 55,49 58,50 55,51 54,54 53,51 50,50 53,49" />
        <rect className="desktop-wallpaper__star" x="24" y="56" width="1" height="1" />
        <rect className="desktop-wallpaper__star" x="66" y="8" width="1" height="1" />
      </pattern>
    );
  }
  if (edition === 'christmas') {
    return (
      <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse">
        <g className="desktop-wallpaper__flake">
          <line x1="20" y1="12" x2="20" y2="28" />
          <line x1="12" y1="20" x2="28" y2="20" />
          <line x1="14" y1="14" x2="26" y2="26" />
          <line x1="26" y1="14" x2="14" y2="26" />
        </g>
        <g className="desktop-wallpaper__flake">
          <line x1="60" y1="54" x2="60" y2="66" />
          <line x1="54" y1="60" x2="66" y2="60" />
          <line x1="56" y1="56" x2="64" y2="64" />
          <line x1="64" y1="56" x2="56" y2="64" />
        </g>
        <rect className="desktop-wallpaper__snow" x="46" y="18" width="2" height="2" />
        <rect className="desktop-wallpaper__snow" x="10" y="62" width="2" height="2" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
      <rect className="desktop-wallpaper__pixel" x="0" y="0" width="1" height="1" />
      <rect className="desktop-wallpaper__pixel" x="4" y="4" width="1" height="1" />
    </pattern>
  );
}

/** The pattern tile for a fixed wallpaper. Every colour is a --wallpaper-* token from tokens.css. */
function fixedTile(wallpaper: Exclude<WallpaperId, 'edition'>, id: string): ReactElement {
  switch (wallpaper) {
    case 'teal':
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect className="desktop-wallpaper__ink--teal" x="0" y="0" width="1" height="1" />
          <rect className="desktop-wallpaper__ink--teal" x="4" y="4" width="1" height="1" />
        </pattern>
      );
    case 'slate':
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect className="desktop-wallpaper__ink--slate" x="0" y="0" width="6" height="1" />
        </pattern>
      );
    case 'crosshatch':
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <g className="desktop-wallpaper__line--crosshatch">
            <line x1="0" y1="8" x2="8" y2="0" />
            <line x1="0" y1="0" x2="8" y2="8" />
          </g>
        </pattern>
      );
    case 'parchment':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect className="desktop-wallpaper__ink--parchment" x="2" y="3" width="2" height="1" />
          <rect className="desktop-wallpaper__ink--parchment" x="8" y="9" width="1" height="1" />
          <rect className="desktop-wallpaper__ink--parchment" x="9" y="2" width="1" height="2" />
        </pattern>
      );
    case 'blueprint':
      return (
        <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse">
          <g className="desktop-wallpaper__line--blueprint">
            <line x1="0" y1="0.5" x2="32" y2="0.5" />
            <line x1="0.5" y1="0" x2="0.5" y2="32" />
          </g>
          <g className="desktop-wallpaper__line--blueprint-minor">
            <line x1="0" y1="16.5" x2="32" y2="16.5" />
            <line x1="16.5" y1="0" x2="16.5" y2="32" />
          </g>
        </pattern>
      );
  }
}

/**
 * The desktop's wallpaper: an inline SVG <pattern> in token colours behind everything on the
 * desktop. Edition Default is a faint pattern over the edition's own desktop colour; the fixed
 * wallpapers paint their own base. It is decorative, ignores the pointer, and never scrolls.
 */
export function DesktopWallpaper({ edition, wallpaper = DEFAULT_WALLPAPER, className }: DesktopWallpaperProps) {
  const id = `${useId().replace(/:/g, '')}-wallpaper`;
  const fixed = wallpaper !== 'edition';
  return (
    <svg
      className={className ? `desktop-wallpaper ${className}` : 'desktop-wallpaper'}
      data-edition={edition}
      data-wallpaper={wallpaper}
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
    >
      <defs>{fixed ? fixedTile(wallpaper, id) : editionTile(edition, id)}</defs>
      {fixed ? <rect className={`desktop-wallpaper__base desktop-wallpaper__base--${wallpaper}`} width="100%" height="100%" /> : null}
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
