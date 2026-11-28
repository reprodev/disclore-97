import type { StorageLike } from './discLibrary';
import { DEFAULT_WALLPAPER, toWallpaper } from '../model/wallpapers';
import type { WallpaperId } from '../model/wallpapers';

/** The chosen desktop wallpaper, saved as its id. */
export const WALLPAPER_KEY = 'disclore97.wallpaper';

/** Reads the chosen wallpaper. Missing, unknown, or unreadable values give the edition default. Never throws. */
export function loadWallpaper(storage: StorageLike | undefined): WallpaperId {
  try {
    return toWallpaper(storage?.getItem(WALLPAPER_KEY));
  } catch {
    return DEFAULT_WALLPAPER;
  }
}

/** Saves the wallpaper. The edition default removes the key. Returns false when storage refuses. */
export function saveWallpaper(storage: StorageLike | undefined, id: WallpaperId): boolean {
  if (!storage) return false;
  try {
    if (id === DEFAULT_WALLPAPER) storage.removeItem(WALLPAPER_KEY);
    else storage.setItem(WALLPAPER_KEY, id);
    return true;
  } catch {
    return false;
  }
}
