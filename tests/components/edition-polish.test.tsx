// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import * as audio from '../../src/audio/audio';
import {
  __setContextFactory,
  playChime,
  playEditionSwitch,
  setAudioEdition,
  setMuted,
  startAmbience,
  stopAmbience,
} from '../../src/audio/audio';
import { BootSplash } from '../../src/components/BootSplash';
import { DISC_EMBLEMS, emblemFor } from '../../src/components/discEmblems';
import { ExpansionPackList } from '../../src/components/ExpansionPackList';
import { PackShelf } from '../../src/components/PackShelf';
import { PixelIcon } from '../../src/components/PixelIcon';
import { EngravedWatermarks, HeroArt } from '../../src/components/SplashArt';
import { prebakedDiscs } from '../../src/discs';
import { loadDisc } from '../../src/discs/loader';
import type { StorageLike } from '../../src/library/discLibrary';
import { THEMES } from '../../src/model/editions';
import type { Theme } from '../../src/model/editions';
import type { DiscManifest } from '../../src/model/manifest';

const src = (p: string) => readFileSync(resolve(__dirname, '../../src', p), 'utf8');
const discs: DiscManifest[] = prebakedDiscs.map((s) => {
  const r = loadDisc(s, false);
  if (!r.ok) throw new Error('built-in disc failed to load');
  return r.manifest;
});

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setAudioEdition('classic');
  stopAmbience();
  setMuted(false);
  __setContextFactory(null);
  document.documentElement.classList.remove('theme-haunted', 'theme-christmas', 'theme-solstice');
});

// ---- Artwork ----------------------------------------------------------------------------------

/** No gradients, images, filters, or hex colors anywhere in the markup, and every paint is a token. */
function expectFlatTokenArt(container: Element) {
  const html = container.innerHTML;
  expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(html).not.toMatch(/gradient|url\(|<image|<img|filter|mask|clip-path|<style|<script/i);
  for (const el of Array.from(container.querySelectorAll('*'))) {
    for (const attr of ['fill', 'stroke']) {
      const v = el.getAttribute(attr);
      if (v !== null) expect(v === 'none' || v === 'currentColor' || /^var\(--[a-z-]+\)$/.test(v), `${attr}=${v}`).toBe(true);
    }
  }
}

describe('HeroArt per edition', () => {
  const hero = (edition?: Theme) => {
    const { container } = render(<HeroArt edition={edition} />);
    return container.querySelector('svg.boot-hero__art')!;
  };

  it('defaults to the Classic 97 castle, CD, and CRT', () => {
    const svg = hero();
    expect(svg.getAttribute('data-edition')).toBe('classic');
    expect(svg.getAttribute('aria-label')).toMatch(/CD-ROM disc.*castle keep.*CRT terminal/);
    expect(svg.querySelector('.hero-glint')).not.toBeNull();
    expect(svg.querySelector('.hero-cursor')).not.toBeNull();
  });

  it('Haunted draws a keep, an amber crescent moon, bats, and a flickering lantern', () => {
    const svg = hero('haunted');
    expect(svg.getAttribute('data-edition')).toBe('haunted');
    expect(svg.getAttribute('aria-label')).toMatch(/haunted keep.*crescent moon.*bats.*lantern/);
    expect(svg.querySelector('path')).not.toBeNull(); // the crescent
    expect(svg.querySelectorAll('.hero-torch').length).toBeGreaterThanOrEqual(5);
    expect(svg.querySelector('.hero-glint')).toBeNull();
    expect(svg.querySelector('.hero-cursor')).toBeNull();
    expect(svg.innerHTML).toContain('var(--color-gold-light)'); // the amber moon
  });

  it('Christmas draws snow-dusted evergreens, a starry night, a lit keep and cottage, and a golden star', () => {
    const svg = hero('christmas');
    expect(svg.getAttribute('data-edition')).toBe('christmas');
    expect(svg.getAttribute('aria-label')).toMatch(/Snow-dusted evergreens.*starry winter night.*keep and cottage.*amber windows.*golden star/);
    // The golden star: one 16-point polygon (8 tips and 8 notches) in candle gold, with a glint.
    const star = Array.from(svg.querySelectorAll('polygon')).find((p) => p.getAttribute('points')!.trim().split(/\s+/).length === 16)!;
    expect(star.getAttribute('fill')).toBe('var(--color-gold-light)');
    expect(star.classList.contains('hero-glint')).toBe(true);
    // Four evergreens, each dusted with snow (paper-colored polygons on the boughs).
    expect(svg.querySelectorAll('g').length).toBe(4);
    for (const tree of Array.from(svg.querySelectorAll('g'))) {
      expect(tree.querySelector('polygon[fill="var(--color-paper)"]')).not.toBeNull();
    }
    // Warm amber windows on the keep and the cottage, which flicker like candlelight.
    const lit = svg.querySelectorAll('.hero-torch');
    expect(lit.length).toBeGreaterThanOrEqual(6);
    expect(Array.from(lit).some((r) => r.getAttribute('fill') === 'var(--color-gold-light)')).toBe(true);
    expect(Array.from(lit).some((r) => r.getAttribute('fill') === 'var(--color-gold)')).toBe(true);
    // Starry night and falling snow: many single-unit pixels.
    const pixels = Array.from(svg.querySelectorAll('rect')).filter((r) => r.getAttribute('width') === '1' && r.getAttribute('height') === '1');
    expect(pixels.length).toBeGreaterThanOrEqual(25);
    expect(svg.innerHTML).toContain('var(--color-night)');
    expect(svg.innerHTML).toContain('var(--color-crimson)'); // the cranberry banner and holly berry
  });

  it('every edition is flat token art, and the three are different pictures', () => {
    const htmls = THEMES.map((t) => {
      const svg = hero(t);
      expectFlatTokenArt(svg);
      expect(svg.getAttribute('viewBox')).toBe('0 0 200 80');
      expect(svg.getAttribute('role')).toBe('img');
      const html = svg.outerHTML;
      cleanup();
      return html;
    });
    expect(new Set(htmls).size).toBe(3);
  });
});

describe('EngravedWatermarks per edition', () => {
  const marks = (edition?: Theme) => {
    const { container } = render(<EngravedWatermarks edition={edition} />);
    return container.querySelector('.home-marks')!;
  };
  const names = (el: Element) => Array.from(el.querySelectorAll('svg.home-mark')).map((s) => Array.from(s.classList).find((c) => /^home-mark--(?!slot)/.test(c))!.replace('home-mark--', ''));

  it('Classic 97 keeps the planet, orbital CD rings, open book, and arch and keep', () => {
    const el = marks();
    expect(el.getAttribute('data-edition')).toBe('classic');
    expect(names(el)).toEqual(['planet', 'rings', 'book', 'arch']);
  });

  it('Haunted has a crescent moon, a gothic lantern, a tome, and a bat', () => {
    const el = marks('haunted');
    expect(names(el)).toEqual(['moon', 'lantern', 'tome', 'bat']);
    expect(el.querySelectorAll('.home-mark--slot1, .home-mark--slot2, .home-mark--slot3, .home-mark--slot4')).toHaveLength(4);
  });

  it('Christmas has a holiday star, a snowflake, an evergreen tree, and a candle', () => {
    const el = marks('christmas');
    expect(names(el)).toEqual(['star', 'snowflake', 'tree', 'candle']);
    const star = el.querySelector('.home-mark--star polygon')!;
    expect(star.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(16); // 8 outer and 8 inner points
    expect(el.querySelectorAll('.home-mark--snowflake g')).toHaveLength(6);
    expect(el.querySelectorAll('.home-mark--tree circle')).toHaveLength(5); // baubles
    expect(el.querySelectorAll('.home-mark--tree polygon')).toHaveLength(2); // the treetop star and the tree
    expect(el.querySelector('.home-mark--candle rect')).not.toBeNull(); // the candle
    expect(el.querySelectorAll('.home-mark--candle path').length).toBeGreaterThanOrEqual(4); // flame, wick, handle, holly
  });

  it('an unknown or legacy edition draws the right art instead of failing', () => {
    const editionOfArt = (value: string) => {
      const { container, unmount } = render(
        <>
          <EngravedWatermarks edition={value as Theme} />
          <HeroArt edition={value as Theme} />
        </>,
      );
      const out = [container.querySelector('.home-marks')!.getAttribute('data-edition'), container.querySelector('svg.boot-hero__art')!.getAttribute('data-edition')];
      unmount();
      return out;
    };
    expect(editionOfArt('solstice')).toEqual(['christmas', 'christmas']);
    expect(editionOfArt('bogus')).toEqual(['classic', 'classic']);
  });

  it('is decorative, flat, and token-colored in every edition', () => {
    for (const t of THEMES) {
      const el = marks(t);
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.querySelectorAll('svg.home-mark')).toHaveLength(4);
      expectFlatTokenArt(el);
      cleanup();
    }
  });

  it('the edition marks sit in the same four places as the classic ones', () => {
    const css = src('styles/home.css');
    for (const [slot, top] of [['slot1', '0'], ['slot2', '118px'], ['slot3', '238px'], ['slot4', '330px']] as const) {
      const i = css.indexOf(`.home-mark--${slot} {`);
      expect(i, slot).toBeGreaterThan(0);
      expect(css.slice(i, css.indexOf('}', i))).toContain(`top: ${top}`);
    }
  });
});

describe('the Home window and boot splash show the edition artwork', () => {
  it.each(THEMES)('Home, %s', (theme) => {
    const storage = memoryStorage();
    if (theme !== 'classic') storage.setItem('disclore97.theme', theme);
    const { container } = render(<App sources={discs} storage={storage} />);
    expect(container.querySelector('.home-hero__emblem svg')!.getAttribute('data-edition')).toBe(theme);
    expect(container.querySelector('.home-marks')!.getAttribute('data-edition')).toBe(theme);
  });

  it.each(THEMES)('boot splash, %s', (theme) => {
    const { container } = render(<BootSplash onDone={() => undefined} edition={theme} />);
    expect(container.querySelector('.boot-hero svg')!.getAttribute('data-edition')).toBe(theme);
  });

  it('switching the edition swaps the artwork live', async () => {
    const user = userEvent.setup();
    const { container } = render(<App sources={discs} storage={memoryStorage()} />);
    await user.click(screen.getByRole('button', { name: /Edition: Classic '97/ }));
    expect(container.querySelector('.home-hero__emblem svg')!.getAttribute('data-edition')).toBe('haunted');
    await user.click(screen.getByRole('button', { name: /Edition: Haunted Edition/ }));
    expect(container.querySelector('.home-marks')!.getAttribute('data-edition')).toBe('christmas');
  });
});

// ---- Typography -------------------------------------------------------------------------------

describe('display typography tokens', () => {
  const css = src('styles/tokens.css');
  const block = (selector: string) => {
    const i = css.indexOf(selector);
    expect(i, selector).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
  };
  const decl = (text: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(text)?.[1]?.trim();
  const root = block(':root {');
  const haunted = block(':root.theme-haunted');
  const christmas = block(':root.theme-christmas');

  it(':root defines --font-display as Georgia serif', () => {
    expect(decl(root, '--font-display')).toBe('Georgia, "Times New Roman", serif');
  });

  it('Haunted overrides it with a dramatic antique serif stack', () => {
    const v = decl(haunted, '--font-display')!;
    expect(v).toMatch(/^"Palatino Linotype", "Book Antiqua", Georgia, serif$/);
  });

  it('Christmas overrides it with a crisp Cambria stack', () => {
    expect(decl(christmas, '--font-display')).toMatch(/^Cambria, "Book Antiqua", Georgia, serif$/);
  });

  it('uses system font stacks only, ending in a generic family, with no web fonts anywhere', () => {
    for (const v of [root, haunted, christmas].map((b) => decl(b, '--font-display')!)) expect(v).toMatch(/,\s*serif$/);
    for (const f of readdirSync(resolve(__dirname, '../../src/styles'))) {
      const text = src(`styles/${f}`);
      expect(text, f).not.toMatch(/@font-face|@import|url\(/);
    }
    expect(readFileSync(resolve(__dirname, '../../index.html'), 'utf8')).not.toMatch(/fonts\.|<link[^>]+stylesheet/i);
  });

  it('the masthead is tighter and bolder in Haunted, and airier in Christmas', () => {
    const em = (b: string) => parseFloat(decl(b, '--display-tracking')!);
    expect(em(haunted)).toBeLessThan(em(root));
    expect(em(christmas)).toBeGreaterThan(em(root));
    expect(decl(haunted, '--display-weight')).toBe('bold');
    expect(decl(root, '--display-weight')).toBe('normal');
    expect(decl(christmas, '--display-weight')).toBe('normal');
  });

  it('the masthead title and the boot title use the display token, with the serif as a fallback', () => {
    const home = src('styles/home.css');
    const title = home.slice(home.lastIndexOf('.home-hero__title {'));
    expect(title.slice(0, title.indexOf('}'))).toContain('var(--font-display, var(--font-serif))');
    const word = home.slice(home.lastIndexOf('.home-hero__word {'));
    expect(word.slice(0, word.indexOf('}'))).toContain('letter-spacing: var(--display-tracking');
    const splash = src('styles/splash.css');
    const boot = splash.slice(splash.indexOf('.boot-title {'));
    expect(boot.slice(0, boot.indexOf('}'))).toContain('var(--font-display, var(--font-serif))');
  });
});

// ---- Audio ------------------------------------------------------------------------------------

interface Voice {
  type: string;
  freq: number;
}

/** An AudioContext double that records the type and starting frequency of every oscillator started. */
function recorder() {
  const voices: Voice[] = [];
  const filters: { type: string; freq: number }[] = [];
  let stopped = 0;
  const param = (onSet?: (v: number) => void) => ({
    value: 0,
    setValueAtTime(v: number) {
      onSet?.(v);
    },
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const factory = () =>
    ({
      state: 'running',
      currentTime: 0,
      sampleRate: 8000,
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
      createOscillator: () => {
        const v: Voice = { type: 'sine', freq: 0 };
        return {
          set type(t: string) {
            v.type = t;
          },
          get type() {
            return v.type;
          },
          frequency: param((f) => {
            v.freq = f;
          }),
          onended: null,
          connect() {},
          disconnect() {},
          start() {
            voices.push(v);
          },
          stop() {
            stopped++;
          },
        };
      },
      createBufferSource: () => ({ buffer: null, loop: false, onended: null, connect() {}, disconnect() {}, start() {}, stop() {} }),
      createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBiquadFilter: () => {
        const f = { type: 'lowpass', freq: 0 };
        return {
          set type(t: string) {
            f.type = t;
            filters.push(f);
          },
          get type() {
            return f.type;
          },
          frequency: param((v) => {
            f.freq = v;
          }),
          connect() {},
          disconnect() {},
        };
      },
    }) as unknown as AudioContext;
  return { factory, voices, filters, stopped: () => stopped };
}

const freqs = (voices: Voice[]) => voices.map((v) => Math.round(v.freq * 100) / 100);

beforeEach(() => {
  setMuted(false);
  setAudioEdition('classic');
});

describe('playEditionSwitch', () => {
  const cue = (edition: Theme) => {
    const r = recorder();
    __setContextFactory(r.factory);
    playEditionSwitch(edition);
    return r.voices;
  };

  it('Classic 97 is a warm C major triad of triangle voices with a shimmer', () => {
    const v = cue('classic');
    expect(freqs(v)).toEqual(expect.arrayContaining([523.25, 659.25, 783.99]));
    expect(v.some((x) => x.type === 'triangle')).toBe(true);
    expect(freqs(v).every((f) => f > 400)).toBe(true);
  });

  it('Haunted is a minor bell chime: A, C, and E with inharmonic overtones and a low bell', () => {
    const v = cue('haunted');
    expect(freqs(v)).toEqual(expect.arrayContaining([220, 261.63, 329.63, 110]));
    expect(freqs(v)).toContain(Math.round(220 * 2.76 * 100) / 100); // the bell overtone
    expect(v.every((x) => x.type === 'sine')).toBe(true);
    expect(Math.min(...v.map((x) => x.freq))).toBeLessThan(150);
  });

  it('Christmas is a crisp, celebratory bell fifth: pure high sines a fifth apart', () => {
    const v = cue('christmas');
    expect(freqs(v)).toEqual(expect.arrayContaining([1046.5, 1567.98, 2093]));
    expect(v.every((x) => x.type === 'sine')).toBe(true);
    expect(Math.min(...v.map((x) => x.freq))).toBeGreaterThanOrEqual(1046);
    expect(1567.98 / 1046.5).toBeCloseTo(1.498, 2); // a perfect fifth
  });

  it('the three cues are different sounds', () => {
    const sets = THEMES.map((t) => JSON.stringify(freqs(cue(t))));
    expect(new Set(sets).size).toBe(3);
  });

  it('is silent while muted, and never throws when audio is unavailable', () => {
    const r = recorder();
    __setContextFactory(r.factory);
    setMuted(true);
    for (const t of THEMES) playEditionSwitch(t);
    expect(r.voices).toHaveLength(0);
    setMuted(false);
    __setContextFactory(() => {
      throw new Error('no audio');
    });
    expect(() => playEditionSwitch('haunted')).not.toThrow();
  });

  it('plays when the Home Edition card changes the edition, and not on load', async () => {
    const spy = vi.spyOn(audio, 'playEditionSwitch');
    const user = userEvent.setup();
    render(<App sources={discs} storage={memoryStorage()} />);
    expect(spy).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Edition: Classic '97/ }));
    expect(spy).toHaveBeenLastCalledWith('haunted');
    await user.click(screen.getByRole('button', { name: /Edition: Haunted Edition/ }));
    expect(spy).toHaveBeenLastCalledWith('christmas');
    await user.click(screen.getByRole('button', { name: /Edition: Christmas Edition/ }));
    expect(spy).toHaveBeenLastCalledWith('classic');
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe('the chime and the ambience follow the edition', () => {
  const chime = (edition: Theme) => {
    const r = recorder();
    __setContextFactory(r.factory);
    setAudioEdition(edition);
    playChime();
    return r.voices;
  };

  it('keeps the rising C major arpeggio in Classic 97', () => {
    const v = freqs(chime('classic'));
    expect(v).toEqual(expect.arrayContaining([523.25, 659.25, 783.99, 1046.5]));
    expect(v).not.toContain(622.25);
  });

  it('turns minor with a low bell in the Haunted Edition', () => {
    const v = freqs(chime('haunted'));
    expect(v).toContain(622.25); // E flat
    expect(v).not.toContain(659.25);
    expect(v).toContain(130.81); // the low bell
  });

  it('turns to crisp, celebratory bell fifths with a sleigh-bell sparkle in Christmas', () => {
    const v = chime('christmas');
    expect(freqs(v)).toEqual(expect.arrayContaining([783.99, 1174.66, 1567.98, 2349.32]));
    expect(v.every((x) => x.type === 'sine')).toBe(true);
  });

  const ambience = (edition: Theme) => {
    const r = recorder();
    __setContextFactory(r.factory);
    setAudioEdition(edition);
    startAmbience('study');
    const out = { voices: freqs(r.voices), filters: [...r.filters], stopped: r.stopped };
    stopAmbience();
    return out;
  };

  it('adds an eerie low bell and wind over the ambience in the Haunted Edition', () => {
    const classic = ambience('classic');
    const haunted = ambience('haunted');
    expect(classic.voices).not.toContain(73.42);
    expect(haunted.voices).toEqual(expect.arrayContaining([73.42, Math.round(73.42 * 2.76 * 100) / 100]));
    expect(haunted.voices.length).toBeGreaterThan(classic.voices.length);
    expect(haunted.filters.some((f) => f.type === 'bandpass' && f.freq === 380)).toBe(true);
  });

  it('adds crisp bell fifths and airy hiss in Christmas', () => {
    const christmas = ambience('christmas');
    expect(christmas.voices).toEqual(expect.arrayContaining([523.25, 783.99]));
    expect(christmas.filters.some((f) => f.type === 'highpass' && f.freq === 5000)).toBe(true);
  });

  it('rebuilds a running ambience when the edition changes, and leaves Classic 97 as it was', () => {
    const r = recorder();
    __setContextFactory(r.factory);
    startAmbience('study');
    const before = r.voices.length;
    setAudioEdition('haunted');
    expect(r.voices.length).toBeGreaterThan(before);
    expect(r.stopped()).toBeGreaterThan(0);
    expect(freqs(r.voices)).toContain(73.42);
    setAudioEdition('classic');
    stopAmbience();
    expect(audio.getAudioEdition()).toBe('classic');
  });
});

// ---- Disc emblems -----------------------------------------------------------------------------

describe('built-in disc emblems', () => {
  it('gives each built-in disc its own icon, and any other disc the CD-ROM', () => {
    expect(DISC_EMBLEMS).toEqual({ castles: 'castle', 'retro-dialup': 'computer', halloween: 'lantern', resurrection: 'floppy' });
    expect(emblemFor('halloween')).toBe('lantern');
    expect(emblemFor('resurrection')).toBe('floppy');
    expect(emblemFor('wikipedia-topic-1')).toBe('cd');
    expect(new Set(discs.map((d) => emblemFor(d.disc_id))).size).toBe(discs.length);
  });

  it('draws the lantern and the floppy as distinct, token-colored pixel art', () => {
    const icon = (name: 'lantern' | 'floppy' | 'cd') => {
      const { container, unmount } = render(<PixelIcon name={name} size={32} />);
      const svg = container.querySelector('svg')!;
      const out = { html: svg.innerHTML, rects: svg.querySelectorAll('rect').length, icon: svg.getAttribute('data-icon') };
      unmount();
      return out;
    };
    const [lantern, floppy, cd] = [icon('lantern'), icon('floppy'), icon('cd')];
    expect(lantern.icon).toBe('lantern');
    expect(floppy.icon).toBe('floppy');
    expect(new Set([lantern.html, floppy.html, cd.html]).size).toBe(3);
    expect(lantern.html).toContain('var(--color-flame-hot)'); // the lit flame
    expect(floppy.html).toContain('var(--color-title-bg)'); // the blue shell
    for (const i of [lantern, floppy]) {
      expect(i.rects).toBeGreaterThan(10);
      expect(i.html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  const emblemOf = (card: Element) => card.querySelector('.pack-card__emblem svg')!.getAttribute('data-icon');

  it('the Home shelf shows them on the Halloween and Resurrection cards', () => {
    const { container } = render(<PackShelf discs={discs} removableIds={new Set()} onPick={() => undefined} />);
    const tiles = Array.from(container.querySelectorAll('.pack-tile'));
    const byTitle = (title: RegExp) => tiles.find((t) => title.test(t.textContent ?? ''))!;
    expect(emblemOf(byTitle(/Halloween/))).toBe('lantern');
    expect(emblemOf(byTitle(/Resurrection/))).toBe('floppy');
    expect(emblemOf(byTitle(/Castles/))).toBe('castle');
    expect(emblemOf(byTitle(/Retro/))).toBe('computer');
  });

  it('the Expansion Pack list shows them too, and a burned disc keeps the CD-ROM', () => {
    const burned: DiscManifest = { ...discs[0]!, disc_id: 'burned-topic', title: 'Burned Topic' };
    const { container } = render(<ExpansionPackList discs={[...discs, burned]} variant="card" onPick={() => undefined} />);
    const cards = Array.from(container.querySelectorAll('.pack-card'));
    const icons = cards.map((c) => c.querySelector('.pack-card__emblem svg')?.getAttribute('data-icon'));
    expect(icons).toEqual([...discs.map((d) => emblemFor(d.disc_id)), 'cd']);
    expect(icons).toContain('lantern');
    expect(icons).toContain('floppy');
  });
});

// ---- Home presentation ------------------------------------------------------------------------

describe('Home right column fits without a scrollbar', () => {
  const css = src('styles/home.css');
  const rule = (selector: string) => {
    const i = css.lastIndexOf(`${selector} {`);
    expect(i, selector).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
  };

  it('lays the Utilities cards in two columns, with every item including Replay Intro Splash', () => {
    const { container } = render(<App sources={discs} storage={memoryStorage()} />);
    const groups = Array.from(container.querySelectorAll('fieldset.home-group--editorial'));
    const quick = groups.find((g) => /Quick Jump Modes/.test(g.textContent ?? ''))!;
    const utilities = groups.find((g) => /^Utilities/.test(g.querySelector('legend')?.textContent ?? ''))!;
    expect(quick.querySelector('.home__cards--grid')).toBeNull();
    const grid = utilities.querySelector('.home__cards--grid')!;
    const titles = Array.from(grid.querySelectorAll('.home-card__title')).map((t) => t.textContent);
    expect(titles).toContain('Replay Intro Splash');
    expect(titles).toContain('Burn New CD-R Disc...');
    expect(within(grid as HTMLElement).getAllByRole('button').length).toBe(titles.length);
    expect(rule('.home .home__cards--grid')).toMatch(/grid-template-columns:\s*repeat\(2,/);
  });

  it('cards keep the full text as a tooltip, since the grid clips long lines', () => {
    render(<App sources={discs} storage={memoryStorage()} />);
    const replay = screen.getByRole('button', { name: /Replay Intro Splash/ });
    expect(replay.getAttribute('title')).toBe('watch the boot screen again');
    expect(rule('.home .home__cards--grid .home-card__desc')).toContain('text-overflow: ellipsis');
  });

  it('tightens the rows and spacing, and keeps the scroll only as a fallback', () => {
    expect(rule('.home .bevel-button.home-card')).toMatch(/padding:\s*1px 8px/);
    expect(rule('.home__side')).toContain('gap: 4px');
    expect(rule('.home .home__cards')).toContain('gap: 3px');
    expect(rule('.home__side')).toContain('overflow-y: auto');
  });
});
