// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMuted } from '../../src/audio/audio';
import { isSpeechAvailable, speak, stopSpeaking } from '../../src/audio/speech';
import { MiniMap } from '../../src/components/MiniMap';
import { PixelIcon } from '../../src/components/PixelIcon';
import type { IconName } from '../../src/components/PixelIcon';
import { buildFlashcards } from '../../src/model/flashcards';
import type { DiscManifest, Dungeon } from '../../src/model/manifest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
  setMuted(false);
});

const rectsOf = (container: HTMLElement) => container.querySelector('svg')!.innerHTML;

describe('PixelIcon with a missing map', () => {
  it('renders an unknown icon name safely, as the CD-ROM, instead of throwing', () => {
    let container: HTMLElement | undefined;
    expect(() => {
      ({ container } = render(<PixelIcon name={'unknown' as IconName} size={32} />));
    }).not.toThrow();
    const svg = container!.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('data-icon')).toBe('unknown');
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('draws the same pixels as the CD-ROM for an unknown name', () => {
    const { container: a } = render(<PixelIcon name={'not-an-icon' as IconName} />);
    const unknown = rectsOf(a);
    cleanup();
    const { container: b } = render(<PixelIcon name="cd" />);
    expect(unknown).toBe(rectsOf(b));
  });

  it('still draws the muted cross on the speaker', () => {
    const { container } = render(<PixelIcon name="speaker" muted />);
    expect(container.querySelector('svg')!.innerHTML).toContain('var(--color-crimson-light)');
  });
});

describe('other loops over arrays do not throw on missing or empty data', () => {
  it('MiniMap draws a room that has no exits list', () => {
    const dungeon = {
      dungeon_id: 'd',
      title: 'D',
      rooms: [
        { room_id: 'entrance', name: 'Gate', description: 'A gate.' },
        { room_id: 'throne_room', name: 'Throne', description: 'The throne.', exits: [] },
      ],
    } as unknown as Dungeon;
    expect(() => render(<MiniMap dungeon={dungeon} visited={['entrance']} currentRoomId="entrance" />)).not.toThrow();
  });

  it('speak() returns false for a missing, empty, or non-text list, and never throws', () => {
    const speakSpy = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      constructor(readonly text: string) {}
    });
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: speakSpy, cancel: vi.fn() }, configurable: true });
    expect(isSpeechAvailable()).toBe(true);
    const onEnd = vi.fn();
    for (const bad of [undefined, null, [], ['', '  '], [5, null]] as unknown as string[][]) {
      expect(() => speak(bad, onEnd)).not.toThrow();
      expect(speak(bad, onEnd)).toBe(false);
    }
    expect(speakSpy).not.toHaveBeenCalled();
    expect(speak(['Hello', 7 as unknown as string], onEnd)).toBe(true);
    expect(speakSpy).toHaveBeenCalledTimes(1);
    stopSpeaking();
  });

  it('buildFlashcards copes with a section whose facts are missing or not a list', () => {
    const disc = {
      disc_id: 'x',
      title: 'X',
      tagline: 't',
      sections: [
        { section_id: 'a', title: 'A', paragraphs: ['First sentence. More.'] },
        { section_id: 'b', title: 'B', paragraphs: ['Bee sentence.'], facts: 'not a list' },
        { section_id: 'c', title: 'C', paragraphs: ['Sea.'], facts: [] },
      ],
      diagrams: [],
      trivia: [],
      dungeons: [],
    } as unknown as DiscManifest;
    let cards: ReturnType<typeof buildFlashcards> = [];
    expect(() => {
      cards = buildFlashcards(disc);
    }).not.toThrow();
    expect(cards.map((c) => c.back)).toEqual(['First sentence.', 'Bee sentence.', 'Sea.']);
  });
});
