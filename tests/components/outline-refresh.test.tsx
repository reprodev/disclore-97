// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { burnFallback } from '../../src/adapters/burn';
import { BurnDialog } from '../../src/components/BurnDialog';
import type { FetchLike } from '../../src/adapters/types';
import { loadBest, saveBest } from '../../src/library/best';
import { createDiscLibrary, KEY_PREFIX, type StorageLike } from '../../src/library/discLibrary';
import { loadNotes, saveNotes } from '../../src/library/notebook';
import type { DiscManifest } from '../../src/model/manifest';

const REPO = 'https://github.com/octo/hello';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const githubOk: FetchLike = async (input) => {
  const url = String(input);
  if (url.endsWith('/languages')) return json({ TypeScript: 900 });
  if (url.endsWith('/readme')) {
    return json({ encoding: 'base64', content: btoa('# Hello\n\nHello is a friendly test repository.\n\n## Usage\n\nSay hello.') });
  }
  return json({ full_name: 'octo/hello', description: 'A friendly repo', default_branch: 'main', owner: { login: 'octo' } });
};

const githubBusy: FetchLike = async () =>
  json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 9 * 60) });

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

async function setup(fetchFn: FetchLike) {
  const r = await burnFallback('hello', {}, { kind: 'github', input: REPO });
  if (!r.ok) throw new Error('no outline');
  const outline: DiscManifest = r.manifest;
  const storage = memoryStorage();
  createDiscLibrary(storage).save(outline);
  saveNotes(storage, outline.disc_id, '[Hello] my own note');
  saveBest(storage, outline.disc_id, { bestScore: 210, bestRank: 'Royal Archivist' });
  render(<App sources={[]} storage={storage} fetch={fetchFn} search={`?disc=${outline.disc_id}`} />);
  return { outline, storage, user: userEvent.setup() };
}

const stored = (storage: StorageLike, id: string): DiscManifest =>
  (JSON.parse(storage.getItem(KEY_PREFIX + id) ?? '{}') as { manifest: DiscManifest }).manifest;

afterEach(cleanup);

describe('Refresh Full Disc from Source', () => {
  it('shows the outline banner and a File menu item only on an outline disc', async () => {
    const { user } = await setup(githubOk);
    const banner = await screen.findByRole('region', { name: 'Offline outline' });
    expect(banner.textContent).toMatch(/stands in for the GitHub repository/);
    expect(within(banner).getByRole('button', { name: 'Refresh Full Disc from Source...' })).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.getByRole('menuitem', { name: 'Refresh Disc from Source...' })).toBeTruthy();
  });

  it('upgrades the outline in place and keeps its notes and Personal Best', async () => {
    const { outline, storage, user } = await setup(githubOk);
    const banner = await screen.findByRole('region', { name: 'Offline outline' });
    await user.click(within(banner).getByRole('button', { name: 'Refresh Full Disc from Source...' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Offline outline' })).toBeNull(), { timeout: 4000 });
    expect(screen.getAllByText('octo/hello').length).toBeGreaterThan(0);
    const saved = stored(storage, outline.disc_id);
    expect(saved.disc_id).toBe(outline.disc_id);
    expect(saved.outline).toBeUndefined();
    expect(saved.title).toBe('octo/hello');
    expect(createDiscLibrary(storage).load()).toHaveLength(1);
    expect(loadNotes(storage, outline.disc_id)).toBe('[Hello] my own note');
    expect(loadBest(storage, outline.disc_id)).toEqual({ bestScore: 210, bestRank: 'Royal Archivist' });

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.queryByRole('menuitem', { name: 'Refresh Disc from Source...' })).toBeNull();
  });

  it('keeps the outline untouched and shows the busy line when GitHub is still rate-limited', async () => {
    const { outline, storage, user } = await setup(githubBusy);
    const before = storage.getItem(KEY_PREFIX + outline.disc_id);
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Refresh Disc from Source...' }));

    const box = await screen.findByRole('dialog', { name: 'Refresh Disc from Source' }, { timeout: 4000 });
    expect(box.textContent).toMatch(/All lines to the GitHub archive are busy/);
    expect(box.textContent).toMatch(/about (9|10) minutes/);
    expect(box.textContent).toMatch(/Your outline disc was left as it was/);
    expect(box.textContent).not.toMatch(/Burn offline/);
    expect(storage.getItem(KEY_PREFIX + outline.disc_id)).toBe(before);
    expect(screen.getByRole('region', { name: 'Offline outline' })).toBeTruthy();
    expect(loadNotes(storage, outline.disc_id)).toBe('[Hello] my own note');
  });

  it('the Burn dialog quotes the wait, and Burn offline keeps the address on the outline', async () => {
    const user = userEvent.setup();
    const onBurned = vi.fn<(m: DiscManifest) => void>();
    render(<BurnDialog onBurned={onBurned} onClose={() => {}} fetch={githubBusy} minBurnMs={0} online={() => true} />);
    await user.type(screen.getByRole('textbox'), REPO);
    await user.click(screen.getByRole('button', { name: 'Burn' }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toMatch(/about (9|10) minutes/));
    expect(alert.textContent).toMatch(/or choose Burn offline/);
    await user.click(screen.getByRole('button', { name: 'Burn offline from "hello"' }));
    await waitFor(() => expect(onBurned).toHaveBeenCalledTimes(1));
    expect(onBurned.mock.calls[0]![0].outline).toEqual({ kind: 'github', input: REPO });
  });

  it('shows no banner on a full disc', async () => {
    const storage = memoryStorage();
    const full = await burnFallback('hello');
    if (!full.ok) throw new Error('no disc');
    const plain: DiscManifest = { ...full.manifest };
    delete plain.outline;
    createDiscLibrary(storage).save(plain);
    render(<App sources={[]} storage={storage} fetch={githubOk} search={`?disc=${plain.disc_id}`} />);
    await screen.findAllByText(plain.title);
    expect(screen.queryByRole('region', { name: 'Offline outline' })).toBeNull();
  });
});
