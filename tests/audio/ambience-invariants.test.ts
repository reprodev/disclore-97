import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setContextFactory,
  AMBIENCE_FADE_IN,
  AMBIENCE_FADE_OUT,
  AMBIENCE_KINDS,
  AMBIENCE_LEVEL,
  AMBIENCE_MAX_CUTOFF,
  type AmbienceKind,
  setAmbienceKind,
  setAudioEdition,
  setMuted,
  startAmbience,
  stopAmbience,
} from '../../src/audio/audio';
import type { Theme } from '../../src/model/editions';

/**
 * An AudioContext double that records the whole node graph: every node, every connection (to a node
 * or to a parameter), every value set, every ramp, and every start and stop.
 */
interface Param {
  owner: GNode;
  name: string;
  sets: number[];
  ramps: { value: number; time: number }[];
  value: number;
}
interface GNode {
  kind: 'osc' | 'noise' | 'filter' | 'gain' | 'destination';
  type: string;
  out: (GNode | Param)[];
  params: Record<string, Param>;
  started: boolean;
  stops: (number | undefined)[];
}

function graph() {
  const nodes: GNode[] = [];
  const node = (kind: GNode['kind'], paramNames: string[], type = ''): GNode => {
    const n: GNode = { kind, type, out: [], params: {}, started: false, stops: [] };
    for (const name of paramNames) {
      const p: Param = { owner: n, name, sets: [], ramps: [], value: 0 };
      n.params[name] = p;
    }
    nodes.push(n);
    return n;
  };
  const facade = (n: GNode) => {
    const api: Record<string, unknown> = {
      connect(target: { __node?: GNode; __param?: Param }) {
        n.out.push(target.__param ?? (target.__node as GNode));
      },
      disconnect() {},
      start() {
        n.started = true;
      },
      stop(when?: number) {
        n.stops.push(when);
      },
      onended: null,
      buffer: null,
      loop: false,
      __node: n,
    };
    Object.defineProperty(api, 'type', {
      get: () => n.type,
      set: (v: string) => {
        n.type = v;
      },
    });
    for (const [name, p] of Object.entries(n.params)) {
      api[name] = {
        __param: p,
        get value() {
          return p.value;
        },
        set value(v: number) {
          p.value = v;
        },
        setValueAtTime(v: number) {
          p.sets.push(v);
          p.value = v;
        },
        linearRampToValueAtTime(v: number, time: number) {
          p.ramps.push({ value: v, time });
        },
        cancelScheduledValues() {},
      };
    }
    return api;
  };
  const destination = node('destination', []);
  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 8000,
    destination: facade(destination),
    resume: () => Promise.resolve(),
    createGain: () => facade(node('gain', ['gain'])),
    createOscillator: () => facade(node('osc', ['frequency'], 'sine')),
    createBufferSource: () => facade(node('noise', [])),
    createBiquadFilter: () => facade(node('filter', ['frequency'], 'lowpass')),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { nodes, destination, factory: () => ctx as unknown as AudioContext };
}

type Graph = ReturnType<typeof graph>;

const nodeTargets = (n: GNode) => n.out.filter((t): t is GNode => 'kind' in t);
const freqOf = (n: GNode) => n.params.frequency?.sets[0] ?? 0;

/** The ambience bus: the gain that swells from near silence up to AMBIENCE_LEVEL. */
function busOf(g: Graph): GNode {
  const bus = g.nodes.find(
    (n) => n.kind === 'gain' && n.params.gain!.sets[0]! < 0.001 && n.params.gain!.ramps.some((r) => r.value === AMBIENCE_LEVEL),
  );
  if (!bus) throw new Error('no ambience bus');
  return bus;
}

/** Oscillators that modulate a parameter (through a depth gain): the LFOs. */
function lfos(g: Graph): GNode[] {
  return g.nodes.filter(
    (n) => n.kind === 'osc' && nodeTargets(n).some((d) => d.kind === 'gain' && d.out.some((t) => !('kind' in t))),
  );
}

/** Oscillators that are heard: the pad voices. */
function voices(g: Graph): GNode[] {
  const mod = new Set(lfos(g));
  return g.nodes.filter((n) => n.kind === 'osc' && n.started && !mod.has(n));
}

function build(kind: AmbienceKind, edition: Theme = 'classic'): Graph {
  const g = graph();
  __setContextFactory(g.factory);
  setAudioEdition(edition);
  startAmbience(kind);
  return g;
}

beforeEach(() => {
  setMuted(false);
});
afterEach(() => {
  stopAmbience();
  setAudioEdition('classic');
  setMuted(false);
  __setContextFactory(null);
  vi.restoreAllMocks();
});

const EDITIONS: Theme[] = ['classic', 'haunted', 'christmas'];
const CASES = AMBIENCE_KINDS.flatMap((kind) => EDITIONS.map((edition) => [kind, edition] as const));

describe('ambience invariants for every soundscape and edition', () => {
  it('keeps the bus quiet and swells in slowly from silence', () => {
    expect(AMBIENCE_LEVEL).toBeLessThanOrEqual(0.3);
    expect(AMBIENCE_FADE_IN).toBeGreaterThanOrEqual(2);
    expect(AMBIENCE_FADE_OUT).toBeGreaterThanOrEqual(1);
    for (const [kind, edition] of CASES) {
      const g = build(kind, edition);
      const bus = busOf(g);
      expect(bus.params.gain!.sets[0]).toBeLessThan(0.001);
      expect(bus.params.gain!.ramps.find((r) => r.value === AMBIENCE_LEVEL)!.time).toBeGreaterThanOrEqual(AMBIENCE_FADE_IN);
      stopAmbience();
    }
  });

  it.each(CASES)('%s / %s: only soft sine and triangle voices, no buzzing waveforms', (kind, edition) => {
    const g = build(kind, edition);
    const oscillators = g.nodes.filter((n) => n.kind === 'osc');
    expect(oscillators.length).toBeGreaterThan(0);
    for (const o of oscillators) expect(['sine', 'triangle']).toContain(o.type);
  });

  it.each(CASES)('%s / %s: every noise layer is softened by a low-pass at or below the cutoff', (kind, edition) => {
    const g = build(kind, edition);
    const noises = g.nodes.filter((n) => n.kind === 'noise');
    expect(noises.length).toBeGreaterThan(0);
    for (const src of noises) {
      // Walk the filters from the noise to its first gain; the last one must be a gentle low-pass.
      let at: GNode | undefined = nodeTargets(src)[0];
      let lastFilter: GNode | undefined;
      while (at && at.kind === 'filter') {
        lastFilter = at;
        at = nodeTargets(at)[0];
      }
      expect(at?.kind).toBe('gain');
      expect(lastFilter?.type).toBe('lowpass');
      expect(freqOf(lastFilter!)).toBeLessThanOrEqual(AMBIENCE_MAX_CUTOFF);
    }
  });

  it.each(CASES)('%s / %s: moves slowly over time with sub-hertz LFOs', (kind, edition) => {
    const g = build(kind, edition);
    const slow = lfos(g).filter((o) => freqOf(o) > 0 && freqOf(o) < 1);
    expect(slow.length).toBeGreaterThanOrEqual(2);
    for (const o of lfos(g)) expect(freqOf(o)).toBeLessThan(1);
  });

  it.each(CASES)('%s / %s: pads beat gently with a detuned twin, and no voice is louder than the bed', (kind, edition) => {
    const g = build(kind, edition);
    const v = voices(g).map(freqOf);
    expect(v.length).toBeGreaterThanOrEqual(4);
    // Every pad pitch has a twin a hair sharp.
    const roots = v.filter((f) => !v.some((o) => o !== f && Math.abs(f / o - 1.0035) < 1e-6));
    for (const f of roots) expect(v.some((o) => Math.abs(o / f - 1.0035) < 1e-6)).toBe(true);
    // Everything stays in a warm register: no voice above 1 kHz.
    for (const f of v) expect(f).toBeLessThan(1000);
    // No gain feeding the bus is set louder than the bus can make sense of.
    const bus = busOf(g);
    const feeds = g.nodes.filter((n) => n.kind === 'gain' && nodeTargets(n).includes(bus));
    for (const f of feeds) expect(f.params.gain!.sets[0]).toBeLessThanOrEqual(0.5);
  });

  it('the CRT purr is a low, rounded hum with no high-pass hiss', () => {
    const g = build('retro');
    const v = voices(g).map(freqOf);
    expect(Math.min(...v)).toBe(60);
    for (const f of v) expect(f).toBeLessThanOrEqual(130);
    expect(g.nodes.some((n) => n.kind === 'filter' && n.type === 'highpass')).toBe(false);
  });
});

describe('distinct atmospheres', () => {
  const signature = (g: Graph) =>
    JSON.stringify({
      voices: voices(g).map(freqOf).sort((a, b) => a - b),
      filters: g.nodes
        .filter((n) => n.kind === 'filter')
        .map((n) => `${n.type}:${freqOf(n)}`)
        .sort(),
    });

  it('gives every soundscape its own voices and filters', () => {
    const sigs = AMBIENCE_KINDS.map((kind) => {
      const s = signature(build(kind));
      stopAmbience();
      return s;
    });
    expect(new Set(sigs).size).toBe(AMBIENCE_KINDS.length);
  });

  it('gives every edition its own colour over the same soundscape', () => {
    for (const kind of AMBIENCE_KINDS) {
      const sigs = EDITIONS.map((e) => {
        const s = signature(build(kind, e));
        stopAmbience();
        return s;
      });
      expect(new Set(sigs).size).toBe(EDITIONS.length);
    }
  });

  it('drifts the LFO rates a little from one session to the next', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const low = lfos(build('study')).map(freqOf);
    stopAmbience();
    spy.mockReturnValue(0.999);
    const high = lfos(build('study')).map(freqOf);
    expect(low).toHaveLength(high.length);
    low.forEach((f, i) => {
      expect(high[i]!).toBeGreaterThan(f);
      expect(high[i]! / f).toBeLessThan(1.4);
    });
  });
});

describe('smooth starts, stops, and changes', () => {
  it('turning it off fades the bus out and stops the voices after the fade', () => {
    const g = build('castle');
    const bus = busOf(g);
    const started = g.nodes.filter((n) => n.started);
    stopAmbience();
    const ramps = bus.params.gain!.ramps;
    expect(ramps[ramps.length - 1]).toEqual({ value: 0.0001, time: AMBIENCE_FADE_OUT });
    for (const n of started) {
      expect(n.stops).toHaveLength(1);
      expect(n.stops[0]).toBeGreaterThanOrEqual(AMBIENCE_FADE_OUT);
    }
  });

  it('switching soundscape cross-fades: the old voices fade out while the new ones swell in', () => {
    const g = build('castle');
    const old = g.nodes.filter((n) => n.started);
    setAmbienceKind('study');
    for (const n of old) expect(n.stops[0]).toBeGreaterThanOrEqual(AMBIENCE_FADE_OUT);
    const fresh = g.nodes.filter((n) => n.started && !old.includes(n));
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((n) => n.stops.length === 0)).toBe(true);
  });

  it('muting cuts every voice at once and builds nothing while muted', () => {
    const g = build('night', 'haunted');
    const started = g.nodes.filter((n) => n.started);
    setMuted(true);
    for (const n of started) expect(n.stops).toEqual([undefined]);
    const count = g.nodes.length;
    setAmbienceKind('web');
    setAudioEdition('christmas');
    expect(g.nodes.length).toBe(count);
  });

  it('never throws when the audio graph refuses a node', () => {
    __setContextFactory(
      () =>
        ({
          state: 'running',
          currentTime: 0,
          sampleRate: 8000,
          destination: {},
          resume: () => Promise.resolve(),
          createGain: () => ({ gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }),
          createOscillator: () => {
            throw new Error('no oscillators');
          },
        }) as unknown as AudioContext,
    );
    expect(() => startAmbience('castle')).not.toThrow();
  });
});
