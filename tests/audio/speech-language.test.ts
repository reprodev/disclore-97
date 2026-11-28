// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setMuted } from '../../src/audio/audio';
import { chooseVoice, speak, stopSpeaking } from '../../src/audio/speech';

interface FakeUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
}
const voice = (lang: string, name: string, localService = true) => ({ lang, name, localService, voiceURI: name, default: false }) as SpeechSynthesisVoice;
const VOICES = [voice('en-US', 'David'), voice('fr-CA', 'Amelie'), voice('fr-FR', 'Julie', false), voice('fr-FR', 'Hortense'), voice('ja-JP', 'Haruka'), voice('ar-SA', 'Naayf')];

function installSpeech(voices: SpeechSynthesisVoice[]) {
  const spoken: FakeUtterance[] = [];
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  };
  (window as { speechSynthesis?: unknown }).speechSynthesis = {
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: () => undefined,
    getVoices: () => voices,
  };
  return spoken;
}

afterEach(() => {
  stopSpeaking();
  setMuted(false);
  delete (window as { speechSynthesis?: unknown }).speechSynthesis;
});

describe('Read Aloud matches the disc language', () => {
  it('chooses an exact local voice, then any voice of the language, then none', () => {
    expect(chooseVoice(VOICES, 'fr-FR')?.name).toBe('Hortense');
    expect(chooseVoice(VOICES, 'ja-JP')?.name).toBe('Haruka');
    expect(chooseVoice([voice('fr-CA', 'Amelie')], 'fr-FR')?.name).toBe('Amelie');
    expect(chooseVoice([voice('de_DE', 'Anna')], 'de-DE')?.name).toBe('Anna');
    expect(chooseVoice(VOICES, 'ko-KR')).toBeUndefined();
    expect(chooseVoice([], 'en-US')).toBeUndefined();
  });

  it.each([
    ['fr', 'fr-FR', 'Hortense'],
    ['ja', 'ja-JP', 'Haruka'],
    ['ar', 'ar-SA', 'Naayf'],
    ['de', 'de-DE', undefined],
    [undefined, 'en-US', 'David'],
  ])('a %s disc speaks with lang %s', (language, tag, name) => {
    const spoken = installSpeech(VOICES);
    expect(speak(['Bonjour.', 'Encore.'], () => undefined, undefined, 1, language)).toBe(true);
    expect(spoken).toHaveLength(2);
    for (const u of spoken) {
      expect(u.lang).toBe(tag);
      expect(u.voice?.name).toBe(name);
    }
  });

  it('an unknown language reads as English, and a browser without getVoices still speaks', () => {
    const spoken = installSpeech(VOICES);
    speak(['Hello.'], () => undefined, undefined, 1, 'klingon');
    expect(spoken[0]!.lang).toBe('en-US');
    const plain = installSpeech([]);
    delete (window.speechSynthesis as { getVoices?: unknown }).getVoices;
    expect(speak(['Hola.'], () => undefined, undefined, 1, 'es')).toBe(true);
    expect(plain[0]!.lang).toBe('es-ES');
    expect(plain[0]!.voice).toBeNull();
  });

  it('stays silent while muted', () => {
    const spoken = installSpeech(VOICES);
    setMuted(true);
    expect(speak(['Bonjour.'], () => undefined, undefined, 1, 'fr')).toBe(false);
    expect(spoken).toHaveLength(0);
  });
});
