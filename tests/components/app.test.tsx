// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import { __setContextFactory, isMuted, setMuted } from '../../src/audio/audio';
import type { DiscManifest } from '../../src/model/manifest';

const disc: DiscManifest = {
  disc_id: 'disc1',
  title: 'Test Disc',
  tagline: 'A tagline',
  sections: [
    { section_id: 's1', title: 'Alpha', paragraphs: ['Alpha text'] },
    { section_id: 's2', title: 'Beta', paragraphs: ['Beta text one'] },
  ],
  diagrams: [
    {
      diagram_id: 'g1',
      title: 'Diagram One',
      viewBox: '0 0 100 100',
      shapes: [{ kind: 'rect', x: 10, y: 10, width: 20, height: 20 }],
      hotspots: [{ label: 'Tower', x: 25, y: 30, section_id: 's2' }],
    },
  ],
  trivia: [
    { question_id: 'q1', prompt: 'Question one?', options: ['wrong1', 'right1'], correct_index: 1, section_id: 's1' },
    { question_id: 'q2', prompt: 'Question two?', options: ['right2', 'wrong2'], correct_index: 0, section_id: 's2' },
  ],
  dungeons: [
    {
      dungeon_id: 'd1',
      title: 'Test Keep',
      rooms: [
        { room_id: 'entrance', name: 'Gate', description: 'A cold gate.', exits: [{ to: 'hall' }] },
        { room_id: 'hall', name: 'Great Hall', description: 'A long hall.', exits: [{ to: 'throne_room' }] },
        { room_id: 'throne_room', name: 'Throne', description: 'The throne.', exits: [] },
      ],
    },
  ],
};

const sources = [disc];

interface Counters {
  contexts: number;
  created: number;
  started: number;
}

function param() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
}

function makeMock(c: Counters): () => AudioContext {
  return () => {
    c.contexts++;
    const source = () => {
      c.created++;
      return {
        type: 'sine',
        buffer: null,
        frequency: param(),
        onended: null as null | (() => void),
        connect() {},
        disconnect() {},
        start() {
          c.started++;
        },
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
      createOscillator: source,
      createBufferSource: source,
      createBuffer: (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {}, disconnect() {} }),
    } as unknown as AudioContext;
  };
}

let counters: Counters;

beforeEach(() => {
  counters = { contexts: 0, created: 0, started: 0 };
  setMuted(false);
  __setContextFactory(makeMock(counters));
});
afterEach(() => {
  cleanup();
  setMuted(false);
  __setContextFactory(null);
});

const questions = disc.trivia;
function currentQuestion() {
  const group = screen.getByRole('group', { name: 'Trivia question' });
  const prompt = group.querySelector('p')!.textContent!;
  return questions.find((q) => q.prompt === prompt)!;
}

describe('App integration', () => {
  it('opens a disc, reads a section, and follows a hotspot (5.12, 10.2, 10.4, 11.4)', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.click(screen.getByText('Test Disc'));
    expect(screen.getByRole('dialog', { name: 'Test Disc' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByText('Alpha text')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Diagram One' }));
    await user.click(screen.getByRole('button', { name: 'Tower' }));
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeTruthy();
    expect(screen.getByText('Beta text one')).toBeTruthy();
  });

  it('plays a KeepMaze round to victory (12.5)', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.click(screen.getByText('Test Disc'));
    await user.click(screen.getByRole('button', { name: 'Test Keep' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    for (const exit of ['Great Hall', 'Throne']) {
      await user.click(screen.getByRole('button', { name: exit }));
      const q = currentQuestion();
      await user.click(screen.getByRole('button', { name: q.options[q.correct_index]! }));
    }
    const msg = screen.getByRole('status');
    expect(msg.textContent).toMatch(/Victory/);
    expect(msg.textContent).toContain('2 moves');
    expect(msg.textContent).toContain('0 incorrect');
  });

  it('starts unmuted and toggling mute stops all new audio nodes (13.7, 13.8)', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    expect(isMuted()).toBe(false);
    const toggle = screen.getByRole('button', { name: 'Sound: On' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    await user.click(toggle);
    expect(isMuted()).toBe(true);
    expect(screen.getByRole('button', { name: 'Sound: Off' }).getAttribute('aria-pressed')).toBe('true');
    const created = counters.created;
    const started = counters.started;

    await user.click(screen.getByText('Test Disc'));
    await user.click(screen.getByRole('button', { name: 'Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Test Keep' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(counters.created).toBe(created);
    expect(counters.started).toBe(started);
  });

  it('renders ErrorList for an invalid injected manifest (5.12, 13.11)', () => {
    const bad = { ...disc, disc_id: 'bad', sections: [{ section_id: 's1', paragraphs: ['x'] }] };
    render(<App sources={[bad]} />);
    expect(screen.queryByText('Test Disc')).toBeNull();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(items.some((t) => t.includes('sections[0].title:'))).toBe(true);
    expect(screen.getByRole('button', { name: /Sound:/ })).toBeTruthy();
  });
});
