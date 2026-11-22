// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import { MediaReel, REEL_INTERVAL_MS } from '../../src/components/MediaReel';
import { VIEWER_HINT } from '../../src/components/MediaViewerModal';
import { setMuted } from '../../src/audio/audio';
import type { MediaItem, Section } from '../../src/model/manifest';

const MEDIA: MediaItem[] = [
  { url: 'https://cdn.example.org/one.png', caption: 'First picture' },
  { url: 'https://cdn.example.org/two.png', caption: 'Second picture' },
  { url: 'https://cdn.example.org/three.png', caption: 'Third picture' },
];

const SECTIONS: Section[] = [
  { section_id: 's1', title: 'Alpha', paragraphs: ['Alpha text.', 'More alpha.'] },
  { section_id: 's2', title: 'Beta', paragraphs: ['Beta text.'] },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const counter = () => screen.getByText(/^Frame \d+ \/ \d+$/).textContent;
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const noPlate = () => <div data-testid="plate" />;

describe('MediaReel', () => {
  it('shows the first picture in a no-referrer, lazy-loading frame with its caption', () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    const img = screen.getByRole('img', { name: 'First picture' });
    expect(img.getAttribute('src')).toBe(MEDIA[0].url);
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(screen.getByText('First picture', { selector: 'figcaption' })).toBeTruthy();
    expect(counter()).toBe('Frame 1 / 3');
  });

  it('steps with Next and Prev and wraps around at both ends', () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    click('Next');
    expect(counter()).toBe('Frame 2 / 3');
    expect(screen.getByRole('img', { name: 'Second picture' })).toBeTruthy();
    click('Next');
    click('Next');
    expect(counter()).toBe('Frame 1 / 3');
    click('Prev');
    expect(counter()).toBe('Frame 3 / 3');
  });

  it('has Prev, Next, and Enlarge but no Play or Pause button', () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    const bar = screen.getByRole('group', { name: 'Multimedia Reel controls' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Prev', 'Next', 'Enlarge']);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(counter()).toBe('Frame 1 / 3');
  });

  it('never advances by itself while the Picture Viewer is closed', () => {
    vi.useFakeTimers();
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    act(() => void vi.advanceTimersByTime(20000));
    expect(counter()).toBe('Frame 1 / 3');
  });

  it('keeps Enlarge enabled and disables stepping for a single picture', () => {
    render(<MediaReel media={[MEDIA[0]]} fallback={noPlate} />);
    expect((screen.getByRole('button', { name: 'Prev' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Enlarge' }) as HTMLButtonElement).disabled).toBe(false);
    expect(counter()).toBe('Frame 1 / 1');
  });
  it('shows the fallback for a picture that fails to load, and keeps the caption', () => {
    const fallback = vi.fn((caption: string) => <div data-testid="plate">{caption}</div>);
    render(<MediaReel media={MEDIA} fallback={fallback} />);
    fireEvent.error(screen.getByRole('img', { name: 'First picture' }));
    expect(screen.queryByRole('img', { name: 'First picture' })).toBeNull();
    expect(screen.getByTestId('plate').textContent).toBe('First picture');
    expect(screen.getByText('First picture', { selector: 'figcaption' })).toBeTruthy();
    click('Next');
    expect(screen.getByRole('img', { name: 'Second picture' })).toBeTruthy();
  });

  it('starts over when the pictures change', () => {
    const { rerender } = render(<MediaReel media={MEDIA} fallback={noPlate} />);
    click('Next');
    rerender(<MediaReel media={[MEDIA[2], MEDIA[1]]} fallback={noPlate} />);
    expect(counter()).toBe('Frame 1 / 2');
    expect(screen.getByRole('img', { name: 'Third picture' })).toBeTruthy();
  });
});

describe('ArticleViewer Multimedia Reel', () => {
  it('replaces the plate with the Media Frame when the disc has media', () => {
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" media={MEDIA} />);
    expect(screen.getByRole('img', { name: 'First picture' })).toBeTruthy();
    expect(screen.queryByText('Plate: Alpha')).toBeNull();
  });

  it('keeps the plate when the disc has no media', () => {
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    expect(screen.getByText('Plate: Alpha')).toBeTruthy();
    expect(screen.queryByText(/^Frame \d+ \/ \d+$/)).toBeNull();
  });

  it('falls back to the SVG plate when the picture cannot load', () => {
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" media={MEDIA} />);
    fireEvent.error(screen.getByRole('img', { name: 'First picture' }));
    expect(document.querySelector('figure.plate svg')).not.toBeNull();
  });
});

describe('Read Aloud', () => {
  class FakeUtterance {
    lang = '';
    rate = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly text: string) {}
  }
  let spoken: FakeUtterance[];
  const speak = vi.fn((u: FakeUtterance) => void spoken.push(u));
  const cancel = vi.fn();

  const installSpeech = () => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    Object.defineProperty(window, 'speechSynthesis', { value: { speak, cancel }, configurable: true });
  };

  beforeEach(() => {
    spoken = [];
    speak.mockClear();
    cancel.mockClear();
    setMuted(false);
  });

  afterEach(() => {
    setMuted(false);
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'speechSynthesis');
  });

  it('is disabled when speechSynthesis is unavailable', () => {
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    const button = screen.getByRole('button', { name: 'Read Aloud' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/not available/i);
  });

  it('speaks the title and paragraphs, then returns to Read Aloud when finished', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    expect(spoken.map((u) => u.text)).toEqual(['Alpha', 'Alpha text.', 'More alpha.']);
    expect(screen.getByRole('button', { name: 'Stop (1/3)' }).getAttribute('aria-pressed')).toBe('true');
    act(() => spoken[spoken.length - 1].onend?.());
    expect(screen.getByRole('button', { name: 'Read Aloud' })).toBeTruthy();
  });

  it('shows paragraph progress while narrating and follows each paragraph', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    expect(screen.getByRole('button', { name: 'Stop (1/3)' })).toBeTruthy();
    act(() => spoken[1].onstart?.());
    expect(screen.getByRole('button', { name: 'Stop (2/3)' })).toBeTruthy();
    act(() => spoken[2].onstart?.());
    expect(screen.getByRole('button', { name: 'Stop (3/3)' })).toBeTruthy();
    act(() => spoken[2].onend?.());
    expect(screen.getByRole('button', { name: 'Read Aloud' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Stop cancels the narration', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    cancel.mockClear();
    click('Stop (1/3)');
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Read Aloud' })).toBeTruthy();
  });

  it('stops when the global Mute is switched on, and stays disabled while muted', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    cancel.mockClear();
    act(() => setMuted(true));
    expect(cancel).toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Read Aloud' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    act(() => setMuted(false));
    expect((screen.getByRole('button', { name: 'Read Aloud' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not speak while muted', () => {
    installSpeech();
    setMuted(true);
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    expect((screen.getByRole('button', { name: 'Read Aloud' }) as HTMLButtonElement).disabled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
  });

  it('stops when the section changes', () => {
    installSpeech();
    const { rerender } = render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    cancel.mockClear();
    rerender(<ArticleViewer sections={SECTIONS} sectionId="s2" />);
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Read Aloud' })).toBeTruthy();
  });

  it('highlights the paragraph being read and clears it when finished', () => {
    installSpeech();
    const { container } = render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    const active = () => Array.from(container.querySelectorAll('[data-speaking="true"]')).map((e) => e.textContent);
    expect(active()).toEqual([]);

    click('Read Aloud');
    expect(active()).toEqual(['Alpha']); // the title is item 1
    expect(container.querySelector('h1')!.className).toContain('article-title--speaking');

    act(() => spoken[1].onstart?.());
    expect(active()).toEqual(['Alpha text.']);
    expect(container.querySelector('p[aria-current="true"]')!.className).toContain('article-paragraph--speaking');

    act(() => spoken[2].onstart?.());
    expect(active()).toEqual(['More alpha.']);

    act(() => spoken[2].onend?.());
    expect(active()).toEqual([]);
    expect(container.querySelector('.article-paragraph--speaking')).toBeNull();
  });

  it('clears the highlight when narration is stopped', () => {
    installSpeech();
    const { container } = render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    act(() => spoken[1].onstart?.());
    expect(container.querySelector('.article-paragraph--speaking')).not.toBeNull();
    click('Stop (2/3)');
    expect(container.querySelector('[data-speaking="true"]')).toBeNull();
  });

  it('toggles the reading speed between 1x and 1.2x and speaks at that rate', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    expect(screen.getByRole('button', { name: '1x' })).toBeTruthy();
    click('1x');
    expect(screen.getByRole('button', { name: '1.2x' })).toBeTruthy();
    click('Read Aloud');
    expect(spoken.map((u) => u.rate)).toEqual([1.2, 1.2, 1.2]);
    act(() => spoken[2].onend?.());
    click('1.2x');
    expect(screen.getByRole('button', { name: '1x' })).toBeTruthy();
    spoken = [];
    click('Read Aloud');
    expect(spoken.map((u) => u.rate)).toEqual([1, 1, 1]);
  });

  it('changing the speed mid-narration carries on from the current paragraph', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    act(() => spoken[1].onstart?.());
    expect(screen.getByRole('button', { name: 'Stop (2/3)' })).toBeTruthy();
    spoken = [];
    click('1x');
    expect(spoken.map((u) => [u.text, u.rate])).toEqual([
      ['Alpha text.', 1.2],
      ['More alpha.', 1.2],
    ]);
    expect(screen.getByRole('button', { name: 'Stop (2/3)' })).toBeTruthy();
    act(() => spoken[1].onstart?.());
    expect(screen.getByRole('button', { name: 'Stop (3/3)' })).toBeTruthy();
  });

  it('disables the speed button when speech is unavailable', () => {
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    expect((screen.getByRole('button', { name: '1x' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('stops on unmount', () => {
    installSpeech();
    const { unmount } = render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    cancel.mockClear();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});

describe('MediaReel loading state', () => {
  it('shows "Loading picture..." until the picture loads', () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    expect(screen.getByText('Loading picture...')).toBeTruthy();
    fireEvent.load(screen.getByRole('img', { name: 'First picture' }));
    expect(screen.queryByText('Loading picture...')).toBeNull();
  });

  it('remembers loaded pictures and shows the note again for a new one', () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    fireEvent.load(screen.getByRole('img', { name: 'First picture' }));
    click('Next');
    expect(screen.getByText('Loading picture...')).toBeTruthy();
    click('Prev');
    expect(screen.queryByText('Loading picture...')).toBeNull();
  });

  it('swaps the note for the fallback plate when the picture fails', () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    fireEvent.error(screen.getByRole('img', { name: 'First picture' }));
    expect(screen.queryByText('Loading picture...')).toBeNull();
    expect(screen.getByTestId('plate')).toBeTruthy();
  });
});

describe('Picture Viewer', () => {
  const viewer = () => screen.getByRole('dialog', { name: 'Picture Viewer \u2014 Test Disc' });
  const setup = (media = MEDIA) => render(<MediaReel media={media} fallback={noPlate} title="Test Disc" />);

  it('opens from the picture and from Enlarge, with a Win95 caption bar', () => {
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    const zoom = screen.getByRole('button', { name: 'View larger: First picture' });
    fireEvent.click(zoom);
    expect(viewer()).toBeTruthy();
    cleanup();

    setup();
    click('Enlarge');
    expect(viewer()).toBeTruthy();
  });

  it('shows the full-size picture without a referrer, plus the full caption', () => {
    setup();
    click('Enlarge');
    const img = within(viewer()).getByRole('img', { name: 'First picture' });
    expect(img.getAttribute('src')).toBe(MEDIA[0].url);
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(within(viewer()).getByText('First picture', { selector: 'p' })).toBeTruthy();
    expect(within(viewer()).getByText('Frame 1 / 3')).toBeTruthy();
  });

  it('puts focus on the picture, so Space cannot press Close', () => {
    setup();
    click('Enlarge');
    expect(document.activeElement).toBe(within(viewer()).getByRole('group', { name: 'Picture' }));
  });

  it('Prev and Next step the frame and stay in sync with the reel', () => {
    setup();
    click('Enlarge');
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Next' }));
    expect(within(viewer()).getByText('Frame 2 / 3')).toBeTruthy();
    expect(within(viewer()).getByRole('img', { name: 'Second picture' })).toBeTruthy();
    expect(screen.getAllByText('Frame 2 / 3')).toHaveLength(2);
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Prev' }));
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Prev' }));
    expect(within(viewer()).getByText('Frame 3 / 3')).toBeTruthy();
  });

  it('ArrowRight and ArrowLeft step the frame', () => {
    setup();
    click('Enlarge');
    const stage = within(viewer()).getByRole('group', { name: 'Picture' });
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(within(viewer()).getByText('Frame 2 / 3')).toBeTruthy();
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(within(viewer()).getByText('Frame 3 / 3')).toBeTruthy();
  });

  it('Space toggles Play and Pause, and Play advances the shared reel', () => {
    vi.useFakeTimers();
    setup();
    click('Enlarge');
    const stage = within(viewer()).getByRole('group', { name: 'Picture' });
    fireEvent.keyDown(stage, { key: ' ' });
    expect(within(viewer()).getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('true');
    act(() => void vi.advanceTimersByTime(4000));
    expect(within(viewer()).getByText('Frame 2 / 3')).toBeTruthy();
    fireEvent.keyDown(stage, { key: ' ' });
    expect(within(viewer()).getByRole('button', { name: 'Play' })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(8000));
    expect(within(viewer()).getByText('Frame 2 / 3')).toBeTruthy();
  });

  it('the thumbnail strip jumps to a frame and marks the active one', () => {
    setup();
    click('Enlarge');
    const strip = within(viewer()).getByRole('list', { name: 'Thumbnails' });
    const thumbs = within(strip).getAllByRole('button');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].getAttribute('data-active')).toBe('true');
    fireEvent.click(within(strip).getByRole('button', { name: 'Frame 3: Third picture' }));
    expect(within(viewer()).getByText('Frame 3 / 3')).toBeTruthy();
    expect(thumbs[2].getAttribute('data-active')).toBe('true');
    expect(thumbs[2].getAttribute('aria-current')).toBe('true');
    expect(thumbs[0].getAttribute('data-active')).toBe('false');
    expect(screen.getAllByText('Frame 3 / 3')).toHaveLength(2);
  });

  it('shows no filmstrip or stepping for a single picture', () => {
    setup([MEDIA[0]]);
    click('Enlarge');
    expect(within(viewer()).queryByRole('list', { name: 'Thumbnails' })).toBeNull();
    expect((within(viewer()).getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes it and focus returns to the picture button', () => {
    setup();
    const zoom = screen.getByRole('button', { name: 'View larger: First picture' });
    zoom.focus();
    fireEvent.click(zoom);
    expect(viewer()).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(zoom);
  });

  it('the close button closes it', () => {
    setup();
    click('Enlarge');
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Tab inside the window', () => {
    setup();
    click('Enlarge');
    const buttons = within(viewer()).getAllByRole('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(viewer().contains(document.activeElement)).toBe(true);
  });

  it('shows the fallback plate when the large picture fails to load', () => {
    setup();
    click('Enlarge');
    fireEvent.error(within(viewer()).getByRole('img', { name: 'First picture' }));
    expect(within(viewer()).getByTestId('plate')).toBeTruthy();
  });

  it('shows Loading picture... in the viewer until the picture arrives', () => {
    setup();
    click('Enlarge');
    expect(within(viewer()).getByText('Loading picture...')).toBeTruthy();
    fireEvent.load(within(viewer()).getByRole('img', { name: 'First picture' }));
    expect(within(viewer()).queryByText('Loading picture...')).toBeNull();
  });
});

describe('Picture Viewer slideshow', () => {
  const viewer = () => screen.getByRole('dialog', { name: 'Picture Viewer \u2014 Test Disc' });
  const open = () => {
    render(<MediaReel media={MEDIA} fallback={noPlate} title="Test Disc" />);
    click('Enlarge');
  };

  it('has Play / Pause and the keyboard hint in the footer', () => {
    open();
    expect(within(viewer()).getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(VIEWER_HINT).toBe('Space: Play \u2022 \u2190/\u2192: Step \u2022 Esc: Close');
    expect(within(viewer()).getByText(VIEWER_HINT)).toBeTruthy();
  });

  it('auto-advances every 4 seconds while playing, and Pause stops it', () => {
    vi.useFakeTimers();
    open();
    expect(REEL_INTERVAL_MS).toBe(4000);
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Play' }));
    act(() => void vi.advanceTimersByTime(3999));
    expect(within(viewer()).getByText('Frame 1 / 3')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1));
    expect(within(viewer()).getByText('Frame 2 / 3')).toBeTruthy();
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Pause' }));
    act(() => void vi.advanceTimersByTime(20000));
    expect(within(viewer()).getByText('Frame 2 / 3')).toBeTruthy();
  });

  it('pauses when the window closes: no more steps, and it reopens paused', () => {
    vi.useFakeTimers();
    open();
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Play' }));
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getAllByText('Frame 2 / 3')).toHaveLength(2); // the reel behind shows the same frame
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => void vi.advanceTimersByTime(20000));
    expect(counter()).toBe('Frame 2 / 3');
    click('Enlarge');
    expect(within(viewer()).getByRole('button', { name: 'Play' })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getAllByText('Frame 2 / 3')).toHaveLength(2);
  });

  it('Space toggles Play from the picture, and the reel stays free of a Play button', () => {
    open();
    const stage = within(viewer()).getByRole('group', { name: 'Picture' });
    fireEvent.keyDown(stage, { key: ' ' });
    expect(within(viewer()).getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^(Play|Pause)$/ })).toHaveLength(1);
  });
});