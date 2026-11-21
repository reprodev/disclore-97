// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const audio = vi.hoisted(() => {
  let muted = false;
  const listeners = new Set<(m: boolean) => void>();
  return {
    playClick: vi.fn(),
    playSpinUp: vi.fn(),
    playPageFlip: vi.fn(),
    playTorch: vi.fn(),
    playDoorUnlock: vi.fn(),
    isMuted: () => muted,
    setMuted: (m: boolean) => {
      muted = m;
      listeners.forEach((l) => l(muted));
    },
    toggleMuted: () => {
      muted = !muted;
      listeners.forEach((l) => l(muted));
      return muted;
    },
    subscribeMuted: (l: (m: boolean) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
});
vi.mock('../../src/audio/audio', () => audio);

import { DiscBrowser } from '../../src/components/DiscBrowser';
import { ArticleViewer } from '../../src/components/ArticleViewer';
import { HotspotViewer } from '../../src/components/HotspotViewer';
import { KeepMazeUI } from '../../src/components/KeepMazeUI';
import { MuteToggle } from '../../src/components/MuteToggle';
import { ErrorList } from '../../src/components/ErrorList';
import type { DiscManifest, Dungeon } from '../../src/model/manifest';

const dungeon: Dungeon = {
  dungeon_id: 'd1',
  title: 'Test Keep',
  rooms: [
    { room_id: 'entrance', name: 'Gate', description: 'A cold gate.', exits: [{ to: 'hall' }] },
    { room_id: 'hall', name: 'Great Hall', description: 'A long hall.', exits: [{ to: 'throne_room' }] },
    { room_id: 'throne_room', name: 'Throne', description: 'The throne.', exits: [] },
  ],
};

const disc: DiscManifest = {
  disc_id: 'disc1',
  title: 'Test Disc',
  tagline: 'A tagline',
  sections: [
    { section_id: 's1', title: 'Alpha', paragraphs: ['Alpha text'] },
    { section_id: 's2', title: 'Beta', paragraphs: ['Beta text one', 'Beta text two'] },
  ],
  diagrams: [
    {
      diagram_id: 'g1',
      title: 'Diagram One',
      viewBox: '0 0 100 100',
      shapes: [{ kind: 'rect', x: 10, y: 10, width: 20, height: 20 }],
      hotspots: [
        { label: 'Tower', x: 25, y: 30, section_id: 's2' },
        { label: 'Moat', x: 70, y: 80, section_id: 's1' },
      ],
    },
  ],
  trivia: [
    { question_id: 'q1', prompt: 'Question one?', options: ['wrong1', 'right1'], correct_index: 1, section_id: 's1' },
    { question_id: 'q2', prompt: 'Question two?', options: ['right2', 'wrong2'], correct_index: 0, section_id: 's2' },
  ],
  dungeons: [dungeon],
};

const other: DiscManifest = { ...disc, disc_id: 'disc2', title: 'Other Disc', tagline: 'Second tagline' };

beforeEach(() => {
  Object.values(audio).forEach((f) => {
    if (typeof f === 'function' && 'mockClear' in f) (f as ReturnType<typeof vi.fn>).mockClear();
  });
  audio.setMuted(false);
});
afterEach(cleanup);

describe('DiscBrowser (Req 10.1, 10.2)', () => {
  const noop = () => {};
  it('lists discs by title and tagline and requests spin-up on open', async () => {
    const onOpenDisc = vi.fn();
    const user = userEvent.setup();
    render(
      <DiscBrowser
        discs={[disc, other]}
        openDiscId={null}
        onOpenDisc={onOpenDisc}
        onCloseDisc={noop}
        onSelectSection={noop}
        onSelectDiagram={noop}
        onSelectDungeon={noop}
      />,
    );
    expect(screen.getByText('Test Disc')).toBeTruthy();
    expect(screen.getByText('A tagline')).toBeTruthy();
    expect(screen.getByText('Other Disc')).toBeTruthy();
    expect(screen.getByText('Second tagline')).toBeTruthy();
    await user.click(screen.getByText('Other Disc'));
    expect(audio.playSpinUp).toHaveBeenCalledTimes(1);
    expect(onOpenDisc).toHaveBeenCalledWith('disc2');
  });

  it('shows sections, diagrams, trivia and dungeons for the open disc', async () => {
    const onSelectSection = vi.fn();
    const user = userEvent.setup();
    render(
      <DiscBrowser
        discs={[disc]}
        openDiscId="disc1"
        onOpenDisc={noop}
        onCloseDisc={noop}
        onSelectSection={onSelectSection}
        onSelectDiagram={noop}
        onSelectDungeon={noop}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Test Disc' })).toBeTruthy();
    for (const h of ['Sections', 'Diagrams', 'Trivia', 'Dungeons']) {
      expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    }
    expect(screen.getByText('Question one?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Diagram One' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test Keep' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onSelectSection).toHaveBeenCalledWith('s2');
  });
});

describe('ArticleViewer (Req 10.4, 10.5, 10.6)', () => {
  it('renders title and paragraphs and requests a page flip', () => {
    render(<ArticleViewer sections={disc.sections} sectionId="s2" />);
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeTruthy();
    expect(screen.getByText('Beta text one')).toBeTruthy();
    expect(screen.getByText('Beta text two')).toBeTruthy();
    expect(audio.playPageFlip).toHaveBeenCalledTimes(1);
  });

  it('resets scrollTop to 0 when the section changes', () => {
    const { rerender, container } = render(<ArticleViewer sections={disc.sections} sectionId="s1" />);
    const article = container.querySelector('article') as HTMLElement;
    article.scrollTop = 120;
    rerender(<ArticleViewer sections={disc.sections} sectionId="s2" />);
    expect((container.querySelector('article') as HTMLElement).scrollTop).toBe(0);
  });

  it('shows a not-found message for an unknown section without a page flip', () => {
    render(<ArticleViewer sections={disc.sections} sectionId="nope" />);
    expect(screen.getByText(/not found/i)).toBeTruthy();
    expect(audio.playPageFlip).not.toHaveBeenCalled();
  });
});

describe('HotspotViewer (Req 11.3, 11.4)', () => {
  it('shows the label tooltip on hover and focus', () => {
    render(<HotspotViewer diagram={disc.diagrams[0]!} onNavigate={() => {}} />);
    const tower = screen.getByRole('button', { name: 'Tower' });
    const tip = tower.closest('.tooltip-wrap')!.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tip.hasAttribute('hidden')).toBe(true);
    fireEvent.pointerEnter(tower.closest('.tooltip-wrap')!);
    expect(tip.hasAttribute('hidden')).toBe(false);
    expect(tip.textContent).toBe('Tower');
    fireEvent.pointerLeave(tower.closest('.tooltip-wrap')!);
    expect(tip.hasAttribute('hidden')).toBe(true);
    act(() => tower.focus());
    expect(tip.hasAttribute('hidden')).toBe(false);
  });

  it('navigates to the hotspot section on click and Enter, with a page flip', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<HotspotViewer diagram={disc.diagrams[0]!} onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: 'Tower' }));
    expect(onNavigate).toHaveBeenLastCalledWith('s2');
    act(() => screen.getByRole('button', { name: 'Moat' }).focus());
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenLastCalledWith('s1');
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(audio.playPageFlip).toHaveBeenCalledTimes(2);
  });
});

describe('KeepMazeUI (Req 12.x)', () => {
  const byPrompt = (prompt: string) => disc.trivia.find((q) => q.prompt === prompt)!;
  const currentQuestion = () => {
    const group = screen.getByRole('group', { name: 'Trivia question' });
    const prompt = group.querySelector('p')!.textContent!;
    return byPrompt(prompt);
  };
  const answerWith = async (user: ReturnType<typeof userEvent.setup>, correct: boolean) => {
    const q = currentQuestion();
    const idx = correct ? q.correct_index : (q.correct_index + 1) % q.options.length;
    await user.click(screen.getByRole('button', { name: q.options[idx]! }));
    return q;
  };
  const setup = async (onOpenSection = vi.fn()) => {
    const user = userEvent.setup();
    render(<KeepMazeUI disc={disc} dungeon={dungeon} onOpenSection={onOpenSection} rng={() => 0.5} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    return user;
  };

  it('starts at the entrance showing room, description, exits and counters (12.1)', async () => {
    await setup();
    expect(screen.getByText('Gate')).toBeTruthy();
    expect(screen.getByText('A cold gate.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Great Hall' })).toBeTruthy();
    expect(screen.getByText('Moves: 0')).toBeTruthy();
    expect(screen.getByText('Incorrect: 0')).toBeTruthy();
    expect(audio.playTorch).toHaveBeenCalled();
  });

  it('correct answer moves the player and counts a move (12.3)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Great Hall' }));
    await answerWith(user, true);
    expect(audio.playDoorUnlock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('A long hall.')).toBeTruthy();
    expect(screen.getByText('Moves: 1')).toBeTruthy();
  });

  it('wrong answer keeps the room, counts no move, and links to the cited section (12.4, 12.9)', async () => {
    const onOpenSection = vi.fn();
    const user = await setup(onOpenSection);
    await user.click(screen.getByRole('button', { name: 'Great Hall' }));
    const q = await answerWith(user, false);
    expect(screen.getByText('A cold gate.')).toBeTruthy();
    expect(screen.getByText('Moves: 0')).toBeTruthy();
    expect(screen.getByText('Incorrect: 1')).toBeTruthy();
    expect(audio.playDoorUnlock).not.toHaveBeenCalled();
    const title = disc.sections.find((s) => s.section_id === q.section_id)!.title;
    await user.click(screen.getByRole('button', { name: new RegExp(`Open "${title}"`) }));
    expect(onOpenSection).toHaveBeenCalledWith(q.section_id);
  });

  it('retrying the exit draws the next question (12.10)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Great Hall' }));
    const first = await answerWith(user, false);
    await user.click(screen.getByRole('button', { name: 'Great Hall' }));
    const second = currentQuestion();
    expect(second.question_id).not.toBe(first.question_id);
  });

  it('shows victory with move and incorrect counts, then restart resets (12.5, 12.6)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Great Hall' }));
    await answerWith(user, false);
    await user.click(screen.getByRole('button', { name: 'Great Hall' }));
    await answerWith(user, true);
    await user.click(screen.getByRole('button', { name: 'Throne' }));
    await answerWith(user, true);
    const msg = screen.getByRole('status');
    expect(msg.textContent).toMatch(/Victory/);
    expect(msg.textContent).toContain('2 moves');
    expect(msg.textContent).toContain('1 incorrect');
    await user.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.getByText('A cold gate.')).toBeTruthy();
    expect(screen.getByText('Moves: 0')).toBeTruthy();
    expect(screen.getByText('Incorrect: 0')).toBeTruthy();
  });

  it('disables Start with a message when the disc has no trivia (12.12)', () => {
    render(<KeepMazeUI disc={{ ...disc, trivia: [] }} dungeon={dungeon} onOpenSection={() => {}} />);
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/trivia/i);
  });
});

describe('MuteToggle (Req 13.8)', () => {
  it('shows and toggles the mute state', async () => {
    const user = userEvent.setup();
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: 'Sound: On' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    await user.click(btn);
    const off = screen.getByRole('button', { name: 'Sound: Off' });
    expect(off.getAttribute('aria-pressed')).toBe('true');
    expect(audio.isMuted()).toBe(true);
    await user.click(off);
    expect(screen.getByRole('button', { name: 'Sound: On' })).toBeTruthy();
  });
});

describe('ErrorList (Req 5.12)', () => {
  it('renders path: message for each error', () => {
    render(
      <ErrorList
        errors={[
          { path: 'sections[0].title', code: 'missing-field', message: 'is required' },
          { path: 'dungeons[0]', code: 'orphan-room', message: 'orphan rooms: a, b' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toBe('sections[0].title: is required');
    expect(items[1]!.textContent).toBe('dungeons[0]: orphan rooms: a, b');
  });
});
