// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { createDiscLibrary, KEY_PREFIX } from '../../src/library/discLibrary';
import type { StorageLike } from '../../src/library/discLibrary';
import { compileDisc } from '../../src/model/compiler';
import { topicToSource } from '../../src/adapters/markdown';
import type { DiscManifest } from '../../src/model/manifest';
import type { FetchLike } from '../../src/adapters/types';

const disc: DiscManifest = {
  disc_id: 'disc1',
  title: 'Test Disc',
  tagline: 'A tagline',
  sections: [{ section_id: 's1', title: 'Alpha', paragraphs: ['Alpha text'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
};
const sources = [disc];

const TOPIC = 'Lighthouses and the keepers who tended their lamps';
const burnedManifest = () => compileDisc(topicToSource(TOPIC));

/** In-memory Storage fake. */
function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Disc library entries only: other disclore97.* keys (such as the last place read) do not count. */
const discKeys = (s: { map: Map<string, string> }) => [...s.map.keys()].filter((k) => k.startsWith(KEY_PREFIX)).length;

/** Storage fake whose every member throws. */
function throwingStorage(): StorageLike {
  const boom = () => {
    throw new Error('storage denied');
  };
  return {
    get length(): number {
      return boom();
    },
    key: boom,
    getItem: boom,
    setItem: boom,
    removeItem: boom,
  };
}

const failingFetch: FetchLike = () => Promise.reject(new TypeError('offline'));

let oscillatorTypes: string[];
function param() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
}
function mockContext(): AudioContext {
  const source = (type: string) => () => {
    if (type) oscillatorTypes.push(type);
    return {
      type: 'sine',
      buffer: null,
      frequency: param(),
      onended: null as null | (() => void),
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
  };
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: () => Promise.resolve(),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator: () => {
      const o = source('osc')() as { type: string };
      const proxy = new Proxy(o, {
        set(t, p, v) {
          if (p === 'type') oscillatorTypes.push(String(v));
          (t as Record<string | symbol, unknown>)[p] = v;
          return true;
        },
      });
      return proxy;
    },
    createBufferSource: source(''),
    createBuffer: (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {}, disconnect() {} }),
  } as unknown as AudioContext;
}

beforeEach(() => {
  oscillatorTypes = [];
  setMuted(false);
  __setContextFactory(mockContext);
});
afterEach(() => {
  cleanup();
  setMuted(false);
  __setContextFactory(null);
  vi.restoreAllMocks();
});

async function burnTopic(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Burn New CD-R Disc/ }));
  await user.type(screen.getByRole('textbox'), TOPIC);
  await user.click(screen.getByRole('button', { name: 'Burn' }));
}

describe('App burn integration', () => {
  it('a successful burn mounts the disc, saves it and requests the spin-up sound (6.3, 13.11, 15.3, 17.16)', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const m = burnedManifest();
    render(<App sources={sources} storage={storage} fetch={failingFetch} />);
    expect(screen.queryByText(m.title)).toBeNull();

    const spinsBefore = oscillatorTypes.filter((t) => t === 'sawtooth').length;
    await burnTopic(user);

    await waitFor(() => expect(screen.getAllByText(m.title).length).toBeGreaterThan(0), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeNull(), { timeout: 4000 });
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeTruthy();
    expect(storage.map.has(KEY_PREFIX + m.disc_id)).toBe(true);
    expect(oscillatorTypes.filter((t) => t === 'sawtooth').length).toBeGreaterThan(spinsBefore);
    expect(screen.queryByText(/could not be saved/)).toBeNull();
  });

  it('a failed burn keeps the previous disc open (6.3, 13.11)', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} fetch={failingFetch} />);
    await user.click(screen.getByText('Test Disc'));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Burn New Disc...' }));
    await user.type(screen.getByRole('textbox'), 'https://github.com/octocat/Hello-World');
    const spinsBefore = oscillatorTypes.filter((t) => t === 'sawtooth').length;
    await user.click(screen.getByRole('button', { name: 'Burn' }));

    const alert = await screen.findByRole('alert', undefined, { timeout: 4000 });
    await waitFor(() => expect(alert.textContent).toMatch(/network could not be reached/), { timeout: 4000 });
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
    expect(screen.getAllByText('Test Disc').length).toBeGreaterThan(0);
    expect(discKeys(storage)).toBe(0);
    expect(oscillatorTypes.filter((t) => t === 'sawtooth').length).toBe(spinsBefore);
  });

  it('restores stored discs at start (15.3)', () => {
    const storage = memoryStorage();
    const m = burnedManifest();
    createDiscLibrary(storage).save(m);
    render(<App sources={sources} storage={storage} />);
    expect(screen.getAllByText(m.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test Disc').length).toBeGreaterThan(0);
  });

  it('Remove deletes a stored disc (15.5)', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const m = burnedManifest();
    createDiscLibrary(storage).save(m);
    render(<App sources={sources} storage={storage} />);
    await user.click(screen.getByText('Test Disc'));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Load Disc...' }));
    const remove = screen.getByRole('button', { name: `Remove ${m.title} from library` });
    expect(storage.map.has(KEY_PREFIX + m.disc_id)).toBe(true);
    await user.click(remove);
    expect(storage.map.has(KEY_PREFIX + m.disc_id)).toBe(false);
    expect(screen.queryByRole('button', { name: `Remove ${m.title} from library` })).toBeNull();
  });

  it('a throwing Storage shows the not-saved notice while the disc still mounts (15.6, 17.17)', async () => {
    const user = userEvent.setup();
    const m = burnedManifest();
    render(<App sources={sources} storage={throwingStorage()} fetch={failingFetch} />);

    await burnTopic(user);

    const notice = await screen.findByText('The disc is open, but it could not be saved to this browser.', undefined, {
      timeout: 4000,
    });
    expect(notice).toBeTruthy();
    expect(screen.getAllByText(m.title).length).toBeGreaterThan(0);
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeTruthy();
  });

  it('sources prop tests never read localStorage (15.3)', async () => {
    const reads = vi.fn();
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      reads();
      throw new Error('localStorage must not be read');
    });
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.click(screen.getByText('Test Disc'));
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeTruthy();
    expect(reads).not.toHaveBeenCalled();
  });
});


