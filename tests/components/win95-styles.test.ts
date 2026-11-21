import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (n: string) => readFileSync(resolve(__dirname, '../../src/styles', `${n}.css`), 'utf8');
const files = ['button', 'window', 'menubar', 'tooltip'] as const;

/** Returns the declaration body of the first rule whose selector list contains `selector`. */
function ruleBody(css: string, selector: string): string {
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1].split(',').some((s) => s.trim() === selector)) return m[2];
  }
  throw new Error(`rule not found: ${selector}`);
}

describe('Win95 stylesheets (Req 9.4, 9.7, 9.8, 9.11, 9.14, 9.15, 9.16)', () => {
  it.each(files)('%s.css uses no literal colors', (n) => {
    const css = read(n);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    // every color-bearing declaration value that is not a keyword must use var(--...)
    const colorProps = /(?:^|[;{\s])(color|background|background-color|border-color|outline-color)\s*:\s*([^;}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = colorProps.exec(css))) {
      const v = m[2].trim();
      if (['none', 'inherit', 'transparent'].includes(v)) continue;
      expect(v, `${n}.css ${m[1]}: ${v}`).toMatch(/var\(--/);
    }
  });

  it('disabled button uses the bevel shadow token', () => {
    expect(ruleBody(read('button'), '.bevel-button:disabled')).toMatch(
      /color:\s*var\(--color-bevel-shadow\)/,
    );
  });

  it('menubar uses the sans-serif font token', () => {
    const css = read('menubar');
    expect(ruleBody(css, '.menubar')).toMatch(/font-family:\s*var\(--font-ui\)/);
    expect(ruleBody(css, '.menubar__menu')).toMatch(/font-family:\s*var\(--font-ui\)/);
  });

  it('tooltip uses the tooltip fill token and a 1px solid outer-edge border', () => {
    const body = ruleBody(read('tooltip'), '.tooltip-bubble');
    expect(body).toMatch(/background:\s*var\(--color-tooltip-bg\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--color-bevel-edge\)/);
  });

  it.each([
    ['button', '.bevel-button:focus-visible'],
    ['menubar', '.menubar__top:focus-visible'],
    ['menubar', '.menubar__item:focus-visible'],
  ])('%s.css has token-based %s', (n, sel) => {
    const body = ruleBody(read(n), sel);
    expect(body).toMatch(/outline:\s*1px dotted var\(--color-[a-z-]+\)/);
  });
});
