import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prebakedDiscs, halloweenDisc, resurrectionDisc } from '../src/discs';
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

describe('the four built-in discs', () => {
  const tokens = readFileSync(resolve(__dirname, '../src/styles/tokens.css'), 'utf8');
  const defined = new Set([...tokens.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const PLATE_KEYS = new Set(['mound', 'tower', 'wall', 'gate', 'siege', 'computer', 'modem', 'phone', 'disc', 'bbs', 'browser', 'terminal', 'book']);

  it('ships castles, retro, halloween, and resurrection, in that order, for a 2 by 2 shelf', () => {
    expect(prebakedDiscs.map((d) => d.disc_id)).toEqual(['castles', 'retro-dialup', 'halloween', 'resurrection']);
    expect(new Set(prebakedDiscs.map((d) => d.title)).size).toBe(4);
  });

  it.each([
    ['halloween', halloweenDisc, "DiscLore '97: Folklore, Samhain & Halloween"],
    ['resurrection', resurrectionDisc, "DiscLore '97: Lost Formats & Digital Resurrection"],
  ] as const)('%s passes the validator and loads as pre-baked', (_id, disc, title) => {
    expect(disc.title).toBe(title);
    expect(validateManifest(disc).ok).toBe(true);
    const r = loadDisc(disc, true);
    expect(r.ok && r.manifest).toBe(disc);
    expect(loadDisc(JSON.parse(JSON.stringify(disc)), false).ok).toBe(true); // survives a JSON round trip
  });

  it.each([
    ['halloween', halloweenDisc, ['samhain', 'jack-o-lanterns', 'gothic-gargoyles', 'victorian-ghosts', 'modern-halloween']],
    ['resurrection', resurrectionDisc, ['silver-cd-rom', 'hypercard', 'floppy-disks', 'crt-phosphor', 'preserving-software']],
  ] as const)('%s has its planned sections, each with facts, a timeline, and a known plate', (_id, disc, ids) => {
    expect(disc.sections.map((s) => s.section_id)).toEqual(ids);
    for (const s of disc.sections) {
      expect(s.facts!.length).toBeGreaterThanOrEqual(3);
      expect(s.timeline!.length).toBeGreaterThanOrEqual(3);
      expect(s.paragraphs.length).toBeGreaterThanOrEqual(3);
      expect(PLATE_KEYS.has(s.plate!)).toBe(true);
    }
  });

  it.each([
    ['halloween', halloweenDisc],
    ['resurrection', resurrectionDisc],
  ] as const)('%s has a hotspot diagram that links to every section', (_id, disc) => {
    const diagram = disc.diagrams[0]!;
    expect(diagram.hotspots.length).toBeGreaterThanOrEqual(5);
    expect(new Set(diagram.hotspots.map((h) => h.section_id))).toEqual(new Set(disc.sections.map((s) => s.section_id)));
    // Pins must not sit on top of each other.
    for (const [i, a] of diagram.hotspots.entries()) {
      for (const b of diagram.hotspots.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(8);
    }
  });

  it.each([
    ['halloween', halloweenDisc],
    ['resurrection', resurrectionDisc],
  ] as const)('%s draws only with defined color tokens, and uses known animations', (_id, disc) => {
    const shapes = disc.diagrams.flatMap((d) => d.shapes);
    expect(shapes.length).toBeGreaterThan(30);
    for (const s of shapes) {
      for (const paint of [(s as { fill?: string }).fill, s.stroke]) {
        if (paint === undefined || paint === 'none' || paint === 'currentColor') continue;
        const m = /^var\(--color-([a-z0-9-]+)\)$/.exec(paint);
        expect(m, `${paint} is a token`).not.toBeNull();
        expect(defined.has(m![1]!), `${paint} is defined in tokens.css`).toBe(true);
      }
      if (s.anim !== undefined) expect(['flicker', 'blink', 'glint']).toContain(s.anim);
    }
    expect(shapes.some((s) => s.anim !== undefined)).toBe(true);
  });

  it('halloween uses flicker and glint, and resurrection uses blink and glint', () => {
    const anims = (d: typeof halloweenDisc) => new Set(d.diagrams.flatMap((g) => g.shapes).map((s) => s.anim).filter(Boolean));
    expect(anims(halloweenDisc)).toEqual(new Set(['flicker', 'glint']));
    expect(anims(resurrectionDisc)).toEqual(new Set(['blink', 'glint']));
  });

  it.each([
    ['halloween', halloweenDisc],
    ['resurrection', resurrectionDisc],
  ] as const)('%s has a 10-room dungeon with a shortest path and enough trivia from every section', (_id, disc) => {
    const dungeon = disc.dungeons[0]!;
    expect(dungeon.rooms).toHaveLength(10);
    const s = solveDungeon(dungeon);
    expect(s.path[0]).toBe('entrance');
    expect(s.path[s.path.length - 1]).toBe('throne_room');
    expect(s.path.length).toBeGreaterThanOrEqual(4);
    expect(s.orphans).toEqual([]);
    expect(disc.trivia.length).toBeGreaterThanOrEqual(6);
    expect(new Set(disc.trivia.map((q) => q.section_id))).toEqual(new Set(disc.sections.map((x) => x.section_id)));
    for (const q of disc.trivia) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it('has trivia answers spread over the option positions', () => {
    for (const disc of [halloweenDisc, resurrectionDisc]) {
      expect(new Set(disc.trivia.map((q) => q.correct_index)).size).toBeGreaterThanOrEqual(3);
    }
  });
});