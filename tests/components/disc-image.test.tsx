// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { topicToSource } from '../../src/adapters/markdown';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { MAX_IMAGE_BYTES, readFileText, serializeDiscImage } from '../../src/library/discImage';
import { createDiscLibrary, KEY_PREFIX } from '../../src/library/discLibrary';
import type { StorageLike } from '../../src/library/discLibrary';
import { compileDisc } from '../../src/model/compiler';
import type { DiscManifest } from '../../src/model/manifest';

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

const burned = (): DiscManifest => ({
  ...compileDisc(topicToSource('Lighthouses and the keepers who tended their lamps')),
  media: [{ url: 'https://cdn.example.org/lighthouse.jpg', caption: 'A lighthouse' }],
});

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

const jsonFile = (text: string, name = 'disc.json') => new File([text], name, { type: 'application/json' });
const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const pick = (file: File) => fireEvent.change(input(), { target: { files: [file] } });
const dialog = () => screen.getByRole('dialog', { name: 'Mount Disc Image' });
/**
 * Mounting reads the file, parses and validates it (BFS included), then renders the disc. That can
 * take well over Testing Library's 1-second default on a busy machine, so these waits get 4 seconds,
 * the same allowance burn-app.test.tsx gives its compile-heavy waits.
 */
const MOUNT_WAIT = { timeout: 4000 };

let savedBlobs: Blob[];
let savedNames: string[];

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
  savedBlobs = [];
  savedNames = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: (b: Blob) => {
      savedBlobs.push(b);
      return 'blob:disc';
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    savedNames.push(this.download);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  __setContextFactory(null);
});

async function openTestDisc(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Test Disc'));
}

describe('File menu and Home launcher entries', () => {
  it('the File menu offers Save and Mount when a disc is open', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} storage={memoryStorage()} />);
    await openTestDisc(user);
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.getByRole('menuitem', { name: 'Save Disc Image (.json)' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Mount Disc Image (.json)...' })).toBeTruthy();
  });

  it('Home Utilities has a Mount Disc Image card that opens the file picker', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<App sources={sources} storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: /Mount Disc Image \(\.json\)\.\.\./ }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(input().accept).toContain('.json');
  });

  it('the File menu item opens the file picker too', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<App sources={sources} storage={memoryStorage()} />);
    await openTestDisc(user);
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mount Disc Image (.json)...' }));
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('Save Disc Image (.json)', () => {
  it('downloads the open disc as <disc_id>.json containing the manifest', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} storage={memoryStorage()} />);
    await openTestDisc(user);
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save Disc Image (.json)' }));

    expect(savedNames).toEqual(['disc1.json']);
    expect(savedBlobs).toHaveLength(1);
    expect(JSON.parse(await readFileText(savedBlobs[0]!))).toEqual(disc);
    expect(screen.queryByRole('dialog', { name: 'Save Disc Image' })).toBeNull();
  });

  it('shows an error box when the browser cannot save files', async () => {
    const user = userEvent.setup();
    Reflect.deleteProperty(URL, 'createObjectURL');
    render(<App sources={sources} storage={memoryStorage()} />);
    await openTestDisc(user);
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save Disc Image (.json)' }));
    const box = screen.getByRole('dialog', { name: 'Save Disc Image' });
    expect(within(box).getByRole('alert').textContent).toMatch(/could not save/);
    await user.click(within(box).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Save Disc Image' })).toBeNull();
  });
});

describe('Mount Disc Image (.json)', () => {
  it('mounts a valid image, opens it, and adds it to the library', async () => {
    const m = burned();
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    expect(screen.queryByText(m.title)).toBeNull();

    pick(jsonFile(serializeDiscImage(m)));

    await waitFor(() => expect(screen.getAllByText(m.title).length).toBeGreaterThan(0), MOUNT_WAIT);
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeTruthy(); // a disc window is open
    expect(storage.map.has(KEY_PREFIX + m.disc_id)).toBe(true);
    expect(createDiscLibrary(storage).load().map((d) => d.disc_id)).toEqual([m.disc_id]);
    expect(screen.queryByRole('dialog', { name: 'Mount Disc Image' })).toBeNull();
    expect(input().value).toBe(''); // the same file can be chosen again
  });

  it('round trip: a disc saved from one session mounts in a fresh one', async () => {
    const user = userEvent.setup();
    const stored = burned();
    const first = memoryStorage();
    createDiscLibrary(first).save(stored);
    const { unmount } = render(<App sources={sources} storage={first} />);
    await user.click(screen.getAllByText(stored.title)[0]!);
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save Disc Image (.json)' }));
    const text = await readFileText(savedBlobs[0]!);
    expect(savedNames[0]).toBe(`${stored.disc_id}.json`);
    unmount();

    const second = memoryStorage();
    render(<App sources={sources} storage={second} />);
    pick(jsonFile(text, savedNames[0]!));
    await waitFor(() => expect(screen.getAllByText(stored.title).length).toBeGreaterThan(0), MOUNT_WAIT);
    expect(createDiscLibrary(second).load()[0]).toEqual(stored);
  });

  it('mounting the same image again replaces it instead of duplicating it', async () => {
    const m = burned();
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    pick(jsonFile(serializeDiscImage(m)));
    await waitFor(() => expect(storage.map.size).toBe(1), MOUNT_WAIT);
    pick(jsonFile(serializeDiscImage(m)));
    await waitFor(() => expect(screen.getAllByText(m.title).length).toBeGreaterThan(0), MOUNT_WAIT);
    expect(storage.map.size).toBe(1);
  });

  const expectRejected = async (text: string, messagePattern: RegExp, storage: ReturnType<typeof memoryStorage>) => {
    pick(jsonFile(text));
    const box = await screen.findByRole('dialog', { name: 'Mount Disc Image' }, MOUNT_WAIT);
    expect(within(box).getByRole('alert').textContent).toMatch(messagePattern);
    expect(storage.map.size).toBe(0);
    expect(screen.queryByText(/Lighthouses/)).toBeNull();
    return box;
  };

  it('rejects malformed JSON with a message box, and OK dismisses it', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    const box = await expectRejected('{ not json', /not valid JSON/, storage);
    await user.click(within(box).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Mount Disc Image' })).toBeNull();
  });

  it('Escape also dismisses the message box', async () => {
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    await expectRejected('nope', /not valid JSON/, storage);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Mount Disc Image' })).toBeNull();
  });

  it('rejects JSON that is not a disc, listing what is wrong', async () => {
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    const box = await expectRejected('{"hello": "world"}', /not a DiscLore '97 disc image/, storage);
    const details = within(box).getByRole('list', { name: 'Details' });
    expect(within(details).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(box).getByText('Nothing was mounted.')).toBeTruthy();
  });

  it.each([
    ['an http picture', 'http://cdn.example.org/a.png'],
    ['a javascript address', 'javascript:alert(1)'],
    ['an SVG picture', 'https://cdn.example.org/a.svg'],
    ['a private-network picture', 'https://10.0.0.5/a.png'],
  ])('rejects a disc with %s', async (_name, url) => {
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    const bad = { ...burned(), media: [{ url, caption: 'x' }] };
    const box = await expectRejected(JSON.stringify(bad), /safety checks/, storage);
    expect(within(box).getByRole('list', { name: 'Details' }).textContent).toContain('$.media[0].url');
  });

  it('rejects a disc whose dungeon cannot be solved', async () => {
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    const m = burned();
    for (const r of m.dungeons[0]!.rooms) r.exits = [];
    const box = await expectRejected(JSON.stringify(m), /safety checks/, storage);
    expect(within(box).getByRole('list', { name: 'Details' }).textContent).toMatch(/No path/);
  });

  it('rejects an image that uses the ID of a built-in disc', async () => {
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    pick(jsonFile(serializeDiscImage({ ...burned(), disc_id: 'disc1' })));
    const box = await screen.findByRole('dialog', { name: 'Mount Disc Image' }, MOUNT_WAIT);
    expect(within(box).getByRole('alert').textContent).toMatch(/same ID \("disc1"\) as a built-in disc/);
    expect(storage.map.size).toBe(0);
  });

  it('rejects a file that is too large without reading it', async () => {
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    const big = jsonFile('{}');
    Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 });
    pick(big);
    const box = await screen.findByRole('dialog', { name: 'Mount Disc Image' }, MOUNT_WAIT);
    expect(within(box).getByRole('alert').textContent).toMatch(/too large/);
    expect(storage.map.size).toBe(0);
  });

  it('keeps the open disc when a mount is rejected', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={sources} storage={storage} />);
    await openTestDisc(user);
    pick(jsonFile('[]'));
    await screen.findByRole('dialog', { name: 'Mount Disc Image' }, MOUNT_WAIT);
    expect(screen.getAllByText('Test Disc').length).toBeGreaterThan(0);
    expect(screen.getByRole('menuitem', { name: 'File' })).toBeTruthy();
  });

  it('does nothing when the file picker is cancelled', () => {
    render(<App sources={sources} storage={memoryStorage()} />);
    fireEvent.change(input(), { target: { files: [] } });
    expect(screen.queryByRole('dialog', { name: 'Mount Disc Image' })).toBeNull();
  });
});
