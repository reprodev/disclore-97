// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../../src/App';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import { HotspotViewer } from '../../src/components/HotspotViewer';
import { SEEK_PULSE_MS, Taskbar } from '../../src/components/Taskbar';
import type { StorageLike } from '../../src/library/discLibrary';
import type { Diagram, DiscManifest } from '../../src/model/manifest';

const disc: DiscManifest = {
  disc_id: 'callouts',
  title: 'Callout Disc',
  tagline: 'Pins and keys',
  sections: [
    { section_id: 'moat', title: 'The Moat', paragraphs: ['Water circles the keep.'], facts: ['Moats can be wet or dry.'] },
    { section_id: 'keep', title: 'Keep Tower', paragraphs: ['The keep rises above the moat.'] },
    { section_id: 'gate', title: 'Drawbridge', paragraphs: ['A drawbridge crosses the water.'] },
  ],
  diagrams: [
    {
      diagram_id: 'plan',
      title: 'The Plan',
      viewBox: '0 0 100 100',
      shapes: [{ kind: 'rect', x: 0, y: 0, width: 100, height: 100, fill: 'var(--color-parchment)', stroke: 'none' }],
      hotspots: [
        { label: 'Water ring', x: 30, y: 40, section_id: 'moat' },
        { label: 'Bridge', x: 80, y: 60, section_id: 'gate' },
        { label: 'Tower top', x: 50, y: 20, section_id: 'keep' },
      ],
    },
  ],
  trivia: [],
  dungeons: [],
};
const diagram = disc.diagrams[0] as Diagram;

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
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
  setMuted(true);
  __setContextFactory(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __setContextFactory(null);
});

const key = () => screen.getByRole('list', { name: 'Callout Key' });
const items = () => within(key()).getAllByRole('button');
const pin = (label: string) => screen.getByRole('button', { name: label });

// ---- Numbered Callout Key --------------------------------------------------------------------
describe('HotspotViewer Numbered Callout Key', () => {
  it('lists every hotspot as "[n] section title", in pin order, below the diagram', () => {
    const { container } = render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} />);
    expect(items().map((b) => b.textContent)).toEqual(['[1] The Moat', '[2] Drawbridge', '[3] Keep Tower']);
    expect(items().map((b) => b.getAttribute('type'))).toEqual(['button', 'button', 'button']);
    // The key sits after the square diagram plate, not inside it, so pin percentages still match the SVG.
    const viewer = container.querySelector('.hotspot-viewer')!;
    const plate = container.querySelector('.callout-key')!;
    expect(viewer.contains(plate)).toBe(false);
    expect(viewer.compareDocumentPosition(plate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Names do not clash with the pins' own labels.
    expect(screen.getAllByRole('button', { name: 'Water ring' })).toHaveLength(1);
  });

  it('falls back to the hotspot label when no sections are given', () => {
    render(<HotspotViewer diagram={diagram} onNavigate={() => {}} />);
    expect(items().map((b) => b.textContent)).toEqual(['[1] Water ring', '[2] Bridge', '[3] Tower top']);
  });

  it('renders no key for a diagram without hotspots', () => {
    render(<HotspotViewer diagram={{ ...diagram, hotspots: [] }} onNavigate={() => {}} />);
    expect(screen.queryByRole('list', { name: 'Callout Key' })).toBeNull();
  });

  it('clicking a callout jumps to its section, just like its pin', async () => {
    const picked: string[] = [];
    const user = userEvent.setup();
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={(id) => picked.push(id)} />);
    await user.click(screen.getByRole('button', { name: '[2] Drawbridge' }));
    await user.click(pin('Bridge'));
    await user.click(screen.getByRole('button', { name: '[3] Keep Tower' }));
    expect(picked).toEqual(['gate', 'gate', 'keep']);
  });

  it('hovering or focusing a callout highlights its pin, and leaving clears it', () => {
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} />);
    const item = screen.getByRole('button', { name: '[2] Drawbridge' });
    fireEvent.pointerEnter(item);
    expect(pin('Bridge').getAttribute('class')).toContain('hotspot-button--preview');
    expect(pin('Bridge').getAttribute('data-preview')).toBe('true');
    expect(pin('Water ring').getAttribute('class')).not.toContain('hotspot-button--preview');
    expect(item.getAttribute('data-preview')).toBe('true');
    fireEvent.pointerLeave(item);
    expect(pin('Bridge').getAttribute('class')).not.toContain('hotspot-button--preview');

    const first = screen.getByRole('button', { name: '[1] The Moat' });
    act(() => first.focus());
    expect(pin('Water ring').getAttribute('data-preview')).toBe('true');
    act(() => first.blur());
    expect(pin('Water ring').getAttribute('data-preview')).toBe('false');
  });

  it('hovering or focusing a pin highlights its callout (the reverse direction)', () => {
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} />);
    const item = () => screen.getByRole('button', { name: '[3] Keep Tower' });
    fireEvent.pointerEnter(pin('Tower top'));
    expect(item().getAttribute('data-preview')).toBe('true');
    expect(items().filter((b) => b.getAttribute('data-preview') === 'true')).toHaveLength(1);
    fireEvent.pointerLeave(pin('Tower top'));
    expect(item().getAttribute('data-preview')).toBe('false');

    act(() => pin('Water ring').focus());
    expect(screen.getByRole('button', { name: '[1] The Moat' }).getAttribute('data-preview')).toBe('true');
    act(() => pin('Water ring').blur());
    expect(items().every((b) => b.getAttribute('data-preview') === 'false')).toBe(true);
  });

  it('keeps the "Show in Diagram" highlight alongside a preview', () => {
    render(<HotspotViewer diagram={diagram} sections={disc.sections} onNavigate={() => {}} highlightSectionId="moat" />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: '[2] Drawbridge' }));
    expect(pin('Water ring').getAttribute('class')).toContain('hotspot-button--active');
    expect(pin('Bridge').getAttribute('class')).toContain('hotspot-button--preview');
  });

  it('styles the key as a sunken ivory plate with token colors and square corners', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/hotspot.css'), 'utf8');
    const block = (sel: string) => new RegExp(`${sel.replace(/[.[\]"=]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const plate = block('.callout-key');
    expect(plate).toContain('background: var(--color-tooltip-bg)');
    expect(plate).toContain('var(--color-bevel-shadow) var(--color-bevel-hi) var(--color-bevel-hi) var(--color-bevel-shadow)');
    expect(plate).toContain('border-radius: 0');
    expect(block('.hotspot-button--preview rect')).toContain('var(--color-crimson)');
    expect(css).not.toMatch(/gradient|blur\(/);
  });
});

// ---- Drive D: activity LED -------------------------------------------------------------------
const drive = () => screen.getByRole('img', { name: /^Drive D: \(CD-ROM\)/ });

function bar(activityKey: number) {
  return <Taskbar discs={[disc]} active={null} onOpenDisc={() => {}} onCloseAll={() => {}} driveActive activityKey={activityKey} />;
}

describe('Taskbar Drive D: activity LED', () => {
  it('stays steady on first render, flashes on a new activity key, then settles', () => {
    vi.useFakeTimers();
    const { rerender } = render(bar(0));
    expect(drive().getAttribute('data-seek')).toBe('false');
    expect(drive().getAttribute('data-active')).toBe('true');

    rerender(bar(1));
    expect(drive().getAttribute('data-seek')).toBe('true');
    act(() => vi.advanceTimersByTime(SEEK_PULSE_MS - 1));
    expect(drive().getAttribute('data-seek')).toBe('true');
    act(() => vi.advanceTimersByTime(1));
    expect(drive().getAttribute('data-seek')).toBe('false');
    expect(drive().getAttribute('data-active')).toBe('true');
  });

  it('a new seek during a flash restarts it (fresh LED element, fresh timer)', () => {
    vi.useFakeTimers();
    const { rerender } = render(bar(0));
    rerender(bar(1));
    const firstLed = drive().querySelector('.taskbar__led');
    act(() => vi.advanceTimersByTime(SEEK_PULSE_MS - 100));
    rerender(bar(2));
    expect(drive().querySelector('.taskbar__led')).not.toBe(firstLed);
    act(() => vi.advanceTimersByTime(SEEK_PULSE_MS - 1));
    expect(drive().getAttribute('data-seek')).toBe('true');
    act(() => vi.advanceTimersByTime(1));
    expect(drive().getAttribute('data-seek')).toBe('false');
  });

  it('flashes amber in hard steps, settles on gold, and stops animating for reduced motion', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/taskbar.css'), 'utf8');
    expect(css).toMatch(/@keyframes taskbar-led-seek\s*\{[^@]*var\(--color-flame-hot\)[^@]*var\(--color-gold-light\)/);
    expect(css).toMatch(/\.taskbar__drive\[data-seek="true"\] \.taskbar__led\s*\{[^}]*animation: taskbar-led-seek [^;]*steps\(1, end\)/);
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
    expect(reduced).toMatch(/\.taskbar__drive\[data-seek="true"\] \.taskbar__led\s*\{\s*animation: none;/);
    // The keyframes end on the steady mounted gold.
    expect(css).toMatch(/100% \{\s*background: var\(--color-gold-light\);/);
  });

  it('in the app, opening a disc and moving between views pulse the LED', async () => {
    const user = userEvent.setup();
    render(<App sources={[disc]} storage={memoryStorage()} />);
    expect(drive().getAttribute('data-seek')).toBe('false');

    await user.click(screen.getByText('Callout Disc'));
    expect(drive().getAttribute('data-active')).toBe('true');
    expect(drive().getAttribute('data-seek')).toBe('true');
    await waitFor(() => expect(drive().getAttribute('data-seek')).toBe('false'), { timeout: SEEK_PULSE_MS * 3 });

    await user.click(screen.getByRole('button', { name: 'Diagram' }));
    expect(drive().getAttribute('data-seek')).toBe('true');
    await waitFor(() => expect(drive().getAttribute('data-seek')).toBe('false'), { timeout: SEEK_PULSE_MS * 3 });

    // A Callout Key entry navigates like a pin, and that is a seek too.
    await user.click(screen.getByRole('button', { name: '[2] Drawbridge' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Drawbridge');
    expect(drive().getAttribute('data-seek')).toBe('true');
  });
});
