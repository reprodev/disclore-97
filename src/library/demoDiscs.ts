import type { StorageLike } from './discLibrary';

/**
 * Whether the four built-in demo discs are mounted, kept under this key as "true" or "false".
 * Absent means on, so first-time visitors (and judges) get the built-in discs out of the box.
 */
export const DEMO_DISCS_KEY = 'disclore97.demoDiscs';

/** Reads the setting. Only a saved "false" turns the demo discs off; anything else, or unreadable storage, means on. Never throws. */
export function loadDemoDiscs(storage: StorageLike | undefined): boolean {
  try {
    return storage?.getItem(DEMO_DISCS_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Saves the setting. Returns false when storage is missing or refuses. Never throws. */
export function saveDemoDiscs(storage: StorageLike | undefined, on: boolean): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DEMO_DISCS_KEY, on ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
}
