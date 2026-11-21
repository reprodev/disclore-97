// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ALLOWED_TOKENS } from '../src/model/compiler';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', 'dist', '.git', '.kiro']);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
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
const abs = (p: string) => join(ROOT, p);

/** Remove block comments and line comments (a double slash after a colon is kept, as in URLs). */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const allFiles = walk(ROOT);
const srcFiles = allFiles.filter((f) => rel(f).startsWith('src/'));
const srcCode = srcFiles.filter((f) => /\.(ts|tsx|css)$/.test(f));

const compilerFiles = [
  'src/model/compiler.ts',
  'src/model/sourceInput.ts',
  'src/extract/ssrf.ts',
  ...allFiles.map(rel).filter((f) => f.startsWith('src/model/compile/') && f.endsWith('.ts')),
];

function offendersOf(files: string[], pattern: RegExp, strip = true): string[] {
  return files.filter((f) => {
    const text = read(abs(f));
    return pattern.test(strip ? stripComments(text) : text);
  });
}

describe('burn.css compliance', () => {
  const path = abs('src/styles/burn.css');

  it('exists and uses the UI font variable', () => {
    expect(existsSync(path)).toBe(true);
    expect(read(path)).toContain('var(--font-ui)');
  });

  it('has no forbidden visual constructs', () => {
    const css = stripComments(read(path));
    expect(css).not.toMatch(/url\(/i);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/gradient\s*\(/i);
    expect(css).not.toMatch(/backdrop-filter/i);

    for (const m of css.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/gi)) {
      const nums = m[1].match(/-?\d*\.?\d+/g) ?? [];
      expect(nums.every((n) => parseFloat(n) === 0) && !/%|\bvar\(/.test(m[1])).toBe(true);
    }
    for (const m of css.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)) {
      for (const layer of m[1].split(/,(?![^(]*\))/)) {
        const lengths = layer.match(/(?<![\w#.-])-?\d*\.?\d+(?:px)?(?![\w%])/g) ?? [];
        if (lengths.length >= 3) expect(parseFloat(lengths[2])).toBe(0);
      }
    }
  });
});

describe('compiler purity', () => {
  it('finds the compiler files', () => {
    expect(compilerFiles.length).toBeGreaterThanOrEqual(10);
    for (const f of compilerFiles) expect(existsSync(abs(f)), f).toBe(true);
  });

  it('imports nothing from react, components, adapters, or library', () => {
    const importPattern =
      /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:react(?:-dom)?(?:\/[^'"]*)?|[^'"]*\/(?:components|adapters|library)(?:\/[^'"]*)?)['"]/;
    expect(offendersOf(compilerFiles, importPattern)).toEqual([]);
  });

  it('uses no nondeterministic or browser-only APIs', () => {
    const banned = /Math\.random|Date\.now|new Date|\bdocument\.|\bwindow\.|localStorage|\bfetch\(/;
    expect(offendersOf(compilerFiles, banned)).toEqual([]);
  });
});

describe('security and network surface', () => {
  it('has no dangerouslySetInnerHTML or innerHTML under src', () => {
    expect(offendersOf(srcCode.map(rel), /dangerouslySetInnerHTML|innerHTML/, false)).toEqual([]);
  });

  it('has no Authorization in adapters', () => {
    const adapters = srcCode.map(rel).filter((f) => f.startsWith('src/adapters/'));
    expect(adapters.length).toBeGreaterThan(0);
    expect(offendersOf(adapters, /Authorization/i)).toEqual([]);
  });

  it('only references the allowed absolute http URLs in src', () => {
    const offenders: string[] = [];
    for (const f of srcCode) {
      const text = stripComments(read(f));
      for (const m of text.matchAll(/https?:\/\/[^\s'"`)]*/g)) {
        const url = m[0];
        const ok =
          url === 'https://api.github.com' ||
          url.startsWith('https://api.github.com/') ||
          url.startsWith('https://github.com/');
        if (!ok) offenders.push(`${rel(f)}: ${url}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no env or secret access in functions or src/extract', () => {
    const files = allFiles
      .map(rel)
      .filter((f) => (f.startsWith('functions/') || f.startsWith('src/extract/')) && /\.(ts|tsx|js)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    expect(offendersOf(files, /process\.env|API_KEY|Authorization|secret/i)).toEqual([]);
  });

  it('commits no .env file', () => {
    const bad = allFiles.filter((f) => {
      const base = f.split(sep).pop() ?? '';
      return base === '.env' || base.startsWith('.env.');
    });
    expect(bad.map(rel)).toEqual([]);
  });
});

describe('project configuration', () => {
  it('defines every ALLOWED_TOKENS name in tokens.css', () => {
    const css = read(abs('src/styles/tokens.css'));
    expect(ALLOWED_TOKENS.length).toBeGreaterThan(0);
    for (const name of ALLOWED_TOKENS) {
      expect(css, name).toMatch(new RegExp(`${name}\\s*:`));
    }
  });

  it('tsconfig include contains functions', () => {
    const ts = JSON.parse(read(abs('tsconfig.json')));
    expect(ts.include).toContain('functions');
  });

  it('runtime dependencies stay react and react-dom', () => {
    const pkg = JSON.parse(read(abs('package.json')));
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['react', 'react-dom']);
  });

  it('LICENSE is still MIT', () => {
    const text = read(abs('LICENSE'));
    expect(text).toMatch(/MIT License/i);
    expect(text).toMatch(/Permission is hereby granted, free of charge/);
  });

  it('references no external image, audio, font, or script resources', () => {
    const html = read(abs('index.html'));
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i);

    const offenders: string[] = [];
    for (const f of srcCode.filter((p) => p.endsWith('.css'))) {
      const css = stripComments(read(f));
      if (/@import|@font-face[^}]*url\(\s*["']?(?:https?:)?\/\//i.test(css)) offenders.push(rel(f));
      if (/url\(\s*["']?(?:https?:)?\/\//i.test(css)) offenders.push(rel(f));
    }
    for (const f of srcCode.filter((p) => /\.tsx?$/.test(p))) {
      const text = stripComments(read(f));
      if (/new\s+(?:Image|Audio)\s*\(|\.src\s*=|<(?:img|audio|video|script|link)\b[^>]*(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(text)) {
        offenders.push(rel(f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
