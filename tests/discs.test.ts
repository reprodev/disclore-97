import { describe, expect, it } from 'vitest';
import { prebakedDiscs } from '../src/discs';
import { loadDisc } from '../src/discs/loader';
import { validateManifest } from '../src/model/validate';
import { solveDungeon } from '../src/model/solver';

describe('pre-baked discs', () => {
  it('ships at least one disc', () => {
    expect(prebakedDiscs.length).toBeGreaterThan(0);
  });

  describe.each(prebakedDiscs.map((d) => [d.disc_id, d] as const))('%s', (_id, disc) => {
    const sectionIds = new Set(disc.sections.map((s) => s.section_id));

    it('validates with zero errors', () => {
      const r = validateManifest(disc);
      expect(r.ok ? [] : r.errors).toEqual([]);
    });

    it('hotspots are within 0..100 and reference existing sections', () => {
      for (const dg of disc.diagrams) {
        for (const h of dg.hotspots) {
          expect(h.x).toBeGreaterThanOrEqual(0);
          expect(h.x).toBeLessThanOrEqual(100);
          expect(h.y).toBeGreaterThanOrEqual(0);
          expect(h.y).toBeLessThanOrEqual(100);
          expect(sectionIds.has(h.section_id)).toBe(true);
        }
      }
    });

    it('trivia cite existing sections', () => {
      for (const q of disc.trivia) expect(sectionIds.has(q.section_id)).toBe(true);
    });

    it('dungeons are solvable with no orphans', () => {
      for (const d of disc.dungeons) {
        const s = solveDungeon(d);
        expect(s.path.length).toBeGreaterThan(0);
        expect(s.path[0]).toBe('entrance');
        expect(s.path[s.path.length - 1]).toBe('throne_room');
        expect(s.orphans).toEqual([]);
      }
    });

    it('meets content minimums', () => {
      expect(disc.sections.length).toBeGreaterThanOrEqual(5);
      expect(disc.diagrams.length).toBeGreaterThanOrEqual(1);
      expect(disc.diagrams.some((d) => d.hotspots.length >= 3)).toBe(true);
      expect(disc.trivia.length).toBeGreaterThanOrEqual(5);
      expect(disc.dungeons.length).toBeGreaterThanOrEqual(1);
      expect(disc.dungeons.some((d) => d.rooms.length >= 8)).toBe(true);
    });
  });
});

describe('loadDisc', () => {
  it('rejects an invalid non-pre-baked manifest with errors', () => {
    const r = loadDisc({ disc_id: 'bad' }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });
});
