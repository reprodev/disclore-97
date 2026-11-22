// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import type { StorageLike } from '../../src/library/discLibrary';
import {
  loadNotes,
  loadPinnedNotes,
  MAX_PINNED_NOTES,
  notesFileName,
  notesMarkdown,
  PINNED_NOTES_KEY,
  quoteText,
  saveNotes,
  savePinnedNotes,
  shortDiscTitle,
  togglePinnedNotes,
} from '../../src/library/notebook';
import { encodeNotes, notesQuery } from '../../src/model/noteShare';
import type { DiscManifest } from '../../src/model/manifest';

// ---- Fixtures ---------------------------------------------------------------------------------

const castles: DiscManifest = {
  disc_id: 'castles',
  title: "DiscLore '97: Ancient Castles & Keeps",
  tagline: 'Stone and water',
  sections: [
    { section_id: 'moat', title: 'The Moat', paragraphs: ['Water circles the keep. It guards the wall.', 'A second paragraph.'], facts: ['Moats were ditches of water.'] },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above the moat. It was the last refuge.'] },
  ],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

const retro: DiscManifest = {
  disc_id: 'retro-dialup',
  title: "DiscLore '97: Retro Computing and the Dial-Up Era",
  tagline: 'Beige boxes',
  sections: [{ section_id: 'modem', title: 'The Modem', paragraphs: ['A modem screeches. Dial tones follow.'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

function memoryStorage(entries: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(entries));
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

beforeEach(() => {
  setMuted(false);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  document.body.classList.remove('notes-printing');
});

type User = ReturnType<typeof userEvent.setup>;
const bar = () => screen.getByRole('toolbar', { name: 'Navigation' });
const notebook = () => screen.getByRole('dialog', { name: /^Research Notebook/ });
const pad = () => within(notebook()).getByRole('textbox', { name: 'Study pad' }) as HTMLTextAreaElement;
const discSelect = () => within(notebook()).getByRole('combobox', { name: 'Disc:' }) as HTMLSelectElement;
const desktop = () => screen.getByRole('group', { name: 'Desktop shortcuts' });
const openNotebook = async (user: User) => {
  await user.click(screen.getByText("DiscLore '97: Ancient Castles & Keeps"));
  await user.click(within(bar()).getByRole('button', { name: 'Notebook' }));
};
const closeNotebook = async (user: User) => {
  const closers = within(notebook()).getAllByRole('button', { name: 'Close' });
  await user.click(closers[closers.length - 1]!);
};

/** Captures files saved through saveTextFile: name, type, and text. */
function captureDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  let pending: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', {
    value: (b: Blob) => {
      pending = b;
      return 'blob:notes';
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, blob: pending! });
  });
  return files;
}
const textOf = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsText(b);
  });

// ---- Storage helpers ---------------------------------------------------------------------------

describe('notebook helpers', () => {
  it('pins round-trip under disclore97.pinnedNotes, without duplicates, and never throw', () => {
    const s = memoryStorage();
    expect(PINNED_NOTES_KEY).toBe('disclore97.pinnedNotes');
    expect(loadPinnedNotes(s)).toEqual([]);
    expect(savePinnedNotes(s, ['castles', 'retro-dialup'])).toBe(true);
    expect(JSON.parse(s.map.get(PINNED_NOTES_KEY)!)).toEqual({ v: 1, discs: ['castles', 'retro-dialup'] });
    expect(loadPinnedNotes(s)).toEqual(['castles', 'retro-dialup']);
    savePinnedNotes(s, []);
    expect(s.map.has(PINNED_NOTES_KEY)).toBe(false);
    for (const bad of ['nope', '{}', '{"discs":"x"}', '{"discs":[1,"a","a",""]}']) {
      s.setItem(PINNED_NOTES_KEY, bad);
      expect(loadPinnedNotes(s)).toEqual(bad.includes('"a"') ? ['a'] : []);
    }
    expect(loadPinnedNotes(undefined)).toEqual([]);
    expect(savePinnedNotes(undefined, ['a'])).toBe(false);
    const refusing: StorageLike = { ...s, setItem: () => { throw new Error('full'); } };
    expect(savePinnedNotes(refusing, ['a'])).toBe(false);
  });

  it('toggles a pin and caps the list', () => {
    expect(togglePinnedNotes([], 'a')).toEqual(['a']);
    expect(togglePinnedNotes(['a', 'b'], 'a')).toEqual(['b']);
    const many = Array.from({ length: MAX_PINNED_NOTES }, (_, i) => `d${i}`);
    expect(togglePinnedNotes(many, 'new')).toHaveLength(MAX_PINNED_NOTES);
  });

  it('shortens disc titles for desktop labels', () => {
    expect(shortDiscTitle("DiscLore '97: Ancient Castles & Keeps")).toBe('Ancient Castles');
    expect(shortDiscTitle("DiscLore '97: Retro Computing and the Dial-Up Era")).toBe('Retro Computing');
    expect(shortDiscTitle("DiscLore '97: Folklore, Samhain & Halloween")).toBe('Folklore');
    expect(shortDiscTitle('Lighthouse')).toBe('Lighthouse');
    expect(shortDiscTitle('A very long single title without breaks')).toBe('A very long single\u2026');
    expect(shortDiscTitle('   ')).toBe('Disc');
  });

  it('formats Markdown, quotes, and file names', () => {
    expect(notesMarkdown('Ancient Castles', 'line 1\r\nline 2\n\n')).toBe('# Ancient Castles \u2014 Research Notes\n\nline 1\nline 2\n');
    expect(notesFileName('castles', 'md')).toBe('castles-notes.md');
    expect(notesFileName('castles')).toBe('castles-notes.txt');
    expect(quoteText('  The keep\n  rises.  ')).toBe('"The keep rises."');
    expect(quoteText('   ')).toBe('');
    const long = quoteText('x'.repeat(900));
    expect(long.length).toBe(502);
    expect(long.endsWith('..."')).toBe(true);
  });
});

// ---- Desktop pinning ---------------------------------------------------------------------------

describe('Pin to Desktop', () => {
  it('pins the notebook, shows a Notes.txt desktop icon, and saves the pin', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles, retro]} storage={storage} />);
    expect(within(desktop()).queryByRole('button', { name: /Notes\.txt/ })).toBeNull();
    await openNotebook(user);
    const pin = within(notebook()).getByRole('button', { name: 'Pin to Desktop' });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    await user.click(pin);
    expect(within(notebook()).getByRole('button', { name: 'Pinned to Desktop' }).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(storage.map.get('disclore97.pinnedNotes')!)).toEqual({ v: 1, discs: ['castles'] });
    const icon = within(desktop()).getByRole('button', { name: 'Ancient Castles Notes.txt' });
    expect(icon.querySelector('svg')!.getAttribute('data-icon')).toBe('notepad');
  });

  it('opens the notebook for that disc from the desktop icon, and unpinning removes the icon', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage({ 'disclore97.pinnedNotes': JSON.stringify({ v: 1, discs: ['retro-dialup'] }) });
    saveNotes(storage, 'retro-dialup', 'modem notes');
    render(<App sources={[castles, retro]} storage={storage} />);
    const icon = within(desktop()).getByRole('button', { name: 'Retro Computing Notes.txt' });
    await user.dblClick(icon);
    expect(notebook().getAttribute('aria-label') ?? notebook().textContent).toContain('Retro Computing');
    expect(pad().value).toBe('modem notes');
    await user.click(within(notebook()).getByRole('button', { name: 'Pinned to Desktop' }));
    expect(within(desktop()).queryByRole('button', { name: /Notes\.txt/ })).toBeNull();
    expect(storage.map.has('disclore97.pinnedNotes')).toBe(false);
  });

  it('Enter on a focused desktop icon opens it too, and a pin for an unmounted disc shows nothing', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage({ 'disclore97.pinnedNotes': JSON.stringify({ v: 1, discs: ['gone', 'castles'] }) });
    render(<App sources={[castles]} storage={storage} />);
    const icons = within(desktop()).getAllByRole('button', { name: /Notes\.txt$/ });
    expect(icons.map((i) => i.textContent)).toEqual(['Ancient Castles Notes.txt']);
    icons[0]!.focus();
    await user.keyboard('{Enter}');
    expect(notebook()).toBeTruthy();
  });
});

// ---- Multi-disc switcher -----------------------------------------------------------------------

describe('disc switcher', () => {
  it('switches between mounted discs without closing, and saves each disc separately', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'castle notes');
    saveNotes(storage, 'retro-dialup', 'retro notes');
    render(<App sources={[castles, retro]} storage={storage} />);
    await openNotebook(user);
    expect(Array.from(discSelect().options).map((o) => o.textContent)).toEqual([castles.title, retro.title]);
    expect(discSelect().value).toBe('castles');
    expect(pad().value).toBe('castle notes');
    await user.selectOptions(discSelect(), 'retro-dialup');
    expect(pad().value).toBe('retro notes');
    expect(notebook().textContent).toContain(retro.title);
    fireEvent.change(pad(), { target: { value: 'retro notes, edited' } });
    expect(loadNotes(storage, 'retro-dialup')).toBe('retro notes, edited');
    expect(loadNotes(storage, 'castles')).toBe('castle notes');
    await user.selectOptions(discSelect(), 'castles');
    expect(pad().value).toBe('castle notes');
  });

  it('the pin button follows the selected disc', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles, retro]} storage={memoryStorage({ 'disclore97.pinnedNotes': JSON.stringify({ v: 1, discs: ['retro-dialup'] }) })} />);
    await openNotebook(user);
    expect(within(notebook()).getByRole('button', { name: 'Pin to Desktop' })).toBeTruthy();
    await user.selectOptions(discSelect(), 'retro-dialup');
    expect(within(notebook()).getByRole('button', { name: 'Pinned to Desktop' })).toBeTruthy();
  });
});

// ---- Export (.md) and Print -------------------------------------------------------------------

describe('Export and Print', () => {
  it('Export (.md) saves a Markdown file with the disc heading, and Export (.txt) still saves plain text', async () => {
    const files = captureDownloads();
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', '[The Moat] A fact.\n[Keep Tower] Another.');
    render(<App sources={[castles, retro]} storage={storage} />);
    await openNotebook(user);
    await user.click(within(notebook()).getByRole('button', { name: 'Export (.md)' }));
    await user.click(within(notebook()).getByRole('button', { name: 'Export (.txt)' }));
    expect(files.map((f) => f.name)).toEqual(['castles-notes.md', 'castles-notes.txt']);
    expect(files[0]!.blob.type).toBe('text/markdown');
    expect(await textOf(files[0]!.blob)).toBe("# DiscLore '97: Ancient Castles & Keeps \u2014 Research Notes\n\n[The Moat] A fact.\n[Keep Tower] Another.\n");
    expect(await textOf(files[1]!.blob)).toBe('[The Moat] A fact.\n[Keep Tower] Another.');
    expect(within(notebook()).getByText('Notebook exported (.txt).')).toBeTruthy();
  });

  it('Print... calls window.print with a printable notes page, and marks the page for the print rules', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'print me');
    render(<App sources={[castles]} storage={storage} />);
    await openNotebook(user);
    expect(document.body.classList.contains('notes-printing')).toBe(true);
    const page = notebook().querySelector('.notebook-dialog__page')!;
    expect(page.querySelector('.notebook-dialog__heading')!.textContent).toBe(`${castles.title} \u2014 Research Notes`);
    expect(page.querySelector('pre')!.textContent).toBe('print me');
    await user.click(within(notebook()).getByRole('button', { name: 'Print...' }));
    expect(print).toHaveBeenCalledTimes(1);
    await closeNotebook(user);
    expect(document.body.classList.contains('notes-printing')).toBe(false);
  });

  it('the export, print, and share buttons are off for an empty pad', async () => {
    const user = userEvent.setup();
    render(<App sources={[castles]} storage={memoryStorage()} />);
    await openNotebook(user);
    for (const name of ['Export (.txt)', 'Export (.md)', 'Print...', 'Copy Share Link']) {
      expect((within(notebook()).getByRole('button', { name }) as HTMLButtonElement).disabled, name).toBe(true);
    }
  });

  it('ships print rules that show only the notes page, in tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/print.css'), 'utf8');
    const notes = css.slice(css.indexOf('body.notes-printing'));
    for (const needle of [
      'body.notes-printing .desktop > :not(.desktop__work)',
      'body.notes-printing .notebook-dialog__body > :not(.notebook-dialog__page)',
      'body.notes-printing .notebook-dialog .window-title-bar',
      'body.notes-printing .notebook-dialog__page',
    ]) {
      expect(notes, needle).toContain(needle);
    }
    expect(notes).toContain('var(--color-paper)');
    expect(notes).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const screenCss = readFileSync(resolve(__dirname, '../../src/styles/notebook.css'), 'utf8');
    const i = screenCss.indexOf('.notebook-dialog__page {');
    expect(screenCss.slice(i, screenCss.indexOf('}', i))).toContain('display: none');
  });
});

// ---- Share links -------------------------------------------------------------------------------

describe('Copy Share Link', () => {
  it('copies a ?notes= link that decodes back to these notes', async () => {
    // user-event installs its own clipboard, so set it up first and replace that clipboard after.
    const user = userEvent.setup();
    const writeText = vi.fn(async (_t: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'shared \u{1F3F0} notes');
    render(<App sources={[castles]} storage={storage} />);
    await openNotebook(user);
    await user.click(within(notebook()).getByRole('button', { name: 'Copy Share Link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const link = new URL(writeText.mock.calls[0]![0]);
    expect(link.search).toBe(notesQuery({ discId: 'castles', discTitle: castles.title, text: 'shared \u{1F3F0} notes' }));
    expect(within(notebook()).getByText('Share link copied.')).toBeTruthy();
  });

  it('shows the link in a Share Link box when the clipboard refuses', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('denied'); }) }, configurable: true });
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'hello');
    render(<App sources={[castles]} storage={storage} />);
    await openNotebook(user);
    await user.click(within(notebook()).getByRole('button', { name: 'Copy Share Link' }));
    const box = await within(notebook()).findByRole('group', { name: 'Share Link' });
    const input = within(box).getByRole('textbox', { name: 'Share link' }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toContain(`?notes=${encodeNotes({ discId: 'castles', discTitle: castles.title, text: 'hello' })}`);
    // Editing the pad makes the old link stale, so the box goes away.
    fireEvent.change(pad(), { target: { value: 'hello again' } });
    expect(within(notebook()).queryByRole('group', { name: 'Share Link' })).toBeNull();
  });
});

describe('?notes= on load', () => {
  const link = (discId: string, discTitle: string, text: string) => notesQuery({ discId, discTitle, text });
  const shared = () => screen.getByRole('dialog', { name: 'Shared Notes' });

  it('skips the splash and shows the shared disc title and notes, read-only', () => {
    render(<App sources={[castles, retro]} storage={memoryStorage()} skipSplash={false} search={link('castles', castles.title, 'line one\nline two')} />);
    expect(screen.queryByRole('region', { name: "DiscLore '97 boot splash" })).toBeNull();
    expect(shared().textContent).toContain(castles.title);
    const text = within(shared()).getByRole('textbox', { name: 'Shared notes' }) as HTMLTextAreaElement;
    expect(text.value).toBe('line one\nline two');
    expect(text.readOnly).toBe(true);
  });

  it('Save to My Notebook adds the notes to the same disc when it is mounted, without overwriting', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveNotes(storage, 'castles', 'my own note');
    render(<App sources={[castles, retro]} storage={storage} search={link('castles', castles.title, 'their note')} />);
    expect((within(shared()).getByRole('combobox', { name: 'Save into:' }) as HTMLSelectElement).value).toBe('castles');
    expect(loadNotes(storage, 'castles')).toBe('my own note'); // nothing saved yet
    await user.click(within(shared()).getByRole('button', { name: 'Save to My Notebook' }));
    expect(loadNotes(storage, 'castles')).toBe('my own note\ntheir note');
    expect(within(shared()).getByText(`Saved to the ${castles.title} notebook.`)).toBeTruthy();
    expect((within(shared()).getByRole('button', { name: 'Save to My Notebook' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves into a chosen disc when the shared disc is not mounted here', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles, retro]} storage={storage} search={link('somebody-elses-disc', 'Lighthouses', 'beam notes')} />);
    expect(shared().textContent).toContain('Lighthouses');
    expect(shared().textContent).toContain('That disc is not mounted here');
    const select = within(shared()).getByRole('combobox', { name: 'Save into:' }) as HTMLSelectElement;
    expect(select.value).toBe('castles');
    await user.selectOptions(select, 'retro-dialup');
    await user.click(within(shared()).getByRole('button', { name: 'Save to My Notebook' }));
    expect(loadNotes(storage, 'retro-dialup')).toBe('beam notes');
    expect(loadNotes(storage, 'castles')).toBe('');
  });

  it('a link with a disc too opens that disc behind the dialog', () => {
    const search = `?disc=retro-dialup&notes=${encodeNotes({ discId: 'castles', discTitle: castles.title, text: 'x' })}`;
    render(<App sources={[castles, retro]} storage={memoryStorage()} search={search} />);
    expect(shared()).toBeTruthy();
    expect(screen.getByRole('navigation', { name: retro.title })).toBeTruthy();
  });

  it('a damaged link shows a Win95 message instead, and never throws', () => {
    expect(() =>
      render(<App sources={[castles]} storage={memoryStorage()} search={`?notes=${encodeNotes({ discId: 'castles', discTitle: 'C', text: 'hello there' }).slice(0, 9)}`} />),
    ).not.toThrow();
    expect(screen.queryByRole('dialog', { name: 'Shared Notes' })).toBeNull();
    const box = screen.getByRole('dialog', { name: 'Shared Notes Link' });
    expect(within(box).getByText('This shared notes link is damaged or incomplete, so there is nothing to show.')).toBeTruthy();
  });

  it('a value with characters outside the link alphabet is ignored, and the splash shows as usual', () => {
    render(<App storage={memoryStorage()} search="?notes=%3Cscript%3E" />);
    expect(screen.getByRole('region', { name: "DiscLore '97 boot splash" })).toBeTruthy();
  });
});

// ---- + Quote -----------------------------------------------------------------------------------

describe('+ Quote', () => {
  const select = (text: string, anchor: Node | null) =>
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => text, anchorNode: anchor } as unknown as Selection);

  it('adds the selected article text as [Title] "quote"', () => {
    const add = vi.fn();
    render(<ArticleViewer sections={castles.sections} sectionId="moat" onAddNote={add} />);
    const para = screen.getByText(/Water circles the keep/);
    select('  circles the\n keep ', para.firstChild);
    fireEvent.click(screen.getByRole('button', { name: '+ Quote' }));
    expect(add).toHaveBeenCalledWith('The Moat', '"circles the keep"');
    expect(screen.getByText('Quote added to Notebook.')).toBeTruthy();
  });

  it('uses the selection made before the press, even if pressing the button cleared it', () => {
    const add = vi.fn();
    render(<ArticleViewer sections={castles.sections} sectionId="moat" onAddNote={add} />);
    const para = screen.getByText(/Water circles the keep/);
    const spy = select('guards the wall', para.firstChild);
    const button = screen.getByRole('button', { name: '+ Quote' });
    fireEvent.pointerDown(button);
    spy.mockReturnValue({ toString: () => '', anchorNode: null } as unknown as Selection);
    fireEvent.click(button);
    expect(add).toHaveBeenCalledWith('The Moat', '"guards the wall"');
  });

  it('falls back to the first sentence when nothing is selected, or the selection is outside the article', () => {
    const add = vi.fn();
    render(
      <>
        <p>Outside text</p>
        <ArticleViewer sections={castles.sections} sectionId="moat" onAddNote={add} />
      </>,
    );
    select('', null);
    fireEvent.click(screen.getByRole('button', { name: '+ Quote' }));
    expect(add).toHaveBeenLastCalledWith('The Moat', '"Water circles the keep."');
    select('Outside text', screen.getByText('Outside text').firstChild);
    fireEvent.click(screen.getByRole('button', { name: '+ Quote' }));
    expect(add).toHaveBeenLastCalledWith('The Moat', '"Water circles the keep."');
  });

  it('is shown only when the viewer can add notes', () => {
    render(<ArticleViewer sections={castles.sections} sectionId="moat" />);
    expect(screen.queryByRole('button', { name: '+ Quote' })).toBeNull();
  });

  it('appends the quote to the active disc notebook in the app', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App sources={[castles, retro]} storage={storage} />);
    await user.click(screen.getByText(castles.title));
    await user.click(within(screen.getByRole('navigation', { name: castles.title })).getByRole('button', { name: 'Keep Tower' }));
    const para = screen.getByText(/The keep rises/);
    select('the last refuge', para.firstChild);
    await user.click(screen.getByRole('button', { name: '+ Quote' }));
    expect(loadNotes(storage, 'castles')).toBe('[Keep Tower] "the last refuge"');
    select('', null);
    await user.click(screen.getByRole('button', { name: '+ Quote' }));
    expect(loadNotes(storage, 'castles')).toBe('[Keep Tower] "the last refuge"\n[Keep Tower] "The keep rises above the moat."');
    expect(loadNotes(storage, 'retro-dialup')).toBe('');
  });
});

// ---- Build chunks ------------------------------------------------------------------------------

describe('production chunks', () => {
  it('vite.config.ts splits React and the built-in discs into their own chunks', async () => {
    const text = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    expect(text).toMatch(/rollupOptions:\s*\{\s*output:\s*\{\s*manualChunks\s*\}/);
    expect(text).toContain("return 'react-vendor'");
    expect(text).toContain("return 'discs'");
  });
});
