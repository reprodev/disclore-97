// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BOOT_MESSAGES, BootSplash } from '../../src/components/BootSplash';

const splash = readFileSync(resolve(__dirname, '../../src/styles/splash.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
/** The declarations of the first top-level rule for a selector. */
const rule = (selector: string) => {
  const start = splash.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return splash.slice(start, splash.indexOf('}', start));
};

afterEach(cleanup);

describe('Boot Splash layout', () => {
  it('runs artwork, title banner, 2 x 2 specs, then the progress bar and the continue row at the bottom', () => {
    const { container } = render(<BootSplash onDone={() => undefined} />);
    const frame = container.querySelector('.boot-card__frame')!;
    expect(Array.from(frame.children).map((c) => c.className)).toEqual(['boot-hero', 'boot-titleblock', 'boot-specs', 'boot-console']);
    const bottom = container.querySelector('.boot-console')!;
    expect(Array.from(bottom.children).map((c) => c.className)).toEqual(['splash__bar', 'splash__init', 'boot-footer']);
    expect(bottom.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(BOOT_MESSAGES[0]);
    expect(bottom.querySelector('.boot-footer')!.textContent).toMatch(/Click or press Enter to continue/);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(container.querySelectorAll('.boot-specs__row')).toHaveLength(4);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("DiscLore '97");
    expect(container.querySelector('.boot-title__year')!.textContent).toBe("'97");
  });
});

describe('Boot Splash palette matches Home', () => {
  it('keeps the artwork in a night-sky box with a gold frame, like the Home emblem', () => {
    const hero = rule('.boot-hero');
    expect(hero).toContain('background: var(--color-night)');
    expect(hero).toContain('border: 2px solid var(--color-gold-dark)');
  });

  it('sets the card on parchment with ink text, burgundy accents, and antique-gold rules', () => {
    const frame = rule('.boot-card__frame');
    expect(frame).toContain('background: var(--color-parchment)');
    expect(frame).toContain('color: var(--color-ink)');
    expect(frame).toContain('border: 2px solid var(--color-gold-dark)');
    expect(rule('.boot-titleblock')).toContain('border-bottom: 3px double var(--color-gold-dark)');
    expect(rule('.boot-title')).toContain('color: var(--color-ink)');
    expect(rule('.boot-title__year')).toContain('color: var(--color-crimson)');
    expect(rule('.boot-subtitle')).toContain('color: var(--color-ink)');
    const seal = rule('.boot-seal');
    expect(seal).toContain('color: var(--color-title-text)');
    expect(seal).toContain('background: var(--color-crimson)');
    expect(rule('.boot-specs')).toContain('color: var(--color-ink)');
    expect(rule('.boot-specs dt')).toContain('color: var(--color-crimson)');
    expect(rule('.splash__init')).toContain('color: var(--color-ink)');
    expect(rule('.boot-footer')).toContain('color: var(--color-ink)');
    expect(rule('.boot-console')).toContain('border-top: 1px solid var(--color-gold-dark)');
  });

  it('uses tokens only, square corners, no gradients, and no soft shadows', () => {
    expect(splash).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(splash).not.toMatch(/gradient\(/);
    expect(splash).not.toMatch(/border-radius:\s*[1-9]/);
    expect(splash).not.toMatch(/box-shadow/);
    expect(splash).not.toMatch(/--color-console-/);
  });

  describe('contrast on the parchment surfaces, in every edition', () => {
    const vars = (text: string) => new Map(Array.from(text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)).map((m) => [m[1]!, m[2]!.trim()]));
    const block = (selector: string) => {
      const s = tokens.indexOf(selector);
      return vars(tokens.slice(s, tokens.indexOf('}', s)));
    };
    const classic = vars(tokens.slice(0, tokens.indexOf('}')));
    const editions = {
      classic,
      haunted: new Map([...classic, ...block(':root.theme-haunted')]),
      christmas: new Map([...classic, ...block(':root.theme-christmas')]),
    };
    const luminance = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };

    it.each(Object.entries(editions))('%s keeps every text colour at 7:1 or better', (_name, t) => {
      const pairs: [string, string][] = [
        ['--color-ink', '--color-parchment'], // title, subtitle, specs, status, hint
        ['--color-crimson', '--color-parchment'], // the '97 and the spec labels
        ['--color-title-text', '--color-crimson'], // the edition badge
      ];
      for (const [fg, bg] of pairs) expect(contrast(t.get(fg)!, t.get(bg)!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(7);
    });
  });
});
