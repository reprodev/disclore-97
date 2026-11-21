import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  __setContextFactory,
  setMuted,
  playSpinUp,
  playClick,
  playPageFlip,
  playTorch,
  playDoorUnlock,
} from '../../src/audio/audio';

// Feature: disclore-97-core, Property 16: Muted audio is silent
// **Validates: Requirements 8.11, 13.7**

const effects = [playSpinUp, playClick, playPageFlip, playTorch, playDoorUnlock];

interface Counters {
  created: number;
  started: number;
  stopped: number;
  contexts: number;
}

function makeParam() {
  return {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
  };
}

function makeMock(c: Counters): () => AudioContext {
  return () => {
    c.contexts++;
    const source = () => {
      c.created++;
      return {
        type: 'sine',
        buffer: null,
        frequency: makeParam(),
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
    const ctx = {
      state: 'running',
      currentTime: 0,
      sampleRate: 8000,
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: makeParam(), connect() {}, disconnect() {} }),
      createOscillator: source,
      createBufferSource: source,
      createBuffer: (_ch: number, len: number) => ({
        getChannelData: () => new Float32Array(len),
      }),
      createBiquadFilter: () => ({
        type: 'lowpass',
        frequency: makeParam(),
        connect() {},
        disconnect() {},
      }),
    };
    return ctx as unknown as AudioContext;
  };
}

const arbSequence = fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 30 });

describe('Property 16: Muted audio is silent', () => {
  afterEach(() => {
    setMuted(false);
    __setContextFactory(null);
  });

  it('creates no context, oscillators, or buffer sources while muted from the start', () => {
    fc.assert(
      fc.property(arbSequence, (seq) => {
        const c: Counters = { created: 0, started: 0, stopped: 0, contexts: 0 };
        __setContextFactory(makeMock(c));
        setMuted(true);
        for (const i of seq) effects[i]();
        expect(c.contexts).toBe(0);
        expect(c.created).toBe(0);
        expect(c.started).toBe(0);
        setMuted(false);
      }),
      { numRuns: 100 },
    );
  });

  it('creates and starts nothing after muting mid-session, and stops all playing nodes', () => {
    fc.assert(
      fc.property(arbSequence, arbSequence, (before, after) => {
        const c: Counters = { created: 0, started: 0, stopped: 0, contexts: 0 };
        __setContextFactory(makeMock(c));
        setMuted(false);
        for (const i of before) effects[i]();
        setMuted(true);
        const created = c.created;
        const started = c.started;
        // every started node has been stopped on mute
        expect(c.stopped).toBeGreaterThanOrEqual(started);
        for (const i of after) effects[i]();
        expect(c.created).toBe(created);
        expect(c.started).toBe(started);
        setMuted(false);
      }),
      { numRuns: 100 },
    );
  });
});
