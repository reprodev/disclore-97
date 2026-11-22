import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { prebakedDiscs } from '../../src/discs';
import { loadDisc } from '../../src/discs/loader';
import type { DiscManifest } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';
import { buildTour } from '../../src/model/tour';
import { arbExtractedSource, arbHostileSource, arbManifest, arbThinSource } from '../generators';

const arbMedia = fc.array(
  fc.record({ url: fc.constant('https://cdn.example.org/pic.jpg'), caption: fc.constantFrom('A picture', 'Another picture', 'Third view') }),
  { maxLength: 8 },
);

/** Valid manifests of several shapes: hand-built, with and without pictures, and compiled from any source. */
const arbDisc: fc.Arbitrary<DiscManifest> = fc.oneof(
  arbManifest,
  fc.tuple(arbManifest, arbMedia).map(([m, media]) => (media.length > 0 ? { ...m, media } : m)),
  fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource).map((s) => compileDisc(s)),
);

describe('Take a Tour: buildTour', () => {
  // Feature: guided tour, one stop per article
  it('makes one stop per section, in order, each citing a real section', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        expect(validateManifest(disc).ok).toBe(true);
        const stops = buildTour(disc);
        expect(stops.length).toBe(disc.sections.length);
        const ids = new Set(disc.sections.map((s) => s.section_id));
        stops.forEach((stop, i) => {
          expect(ids.has(stop.section_id)).toBe(true);
          expect(stop.section_id).toBe(disc.sections[i]!.section_id);
          expect(stop.title).toBe(disc.sections[i]!.title);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('gives every stop a non-empty spotlight fact', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        for (const stop of buildTour(disc)) {
          expect(typeof stop.spotlightFact).toBe('string');
          expect(stop.spotlightFact.trim()).not.toBe('');
        }
      }),
      { numRuns: 200 },
    );
  });

  it('pairs stop i with picture i modulo the picture count, and with none when the disc has none', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        const media = disc.media ?? [];
        buildTour(disc).forEach((stop, i) => {
          if (media.length === 0) expect(stop.media).toBeUndefined();
          else expect(stop.media).toEqual(media[i % media.length]);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic and does not change the disc', () => {
    fc.assert(
      fc.property(arbDisc, (disc) => {
        const before = JSON.stringify(disc);
        expect(buildTour(disc)).toEqual(buildTour(disc));
        expect(JSON.stringify(disc)).toBe(before);
      }),
      { numRuns: 100 },
    );
  });

  it('uses the first Quick Fact, else the first sentence, and carries the first dated event', () => {
    const disc: DiscManifest = {
      disc_id: 'd',
      title: 'D',
      tagline: 't',
      sections: [
        { section_id: 'a', title: 'A', paragraphs: ['Lead sentence. Second.'], facts: ['Fact one.', 'Fact two.'], timeline: [{ when: '1066', event: 'Normans arrive.' }] },
        { section_id: 'b', title: 'B', paragraphs: ['Only a lead sentence. More text.'], plate: 'tower' },
        { section_id: 'c', title: 'C', paragraphs: [''] },
      ],
      diagrams: [],
      trivia: [],
      dungeons: [],
    };
    const [a, b, c] = buildTour(disc);
    expect(a!.spotlightFact).toBe('Fact one.');
    expect(a!.timelineNote).toBe('1066: Normans arrive.');
    expect(b!.spotlightFact).toBe('Only a lead sentence.');
    expect(b!.plate).toBe('tower');
    expect(b!.timelineNote).toBeUndefined();
    expect(c!.spotlightFact).toBe('C');
  });

  it('works for every built-in disc', () => {
    for (const src of prebakedDiscs) {
      const r = loadDisc(src, false);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const stops = buildTour(r.manifest);
      expect(stops).toHaveLength(r.manifest.sections.length);
      expect(stops.every((s) => s.spotlightFact.trim() !== '')).toBe(true);
    }
  });
});
