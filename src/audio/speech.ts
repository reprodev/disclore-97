/**
 * Read Aloud: narration through the browser's native Web Speech API.
 * Uses the voice the browser already has: no audio files, no network requests, and no
 * AudioContext. Respects the global Mute: muting stops speech, and nothing speaks while muted.
 */
import { speechTag } from '../model/languages';
import { isMuted, subscribeMuted } from './audio';

interface Run {
  onEnd: () => void;
}

let current: Run | null = null;
let hooked = false;

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  const s = (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  return s && typeof s.speak === 'function' && typeof SpeechSynthesisUtterance !== 'undefined' ? s : null;
}

/** True when this browser can speak. */
export function isSpeechAvailable(): boolean {
  return synth() !== null;
}

/** Stops any narration and tells its owner (once) that it ended. Safe to call at any time. */
export function stopSpeaking(): void {
  const run = current;
  current = null;
  try {
    synth()?.cancel();
  } catch {
    /* speech must never break the app */
  }
  run?.onEnd();
}

/**
 * Picks the browser voice for a BCP 47 tag: an exact match first (`fr-FR`), then any voice of the
 * same language (`fr-CA`), preferring a local voice. Returns undefined when the browser has none,
 * in which case the utterance's `lang` alone lets the browser choose.
 */
export function chooseVoice(voices: readonly SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | undefined {
  const want = tag.toLowerCase();
  const base = want.split('-')[0]!;
  const norm = (v: SpeechSynthesisVoice) => String(v.lang ?? '').toLowerCase().replace('_', '-');
  const exact = voices.filter((v) => norm(v) === want);
  const same = voices.filter((v) => norm(v).split('-')[0] === base);
  const pick = (list: SpeechSynthesisVoice[]) => list.find((v) => v.localService) ?? list[0];
  return pick(exact) ?? pick(same);
}

/** The browser's voices, or none. Never throws. */
function voicesOf(s: SpeechSynthesis): SpeechSynthesisVoice[] {
  try {
    return typeof s.getVoices === 'function' ? s.getVoices() : [];
  } catch {
    return [];
  }
}

/**
 * Speaks the given paragraphs one after another. `onEnd` runs exactly once, when the last
 * paragraph finishes, when speech fails, or when it is stopped. onProgress(current, total),
 * with a 1-based paragraph number, runs when narration begins and as each paragraph starts.
 * `rate` is the speaking speed (1 is normal, 1.2 is brisk), clamped to 0.5 to 2.
 * `language` is the disc's language (for example `fr`): the utterance gets its tag (`fr-FR`) and a
 * matching voice when the browser has one. English (`en-US`) when omitted.
 * Returns false (and speaks nothing) when speech is unavailable, muted, or there is no text.
 */
export function speak(
  paragraphs: readonly string[],
  onEnd: () => void,
  onProgress?: (current: number, total: number) => void,
  rate = 1,
  language?: string,
): boolean {
  const s = synth();
  const texts = (Array.isArray(paragraphs) ? paragraphs : [])
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (!s || isMuted() || texts.length === 0) return false;

  if (!hooked) {
    hooked = true;
    subscribeMuted((m) => {
      if (m) stopSpeaking();
    });
  }

  stopSpeaking();
  const run: Run = { onEnd };
  current = run;
  const finish = () => {
    if (current === run) {
      current = null;
      onEnd();
    }
  };
  onProgress?.(1, texts.length);
  const tag = speechTag(language);
  const voice = chooseVoice(voicesOf(s), tag);
  try {
    texts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = tag;
      if (voice) u.voice = voice;
      u.rate = Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 1;
      u.onstart = () => {
        if (current === run) onProgress?.(i + 1, texts.length);
      };
      u.onend = i === texts.length - 1 ? finish : null;
      u.onerror = finish;
      s.speak(u);
    });
  } catch {
    finish();
    return false;
  }
  return true;
}
