import type { DiscManifest } from '../model/manifest';
import { loadDisc } from '../discs/loader';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export type SaveResult = { saved: true } | { saved: false; reason: 'unavailable' | 'quota' };

export interface DiscLibrary {
  /** Validated manifests, oldest first. */
  load(): DiscManifest[];
  /**
   * Saves a disc as the newest one. With `keepPosition`, a disc that is already saved under the same
   * id is replaced where it is (used when an outline is refreshed into the full disc).
   */
  save(m: DiscManifest, options?: { keepPosition?: boolean }): SaveResult;
  remove(discId: string): void;
}

export const KEY_PREFIX = 'disclore97.disc.';
export const MAX_DISCS = 10;

interface Entry {
  key: string;
  seq: number;
  manifest: DiscManifest;
}

function tryRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function listKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  try {
    const n = storage.length;
    for (let i = 0; i < n; i++) {
      const k = storage.key(i);
      if (typeof k === 'string' && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

function readEntry(storage: StorageLike, key: string): Entry | null {
  try {
    const raw = storage.getItem(key);
    if (typeof raw !== 'string') return null;
    const env: unknown = JSON.parse(raw);
    if (typeof env !== 'object' || env === null) return null;
    const e = env as { v?: unknown; seq?: unknown; manifest?: unknown };
    if (e.v !== 1 || typeof e.seq !== 'number' || !Number.isInteger(e.seq)) return null;
    const res = loadDisc(e.manifest, false);
    if (!res.ok) return null;
    if (KEY_PREFIX + res.manifest.disc_id !== key) return null;
    return { key, seq: e.seq, manifest: res.manifest };
  } catch {
    return null;
  }
}

/** Reads all valid entries sorted oldest first; removes invalid ones. */
function readAll(storage: StorageLike): Entry[] {
  const entries: Entry[] = [];
  for (const key of listKeys(storage)) {
    const entry = readEntry(storage, key);
    if (entry) entries.push(entry);
    else tryRemove(storage, key);
  }
  entries.sort((a, b) => a.seq - b.seq);
  return entries;
}

export function createDiscLibrary(storage: StorageLike | null | undefined): DiscLibrary {
  return {
    load(): DiscManifest[] {
      if (!storage) return [];
      try {
        const entries = readAll(storage);
        while (entries.length > MAX_DISCS) {
          const oldest = entries.shift();
          if (oldest) tryRemove(storage, oldest.key);
        }
        return entries.map((e) => e.manifest);
      } catch {
        return [];
      }
    },

    save(m: DiscManifest, options?: { keepPosition?: boolean }): SaveResult {
      if (!storage) return { saved: false, reason: 'unavailable' };
      try {
        const key = KEY_PREFIX + m.disc_id;
        const all = readAll(storage);
        const existing = all.find((e) => e.key === key);
        const others = all.filter((e) => e.key !== key);
        const seq =
          options?.keepPosition && existing ? existing.seq : 1 + others.reduce((max, e) => Math.max(max, e.seq), 0);
        const value = JSON.stringify({ v: 1, seq, manifest: m });
        // Make room first so the saved disc is never the one evicted.
        while (others.length > MAX_DISCS - 1) {
          const oldest = others.shift();
          if (oldest) tryRemove(storage, oldest.key);
        }
        try {
          storage.setItem(key, value);
        } catch {
          const oldest = others.shift();
          if (!oldest) return { saved: false, reason: 'quota' };
          tryRemove(storage, oldest.key);
          try {
            storage.setItem(key, value);
          } catch {
            return { saved: false, reason: 'quota' };
          }
        }
        return { saved: true };
      } catch {
        return { saved: false, reason: 'unavailable' };
      }
    },

    remove(discId: string): void {
      if (!storage) return;
      tryRemove(storage, KEY_PREFIX + discId);
    },
  };
}

export function getBrowserStorage(): StorageLike | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const s = localStorage;
    // Touch the API so a throwing or blocked store is detected here.
    void s.length;
    return s;
  } catch {
    return undefined;
  }
}
