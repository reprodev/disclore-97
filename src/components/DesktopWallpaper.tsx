import { useId } from 'react';
import type { Theme } from '../model/editions';

export interface DesktopWallpaperProps {
  edition: Theme;
}

/**
 * A quiet tiled pattern behind the desktop, drawn as an inline SVG <pattern> in token colours:
 * a Win95 pixel weave for Classic '97, faint stars for the Haunted Edition, and faint snowflakes
 * for the Christmas Edition. It is decorative, ignores the pointer, and never scrolls.
 */
export function DesktopWallpaper({ edition }: DesktopWallpaperProps) {
  const id = `${useId().replace(/:/g, '')}-wallpaper`;
  return (
    <svg className="desktop-wallpaper" data-edition={edition} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        {edition === 'haunted' ? (
          <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
            <polygon className="desktop-wallpaper__star" points="12,6 13,10 17,11 13,12 12,16 11,12 7,11 11,10" />
            <rect className="desktop-wallpaper__star" x="46" y="22" width="2" height="2" />
            <polygon className="desktop-wallpaper__star" points="54,46 55,49 58,50 55,51 54,54 53,51 50,50 53,49" />
            <rect className="desktop-wallpaper__star" x="24" y="56" width="1" height="1" />
            <rect className="desktop-wallpaper__star" x="66" y="8" width="1" height="1" />
          </pattern>
        ) : edition === 'christmas' ? (
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
        ) : (
          <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect className="desktop-wallpaper__pixel" x="0" y="0" width="1" height="1" />
            <rect className="desktop-wallpaper__pixel" x="4" y="4" width="1" height="1" />
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
