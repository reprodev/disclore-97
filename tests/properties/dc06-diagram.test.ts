// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDisc } from '../../src/model/compiler';
import { arbExtractedSource, arbThinSource, arbHostileSource } from '../generators';

const arbAnySource = fc.oneof(arbExtractedSource, arbThinSource, arbHostileSource);

const tokensCss = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
const DEFINED_COLORS = new Set([...tokensCss.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const VAR_REF = /^var\(--color-([a-z0-9-]+)\)$/;
// Built from pieces so this file holds no hex-like literal.
const HEX_LITERAL = new RegExp('#' + '[0-9a-fA-F]{3,8}');

function paintOk(v: unknown): boolean {
  if (v === undefined) return true;
  if (typeof v !== 'string') return false;
  if (v === 'none' || v === 'currentColor') return true;
  const m = VAR_REF.exec(v);
  return m !== null && DEFINED_COLORS.has(m[1]);
}

describe('Property 6: Diagram geometry, references, and colors', () => {
  it('loads color names from tokens.css', () => {
    expect(DEFINED_COLORS.has('ink')).toBe(true);
    expect(DEFINED_COLORS.size).toBeGreaterThan(10);
  });

  // Feature: dynamic-disc-compiler, Property 6: Diagram geometry, references, and colors
  // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 7.5, 17.5**
  it('diagrams have valid geometry, references, and token-only colors', () => {
    fc.assert(
      fc.property(arbAnySource, (source) => {
        const m = compileDisc(source);
        const sectionIds = new Set(m.sections.map((s) => s.section_id));
        expect(m.diagrams.length).toBeGreaterThanOrEqual(1);

        // Source strings that must not leak into SVG attributes (long enough to be meaningful).
        const texts = [source.title, ...source.headings, ...source.paragraphs, source.metadata?.source]
          .filter((t): t is string => typeof t === 'string' && t.trim().length >= 4)
          .map((t) => t.trim());

        for (const d of m.diagrams) {
          expect(d.viewBox).toBe('0 0 100 100');
          expect(d.shapes.length).toBeGreaterThanOrEqual(3);
          expect(d.hotspots.length).toBeGreaterThanOrEqual(3);

          const used = new Set<string>();
          for (const shape of d.shapes) {
            for (const [key, val] of Object.entries(shape)) {
              if (key === 'kind') continue;
              if (key === 'anim') {
                // Only the three micro-animations the viewer and the validator know.
                expect(['blink', 'flicker', 'glint']).toContain(val);
                continue;
              }
              if (key === 'points') {
                // Polygon corners: at least three finite points, all inside the 0..100 space.
                expect(Array.isArray(val)).toBe(true);
                const pts = val as unknown[];
                expect(pts.length).toBeGreaterThanOrEqual(3);
                for (const p of pts) {
                  expect(Array.isArray(p) && p.length === 2).toBe(true);
                  for (const n of p as unknown[]) {
                    expect(typeof n).toBe('number');
                    expect(Number.isFinite(n)).toBe(true);
                    expect(n as number).toBeGreaterThanOrEqual(0);
                    expect(n as number).toBeLessThanOrEqual(100);
                  }
                }
                continue;
              }
              if (key === 'fill' || key === 'stroke') {
                expect(paintOk(val)).toBe(true);
                const ref = typeof val === 'string' ? VAR_REF.exec(val) : null;
                if (ref) used.add(ref[1]);
              } else {
                expect(typeof val).toBe('number');
                expect(Number.isFinite(val)).toBe(true);
              }
            }
            const attrs = Object.values(shape).filter((v): v is string => typeof v === 'string');
            for (const a of attrs) {
              expect(HEX_LITERAL.test(a)).toBe(false);
              for (const t of texts) expect(a.includes(t)).toBe(false);
            }
          }
          expect(used.size).toBeGreaterThanOrEqual(3);

          for (const h of d.hotspots) {
            expect(Number.isFinite(h.x)).toBe(true);
            expect(Number.isFinite(h.y)).toBe(true);
            expect(h.x).toBeGreaterThanOrEqual(0);
            expect(h.x).toBeLessThanOrEqual(100);
            expect(h.y).toBeGreaterThanOrEqual(0);
            expect(h.y).toBeLessThanOrEqual(100);
            expect(sectionIds.has(h.section_id)).toBe(true);
            expect(h.label.length).toBeGreaterThanOrEqual(1);
            expect(h.label.length).toBeLessThanOrEqual(40);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
