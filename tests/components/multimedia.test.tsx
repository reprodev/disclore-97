// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import { MediaReel, REEL_INTERVAL_MS } from '../../src/components/MediaReel';
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

  it('Play advances every 4 seconds and Pause stops it', () => {
    vi.useFakeTimers();
    render(<MediaReel media={MEDIA} fallback={noPlate} />);
    expect(REEL_INTERVAL_MS).toBe(4000);
    click('Play');
    expect(screen.getByRole('button', { name: 'Pause' }).getAttribute('aria-pressed')).toBe('true');
    act(() => void vi.advanceTimersByTime(3999));
    expect(counter()).toBe('Frame 1 / 3');
    act(() => void vi.advanceTimersByTime(1));
    expect(counter()).toBe('Frame 2 / 3');
    act(() => void vi.advanceTimersByTime(4000));
    expect(counter()).toBe('Frame 3 / 3');
    click('Pause');
    act(() => void vi.advanceTimersByTime(20000));
    expect(counter()).toBe('Frame 3 / 3');
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('disables the controls for a single picture', () => {
    render(<MediaReel media={[MEDIA[0]]} fallback={noPlate} />);
    for (const name of ['Prev', 'Play', 'Next']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
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
    expect(screen.getByRole('button', { name: 'Stop' }).getAttribute('aria-pressed')).toBe('true');
    act(() => spoken[spoken.length - 1].onend?.());
    expect(screen.getByRole('button', { name: 'Read Aloud' })).toBeTruthy();
  });

  it('Stop cancels the narration', () => {
    installSpeech();
    render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    cancel.mockClear();
    click('Stop');
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

  it('stops on unmount', () => {
    installSpeech();
    const { unmount } = render(<ArticleViewer sections={SECTIONS} sectionId="s1" />);
    click('Read Aloud');
    cancel.mockClear();
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
