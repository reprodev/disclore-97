import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadDisc } from '../../src/discs/loader';
import { compileDisc } from '../../src/model/compiler';
import { MAX_MEDIA, safeMediaUrl } from '../../src/model/media';
import type { MediaItem } from '../../src/model/manifest';
import { solveDungeon } from '../../src/model/solver';
import type { ExtractedSource, SourceKind } from '../../src/model/source';
import { MAX_STITCH, stitchSources } from '../../src/model/stitch';
import { arbExtractedSource, arbHostileSource, arbThinSource } from '../generators';

const KINDS: SourceKind[] = ['github', 'webpage', 'markdown', 'topic'];

/** Picture lists that mix safe images with every kind of unsafe address and duplicates. */
const arbMedia: fc.Arbitrary<MediaItem[]> = fc.array(
  fc.record({
    url: fc.oneof(
      fc.nat({ max: 30 }).map((n) => `https://cdn.example.org/pic-${n}.jpg`),
      fc.constantFrom(
        'http://cdn.example.org/a.jpg',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        'https://127.0.0.1/x.jpg',
        'https://192.168.0.4/y.png',
        'https://user:pw@cdn.example.org/z.jpg',
        'https://cdn.example.org:8443/w.jpg',
        'https://cdn.example.org/vector.svg',
        'https://cdn.example.org/has space.jpg',
        '',
      ),
    ),
    caption: fc.oneof(fc.string({ maxLength: 30 }), fc.constant('<b>bold</b> caption')),
  }),
  { maxLength: 6 },
);

/** Any source the generators can make (rich, thin, or hostile), with or without pictures. */
const arbSource: fc.Arbitrary<ExtractedSource> = fc
  .tuple(fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource), fc.option(arbMedia, { nil: undefined }))
  .map(([s, media]) => (media === undefined ? s : { ...s, media }));

const arbSources = fc.array(arbSource, { minLength: 2, maxLength: 4 });
const arbTitle = fc.option(fc.oneof(fc.string({ maxLength: 90 }), fc.constant('   ')), { nil: undefined });

describe('Stitcher: every stitched disc is a valid, solvable disc', () => {
  it('compileDisc(stitchSources(2-4 sources)) passes loadDisc and has a BFS-solvable dungeon with no orphans', () => {
    fc.assert(
      fc.property(arbSources, arbTitle, (sources, title) => {
        const manifest = compileDisc(stitchSources(sources, title));
        const loaded = loadDisc(manifest, false);
        if (!loaded.ok) expect(loaded.errors).toEqual([]);
        expect(loaded.ok).toBe(true);
        expect(manifest.disc_id.startsWith('stitched-')).toBe(true);
        expect(manifest.disc_id.length).toBeLessThanOrEqual(48);
        expect(manifest.sections.length).toBeGreaterThanOrEqual(5);
        expect(manifest.sections.length).toBeLessThanOrEqual(12);
        for (const d of manifest.dungeons) {
          const solved = solveDungeon(d);
          expect(solved.path.length).toBeGreaterThan(0);
          expect(solved.path[0]).toBe('entrance');
          expect(solved.path[solved.path.length - 1]).toBe('throne_room');
          expect(solved.orphans).toEqual([]);
        }
      }),
      { numRuns: 250 },
    );
  });

  it('keeps at most 8 pictures, every one a safe, unique https address', () => {
    fc.assert(
      fc.property(arbSources, (sources) => {
        const stitched = stitchSources(sources);
        const media = compileDisc(stitched).media ?? [];
        expect(media.length).toBeLessThanOrEqual(MAX_MEDIA);
        expect(new Set(media.map((m) => m.url)).size).toBe(media.length);
        for (const m of media) {
          expect(safeMediaUrl(m.url)).toBe(m.url);
          expect(m.caption).not.toMatch(/[<>]/);
        }
        expect(stitched.media ?? []).toEqual((stitched.media ?? []).slice(0, MAX_MEDIA));
      }),
      { numRuns: 250 },
    );
  });

  it('is deterministic and does not change its inputs', () => {
    fc.assert(
      fc.property(arbSources, arbTitle, (sources, title) => {
        const before = JSON.stringify(sources);
        const a = stitchSources(sources, title);
        expect(stitchSources(sources, title)).toEqual(a);
        expect(compileDisc(stitchSources(sources, title))).toEqual(compileDisc(a));
        expect(JSON.stringify(sources)).toBe(before);
      }),
      { numRuns: 120 },
    );
  });
});

// ---- Layout -------------------------------------------------------------------------------------

/** A source whose every paragraph carries a marker word, so the test can see where it lands. */
// Word lists keep generation fast; the layout logic only cares about counts and text, not spelling.
const WORDS = ['tower', 'lamp', 'lens', 'harbor', 'keeper', 'stone', 'code', 'branch', 'commit', 'page', 'night', 'signal'];
const arbWord = fc.constantFrom(...WORDS);
const arbPhrase = (min: number, max: number) => fc.array(arbWord, { minLength: min, maxLength: max }).map((w) => w.join(' '));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const arbTagged = (tag: string): fc.Arbitrary<ExtractedSource> =>
  fc
    .record({
      kind: fc.constantFrom(...KINDS),
      title: arbWord.map(cap),
      headings: fc.array(arbPhrase(1, 3).map(cap), { maxLength: 8 }),
      paragraphs: fc.array(arbPhrase(3, 14), { maxLength: 30 }),
    })
    .map((r) => ({
      title: `${r.title} ${tag}`,
      headings: r.headings,
      paragraphs: r.paragraphs.map((p) => `${tag} ${p}.`),
      metadata: { kind: r.kind, source: `Seed ${tag}` },
    }));

const TAGS = ['QQALPHA', 'QQBRAVO', 'QQCHARLIE', 'QQDELTA'];

describe('Stitcher: layout', () => {
  it("keeps each source's text in its own articles: no article mixes two sources", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }).chain((n) => fc.tuple(...TAGS.slice(0, n).map(arbTagged))), (sources) => {
        const m = compileDisc(stitchSources(sources));
        const HUBS = ['Connections', 'Sources on This Disc', 'Comparing the Sources'];
        // The closing articles name every source on purpose, so only the source articles are checked.
        for (const section of m.sections.filter((s) => !HUBS.includes(s.title))) {
          // The first article's attribution line names every source on purpose, so it is left out.
          const body = section.paragraphs.filter((p) => !p.startsWith('Source (Stitched CD-R):'));
          const tags = new Set(body.flatMap((p) => p.match(/\bQQ(?:ALPHA|BRAVO|CHARLIE|DELTA)\b/g) ?? []));
          expect(tags.size, `${section.title}: ${[...tags].join(', ')}`).toBeLessThanOrEqual(1);
        }
        // Every source has at least one article, in input order, before the closing articles.
        const firstWith = TAGS.slice(0, sources.length).map((tag) =>
          m.sections.findIndex((s) => s.paragraphs.some((p) => p.includes(tag)) || s.title.includes(tag)),
        );
        for (const i of firstWith) expect(i).toBeGreaterThanOrEqual(0);
        expect([...firstWith].sort((a, b) => a - b)).toEqual(firstWith);
      }),
      { numRuns: 250 },
    );
  });

  it('ends with a Connections article that names every source', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }).chain((n) => fc.tuple(...TAGS.slice(0, n).map(arbTagged))), (sources) => {
        const m = compileDisc(stitchSources(sources));
        const hub = m.sections.find((s) => s.title === 'Connections');
        expect(hub).toBeDefined();
        const text = m.sections.filter((s) => ['Connections', 'Sources on This Disc', 'Comparing the Sources'].includes(s.title)).flatMap((s) => s.paragraphs).join(' ');
        for (const s of sources) expect(text).toContain(s.title);
      }),
      { numRuns: 150 },
    );
  });

  it('uses the custom title when it has text, and otherwise joins the source titles', () => {
    const a: ExtractedSource = { title: 'Lighthouse', headings: [], paragraphs: ['A tower with a light.'], metadata: { kind: 'topic', source: 'Topic: Lighthouse' } };
    const b: ExtractedSource = { title: 'Hello-World', headings: [], paragraphs: ['My first repository.'], metadata: { kind: 'github', source: 'https://github.com/octocat/Hello-World' } };
    expect(compileDisc(stitchSources([a, b], 'Coastal Code')).title).toBe('Coastal Code');
    expect(compileDisc(stitchSources([a, b], '   ')).title).toBe('Lighthouse + Hello-World');
    expect(compileDisc(stitchSources([a, b])).title).toBe('Lighthouse + Hello-World');
    const long = Array.from({ length: 4 }, (_, i) => ({ ...a, title: `A very long source title number ${i + 1}` }));
    expect(compileDisc(stitchSources(long)).title).toBe('A very long source title number 1 + 3 more');
    const s = stitchSources([a, b]);
    expect(s.metadata).toMatchObject({ kind: 'stitched', source: 'Stitched: Topic: Lighthouse + github.com/octocat/Hello-World' });
    // A new title, or a new mix, is a new disc.
    const id = (x: ExtractedSource) => compileDisc(x).disc_id;
    expect(id(stitchSources([a, b], 'One'))).not.toBe(id(stitchSources([a, b], 'Two')));
    expect(id(stitchSources([a, b]))).not.toBe(id(stitchSources([b, a])));
  });

  it('draws pictures in turn from each source, de-duplicated, and stops at 8', () => {
    const pics = (prefix: string, count: number): MediaItem[] =>
      Array.from({ length: count }, (_, i) => ({ url: `https://cdn.example.org/${prefix}-${i}.jpg`, caption: `${prefix} ${i}` }));
    const src = (title: string, media: MediaItem[]): ExtractedSource => ({ title, headings: [], paragraphs: [`${title} text.`], metadata: { kind: 'topic', source: title }, media });
    const out = stitchSources([src('A', pics('a', 6)), src('B', [...pics('b', 6), pics('a', 1)[0]!])]).media!;
    expect(out.map((m) => m.caption)).toEqual(['a 0', 'b 0', 'a 1', 'b 1', 'a 2', 'b 2', 'a 3', 'b 3']);
  });

  it('ignores sources past the fourth', () => {
    const many = Array.from({ length: MAX_STITCH + 2 }, (_, i) => ({ title: `Source ${String.fromCharCode(65 + i)}`, headings: [], paragraphs: ['Text.'], metadata: { kind: 'markdown' as const, source: `m${i}` } }));
    const s = stitchSources(many);
    expect(s.metadata.description).toContain('4 sources');
    expect(s.headings).not.toContain('Source E');
  });

  it('never throws on junk input', () => {
    fc.assert(
      fc.property(fc.array(fc.anything(), { maxLength: 5 }), fc.anything(), (junk, title) => {
        const m = compileDisc(stitchSources(junk as ExtractedSource[], title as string));
        expect(loadDisc(m, false).ok).toBe(true);
      }),
      { numRuns: 150 },
    );
    expect(() => stitchSources(undefined as unknown as ExtractedSource[])).not.toThrow();
  });
});

describe('Stitcher: purity', () => {
  it('stitch.ts has no network, DOM, React, storage, clock, randomness, or upward imports', () => {
    const code = readFileSync(resolve(__dirname, '../../src/model/stitch.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    for (const banned of [/\bfetch\(/, /\bdocument\./, /\bwindow\./, /localStorage/, /navigator/, /Math\.random/, /Date\.now/, /new Date/, /from 'react/, /components\//, /adapters\//, /library\//]) {
      expect(code, String(banned)).not.toMatch(banned);
    }
  });
});
