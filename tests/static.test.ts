import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', 'dist', '.git', '.kiro']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (p: string) => relative(ROOT, p).split(sep).join('/');
const read = (p: string) => readFileSync(p, 'utf8');

const allFiles = walk(ROOT);
const cssFiles = allFiles.filter((f) => f.endsWith('.css'));
const srcFiles = allFiles.filter((f) => rel(f).startsWith('src/'));
const srcCodeFiles = srcFiles.filter((f) => /\.(ts|tsx|css)$/.test(f));

/** Strip CSS comments so they do not affect declaration scans. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('static repository scan', () => {
  it('LICENSE contains MIT text', () => {
    const text = read(join(ROOT, 'LICENSE'));
    expect(text).toMatch(/MIT License/i);
    expect(text).toMatch(/Permission is hereby granted, free of charge/);
  });

  it('.gitignore lists required entries', () => {
    const lines = read(join(ROOT, '.gitignore'))
      .split(/\r?\n/)
      .map((l: string) => l.trim());
    for (const entry of ['node_modules', 'dist', '.env', '.env.*', '.wrangler']) {
      expect(lines).toContain(entry);
    }
  });

  it('has no .env or audio asset files', () => {
    const bad = allFiles.filter((f) => {
      const base = f.split(sep).pop() ?? '';
      return base === '.env' || base.startsWith('.env.') || /\.(mp3|wav|ogg)$/i.test(base);
    });
    expect(bad.map(rel)).toEqual([]);
  });

  it('hex literals appear only in tokens.css', () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    const files = [...srcCodeFiles, join(ROOT, 'index.html')].filter(
      (f) => existsSync(f) && rel(f) !== 'src/styles/tokens.css',
    );
    const offenders = files.filter((f) => hex.test(stripComments(read(f))));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('tokens.css values match Requirement 3.1', () => {
    const css = read(join(ROOT, 'src/styles/tokens.css'));
    const expected: Record<string, string> = {
      '--color-surface': '#C0C0C0',
      '--color-title-bg': '#000080',
      '--color-title-text': '#FFFFFF',
      '--color-bevel-hi': '#FFFFFF',
      '--color-bevel-shadow': '#808080',
      '--color-bevel-edge': '#000000',
      '--color-tooltip-bg': '#FFFFE1',
    };
    for (const [name, value] of Object.entries(expected)) {
      const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]+)\\s*;`));
      expect(m, `${name} defined`).not.toBeNull();
      expect(m![1].toUpperCase()).toBe(value);
    }
  });

  it('stylesheets have no nonzero border-radius', () => {
    const offenders: string[] = [];
    for (const f of cssFiles) {
      for (const m of stripComments(read(f)).matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/gi)) {
        const nums = m[1].match(/-?\d*\.?\d+/g) ?? [];
        if (nums.some((n) => parseFloat(n) !== 0) || /%|\bvar\(/.test(m[1])) {
          offenders.push(`${rel(f)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('stylesheets have no blurred box-shadow', () => {
    const offenders: string[] = [];
    for (const f of cssFiles) {
      for (const m of stripComments(read(f)).matchAll(/box-shadow\s*:\s*([^;}]+)/gi)) {
        for (const layer of m[1].split(/,(?![^(]*\))/)) {
          const lengths = layer.match(/(?<![\w#.-])-?\d*\.?\d+(?:px)?(?![\w%])/g) ?? [];
          if (lengths.length >= 3 && parseFloat(lengths[2]) !== 0) {
            offenders.push(`${rel(f)}: ${m[0]}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('stylesheets have no backdrop-filter or gradients', () => {
    const offenders = cssFiles.filter((f) =>
      /backdrop-filter|gradient\s*\(/i.test(stripComments(read(f))),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('AudioContext and createOscillator are used only under src/audio', () => {
    const offenders = srcCodeFiles.filter(
      (f) =>
        !rel(f).startsWith('src/audio/') &&
        /\b(AudioContext|createOscillator)\b/.test(read(f)),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('runtime dependencies are exactly react and react-dom', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json')));
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['react', 'react-dom']);
  });

  it('tsconfig.json enables strict mode', () => {
    const ts = JSON.parse(read(join(ROOT, 'tsconfig.json')));
    expect(ts.compilerOptions.strict).toBe(true);
  });
});
