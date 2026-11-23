// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compileDisc, ALLOWED_TOKENS } from '../../src/model/compiler';
import type { ExtractedSource } from '../../src/model/compiler';
import { SCENE_SLOTS } from '../../src/model/compile/diagram';
import { SHAPE_ANIMS } from '../../src/model/manifest';
import type { Diagram, Shape } from '../../src/model/manifest';
import { validateManifest } from '../../src/model/validate';

type Kind = ExtractedSource['metadata']['kind'];
const KINDS: readonly Kind[] = ['topic', 'webpage', 'github', 'markdown'];

/** The micro-animation each 1997 scene is drawn with. */
const SCENE_ANIM: Record<string, string> = { topic: 'glint', webpage: 'glint', github: 'blink', markdown: 'flicker' };

/** A source with enough headings to fill every scene slot (eight pins). */
function source(kind: Kind, title: string): ExtractedSource {
  const headings = ['Origins', 'Design', 'Parts', 'People', 'Places', 'Methods', 'Legacy', 'Further Reading', 'Notes'];
  return {
    title,
    headings,
    paragraphs: headings.map((h) => `${h} covers one part of ${title}. It has a second sentence for the article.`),
    metadata: { kind, source: `${kind}: ${title}` },
  };
}

function diagramOf(kind: Kind, title: string): Diagram {
  const m = compileDisc(source(kind, title));
  expect(validateManifest(m).ok).toBe(true);
  return m.diagrams[0]!;
}

const PAINT = /^var\((--color-[a-z0-9-]+)\)$/;

function paints(s: Shape): string[] {
  const out: string[] = [];
  if ('fill' in s && s.fill !== undefined) out.push(s.fill);
  if (s.stroke !== undefined) out.push(s.stroke);
  return out;
}

describe('enriched 1997 diagram scenes', () => {
  for (const kind of KINDS) {
    describe(`${kind} scene`, () => {
      const d = diagramOf(kind, 'Lighthouse Keepers');

      it('paints only with ALLOWED_TOKENS (or none/currentColor)', () => {
        for (const s of d.shapes) {
          for (const p of paints(s)) {
            if (p === 'none' || p === 'currentColor') continue;
            const m = PAINT.exec(p);
            expect(m, `${s.kind} paint ${p}`).not.toBeNull();
            expect(ALLOWED_TOKENS).toContain(m![1]);
          }
        }
      });

      it('uses only known anim values, and its own scene animation', () => {
        const anims = d.shapes.map((s) => s.anim).filter((a): a is NonNullable<typeof a> => a !== undefined);
        for (const a of anims) expect(SHAPE_ANIMS).toContain(a);
        expect(anims).toContain(SCENE_ANIM[kind]);
        expect(new Set(anims)).toEqual(new Set([SCENE_ANIM[kind]]));
      });

      it('draws a rich scene from rects, circles and lines (polygons where the scene needs them)', () => {
        const kinds = new Set(d.shapes.map((s) => s.kind));
        for (const k of ['rect', 'circle', 'line']) expect(kinds).toContain(k);
        if (kind !== 'github') expect(kinds).toContain('polygon');
        expect(d.shapes.length).toBeGreaterThanOrEqual(60);
        for (const s of d.shapes) {
          if (s.kind !== 'polygon') continue;
          expect(s.points.length).toBeGreaterThanOrEqual(3);
          for (const [x, y] of s.points) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(100);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(100);
          }
        }
      });

      it('places eight pins inside the plate', () => {
        expect(d.hotspots).toHaveLength(8);
        expect(SCENE_SLOTS[kind]).toHaveLength(8);
      });
    });
  }

  it('keeps every pin well inside bounds and apart, for any title (seed)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), fc.string({ minLength: 1, maxLength: 30 }), (kind, title) => {
        const pins = diagramOf(kind, title).hotspots;
        for (const h of pins) {
          expect(h.x).toBeGreaterThanOrEqual(5);
          expect(h.x).toBeLessThanOrEqual(95);
          expect(h.y).toBeGreaterThanOrEqual(5);
          expect(h.y).toBeLessThanOrEqual(95);
        }
        for (let i = 0; i < pins.length; i++) {
          for (let j = i + 1; j < pins.length; j++) {
            const dist = Math.hypot(pins[i]!.x - pins[j]!.x, pins[i]!.y - pins[j]!.y);
            expect(dist, `${kind} pins ${i + 1} and ${j + 1}`).toBeGreaterThanOrEqual(8);
          }
        }
      }),
      { numRuns: 120 },
    );
  });

  it('scene slots leave room for the jitter: inside 8..92 and at least 14 apart', () => {
    for (const kind of KINDS) {
      const slots = SCENE_SLOTS[kind];
      for (const [x, y] of slots) {
        expect(x).toBeGreaterThanOrEqual(8);
        expect(x).toBeLessThanOrEqual(92);
        expect(y).toBeGreaterThanOrEqual(8);
        expect(y).toBeLessThanOrEqual(92);
      }
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          expect(Math.hypot(slots[i]![0] - slots[j]![0], slots[i]![1] - slots[j]![1])).toBeGreaterThanOrEqual(14);
        }
      }
    }
  });

  it('compiles the same scene twice from the same source', () => {
    for (const kind of KINDS) expect(diagramOf(kind, 'Same')).toEqual(diagramOf(kind, 'Same'));
  });
});
