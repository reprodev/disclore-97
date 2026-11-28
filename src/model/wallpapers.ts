/** Desktop wallpapers: pure data. The colours live in tokens.css, and the patterns in DesktopWallpaper. */

export type WallpaperId = 'edition' | 'teal' | 'slate' | 'crosshatch' | 'parchment' | 'blueprint';

export interface WallpaperOption {
  id: WallpaperId;
  name: string;
  /** One line for the Display Properties list. */
  description: string;
}

export const WALLPAPERS: readonly WallpaperOption[] = [
  { id: 'edition', name: 'Edition Default', description: "Follows the edition: pixel weave, haunted stars, or snowflakes." },
  { id: 'teal', name: 'Classic Teal', description: 'The plain 1995 desktop with a faint pixel weave.' },
  { id: 'slate', name: 'Midnight Slate', description: 'Dark blue-grey with quiet stripes.' },
  { id: 'crosshatch', name: '1997 Crosshatch Tile', description: 'A grey tile of fine diagonal hatching.' },
  { id: 'parchment', name: 'Parchment Desk', description: 'Warm desk paper with a woven fleck.' },
  { id: 'blueprint', name: 'Blueprint Grid', description: 'Engineering blue with a drafting grid.' },
];

export const DEFAULT_WALLPAPER: WallpaperId = 'edition';

/** Any saved or passed value, read as a known wallpaper. Unknown values are the edition default. */
export function toWallpaper(value: unknown): WallpaperId {
  return WALLPAPERS.some((w) => w.id === value) ? (value as WallpaperId) : DEFAULT_WALLPAPER;
}
