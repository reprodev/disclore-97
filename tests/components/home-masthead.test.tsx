// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HomeLauncher } from '../../src/components/HomeLauncher';
import { EngravedWatermarks } from '../../src/components/SplashArt';
import { prebakedDiscs } from '../../src/discs';
import type { DiscManifest } from '../../src/model/manifest';

const css = readFileSync(resolve(__dirname, '../../src/styles/home.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');

/** The declarations of the last rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const i = css.lastIndexOf(`${selector} {`);
  expect(i, `${selector} exists`).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
}

const handlers = () => ({
  onQuickJump: vi.fn(),
  onOpenReadMe: vi.fn(),
  onReplaySplash: vi.fn(),
  onBurnNew: vi.fn(),
  onMountImage: vi.fn(),
  onOpenSection: vi.fn(),
});

function renderHome(over: Partial<React.ComponentProps<typeof HomeLauncher>> = {}) {
  const h = handlers();
  const utils = render(
    <HomeLauncher
      discs={prebakedDiscs as DiscManifest[]}
      onPickDisc={() => {}}
      random={() => 0}
      {...h}
      {...over}
    />,
  );
  return { ...utils, ...h };
}

afterEach(cleanup);

describe('Encarta-style masthead', () => {
  it('has a tracked uppercase eyebrow, the DISCLORE 97 lockup, and a lowercase subtitle', () => {
    const { container } = renderHome();
    expect(container.querySelector('.home-hero__eyebrow')!.textContent).toBe('Multimedia Encyclopedia \u2022 1997 Edition');
    const title = screen.getByRole('heading', { level: 1, name: "DiscLore '97" });
    expect(title.querySelector('.home-hero__word')!.textContent).toBe('DiscLore');
    expect(title.querySelector('.home-hero__num')!.textContent).toBe('97');
    expect(container.querySelector('.home-hero__tag')!.textContent).toBe('encyclopedia');
  });

  it('keeps the CD-ROM badge and the emblem art in the header', () => {
    const { container } = renderHome();
    expect(screen.getByText(/D: CD-ROM Mounted/)).toBeTruthy();
    expect(container.querySelector('.home-hero__emblem svg')).not.toBeNull();
  });

  it('styles the lockup: tracked caps eyebrow, serif capitals, burgundy numeral, wide-tracked subtitle', () => {
    expect(rule('.home-hero__eyebrow')).toMatch(/text-transform:\s*uppercase/);
    expect(rule('.home-hero__eyebrow')).toMatch(/letter-spacing:\s*0\.2\d?em/);
    expect(rule('.home-hero__word')).toMatch(/text-transform:\s*uppercase/);
    expect(rule('.home-hero__title')).toContain('var(--font-serif)');
    expect(rule('.home-hero__num')).toContain('color: var(--color-crimson)');
    expect(rule('.home-hero__num')).toContain('var(--color-gold)'); // gold offset accent
    expect(rule('.home-hero__num')).toMatch(/font-size:\s*(5\d|6\d)px/); // large
    expect(rule('.home-hero__tag')).toMatch(/letter-spacing:\s*0\.[5-9]\d*em/);
    expect(rule('.home-hero__tag')).not.toMatch(/text-transform/); // stays lowercase
  });

  it('sits on warm parchment with a gold double rule', () => {
    const root = css.slice(css.indexOf('.home {'));
    expect(root.slice(0, root.indexOf('}'))).toContain('background: var(--color-parchment)');
    expect(rule('.home-hero')).toContain('3px double var(--color-gold-dark)');
  });
});

describe('engraved watermarks', () => {
  it('draws four decorative line-art marks behind the Home content', () => {
    const { container } = renderHome();
    const layer = container.querySelector('.home > .home-marks')!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer).toBe(container.querySelector('.home')!.firstElementChild); // painted first, so behind
    for (const k of ['planet', 'rings', 'book', 'arch']) {
      expect(layer.querySelector(`svg.home-mark--${k}`), k).not.toBeNull();
    }
    expect(layer.querySelectorAll('svg')).toHaveLength(4);
    expect(within(layer as HTMLElement).queryAllByRole('img')).toHaveLength(0);
  });

  it('uses only the sepia ink and tint tokens: no hex, no gradients, no images', () => {
    const { container } = render(<EngravedWatermarks />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/gradient|url\(|<image|<img|filter|mask|clip-path/i);
    for (const el of Array.from(container.querySelectorAll('*'))) {
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr);
        if (v === null) continue;
        expect(['none', 'var(--color-watermark-ink)', 'var(--color-parchment-tint)'], `${el.tagName} ${attr}`).toContain(v);
      }
    }
    expect(container.querySelectorAll('[stroke="var(--color-watermark-ink)"]').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll('[fill="var(--color-parchment-tint)"]').length).toBeGreaterThan(8);
  });

  it('defines the watermark tokens in tokens.css, beside the existing parchment tokens', () => {
    expect(tokens).toMatch(/--color-watermark-ink:\s*#[0-9A-Fa-f]{6};/);
    expect(tokens).toMatch(/--color-parchment-tint:\s*#[0-9A-Fa-f]{6};/);
    expect(tokens).toMatch(/--color-parchment:\s*#F0E6C8;/);
  });

  it('is faint, click-through, and in the corners', () => {
    expect(rule('.home > .home-marks')).toContain('pointer-events: none');
    expect(rule('.home > .home-marks')).toContain('z-index: 0');
    expect(rule('.home > :not(.home-marks)')).toContain('z-index: 1');
    const opacity = /opacity:\s*([0-9.]+)/.exec(rule('.home-mark'));
    expect(Number(opacity![1])).toBeLessThanOrEqual(0.6);
    expect(Number(opacity![1])).toBeGreaterThan(0);
  });
});

describe('editorial action rail', () => {
  const rows = (legend: string) => {
    const group = screen.getByText(legend).closest('fieldset')!;
    return within(group).getAllByRole('button');
  };
  const title = (b: HTMLElement) => b.querySelector('.home-card__title')!.textContent;
  const sub = (b: HTMLElement) => b.querySelector('.home-card__desc')!.textContent;

  it('lists Quick Jump Modes as icon, bold title, and italic one-line subtitle', () => {
    renderHome();
    const quick = rows('Quick Jump Modes');
    expect(quick.map(title)).toEqual(['Interactive Diagrams', 'KeepMaze Quest', 'Take a Tour', 'Study Flashcards', 'Surprise Me!']);
    expect(quick.map(sub)).toEqual([
      'find and jump straight to pin diagrams',
      'explore the trivia dungeon',
      'a guided walk through a disc, stop by stop',
      'drill trivia and Quick Facts as index cards',
      'open a random article from any disc',
    ]);
  });

  it('lists Utilities the same way', () => {
    renderHome();
    const utilities = rows('Utilities');
    expect(utilities.map(title)).toEqual([
      'Burn New CD-R Disc...',
      'Mount Disc Image (.json)...',
      'About / ReadMe.txt',
      'Replay Intro Splash',
    ]);
    expect(utilities.map(sub)).toEqual([
      'burn a Wikipedia topic, GitHub repo, or web page',
      'open a disc image saved on this computer',
      "what DiscLore '97 and KeepMaze are",
      'watch the boot screen again',
    ]);
  });

  it('gives every row a 24px icon on the left', () => {
    renderHome();
    for (const b of [...rows('Quick Jump Modes'), ...rows('Utilities')]) {
      const icon = b.firstElementChild as HTMLElement;
      expect(icon.tagName.toLowerCase()).toBe('svg');
      expect(icon.style.width).toBe('24px');
      expect(icon.style.height).toBe('24px');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('keeps the accessible button names the tests and screen readers rely on', () => {
    renderHome();
    for (const name of [
      /Interactive Diagrams/,
      /KeepMaze Quest/,
      /Surprise Me!/,
      /Burn New CD-R Disc/,
      /Mount Disc Image \(\.json\)\.\.\./,
      /About \/ ReadMe\.txt/,
      /Replay Intro Splash/,
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('still runs each action', async () => {
    const user = userEvent.setup();
    const h = renderHome();
    await user.click(screen.getByRole('button', { name: /Interactive Diagrams/ }));
    expect(h.onQuickJump).toHaveBeenLastCalledWith('diagram');
    await user.click(screen.getByRole('button', { name: /KeepMaze Quest/ }));
    expect(h.onQuickJump).toHaveBeenLastCalledWith('keepmaze');
    await user.click(screen.getByRole('button', { name: /Surprise Me!/ }));
    expect(h.onOpenSection).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /Burn New CD-R Disc/ }));
    await user.click(screen.getByRole('button', { name: /Mount Disc Image/ }));
    await user.click(screen.getByRole('button', { name: /About/ }));
    await user.click(screen.getByRole('button', { name: /Replay Intro Splash/ }));
    expect([h.onBurnNew, h.onMountImage, h.onOpenReadMe, h.onReplaySplash].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it('rests flat on the parchment, raises on hover and focus, and sinks when pressed', () => {
    const rest = rule('.home .bevel-button.home-card');
    expect(rest).toContain('background: transparent');
    expect(rest).toMatch(/border:\s*var\(--bevel-w\) solid transparent/);

    const hover = css.slice(css.indexOf('.home .bevel-button.home-card:hover:not(:disabled)'));
    const hoverRule = hover.slice(0, hover.indexOf('}'));
    expect(hoverRule).toContain('.home .bevel-button.home-card:focus-visible:not(:disabled)');
    expect(hoverRule).toContain('background: var(--color-surface)');
    expect(hoverRule).toContain('border-color: var(--color-bevel-hi) var(--color-bevel-edge) var(--color-bevel-edge) var(--color-bevel-hi)');

    const pressed = css.slice(css.indexOf('.home .bevel-button.home-card[data-pressed="true"]:not(:disabled)'));
    const pressedRule = pressed.slice(0, pressed.indexOf('}'));
    expect(pressedRule).toContain('.home .bevel-button.home-card:active:not(:disabled)');
    expect(pressedRule).toContain('border-color: var(--color-bevel-edge) var(--color-bevel-hi) var(--color-bevel-hi) var(--color-bevel-edge)');
  });

  it('styles the subtitle as quiet italic serif on one line', () => {
    const d = rule('.home .home-card__desc');
    expect(d).toContain('font-style: italic');
    expect(d).toContain('var(--font-serif)');
    expect(d).toContain('white-space: nowrap');
    expect(d).toContain('text-overflow: ellipsis');
    expect(rule('.home .home-card__title')).toContain('font-weight: bold');
  });

  it('disables a row when its action is missing, and leaves the rest of the Home screen in place', () => {
    renderHome({ onQuickJump: undefined, onOpenSection: undefined });
    expect((screen.getByRole('button', { name: /Interactive Diagrams/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Surprise Me!/ })).toBeNull();
  });

  it('keeps the Pinpointer, the 2 by 2 shelf, Did You Know?, and How DiscLore Works', () => {
    const { container } = renderHome();
    expect(screen.getByRole('combobox', { name: /Pinpointer/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'All (4)' })).toBeTruthy();
    expect(container.querySelectorAll('.pack-tile')).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Did You Know?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: "How DiscLore '97 Works" })).toBeTruthy();
  });

  it('stays locked to the window: no outer scroll, with the shelf and a short rail scrolling instead', () => {
    expect(rule('.home-window .window-content')).toContain('overflow: hidden');
    expect(rule('.pack-shelf')).toContain('overflow-y: auto');
    expect(rule('.home__side')).toContain('overflow-y: auto');
  });
});

describe('design-system rules for the Home styles', () => {
  it('uses no gradients, blurs, rounded corners, hex colors, or images', () => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/gradient\s*\(/i);
    expect(stripped).not.toMatch(/backdrop-filter|filter\s*:/i);
    expect(stripped).not.toMatch(/url\(/i);
    expect(stripped).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const m of stripped.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/gi)) {
      expect((m[1]!.match(/-?\d*\.?\d+/g) ?? []).every((n) => parseFloat(n) === 0)).toBe(true);
    }
    for (const m of stripped.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)) {
      for (const layer of m[1]!.split(/,(?![^(]*\))/)) {
        const lengths = layer.match(/(?<![\w#.-])-?\d*\.?\d+(?:px)?(?![\w%])/g) ?? [];
        if (lengths.length >= 3) expect(parseFloat(lengths[2]!)).toBe(0);
      }
    }
  });
});
