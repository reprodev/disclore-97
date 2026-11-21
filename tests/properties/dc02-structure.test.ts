import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compileDisc } from '../../src/model/compiler';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';
import { ENTRANCE_ROOM_ID, THRONE_ROOM_ID } from '../../src/model/manifest';

const arbAnySource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

describe('Property 2: Structural minimums and limits', () => {
  // Feature: dynamic-disc-compiler, Property 2: Structural minimums and limits
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 4.1, 5.1, 7.3, 17.4**
  it('compiled discs meet structural minimums and limits', () => {
    fc.assert(
      fc.property(arbAnySource, (source) => {
        const m = compileDisc(source);

        expect(m.title.length).toBeGreaterThanOrEqual(1);
        expect(m.title.length).toBeLessThanOrEqual(80);
        expect(m.tagline.length).toBeGreaterThanOrEqual(1);
        expect(m.tagline.length).toBeLessThanOrEqual(140);

        expect(m.sections.length).toBeGreaterThanOrEqual(5);
        expect(m.sections.length).toBeLessThanOrEqual(12);
        for (const s of m.sections) {
          expect(s.paragraphs.length).toBeGreaterThanOrEqual(1);
          expect(s.paragraphs.length).toBeLessThanOrEqual(8);
          for (const p of s.paragraphs) expect(p.length).toBeLessThanOrEqual(1200);
          expect(s.facts?.length ?? 0).toBeGreaterThanOrEqual(1);
          expect(s.timeline?.length ?? 0).toBeGreaterThanOrEqual(1);
          expect(typeof s.plate).toBe('string');
          expect((s.plate ?? '').length).toBeGreaterThan(0);
        }

        expect(m.diagrams.length).toBeGreaterThanOrEqual(1);
        expect(m.trivia.length).toBeGreaterThanOrEqual(5);
        expect(m.dungeons.length).toBeGreaterThanOrEqual(1);
        for (const d of m.dungeons) {
          expect(d.rooms.length).toBeGreaterThanOrEqual(8);
          const roomIds = d.rooms.map((r) => r.room_id);
          expect(new Set(roomIds).size).toBe(roomIds.length);
          expect(roomIds).toContain(ENTRANCE_ROOM_ID);
          expect(roomIds).toContain(THRONE_ROOM_ID);
        }

        const ids = [
          ...m.sections.map((s) => s.section_id),
          ...m.diagrams.map((d) => d.diagram_id),
          ...m.trivia.map((t) => t.question_id),
          ...m.dungeons.map((d) => d.dungeon_id),
        ];
        expect(new Set(ids).size).toBe(ids.length);
      }),
      { numRuns: 200 },
    );
  });
});
