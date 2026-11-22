/**
 * Procedural audio module. The only module that constructs an AudioContext
 * or oscillator nodes. No audio files, no network requests.
 *
 * Sound effects are short, warm chords of triangle and sine voices with soft attacks.
 * The optional Ambient Soundscape is a looping bed of filtered noise and soft drones that
 * is Off by default, silent whenever Sound is muted, and stopped on unmount.
 */

type Factory = () => AudioContext;

const MASTER_LEVEL = 0.25;
/** Ambience bus level, relative to the master level. */
const AMBIENCE_LEVEL = 0.45;
const AMBIENCE_FADE_IN = 1.5;
const AMBIENCE_FADE_OUT = 0.25;

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
  stopAmbienceNodes(true);
  ambienceOn = false;
  ambienceKind = 'study';
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

/** Soft attack, a gentle decay to about half level, then a smooth release. */
function envelope(c: AudioContext, t0: number, dur: number, peak: number): GainNode {
  const g = c.createGain();
  const attack = Math.min(0.02, dur / 4);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.linearRampToValueAtTime(peak * 0.55, t0 + dur * 0.55);
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

/** Several voices at once. The peak is shared so a bigger chord is not louder. */
function chord(
  c: AudioContext,
  type: OscillatorType,
  freqs: readonly number[],
  t0: number,
  dur: number,
  peak: number,
): void {
  const each = peak / Math.sqrt(freqs.length);
  for (const f of freqs) tone(c, type, f, f, t0, dur, each);
}

/** A triangle chord with a quiet sine an octave above each voice: warm, with a little shimmer. */
function warmChord(c: AudioContext, freqs: readonly number[], t0: number, dur: number, peak: number): void {
  chord(c, 'triangle', freqs, t0, dur, peak);
  chord(c, 'sine', freqs.map((f) => f * 2), t0, dur, peak * 0.3);
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

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

export function playSpinUp(): void {
  play((c, t) => {
    tone(c, 'sawtooth', 80, 700, t, 1.2, 0.3);
    tone(c, 'triangle', 110, 440, t, 1.2, 0.25);
    tone(c, 'sine', 165, 660, t + 0.1, 1.1, 0.12);
    noise(c, 'bandpass', 400, t, 0.6, 0.12);
  });
}

export function playClick(): void {
  play((c, t) => {
    tone(c, 'triangle', 1100, 800, t, 0.03, 0.35);
    tone(c, 'sine', 2200, 1600, t, 0.02, 0.1);
  });
}

export function playPageFlip(): void {
  play((c, t) => {
    noise(c, 'highpass', 2000, t, 0.18, 0.4);
    noise(c, 'bandpass', 900, t + 0.04, 0.14, 0.15);
  });
}

export function playTorch(): void {
  play((c, t) => {
    noise(c, 'lowpass', 500, t, 0.5, 0.45, true);
    tone(c, 'sine', 110, 98, t, 0.5, 0.08);
  });
}

export function playDoorUnlock(): void {
  play((c, t) => {
    warmChord(c, [440, 554.37], t, 0.14, 0.3);
    warmChord(c, [659.25, 830.61], t + 0.12, 0.28, 0.3);
  });
}

/** Disc-ready chime: a rising C major arpeggio that settles on a held chord. */
export function playChime(): void {
  play((c, t) => {
    warmChord(c, [523.25], t, 0.16, 0.32);
    warmChord(c, [659.25], t + 0.1, 0.16, 0.32);
    warmChord(c, [783.99], t + 0.2, 0.16, 0.32);
    warmChord(c, [523.25, 659.25, 783.99, 1046.5], t + 0.3, 0.7, 0.35);
  });
}

/** Slide-projector advance: two soft clicks, a high one then a lower one. */
export function playSlideClick(): void {
  play((c, t) => {
    tone(c, 'triangle', 760, 520, t, 0.04, 0.3);
    tone(c, 'triangle', 480, 360, t + 0.05, 0.05, 0.3);
    noise(c, 'highpass', 3500, t, 0.03, 0.08);
  });
}

/** CD-R burn finished: a crisp two-note ding, rising. */
export function playBurnComplete(): void {
  play((c, t) => {
    warmChord(c, [1318.51], t, 0.5, 0.3);
    warmChord(c, [1760, 2217.46], t + 0.16, 0.9, 0.3);
  });
}

/** KeepMaze victory: a short fanfare of major chords that ends on a held high C. */
export function playVictoryFanfare(): void {
  play((c, t) => {
    warmChord(c, [261.63, 329.63, 392], t, 0.22, 0.45);
    warmChord(c, [349.23, 440, 523.25], t + 0.22, 0.22, 0.45);
    warmChord(c, [392, 493.88, 587.33], t + 0.44, 0.22, 0.45);
    warmChord(c, [523.25, 659.25, 783.99, 1046.5], t + 0.66, 1.2, 0.5);
  });
}

// ---------------------------------------------------------------------------
// Ambient soundscape
// ---------------------------------------------------------------------------

export type AmbienceKind = 'castle' | 'retro' | 'study';

let ambienceOn = false;
let ambienceKind: AmbienceKind = 'study';
let ambienceBus: GainNode | null = null;
let ambienceNodes: AudioScheduledSourceNode[] = [];
const ambienceListeners = new Set<(on: boolean) => void>();

/** Picks the soundscape for a disc: castles get wind and hearth, code and web discs a CRT hum, the rest a study tone. */
export function ambienceKindFor(discId: string | undefined): AmbienceKind {
  const id = (discId ?? '').toLowerCase();
  if (id.includes('castle') || id.includes('keep') || id.includes('fort')) return 'castle';
  if (id.startsWith('retro') || id.startsWith('github-') || id.startsWith('webpage-')) return 'retro';
  return 'study';
}

function ambienceNoise(
  c: AudioContext,
  bus: GainNode,
  filterType: BiquadFilterType,
  freq: number,
  level: number,
): { filter: BiquadFilterNode; gain: GainNode } {
  const len = Math.max(1, Math.floor(c.sampleRate * 2));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, c.currentTime);
  const gain = c.createGain();
  gain.gain.setValueAtTime(level, c.currentTime);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  src.start();
  ambienceNodes.push(src);
  return { filter, gain };
}

function ambienceDrone(
  c: AudioContext,
  bus: GainNode,
  type: OscillatorType,
  freq: number,
  level: number,
): GainNode {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  const gain = c.createGain();
  gain.gain.setValueAtTime(level, c.currentTime);
  osc.connect(gain);
  gain.connect(bus);
  osc.start();
  ambienceNodes.push(osc);
  return gain;
}

/** A slow sine that moves an audio parameter around its current value. */
function ambienceLfo(c: AudioContext, target: AudioParam, rate: number, depth: number): void {
  const lfo = c.createOscillator();
  lfo.frequency.setValueAtTime(rate, c.currentTime);
  const amount = c.createGain();
  amount.gain.setValueAtTime(depth, c.currentTime);
  lfo.connect(amount);
  amount.connect(target);
  lfo.start();
  ambienceNodes.push(lfo);
}

function buildAmbience(c: AudioContext, kind: AmbienceKind): void {
  const bus = c.createGain();
  const now = c.currentTime;
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.linearRampToValueAtTime(AMBIENCE_LEVEL, now + AMBIENCE_FADE_IN);
  bus.connect(master as GainNode);
  ambienceBus = bus;

  if (kind === 'castle') {
    // Wind through the battlements, a low hearth crackle, and a quiet stone-hall drone.
    const wind = ambienceNoise(c, bus, 'bandpass', 500, 0.7);
    ambienceLfo(c, wind.filter.frequency, 0.11, 220);
    const hearth = ambienceNoise(c, bus, 'lowpass', 280, 0.35);
    ambienceLfo(c, hearth.gain.gain, 6.5, 0.12);
    ambienceDrone(c, bus, 'sine', 98, 0.22);
    ambienceDrone(c, bus, 'sine', 147, 0.12);
  } else if (kind === 'retro') {
    // The hum of a CRT and a power supply, with a faint hiss.
    ambienceDrone(c, bus, 'sine', 60, 0.4);
    ambienceDrone(c, bus, 'sine', 120, 0.18);
    ambienceDrone(c, bus, 'sine', 180, 0.06);
    ambienceNoise(c, bus, 'highpass', 6000, 0.03);
  } else {
    // A quiet reading-room tone: a soft fifth with a slow swell, over faint room noise.
    const root = ambienceDrone(c, bus, 'sine', 110, 0.3);
    ambienceLfo(c, root.gain, 0.18, 0.08);
    ambienceDrone(c, bus, 'sine', 164.81, 0.16);
    ambienceDrone(c, bus, 'triangle', 220, 0.04);
    ambienceNoise(c, bus, 'lowpass', 220, 0.12);
  }
}

/** Stops the ambience voices. `immediate` cuts them now, otherwise they fade out first. */
function stopAmbienceNodes(immediate: boolean): void {
  const nodes = ambienceNodes;
  const bus = ambienceBus;
  ambienceNodes = [];
  ambienceBus = null;
  if (nodes.length === 0) return;
  let when = 0;
  if (!immediate && ctx && bus) {
    try {
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(AMBIENCE_LEVEL, now);
      bus.gain.linearRampToValueAtTime(0.0001, now + AMBIENCE_FADE_OUT);
      when = now + AMBIENCE_FADE_OUT + 0.05;
    } catch {
      when = 0;
    }
  }
  for (const n of nodes) {
    try {
      if (when > 0) n.stop(when);
      else n.stop();
    } catch {
      /* already stopped */
    }
    n.onended = () => {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    };
    if (when === 0) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
  if (bus && when === 0) {
    try {
      bus.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/** (Re)builds the voices when the ambience is wanted and Sound is on. Never throws. */
function syncAmbience(): void {
  stopAmbienceNodes(true);
  if (!ambienceOn || muted) return;
  const c = getContext();
  if (!c) return;
  try {
    buildAmbience(c, ambienceKind);
  } catch {
    stopAmbienceNodes(true);
  }
}

function notifyAmbience(): void {
  for (const fn of [...ambienceListeners]) fn(ambienceOn);
}

/** Turns the ambience on with a soundscape. Silent while muted, and resumes when Sound comes back. */
export function startAmbience(kind: AmbienceKind): void {
  const changed = !ambienceOn;
  ambienceOn = true;
  ambienceKind = kind;
  syncAmbience();
  if (changed) notifyAmbience();
}

/** Switches the soundscape (for example when another disc opens). Rebuilds it only while it is on. */
export function setAmbienceKind(kind: AmbienceKind): void {
  if (kind === ambienceKind) return;
  ambienceKind = kind;
  if (ambienceOn) syncAmbience();
}

export function stopAmbience(): void {
  const changed = ambienceOn;
  ambienceOn = false;
  stopAmbienceNodes(false);
  if (changed) notifyAmbience();
}

/** Flips the ambience and returns the new state. */
export function toggleAmbience(): boolean {
  if (ambienceOn) stopAmbience();
  else startAmbience(ambienceKind);
  return ambienceOn;
}

export function isAmbienceOn(): boolean {
  return ambienceOn;
}

export function subscribeAmbience(fn: (on: boolean) => void): () => void {
  ambienceListeners.add(fn);
  return () => {
    ambienceListeners.delete(fn);
  };
}

// ---------------------------------------------------------------------------
// Mute
// ---------------------------------------------------------------------------

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
    stopAmbienceNodes(true);
  } else if (changed && ambienceOn) {
    syncAmbience();
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
