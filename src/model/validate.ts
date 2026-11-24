import { ENTRANCE_ROOM_ID, MAX_OUTLINE_INPUT, OUTLINE_KINDS, SHAPE_ANIMS, THRONE_ROOM_ID } from './manifest';
import type {
  DiscManifest,
  Dungeon,
  ErrorCode,
  OutlineKind,
  ShapeAnim,
  ValidationError,
  ValidationResult,
} from './manifest';
import { isValidCaption, MAX_MEDIA, safeMediaUrl } from './media';
import { solveDungeon } from './solver';

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Validates an unknown value as a DiscManifest. Collects every error, never
 * throws, and returns the original manifest object on success.
 */
export function validateManifest(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const err = (path: string, code: ErrorCode, message: string) => {
    errors.push({ path, code, message });
  };

  try {
    if (!isObj(input)) {
      err('$', 'wrong-type', `Expected an object but found ${describe(input)}`);
      return { ok: false, errors };
    }

    // ---------- Pass 1: shape and types ----------
    const field = (o: Obj, key: string, path: string, type: 'string' | 'number'): boolean => {
      const p = `${path}.${key}`;
      if (!(key in o) || o[key] === undefined) {
        err(p, 'missing-field', `Missing required field ${p}`);
        return false;
      }
      if (typeof o[key] !== type) {
        err(p, 'wrong-type', `Expected ${type} at ${p} but found ${describe(o[key])}`);
        return false;
      }
      return true;
    };

    const arrayOf = (o: Obj, key: string, path: string): unknown[] | null => {
      const p = `${path}.${key}`;
      if (!(key in o) || o[key] === undefined) {
        err(p, 'missing-field', `Missing required field ${p}`);
        return null;
      }
      if (!Array.isArray(o[key])) {
        err(p, 'wrong-type', `Expected array at ${p} but found ${describe(o[key])}`);
        return null;
      }
      return o[key] as unknown[];
    };

    const items = (arr: unknown[] | null, path: string, check: (o: Obj, p: string) => void) => {
      if (!arr) return;
      arr.forEach((item, i) => {
        const p = `${path}[${i}]`;
        if (!isObj(item)) {
          err(p, 'wrong-type', `Expected object at ${p} but found ${describe(item)}`);
          return;
        }
        check(item, p);
      });
    };

    const strings = (arr: unknown[] | null, path: string) => {
      if (!arr) return;
      arr.forEach((s, i) => {
        if (typeof s !== 'string') {
          err(`${path}[${i}]`, 'wrong-type', `Expected string at ${path}[${i}] but found ${describe(s)}`);
        }
      });
    };

    const root = input;
    for (const k of ['disc_id', 'title', 'tagline']) field(root, k, '$', 'string');

    items(arrayOf(root, 'sections', '$'), '$.sections', (s, p) => {
      field(s, 'section_id', p, 'string');
      field(s, 'title', p, 'string');
      strings(arrayOf(s, 'paragraphs', p), `${p}.paragraphs`);
      // Optional encyclopedia-layout fields: checked only when present.
      if ('facts' in s && s.facts !== undefined) strings(arrayOf(s, 'facts', p), `${p}.facts`);
      if ('plate' in s && s.plate !== undefined) field(s, 'plate', p, 'string');
      if ('timeline' in s && s.timeline !== undefined) {
        items(arrayOf(s, 'timeline', p), `${p}.timeline`, (t, tp) => {
          field(t, 'when', tp, 'string');
          field(t, 'event', tp, 'string');
        });
      }
    });

    items(arrayOf(root, 'diagrams', '$'), '$.diagrams', (d, p) => {
      field(d, 'diagram_id', p, 'string');
      field(d, 'title', p, 'string');
      if (field(d, 'viewBox', p, 'string') && d.viewBox !== '0 0 100 100') {
        err(`${p}.viewBox`, 'wrong-type', `Expected viewBox "0 0 100 100" at ${p}.viewBox`);
      }
      items(arrayOf(d, 'shapes', p), `${p}.shapes`, (sh, sp) => {
        const nums: Record<string, string[]> = {
          rect: ['x', 'y', 'width', 'height'],
          circle: ['cx', 'cy', 'r'],
          line: ['x1', 'y1', 'x2', 'y2'],
          polygon: [],
        };
        if (!field(sh, 'kind', sp, 'string')) return;
        const kind = sh.kind as string;
        if (!(kind in nums)) {
          err(`${sp}.kind`, 'wrong-type', `Unknown shape kind "${kind}" at ${sp}.kind`);
          return;
        }
        for (const k of nums[kind]) field(sh, k, sp, 'number');
        if (kind === 'polygon') {
          const pts = arrayOf(sh, 'points', sp);
          pts?.forEach((pt, i) => {
            const pp = `${sp}.points[${i}]`;
            if (!Array.isArray(pt) || pt.length !== 2 || pt.some((n) => typeof n !== 'number')) {
              err(pp, 'wrong-type', `Expected [number, number] at ${pp}`);
            }
          });
        }
        if ('anim' in sh && sh.anim !== undefined && !SHAPE_ANIMS.includes(sh.anim as ShapeAnim)) {
          err(`${sp}.anim`, 'wrong-type', `Unknown shape animation at ${sp}.anim`);
        }
        for (const k of ['fill', 'stroke']) {
          if (k in sh && sh[k] !== undefined && typeof sh[k] !== 'string') {
            err(`${sp}.${k}`, 'wrong-type', `Expected string at ${sp}.${k} but found ${describe(sh[k])}`);
          }
        }
      });
      items(arrayOf(d, 'hotspots', p), `${p}.hotspots`, (h, hp) => {
        field(h, 'label', hp, 'string');
        field(h, 'x', hp, 'number');
        field(h, 'y', hp, 'number');
        field(h, 'section_id', hp, 'string');
      });
    });

    items(arrayOf(root, 'trivia', '$'), '$.trivia', (q, p) => {
      field(q, 'question_id', p, 'string');
      field(q, 'prompt', p, 'string');
      strings(arrayOf(q, 'options', p), `${p}.options`);
      field(q, 'correct_index', p, 'number');
      field(q, 'section_id', p, 'string');
    });

    items(arrayOf(root, 'dungeons', '$'), '$.dungeons', (d, p) => {
      field(d, 'dungeon_id', p, 'string');
      field(d, 'title', p, 'string');
      items(arrayOf(d, 'rooms', p), `${p}.rooms`, (r, rp) => {
        field(r, 'room_id', rp, 'string');
        field(r, 'name', rp, 'string');
        field(r, 'description', rp, 'string');
        items(arrayOf(r, 'exits', rp), `${rp}.exits`, (e, ep) => {
          field(e, 'to', ep, 'string');
        });
      });
    });

    // Optional Multimedia Reel pictures: checked only when present.
    if ('media' in root && root.media !== undefined) {
      items(arrayOf(root, 'media', '$'), '$.media', (it, p) => {
        field(it, 'url', p, 'string');
        field(it, 'caption', p, 'string');
      });
    }

    // Optional offline-outline marker: checked only when present.
    if ('outline' in root && root.outline !== undefined) {
      if (!isObj(root.outline)) {
        err('$.outline', 'wrong-type', `Expected object at $.outline but found ${describe(root.outline)}`);
      } else {
        field(root.outline, 'kind', '$.outline', 'string');
        field(root.outline, 'input', '$.outline', 'string');
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    // ---------- Pass 2: semantic checks on well-typed data ----------
    const m = input as unknown as DiscManifest;

    const uniqueIds = <T>(list: T[], path: string, key: (t: T) => string, label: string) => {
      const seen = new Set<string>();
      list.forEach((t, i) => {
        const id = key(t);
        if (seen.has(id)) {
          err(`${path}[${i}].${label}`, 'duplicate-id', `Duplicate ${label} "${id}"`);
        }
        seen.add(id);
      });
    };

    uniqueIds(m.sections, '$.sections', (s) => s.section_id, 'section_id');
    uniqueIds(m.diagrams, '$.diagrams', (d) => d.diagram_id, 'diagram_id');
    uniqueIds(m.trivia, '$.trivia', (q) => q.question_id, 'question_id');
    uniqueIds(m.dungeons, '$.dungeons', (d) => d.dungeon_id, 'dungeon_id');

    const sectionIds = new Set(m.sections.map((s) => s.section_id));

    m.diagrams.forEach((d, di) => {
      d.hotspots.forEach((h, hi) => {
        const p = `$.diagrams[${di}].hotspots[${hi}]`;
        for (const k of ['x', 'y'] as const) {
          const v = h[k];
          if (!Number.isFinite(v) || v < 0 || v > 100) {
            err(`${p}.${k}`, 'coordinate-range', `Hotspot ${k} must be a finite number within 0..100 at ${p}.${k}`);
          }
        }
        if (!sectionIds.has(h.section_id)) {
          err(`${p}.section_id`, 'dangling-reference', `Hotspot references unknown section_id "${h.section_id}"`);
        }
      });
    });

    m.trivia.forEach((q, qi) => {
      const p = `$.trivia[${qi}]`;
      if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length) {
        err(`${p}.correct_index`, 'index-range', `correct_index ${q.correct_index} is outside 0..${q.options.length - 1}`);
      }
      if (!sectionIds.has(q.section_id)) {
        err(`${p}.section_id`, 'dangling-reference', `Trivia references unknown section_id "${q.section_id}"`);
      }
    });

    m.dungeons.forEach((d: Dungeon, di) => {
      const p = `$.dungeons[${di}]`;
      uniqueIds(d.rooms, `${p}.rooms`, (r) => r.room_id, 'room_id');
      const roomIds = new Set(d.rooms.map((r) => r.room_id));

      const hasEntrance = roomIds.has(ENTRANCE_ROOM_ID);
      const hasThrone = roomIds.has(THRONE_ROOM_ID);
      if (!hasEntrance) err(`${p}.rooms`, 'missing-room', `Dungeon has no "${ENTRANCE_ROOM_ID}" room`);
      if (!hasThrone) err(`${p}.rooms`, 'missing-room', `Dungeon has no "${THRONE_ROOM_ID}" room`);

      d.rooms.forEach((r, ri) => {
        r.exits.forEach((e, ei) => {
          if (!roomIds.has(e.to)) {
            err(`${p}.rooms[${ri}].exits[${ei}].to`, 'dangling-reference', `Exit names unknown room_id "${e.to}"`);
          }
        });
      });

      if (hasEntrance && hasThrone) {
        const result = solveDungeon(d);
        if (result.path.length === 0) {
          err(p, 'unsolvable-dungeon', `No path from "${ENTRANCE_ROOM_ID}" to "${THRONE_ROOM_ID}"`);
        }
        if (result.orphans.length > 0) {
          err(p, 'orphan-room', `Orphan rooms: ${result.orphans.join(', ')}`);
        }
      }
    });

    if (m.media !== undefined) {
      if (m.media.length > MAX_MEDIA) {
        err('$.media', 'unsafe-media', `At most ${MAX_MEDIA} media items are allowed`);
      }
      m.media.forEach((it, i) => {
        const p = `$.media[${i}]`;
        if (safeMediaUrl(it.url) === null) {
          err(`${p}.url`, 'unsafe-media', `Media url must be a public https image address at ${p}.url`);
        }
        if (!isValidCaption(it.caption)) {
          err(`${p}.caption`, 'unsafe-media', `Media caption must be plain, non-empty text at ${p}.caption`);
        }
      });
    }

    if (m.outline !== undefined) {
      if (!OUTLINE_KINDS.includes(m.outline.kind as OutlineKind)) {
        err('$.outline.kind', 'wrong-type', 'Outline kind must be github, webpage, or topic at $.outline.kind');
      }
      const input = m.outline.input;
      if (input.trim() === '' || input.length > MAX_OUTLINE_INPUT || /[\u0000-\u001f\u007f]/.test(input)) {
        err(
          '$.outline.input',
          'wrong-type',
          `Outline input must be plain, non-empty text of at most ${MAX_OUTLINE_INPUT} characters at $.outline.input`,
        );
      }
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, manifest: m };
  } catch (e) {
    // Defensive: the validator must never throw.
    return {
      ok: false,
      errors: [{ path: '$', code: 'wrong-type', message: `Unexpected validation failure: ${String(e)}` }],
    };
  }
}
