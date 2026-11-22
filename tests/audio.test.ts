import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setContextFactory,
  ambienceKindFor,
  isAmbienceOn,
  isMuted,
  playBurnComplete,
  playChime,
  playClick,
  playDoorUnlock,
  playPageFlip,
  playSlideClick,
  playSpinUp,
  playTorch,
  playVictoryFanfare,
  setAmbienceKind,
  setMuted,
  startAmbience,
  stopAmbience,
  subscribeAmbience,
  subscribeMuted,
  toggleAmbience,
  toggleMuted,
} from '../src/audio/audio';

function param(initial = 0) {
  return {
    value: initial,
    setValueAtTime: vi.fn(function (this: { value: number }, v: number) {
      this.value = v;
    }),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

interface MockNode {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start?: ReturnType<typeof vi.fn>;
  stop?: ReturnType<typeof vi.fn>;
  gain?: ReturnType<typeof param>;
  onended?: unknown;
}

function makeMock(state: 'running' | 'suspended' = 'running') {
  const sources: MockNode[] = [];
  const gains: MockNode[] = [];
  const base = (): MockNode => ({ connect: vi.fn(), disconnect: vi.fn() });
  const source = (): MockNode => {
    const n = { ...base(), start: vi.fn(), stop: vi.fn(), frequency: param(), type: '' };
    sources.push(n);
    return n;
  };
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(() => {
      const n = { ...base(), gain: param(1) };
      gains.push(n);
      return n;
    }),
    createOscillator: vi.fn(source),
    createBufferSource: vi.fn(() => ({ ...source(), buffer: null })),
    createBiquadFilter: vi.fn(() => ({ ...base(), frequency: param(), type: '' })),
    createBuffer: vi.fn((_c: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    })),
  };
  return { ctx, sources, gains };
}

const effects = [
  ['playSpinUp', playSpinUp],
  ['playClick', playClick],
  ['playPageFlip', playPageFlip],
  ['playTorch', playTorch],
  ['playDoorUnlock', playDoorUnlock],
  ['playChime', playChime],
  ['playSlideClick', playSlideClick],
  ['playBurnComplete', playBurnComplete],
  ['playVictoryFanfare', playVictoryFanfare],
] as const;

beforeEach(() => {
  __setContextFactory(null);
  setMuted(false);
});

describe('audio', () => {
  it('creates the context lazily on first effect only', () => {
    const m = makeMock();
    const factory = vi.fn(() => m.ctx as unknown as AudioContext);
    __setContextFactory(factory);
    expect(factory).not.toHaveBeenCalled();
    playClick();
    playClick();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context', () => {
    const m = makeMock('suspended');
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    playClick();
    expect(m.ctx.resume).toHaveBeenCalled();
  });

  it('does not resume a running context', () => {
    const m = makeMock('running');
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    playClick();
    expect(m.ctx.resume).not.toHaveBeenCalled();
  });

  it('is a silent no-op when AudioContext is missing', () => {
    __setContextFactory(() => null as unknown as AudioContext);
    for (const [, fn] of effects) expect(() => fn()).not.toThrow();
    __setContextFactory(() => {
      throw new Error('unsupported');
    });
    for (const [, fn] of effects) expect(() => fn()).not.toThrow();
  });

  it('is a silent no-op with the default factory when no AudioContext global exists', () => {
    __setContextFactory(null);
    for (const [, fn] of effects) expect(() => fn()).not.toThrow();
  });

  it('sets master gain to 0 and stops active nodes when muting during playback', () => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    playSpinUp();
    expect(m.sources.length).toBeGreaterThan(0);
    setMuted(true);
    const master = m.gains[0];
    expect(master.gain!.value).toBe(0);
    for (const s of m.sources) expect(s.stop).toHaveBeenCalledTimes(2);
  });

  it('flips mute state and notifies subscribers only on change', () => {
    const fn = vi.fn();
    const unsub = subscribeMuted(fn);
    expect(isMuted()).toBe(false);
    expect(toggleMuted()).toBe(true);
    expect(isMuted()).toBe(true);
    expect(fn).toHaveBeenLastCalledWith(true);
    setMuted(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(toggleMuted()).toBe(false);
    expect(fn).toHaveBeenLastCalledWith(false);
    unsub();
    toggleMuted();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it.each(effects)('%s schedules audio on a working context', (_name, fn) => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    expect(() => fn()).not.toThrow();
    expect(m.sources.length).toBeGreaterThan(0);
    for (const s of m.sources) expect(s.start).toHaveBeenCalled();
  });

  it.each(effects)('%s creates nothing while muted', (_name, fn) => {
    const m = makeMock();
    const factory = vi.fn(() => m.ctx as unknown as AudioContext);
    __setContextFactory(factory);
    setMuted(true);
    fn();
    expect(factory).not.toHaveBeenCalled();
    expect(m.sources).toHaveLength(0);
  });
});

describe('ambient soundscape', () => {
  /** Sources started by the ambience: they are the only ones when no effect has played. */
  const started = (m: ReturnType<typeof makeMock>) => m.sources.filter((s) => (s.start as ReturnType<typeof vi.fn>).mock.calls.length > 0);
  const stopped = (s: MockNode) => (s.stop as ReturnType<typeof vi.fn>).mock.calls.length > 0;

  it('is off by default and creates no audio until it is started', () => {
    const m = makeMock();
    const factory = vi.fn(() => m.ctx as unknown as AudioContext);
    __setContextFactory(factory);
    expect(isAmbienceOn()).toBe(false);
    expect(factory).not.toHaveBeenCalled();
    expect(m.sources).toHaveLength(0);
  });

  it.each(['castle', 'retro', 'study'] as const)('%s builds a looping bed of voices', (kind) => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    startAmbience(kind);
    expect(isAmbienceOn()).toBe(true);
    expect(started(m).length).toBeGreaterThanOrEqual(4);
    expect(m.ctx.createBufferSource).toHaveBeenCalled(); // a noise bed under the drones
  });

  it('uses different voices for different soundscapes', () => {
    const counts = (['castle', 'retro', 'study'] as const).map((kind) => {
      const m = makeMock();
      __setContextFactory(() => m.ctx as unknown as AudioContext);
      startAmbience(kind);
      return m.sources.length;
    });
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('toggles on and off, notifies subscribers, and fades the voices out', () => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    const fn = vi.fn();
    const unsub = subscribeAmbience(fn);
    expect(toggleAmbience()).toBe(true);
    expect(fn).toHaveBeenLastCalledWith(true);
    const voices = started(m);
    expect(voices.every((s) => !stopped(s))).toBe(true);
    expect(toggleAmbience()).toBe(false);
    expect(fn).toHaveBeenLastCalledWith(false);
    expect(isAmbienceOn()).toBe(false);
    for (const s of voices) expect(stopped(s)).toBe(true);
    stopAmbience(); // already off: no extra notification
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('stays silent while muted, and starts when Sound comes back', () => {
    const m = makeMock();
    const factory = vi.fn(() => m.ctx as unknown as AudioContext);
    __setContextFactory(factory);
    setMuted(true);
    startAmbience('castle');
    expect(isAmbienceOn()).toBe(true);
    expect(factory).not.toHaveBeenCalled();
    expect(m.sources).toHaveLength(0);
    setMuted(false);
    expect(started(m).length).toBeGreaterThanOrEqual(4);
  });

  it('muting stops every voice at once, and unmuting brings the soundscape back', () => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    startAmbience('retro');
    const first = started(m);
    expect(first.length).toBeGreaterThan(0);
    setMuted(true);
    for (const s of first) expect(stopped(s)).toBe(true);
    expect(isAmbienceOn()).toBe(true);
    const before = m.sources.length;
    setMuted(false);
    expect(m.sources.length).toBeGreaterThan(before);
  });

  it('switching the soundscape rebuilds it only while it is on', () => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    setAmbienceKind('castle');
    expect(m.sources).toHaveLength(0);
    startAmbience('castle');
    const first = started(m);
    setAmbienceKind('retro');
    for (const s of first) expect(stopped(s)).toBe(true);
    expect(started(m).length).toBeGreaterThan(first.length);
  });

  it('is a silent no-op when the context cannot be created', () => {
    __setContextFactory(() => {
      throw new Error('unsupported');
    });
    expect(() => startAmbience('study')).not.toThrow();
    expect(() => stopAmbience()).not.toThrow();
  });

  it('picks a soundscape for a disc id', () => {
    expect(ambienceKindFor('castles')).toBe('castle');
    expect(ambienceKindFor('topic-medieval-castles-ab12')).toBe('castle');
    expect(ambienceKindFor('halloween')).toBe('castle');
    expect(ambienceKindFor('resurrection')).toBe('retro');
    expect(ambienceKindFor('retro-dialup')).toBe('retro');
    expect(ambienceKindFor('github-octo-hello-1a2b')).toBe('retro');
    expect(ambienceKindFor('webpage-example-com-9z8y')).toBe('retro');
    expect(ambienceKindFor('markdown-notes-0000')).toBe('study');
    expect(ambienceKindFor(undefined)).toBe('study');
  });
});

describe('sound effects respect Mute and use soft voices', () => {
  it.each([
    ['playSlideClick', playSlideClick],
    ['playBurnComplete', playBurnComplete],
    ['playVictoryFanfare', playVictoryFanfare],
  ] as const)('%s plays chords without harsh waveforms', (_name, fn) => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    fn();
    const types = m.sources.map((s) => (s as unknown as { type: string }).type).filter(Boolean);
    expect(types.length).toBeGreaterThan(0);
    for (const t of types) expect(['sine', 'triangle', '']).toContain(t);
  });

  it('the victory fanfare is polyphonic', () => {
    const m = makeMock();
    __setContextFactory(() => m.ctx as unknown as AudioContext);
    playVictoryFanfare();
    expect(m.sources.length).toBeGreaterThanOrEqual(12);
  });
});