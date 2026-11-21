/**
 * Procedural audio module. The only module that constructs an AudioContext
 * or oscillator nodes. No audio files, no network requests.
 */

type Factory = () => AudioContext;

const MASTER_LEVEL = 0.25;

let factory: Factory | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let failed = false;
let muted = false;
const listeners = new Set<(m: boolean) => void>();
const active = new Set<AudioScheduledSourceNode>();

function defaultFactory(): AudioContext | null {
  const g = globalThis as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function __setContextFactory(f: Factory | null): void {
  stopActive();
  ctx = null;
  master = null;
  failed = false;
  factory = f;
}

function stopActive(): void {
  for (const n of active) {
    try {
      n.stop();
    } catch {
      /* already stopped */
    }
    try {
      n.disconnect();
    } catch {
      /* ignore */
    }
  }
  active.clear();
}

/** Returns a ready context or null. Never throws. */
function getContext(): AudioContext | null {
  if (failed) return null;
  try {
    if (!ctx) {
      const c = factory ? factory() : defaultFactory();
      if (!c) {
        failed = true;
        return null;
      }
      ctx = c;
      master = c.createGain();
      master.gain.value = MASTER_LEVEL;
      master.connect(c.destination);
    }
    if (ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    }
    if (master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(MASTER_LEVEL, now);
    }
    return ctx;
  } catch {
    failed = true;
    ctx = null;
    master = null;
    return null;
  }
}

function track(n: AudioScheduledSourceNode): void {
  active.add(n);
  n.onended = () => {
    active.delete(n);
  };
}

function envelope(c: AudioContext, t0: number, dur: number, peak: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.005, dur / 4));
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  g.connect(master as GainNode);
  return g;
}

function tone(
  c: AudioContext,
  type: OscillatorType,
  f0: number,
  f1: number,
  t0: number,
  dur: number,
  peak: number,
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
  osc.connect(envelope(c, t0, dur, peak));
  track(osc);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(
  c: AudioContext,
  filterType: BiquadFilterType,
  freq: number,
  t0: number,
  dur: number,
  peak: number,
  flicker = false,
): void {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, t0);
  src.connect(filter);
  const env = envelope(c, t0, dur, peak);
  filter.connect(env);
  if (flicker) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.setValueAtTime(14, t0);
    depth.gain.setValueAtTime(peak * 0.5, t0);
    lfo.connect(depth);
    depth.connect(env.gain);
    track(lfo);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.02);
  }
  track(src);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function play(build: (c: AudioContext, t0: number) => void): void {
  if (muted) return;
  const c = getContext();
  if (!c) return;
  try {
    build(c, c.currentTime);
  } catch {
    /* audio must never break the app */
  }
}

export function playSpinUp(): void {
  play((c, t) => {
    tone(c, 'sawtooth', 80, 700, t, 1.2, 0.5);
    noise(c, 'bandpass', 400, t, 0.6, 0.15);
  });
}

export function playClick(): void {
  play((c, t) => tone(c, 'square', 900, 900, t, 0.015, 0.4));
}

export function playPageFlip(): void {
  play((c, t) => noise(c, 'highpass', 2000, t, 0.18, 0.5));
}

export function playTorch(): void {
  play((c, t) => noise(c, 'lowpass', 500, t, 0.5, 0.5, true));
}

export function playDoorUnlock(): void {
  play((c, t) => {
    tone(c, 'square', 440, 440, t, 0.1, 0.35);
    tone(c, 'square', 660, 660, t + 0.12, 0.18, 0.35);
  });
}

export function setMuted(m: boolean): void {
  const changed = muted !== m;
  muted = m;
  if (m) {
    if (ctx && master) {
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0, now);
      } catch {
        /* ignore */
      }
    }
    stopActive();
  }
  if (changed) for (const fn of [...listeners]) fn(muted);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

export function subscribeMuted(fn: (m: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
