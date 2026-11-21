import { describe, it, expect } from 'vitest';
import { compileDisc } from '../../src/model/compiler';
import { createDiscLibrary, KEY_PREFIX, type StorageLike } from '../../src/library/discLibrary';
import type { ExtractedSource } from '../../src/model/source';

function makeSource(name: string): ExtractedSource {
  return {
    title: `Library ${name}`,
    headings: ['Overview', 'Usage', 'Design', 'History', 'Notes', 'Credits'],
    paragraphs: [
      `${name} is a small program that does useful things for people.`,
      'It reads input files and writes results to the screen quickly.',
      'The design favors simple parts that can be tested one by one.',
      'Early versions were written over a single summer by one author.',
      'Users can extend the program with plugins and shared scripts.',
      'The project is released under a permissive license for everyone.',
    ],
    metadata: { kind: 'markdown', source: `Markdown: ${name}` },
  };
}

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

class ThrowingStorage implements StorageLike {
  get length(): number {
    throw new Error('blocked');
  }
  key(): string | null {
    throw new Error('blocked');
  }
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('blocked');
  }
  removeItem(): void {
    throw new Error('blocked');
  }
}

class QuotaOnSetStorage extends MemoryStorage {
  setItem(): void {
    throw new DOMException('full', 'QuotaExceededError');
  }
}

describe('discLibrary', () => {
  it('stores one key per disc with the prefix and a versioned envelope', () => {
    const storage = new MemoryStorage();
    const lib = createDiscLibrary(storage);
    const m = compileDisc(makeSource('alpha'));
    expect(lib.save(m)).toEqual({ saved: true });
    expect(storage.keys()).toEqual([`${KEY_PREFIX}${m.disc_id}`]);
    expect(KEY_PREFIX).toBe('disclore97.disc.');
    const env = JSON.parse(storage.getItem(`${KEY_PREFIX}${m.disc_id}`) as string);
    expect(Object.keys(env).sort()).toEqual(['manifest', 'seq', 'v']);
    expect(env.v).toBe(1);
    expect(Number.isInteger(env.seq)).toBe(true);
    expect(env.manifest).toEqual(m);
    expect(lib.load()).toEqual([m]);
  });

  it('never throws when every Storage method throws', () => {
    const lib = createDiscLibrary(new ThrowingStorage());
    const m = compileDisc(makeSource('beta'));
    expect(lib.load()).toEqual([]);
    const res = lib.save(m);
    expect(res.saved).toBe(false);
    expect(() => lib.remove(m.disc_id)).not.toThrow();
  });

  it('handles a missing Storage', () => {
    const lib = createDiscLibrary(undefined);
    const m = compileDisc(makeSource('gamma'));
    expect(lib.load()).toEqual([]);
    expect(lib.save(m)).toEqual({ saved: false, reason: 'unavailable' });
    expect(() => lib.remove('x')).not.toThrow();
  });

  it('reports a quota failure when setItem always throws a quota error', () => {
    const storage = new QuotaOnSetStorage();
    const lib = createDiscLibrary(storage);
    const m = compileDisc(makeSource('delta'));
    expect(lib.save(m)).toEqual({ saved: false, reason: 'quota' });
    expect(lib.load()).toEqual([]);
  });

  it('evicts the oldest disc and retries once on a quota error', () => {
    const storage = new MemoryStorage();
    const lib = createDiscLibrary(storage);
    const a = compileDisc(makeSource('one'));
    const b = compileDisc(makeSource('two'));
    lib.save(a);
    let calls = 0;
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      calls++;
      if (calls === 1) throw new DOMException('full', 'QuotaExceededError');
      realSet(k, v);
    };
    expect(lib.save(b)).toEqual({ saved: true });
    expect(calls).toBe(2);
    expect(lib.load()).toEqual([b]);
  });

  it('remove deletes only the named disc', () => {
    const storage = new MemoryStorage();
    const lib = createDiscLibrary(storage);
    const a = compileDisc(makeSource('keep'));
    const b = compileDisc(makeSource('drop'));
    lib.save(a);
    lib.save(b);
    lib.remove(b.disc_id);
    expect(storage.keys()).toEqual([`${KEY_PREFIX}${a.disc_id}`]);
    expect(lib.load()).toEqual([a]);
  });

  it('skips and removes corrupt entries', () => {
    const storage = new MemoryStorage();
    const lib = createDiscLibrary(storage);
    const a = compileDisc(makeSource('good'));
    lib.save(a);
    storage.setItem(`${KEY_PREFIX}bad1`, 'not json');
    storage.setItem(`${KEY_PREFIX}bad2`, JSON.stringify({ v: 2, seq: 1, manifest: a }));
    storage.setItem(`${KEY_PREFIX}bad3`, JSON.stringify({ v: 1, seq: 1, manifest: { nope: 1 } }));
    expect(lib.load()).toEqual([a]);
    expect(storage.keys()).toEqual([`${KEY_PREFIX}${a.disc_id}`]);
  });

  it('stores no tokens or credentials, only the manifest', () => {
    const storage = new MemoryStorage();
    const lib = createDiscLibrary(storage);
    const m = compileDisc(makeSource('safe'));
    lib.save(m);
    const raw = storage.getItem(`${KEY_PREFIX}${m.disc_id}`) as string;
    expect(raw).not.toMatch(/token|password|secret|authorization|bearer|api[_-]?key|credential/i);
    expect(JSON.parse(raw).manifest).toEqual(m);
  });
});
