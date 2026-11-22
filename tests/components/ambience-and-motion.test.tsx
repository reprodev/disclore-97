// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { __setContextFactory, isAmbienceOn, setMuted } from '../../src/audio/audio';
import { BevelButton } from '../../src/components/BevelButton';
import { HotspotViewer } from '../../src/components/HotspotViewer';
import { Plate } from '../../src/components/Plate';
import { HeroArt } from '../../src/components/SplashArt';
import { Taskbar } from '../../src/components/Taskbar';
import { castlesDisc } from '../../src/discs/castles';
import { retroDisc } from '../../src/discs/retro';
import type { Diagram, DiscManifest } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';

function param() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
}

interface Counts {
  oscillators: number;
  started: number;
  stopped: number;
}

/** A tiny AudioContext double that counts the nodes created, started, and stopped. */
function makeContext(c: Counts): () => AudioContext {
  return () => {
    const source = () => {
      c.oscillators++;
      return {
        type: 'sine',
        buffer: null,
        loop: false,
        frequency: param(),
        onended: null as null | (() => void),
        connect() {},
        disconnect() {},
        start() {
          c.started++;
        },
        stop() {
          c.stopped++;
        },
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

let counts: Counts;
beforeEach(() => {
  counts = { oscillators: 0, started: 0, stopped: 0 };
  setMuted(false);
  __setContextFactory(makeContext(counts));
});
afterEach(() => {
  cleanup();
  setMuted(false);
  __setContextFactory(null);
});

const discs: DiscManifest[] = [castlesDisc];
const taskbar = () => (
  <Taskbar
    discs={discs}
    active={{ title: 'Castles', icon: 'cd' }}
    onOpenDisc={() => {}}
    onCloseAll={() => {}}
  />
);

describe('Taskbar Ambience toggle', () => {
  it('sits next to the Sound button and starts Off', () => {
    render(taskbar());
    const ambience = screen.getByRole('button', { name: 'Ambience: Off' });
    const sound = screen.getByRole('button', { name: 'Sound: On' });
    expect(ambience.getAttribute('aria-pressed')).toBe('false');
    expect(ambience.parentElement).toBe(sound.parentElement);
    expect(isAmbienceOn()).toBe(false);
    expect(counts.oscillators).toBe(0);
  });

  it('turns the soundscape on and off', () => {
    render(taskbar());
    fireEvent.click(screen.getByRole('button', { name: 'Ambience: Off' }));
    expect(screen.getByRole('button', { name: 'Ambience: On' }).getAttribute('aria-pressed')).toBe('true');
    expect(isAmbienceOn()).toBe(true);
    const startedWhileOn = counts.started;
    expect(startedWhileOn).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Ambience: On' }));
    expect(screen.getByRole('button', { name: 'Ambience: Off' })).toBeTruthy();
    expect(isAmbienceOn()).toBe(false);
    expect(counts.stopped).toBeGreaterThanOrEqual(startedWhileOn);
  });

  it('goes quiet when Sound is muted and comes back when it is not', () => {
    render(taskbar());
    fireEvent.click(screen.getByRole('button', { name: 'Ambience: Off' }));
    const first = counts.started;
    fireEvent.click(screen.getByRole('button', { name: 'Sound: On' }));
    expect(counts.stopped).toBeGreaterThanOrEqual(first);
    expect(screen.getByRole('button', { name: 'Ambience: On' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sound: Off' }));
    expect(counts.started).toBeGreaterThan(first);
  });

  it('stops cleanly when the Taskbar unmounts', () => {
    const { unmount } = render(taskbar());
    fireEvent.click(screen.getByRole('button', { name: 'Ambience: Off' }));
    const started = counts.started;
    unmount();
    expect(isAmbienceOn()).toBe(false);
    expect(counts.stopped).toBeGreaterThanOrEqual(started);
  });
});

describe('BevelButton quiet', () => {
  it('plays the click sound by default and stays silent when quiet', () => {
    const onClick = vi.fn();
    render(
      <>
        <BevelButton onClick={onClick}>Loud</BevelButton>
        <BevelButton quiet onClick={onClick}>
          Quiet
        </BevelButton>
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quiet' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(counts.oscillators).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Loud' }));
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(counts.oscillators).toBeGreaterThan(0);
  });
});

describe('SVG micro-animations', () => {
  const diagram = (anim: string | undefined): Diagram =>
    ({
      diagram_id: 'd',
      title: 'D',
      viewBox: '0 0 100 100',
      shapes: [
        { kind: 'rect', x: 1, y: 1, width: 5, height: 5, fill: 'var(--color-gold)', stroke: 'none', ...(anim ? { anim } : {}) },
        { kind: 'rect', x: 9, y: 9, width: 5, height: 5, fill: 'var(--color-gold)', stroke: 'none' },
      ],
      hotspots: [],
    }) as unknown as Diagram;

  it('the diagram viewer adds an animation class for known names only', () => {
    for (const anim of ['blink', 'flicker', 'glint']) {
      const { container, unmount } = render(<HotspotViewer diagram={diagram(anim)} onNavigate={() => {}} />);
      const rects = container.querySelectorAll('.hotspot-shapes rect');
      expect(rects[0].getAttribute('class')).toBe(`shape-anim shape-anim--${anim}`);
      expect(rects[1].getAttribute('class')).toBeNull();
      unmount();
    }
    const { container } = render(<HotspotViewer diagram={diagram('spin" onload="x')} onNavigate={() => {}} />);
    expect(container.querySelector('.hotspot-shapes rect')!.getAttribute('class')).toBeNull();
  });

  it('the validator accepts the three animation names and rejects anything else', () => {
    const withAnim = (anim: unknown) => ({
      ...castlesDisc,
      diagrams: [
        {
          ...castlesDisc.diagrams[0],
          shapes: [{ kind: 'rect', x: 1, y: 1, width: 2, height: 2, anim }, ...castlesDisc.diagrams[0].shapes],
        },
      ],
    });
    for (const anim of ['blink', 'flicker', 'glint']) expect(validateManifest(withAnim(anim)).ok).toBe(true);
    for (const anim of ['spin', '', 5, null]) {
      const r = validateManifest(withAnim(anim));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.some((e) => e.path.endsWith('.anim'))).toBe(true);
    }
  });

  it('the built-in discs animate the Retro monitor cursor and a castle window torch', () => {
    const retro = retroDisc.diagrams.flatMap((d) => d.shapes).filter((s) => s.anim === 'blink');
    const castle = castlesDisc.diagrams.flatMap((d) => d.shapes).filter((s) => s.anim === 'flicker');
    expect(retro).toHaveLength(1);
    expect(retro[0].kind === 'rect' && retro[0].fill).toBe('var(--color-phosphor)');
    expect(castle).toHaveLength(1);
    expect(validateManifest(retroDisc).ok).toBe(true);
    expect(validateManifest(castlesDisc).ok).toBe(true);
  });

  it('plates carry a CRT cursor, a torch window, and a CD glint', () => {
    const q = (kind: string, sel: string) => {
      const { container, unmount } = render(<Plate kind={kind} caption="c" />);
      const n = container.querySelectorAll(sel).length;
      unmount();
      return n;
    };
    expect(q('computer', '.plate__cursor')).toBe(1);
    expect(q('bbs', '.plate__cursor')).toBe(1);
    expect(q('terminal', '.plate__cursor')).toBe(1);
    expect(q('tower', '.plate__torch')).toBe(1);
    expect(q('disc', '.plate__glint')).toBe(1);
  });

  it('the hero art has a blinking cursor, flickering windows, and a CD glint', () => {
    const { container } = render(<HeroArt />);
    expect(container.querySelectorAll('.hero-cursor')).toHaveLength(1);
    expect(container.querySelectorAll('.hero-torch').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('.hero-glint')).toHaveLength(1);
  });

  it('every animation class is switched off under prefers-reduced-motion', () => {
    const read = (f: string) => readFileSync(resolve(__dirname, '../../src/styles', f), 'utf8');
    const checks: [string, string[]][] = [
      ['plate.css', ['.plate__cursor', '.plate__torch', '.plate__glint']],
      ['splash.css', ['.hero-cursor', '.hero-torch', '.hero-glint']],
      ['hotspot.css', ['.shape-anim--blink', '.shape-anim--flicker', '.shape-anim--glint']],
    ];
    for (const [file, classes] of checks) {
      const css = read(file);
      const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
      expect(css).toContain('prefers-reduced-motion: reduce');
      for (const cls of classes) {
        expect(css, `${file} animates ${cls}`).toMatch(new RegExp(`${cls.replace('.', '\\.')}\\s*\\{[^}]*animation:`));
        expect(reduced, `${file} stops ${cls}`).toContain(cls);
      }
      expect(reduced).toMatch(/animation:\s*none/);
    }
  });
});
