/**
 * Procedural audio module. The only module that constructs an AudioContext
 * or oscillator nodes. No audio files, no network requests.
 *
 * Sound effects are short, warm chords of triangle and sine voices with soft attacks.
 * The optional Ambient Soundscape is a looping bed of filtered noise and soft drones that
 * is Off by default, silent whenever Sound is muted, and stopped on unmount.
 */

import type { Theme } from '../model/editions';

type Factory = () => AudioContext;

const MASTER_LEVEL = 0.25;
/** Ambience bus level, relative to the master level. Kept low so a long session never tires the ear. */
export const AMBIENCE_LEVEL = 0.22;
/** Seconds the ambience takes to swell in from silence. */
export const AMBIENCE_FADE_IN = 4;
/** Seconds the ambience takes to fade away when it is turned off or a new soundscape takes over. */
export const AMBIENCE_FADE_OUT = 1.5;
/** Every noise layer in the ambience ends in a low-pass at or below this cutoff, so nothing hisses. */
export const AMBIENCE_MAX_CUTOFF = 2400;

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

/** The edition that colors the chime and the ambience. Classic '97 is the original sound. */
let edition: Theme = 'classic';

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

/** A struck bell: a sine with an inharmonic overtone and a long, soft decay. */
function bell(c: AudioContext, f: number, t0: number, dur: number, peak: number): void {
  tone(c, 'sine', f, f, t0, dur, peak);
  tone(c, 'sine', f * 2.76, f * 2.76, t0, dur * 0.6, peak * 0.3);
}

/** A crystalline tone: two pure sines an octave apart, short and bright. */
function crystal(c: AudioContext, f: number, t0: number, dur: number, peak: number): void {
  tone(c, 'sine', f, f, t0, dur, peak);
  tone(c, 'sine', f * 2, f * 2, t0, dur * 0.6, peak * 0.25);
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

/** Disc-ready chime: a rising C major arpeggio that settles on a held chord. The edition changes its character. */
export function playChime(): void {
  play((c, t) => {
    if (edition === 'haunted') {
      // C minor, with an eerie low bell underneath.
      warmChord(c, [523.25], t, 0.16, 0.3);
      warmChord(c, [622.25], t + 0.1, 0.16, 0.3);
      warmChord(c, [783.99], t + 0.2, 0.16, 0.3);
      warmChord(c, [523.25, 622.25, 783.99, 1046.5], t + 0.3, 0.7, 0.32);
      bell(c, 130.81, t + 0.05, 1.4, 0.2);
      noise(c, 'lowpass', 320, t, 0.9, 0.06);
      return;
    }
    if (edition === 'christmas') {
      // Crisp, celebratory bell fifths, with a sleigh-bell sparkle on top.
      crystal(c, 783.99, t, 0.5, 0.26);
      crystal(c, 1174.66, t + 0.1, 0.5, 0.26);
      crystal(c, 1567.98, t + 0.2, 0.7, 0.24);
      crystal(c, 2349.32, t + 0.3, 0.9, 0.18);
      noise(c, 'highpass', 7000, t + 0.3, 0.35, 0.05, true);
      return;
    }
    warmChord(c, [523.25], t, 0.16, 0.32);
    warmChord(c, [659.25], t + 0.1, 0.16, 0.32);
    warmChord(c, [783.99], t + 0.2, 0.16, 0.32);
    warmChord(c, [523.25, 659.25, 783.99, 1046.5], t + 0.3, 0.7, 0.35);
  });
}

/**
 * Played when the edition changes. Classic '97 is a warm major triad, the Haunted Edition a minor bell
 * chime, and the Christmas Edition a crisp, celebratory bell fifth.
 */
export function playEditionSwitch(next: Theme): void {
  play((c, t) => {
    if (next === 'haunted') {
      bell(c, 220, t, 1.3, 0.26);
      bell(c, 261.63, t + 0.14, 1.2, 0.24);
      bell(c, 329.63, t + 0.28, 1.4, 0.22);
      bell(c, 110, t, 1.6, 0.18);
    } else if (next === 'christmas') {
      crystal(c, 1046.5, t, 0.9, 0.28);
      crystal(c, 1567.98, t, 1.0, 0.24);
      crystal(c, 2093, t + 0.12, 0.8, 0.14);
    } else {
      warmChord(c, [523.25, 659.25, 783.99], t, 0.7, 0.36);
    }
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

/**
 * The soundscape families. Castles get wind and a hearth, folklore and Halloween discs a still night,
 * code and lost-format discs a soft CRT purr, web pages a calm network room, and the rest a reading room.
 */
export type AmbienceKind = 'castle' | 'night' | 'retro' | 'web' | 'study';
export const AMBIENCE_KINDS: readonly AmbienceKind[] = ['castle', 'night', 'retro', 'web', 'study'];

let ambienceOn = false;
let ambienceKind: AmbienceKind = 'study';
let ambienceBus: GainNode | null = null;
let ambienceNodes: AudioScheduledSourceNode[] = [];
const ambienceListeners = new Set<(on: boolean) => void>();

/** Picks the soundscape for a disc from its id. */
export function ambienceKindFor(discId: string | undefined): AmbienceKind {
  const id = (discId ?? '').toLowerCase();
  if (id.includes('halloween') || id.includes('folklore') || id.includes('ghost') || id.includes('samhain')) return 'night';
  if (id.includes('castle') || id.includes('keep') || id.includes('fort')) return 'castle';
  if (id.startsWith('webpage-')) return 'web';
  if (id.startsWith('retro') || id.startsWith('resurrection') || id.startsWith('github-')) return 'retro';
  return 'study';
}

/** A small random spread (about +/-15%) so two sessions never move in exactly the same way. */
function drift(x: number): number {
  return x * (0.85 + Math.random() * 0.3);
}

/**
 * A looping noise layer. It is always shaped by a first filter and then softened by a low-pass at or
 * below AMBIENCE_MAX_CUTOFF, so the ambience never carries bright hiss.
 */
function ambienceNoise(
  c: AudioContext,
  bus: GainNode,
  filterType: BiquadFilterType,
  freq: number,
  level: number,
  soften = AMBIENCE_MAX_CUTOFF,
): { filter: BiquadFilterNode; gain: GainNode } {
  const len = Math.max(1, Math.floor(c.sampleRate * 3));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // Gently smoothed noise: a one-pole average takes the edge off before any filter.
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
    data[i] = last;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, c.currentTime);
  const gain = c.createGain();
  gain.gain.setValueAtTime(level, c.currentTime);
  src.connect(filter);
  if (filterType === 'lowpass' && freq <= soften) {
    filter.connect(gain);
  } else {
    const warm = c.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.setValueAtTime(Math.min(soften, AMBIENCE_MAX_CUTOFF), c.currentTime);
    filter.connect(warm);
    warm.connect(gain);
  }
  gain.connect(bus);
  src.start();
  ambienceNodes.push(src);
  return { filter, gain };
}

/**
 * A warm pad voice: a sine or triangle at the given pitch, plus a quieter twin tuned a hair sharp,
 * so the two beat slowly against each other instead of sitting dead still.
 */
function ambiencePad(
  c: AudioContext,
  bus: GainNode,
  type: 'sine' | 'triangle',
  freq: number,
  level: number,
): GainNode {
  const gain = c.createGain();
  gain.gain.setValueAtTime(level, c.currentTime);
  gain.connect(bus);
  const voices: [number, number][] = [
    [freq, 1],
    [freq * 1.0035, 0.45],
  ];
  for (const [f, share] of voices) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, c.currentTime);
    const g = c.createGain();
    g.gain.setValueAtTime(share, c.currentTime);
    osc.connect(g);
    g.connect(gain);
    osc.start();
    ambienceNodes.push(osc);
  }
  return gain;
}

/** A slow sine that moves an audio parameter around its current value. */
function ambienceLfo(c: AudioContext, target: AudioParam, rate: number, depth: number): void {
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(drift(rate), c.currentTime);
  const amount = c.createGain();
  amount.gain.setValueAtTime(depth, c.currentTime);
  lfo.connect(amount);
  amount.connect(target);
  lfo.start();
  ambienceNodes.push(lfo);
}

/** The edition's own layer, added over any soundscape: a low bell and night wind, or soft bell fifths. */
function editionLayer(c: AudioContext, bus: GainNode): void {
  if (edition === 'haunted') {
    const toll = ambiencePad(c, bus, 'sine', 73.42, 0.12);
    ambienceLfo(c, toll.gain, 0.05, 0.05);
    ambiencePad(c, bus, 'sine', 73.42 * 2.76, 0.015);
    const wind = ambienceNoise(c, bus, 'bandpass', 380, 0.14, 900);
    ambienceLfo(c, wind.filter.frequency, 0.06, 140);
    ambienceLfo(c, wind.gain.gain, 0.04, 0.06);
  } else if (edition === 'christmas') {
    const fifth = ambiencePad(c, bus, 'sine', 523.25, 0.03);
    ambienceLfo(c, fifth.gain, 0.09, 0.012);
    const upper = ambiencePad(c, bus, 'sine', 783.99, 0.02);
    ambienceLfo(c, upper.gain, 0.07, 0.01);
    // A faint wisp of frosty air: high noise, then softened hard so it is felt more than heard.
    ambienceNoise(c, bus, 'highpass', 5000, 0.012);
  }
}

function buildAmbience(c: AudioContext, kind: AmbienceKind): void {
  const bus = c.createGain();
  const now = c.currentTime;
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.linearRampToValueAtTime(AMBIENCE_LEVEL, now + AMBIENCE_FADE_IN);
  bus.connect(master as GainNode);
  ambienceBus = bus;

  if (kind === 'castle') {
    // Wind through the battlements that rises and falls, a muffled hearth, and a low stone-hall pad.
    const wind = ambienceNoise(c, bus, 'bandpass', 420, 0.45, 1200);
    ambienceLfo(c, wind.filter.frequency, 0.08, 180);
    ambienceLfo(c, wind.gain.gain, 0.05, 0.18);
    const hearth = ambienceNoise(c, bus, 'lowpass', 240, 0.22);
    ambienceLfo(c, hearth.gain.gain, 0.6, 0.05);
    const hall = ambiencePad(c, bus, 'sine', 98, 0.14);
    ambienceLfo(c, hall.gain, 0.03, 0.04);
    ambiencePad(c, bus, 'sine', 146.83, 0.06);
  } else if (kind === 'night') {
    // A still night: a hushed breeze, a dark minor pad, and a distant, slow-breathing hollow tone.
    const breeze = ambienceNoise(c, bus, 'lowpass', 520, 0.2);
    ambienceLfo(c, breeze.filter.frequency, 0.05, 160);
    ambienceLfo(c, breeze.gain.gain, 0.035, 0.08);
    const low = ambiencePad(c, bus, 'sine', 110, 0.12);
    ambienceLfo(c, low.gain, 0.04, 0.04);
    ambiencePad(c, bus, 'sine', 130.81, 0.06);
    const hollow = ambiencePad(c, bus, 'triangle', 164.81, 0.025);
    ambienceLfo(c, hollow.gain, 0.025, 0.02);
  } else if (kind === 'retro') {
    // A soft, warm CRT purr: a low fundamental and a quiet octave, rounded off, never a buzz.
    const purr = ambiencePad(c, bus, 'sine', 60, 0.16);
    ambienceLfo(c, purr.gain, 0.07, 0.03);
    ambiencePad(c, bus, 'sine', 120, 0.04);
    const room = ambienceNoise(c, bus, 'lowpass', 900, 0.05);
    ambienceLfo(c, room.filter.frequency, 0.04, 200);
  } else if (kind === 'web') {
    // A calm network room: a gentle open fifth that glows and fades, over a quiet line murmur.
    const root = ambiencePad(c, bus, 'triangle', 146.83, 0.08);
    ambienceLfo(c, root.gain, 0.06, 0.03);
    const fifth = ambiencePad(c, bus, 'sine', 220, 0.05);
    ambienceLfo(c, fifth.gain, 0.045, 0.025);
    const line = ambienceNoise(c, bus, 'bandpass', 700, 0.06, 1600);
    ambienceLfo(c, line.filter.frequency, 0.03, 220);
  } else {
    // A quiet reading room: a soft fifth with a slow swell, over faint, warm room tone.
    const root = ambiencePad(c, bus, 'sine', 110, 0.16);
    ambienceLfo(c, root.gain, 0.05, 0.05);
    ambiencePad(c, bus, 'sine', 164.81, 0.08);
    const air = ambiencePad(c, bus, 'triangle', 220, 0.02);
    ambienceLfo(c, air.gain, 0.03, 0.012);
    const room = ambienceNoise(c, bus, 'lowpass', 220, 0.1);
    ambienceLfo(c, room.filter.frequency, 0.02, 60);
  }
  editionLayer(c, bus);
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
      // Fade from wherever the swell has got to, so stopping mid-fade-in never jumps louder.
      const current = bus.gain.value;
      const from = current > 0 && current < AMBIENCE_LEVEL ? current : AMBIENCE_LEVEL;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(from, now);
      bus.gain.linearRampToValueAtTime(0.0001, now + AMBIENCE_FADE_OUT);
      when = now + AMBIENCE_FADE_OUT + 0.05;
    } catch {
      when = 0;
    }
  }
  let busDone = false;
  const releaseBus = () => {
    if (busDone || !bus) return;
    busDone = true;
    try {
      bus.disconnect();
    } catch {
      /* ignore */
    }
  };
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
      releaseBus();
    };
    if (when === 0) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
  if (when === 0) releaseBus();
}

/**
 * (Re)builds the voices when the ambience is wanted and Sound is on. A change of soundscape or
 * edition cross-fades: the old voices fade out while the new ones swell in. Never throws.
 */
function syncAmbience(crossfade = false): void {
  stopAmbienceNodes(!crossfade);
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
  syncAmbience(true);
  if (changed) notifyAmbience();
}

/** Sets the edition that colors the chime and the ambience. Rebuilds the ambience while it is on. */
export function setAudioEdition(next: Theme): void {
  if (next === edition) return;
  edition = next;
  if (ambienceOn) syncAmbience(true);
}

export function getAudioEdition(): Theme {
  return edition;
}

/** Switches the soundscape (for example when another disc opens). Rebuilds it only while it is on. */
export function setAmbienceKind(kind: AmbienceKind): void {
  if (kind === ambienceKind) return;
  ambienceKind = kind;
  if (ambienceOn) syncAmbience(true);
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
