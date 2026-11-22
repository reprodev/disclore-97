/**
 * Read Aloud: narration through the browser's native Web Speech API.
 * Uses the voice the browser already has: no audio files, no network requests, and no
 * AudioContext. Respects the global Mute: muting stops speech, and nothing speaks while muted.
 */
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
 * Speaks the given paragraphs one after another. `onEnd` runs exactly once, when the last
 * paragraph finishes, when speech fails, or when it is stopped. Returns false (and speaks
 * nothing) when speech is unavailable, muted, or there is no text.
 */
export function speak(paragraphs: readonly string[], onEnd: () => void): boolean {
  const s = synth();
  const texts = paragraphs.map((p) => p.trim()).filter((p) => p !== '');
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
  try {
    texts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
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
