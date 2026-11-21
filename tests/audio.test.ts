import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setContextFactory,
  isMuted,
  playClick,
  playDoorUnlock,
  playPageFlip,
  playSpinUp,
  playTorch,
  setMuted,
  subscribeMuted,
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
