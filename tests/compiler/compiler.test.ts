import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDisc, ALLOWED_TOKENS } from '../../src/model/compiler';
import type { ExtractedSource } from '../../src/model/compiler';
import { validateManifest } from '../../src/model/validate';

const small: ExtractedSource = {
  title: 'Lighthouse Keepers',
  headings: ['Origins', 'Lamps and Lenses', 'Daily Life'],
  paragraphs: [
    'Lighthouses guided ships along dangerous coasts.',
    'Keepers trimmed wicks and polished lenses every night.',
    'Fog signals warned sailors when light was not enough.',
  ],
  metadata: { kind: 'topic', source: 'Topic: Lighthouses' },
};

const empty: ExtractedSource = {
  title: '',
  headings: [],
  paragraphs: [],
  metadata: { kind: 'markdown', source: '' },
};

describe('compileDisc key fields (fixed small source)', () => {
  const m = compileDisc(small);

  it('validates and has a topic-prefixed id and the source title', () => {
    expect(validateManifest(m).ok).toBe(true);
    expect(m.disc_id).toMatch(/^topic(-[a-z0-9]+)+$/);
    expect(m.disc_id.length).toBeLessThanOrEqual(48);
    expect(m.title).toBe('Lighthouse Keepers');
  });

  it('plans 5 to 12 sections that include the source headings and attribution', () => {
    expect(m.sections.length).toBeGreaterThanOrEqual(5);
    expect(m.sections.length).toBeLessThanOrEqual(12);
    const titles = m.sections.map((s) => s.title);
    for (const h of small.headings) expect(titles).toContain(h);
    expect(JSON.stringify(m.sections[0])).toContain('Source (');
  });

  it('is deterministic', () => {
    expect(compileDisc(small)).toEqual(m);
  });
});

describe('compileDisc empty source', () => {
  it('still produces a valid disc with minimum structure', () => {
    const m = compileDisc(empty);
    expect(validateManifest(m).ok).toBe(true);
    expect(m.title.length).toBeGreaterThanOrEqual(1);
    expect(m.sections.length).toBeGreaterThanOrEqual(5);
    expect(m.diagrams[0].hotspots.length).toBeGreaterThanOrEqual(3);
  });
});

describe('compileDisc with more than 12 headings', () => {
  it('caps sections at 12', () => {
    const headings = Array.from({ length: 30 }, (_, i) => `Heading number ${i + 1}`);
    const m = compileDisc({ ...small, headings });
    expect(m.sections.length).toBeLessThanOrEqual(12);
    expect(m.sections.length).toBeGreaterThanOrEqual(5);
    expect(validateManifest(m).ok).toBe(true);
  });
});

describe('hotspot to section mapping', () => {
  it('hotspot i cites sections[i % N]', () => {
    const headings = Array.from({ length: 12 }, (_, i) => `Topic ${i + 1} overview`);
    for (const src of [small, empty, { ...small, headings }]) {
      const m = compileDisc(src);
      const n = m.sections.length;
      const { hotspots } = m.diagrams[0];
      expect(hotspots.length).toBeGreaterThanOrEqual(3);
      hotspots.forEach((h, i) => {
        expect(h.section_id).toBe(m.sections[i % n].section_id);
      });
    }
  });
});

describe('ALLOWED_TOKENS', () => {
  it('every name is defined in tokens.css', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
    const defined = new Set([...css.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
    expect(ALLOWED_TOKENS.length).toBe(12);
    for (const name of ALLOWED_TOKENS) expect(defined.has(name)).toBe(true);
  });
});
