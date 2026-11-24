import { afterEach, describe, expect, it } from 'vitest';
import {
  __setContextFactory,
  MODEM_CHIRP_SECONDS,
  playEject,
  playKonamiArpeggio,
  playLinerChime,
  playModemChirp,
  playWoodKnock,
  setMuted,
} from '../../src/audio/audio';

/** A tiny AudioContext double that records each oscillator's type and every stop time. */
function recorder() {
  const types: string[] = [];
  const stops: number[] = [];
  let nodes = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const source = (isOsc: boolean) => () => {
    nodes++;
    const n = {
      type: 'sine',
      buffer: null,
      frequency: param(),
      onended: null,
      connect() {},
      disconnect() {},
      start() {
        if (isOsc) types.push(n.type);
      },
      stop(t: number) {
        stops.push(t);
      },
    };
    return n;
  };
  const factory = () =>
    ({
      state: 'running',
      currentTime: 0,
      sampleRate: 8000,
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
      createOscillator: source(true),
      createBufferSource: source(false),
      createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {}, disconnect() {} }),
    }) as unknown as AudioContext;
  return { factory, types, stops, count: () => nodes };
}

const SOUNDS = [
  ['playLinerChime', playLinerChime],
  ['playEject', playEject],
  ['playKonamiArpeggio', playKonamiArpeggio],
  ['playModemChirp', playModemChirp],
  ['playWoodKnock', playWoodKnock],
] as const;

afterEach(() => {
  setMuted(false);
  __setContextFactory(null);
});

describe('Easter-egg sounds', () => {
  it.each(SOUNDS)('%s is silent while muted', (_name, play) => {
    const r = recorder();
    __setContextFactory(r.factory);
    setMuted(true);
    play();
    expect(r.count()).toBe(0);
  });

  it.each(SOUNDS)('%s uses only soft sine and triangle voices', (_name, play) => {
    const r = recorder();
    __setContextFactory(r.factory);
    play();
    expect(r.types.length).toBeGreaterThan(0);
    for (const t of r.types) expect(['sine', 'triangle']).toContain(t);
  });

  it('the modem chirp lasts about 1.2 seconds', () => {
    const r = recorder();
    __setContextFactory(r.factory);
    playModemChirp();
    expect(MODEM_CHIRP_SECONDS).toBe(1.2);
    const end = Math.max(...r.stops);
    expect(end).toBeGreaterThan(1.1);
    expect(end).toBeLessThanOrEqual(MODEM_CHIRP_SECONDS + 0.05);
  });
});
