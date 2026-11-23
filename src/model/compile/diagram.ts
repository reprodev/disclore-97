import type { Diagram, Hotspot, Section, Shape, ShapeAnim } from '../manifest';
import type { SourceKind } from '../source';
import { truncate } from './text';

/** The `--color-*` custom properties compiled shapes may use. Each is defined in tokens.css. */
export const ALLOWED_TOKENS: readonly string[] = [
  '--color-parchment',
  '--color-parchment-dark',
  '--color-sky-deep',
  '--color-ink',
  '--color-gold',
  '--color-gold-dark',
  '--color-sky',
  '--color-forest-light',
  '--color-gold-light',
  '--color-crimson-light',
  '--color-wood-light',
  '--color-stone-light',
];

/** Color names behind ALLOWED_TOKENS. The type keeps every scene below inside the list. */
type Tok =
  | 'parchment'
  | 'parchment-dark'
  | 'sky-deep'
  | 'ink'
  | 'gold'
  | 'gold-dark'
  | 'sky'
  | 'forest-light'
  | 'gold-light'
  | 'crimson-light'
  | 'wood-light'
  | 'stone-light';

const MAX_NODES = 8;
const LABEL_MAX = 40;
const CARD_FILLS: readonly Tok[] = ['sky', 'forest-light', 'gold-light', 'crimson-light', 'wood-light', 'stone-light'];

const CARD_W = 20;
const CARD_H = 14;

function tok(name: Tok): string {
  return `var(--color-${name})`;
}

/** Integer in [-3, 3] from a [0, 1) generator. */
function jitter(rng: () => number): number {
  return Math.floor(rng() * 7) - 3;
}

/** Hotspot target: node `i` cites `sections[i % N]`. */
export function hotspotSectionIndex(i: number, n: number): number {
  return i % n;
}

// ---- Shape helpers. Optional paint fields are omitted, never undefined. ----

function rect(x: number, y: number, width: number, height: number, fill?: Tok, stroke?: Tok, anim?: ShapeAnim): Shape {
  return {
    kind: 'rect',
    x,
    y,
    width,
    height,
    fill: fill ? tok(fill) : 'none',
    stroke: stroke ? tok(stroke) : 'none',
    ...(anim ? { anim } : {}),
  };
}

function circle(cx: number, cy: number, r: number, fill?: Tok, stroke?: Tok, anim?: ShapeAnim): Shape {
  return {
    kind: 'circle',
    cx,
    cy,
    r,
    fill: fill ? tok(fill) : 'none',
    stroke: stroke ? tok(stroke) : 'none',
    ...(anim ? { anim } : {}),
  };
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: Tok, anim?: ShapeAnim): Shape {
  return { kind: 'line', x1, y1, x2, y2, stroke: tok(stroke), ...(anim ? { anim } : {}) };
}

/** Rounds to one decimal place, so computed points stay short and identical on every run. */
const r1 = (n: number): number => Math.round(n * 10) / 10;

function polygon(points: readonly (readonly [number, number])[], fill?: Tok, stroke?: Tok, anim?: ShapeAnim): Shape {
  return {
    kind: 'polygon',
    points: points.map(([x, y]) => [r1(x), r1(y)] as [number, number]),
    fill: fill ? tok(fill) : 'none',
    stroke: stroke ? tok(stroke) : 'none',
    ...(anim ? { anim } : {}),
  };
}

/** An open polyline. The manifest has no polyline shape, so it is drawn as joined line segments. */
function polyline(points: readonly (readonly [number, number])[], stroke: Tok, anim?: ShapeAnim): Shape[] {
  const out: Shape[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    out.push(line(r1(x1), r1(y1), r1(x2), r1(y2), stroke, anim));
  }
  return out;
}

/** Points on an ellipse centred on (cx, cy), tilted by `tilt` radians, from angle a0 to a1 in `steps` steps. */
function ellipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tilt: number,
  a0: number,
  a1: number,
  steps: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return pts;
}

/** A star with `points` tips, alternating outer and inner radius. The first tip points up, turned by `turn` radians. */
function star(cx: number, cy: number, outer: number, inner: number, points: number, turn = 0): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + turn + (i * Math.PI) / points;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** A four-point twinkle. */
const twinkle = (cx: number, cy: number, r: number, anim?: ShapeAnim): Shape =>
  polygon(star(cx, cy, r, r / 3, 4), 'gold-light', undefined, anim);

interface Pt {
  cx: number;
  cy: number;
}

type Edge = readonly [number, number];

/** Everything a scene needs: its backdrop, its connectors, and how one node card looks. */
interface Scene {
  title: (discTitle: string) => string;
  slots: readonly (readonly [number, number])[];
  edges: readonly Edge[];
  backdrop: () => Shape[];
  links: (a: Pt, b: Pt) => Shape[];
  card: (p: Pt, i: number) => Shape[];
  /** Drawn after the cards (frames, hubs, accents) so they sit on top. Kept clear of the pins. */
  overlay: () => Shape[];
}

const mid = (a: number, b: number): number => Math.round((a + b) / 2);

// ---- github: a retro CRT workstation showing the repository blueprint, beside a server rack ----

const GITHUB_STRIPS: readonly Tok[] = ['gold', 'forest-light', 'crimson-light', 'sky', 'gold-light', 'stone-light'];

const githubScene: Scene = {
  title: (t) => `Architecture Blueprint of ${t}`,
  slots: [
    [50, 25],
    [22, 44],
    [50, 44],
    [78, 44],
    [22, 63],
    [50, 63],
    [78, 63],
    [50, 81],
  ],
  edges: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 6],
    [5, 7],
  ],
  backdrop() {
    // The monitor: a beige bezel round a dark blueprint screen.
    const s: Shape[] = [rect(0, 0, 100, 100, 'stone-light'), rect(2, 2, 96, 86, 'ink'), rect(3, 3, 94, 84, 'sky-deep')];
    for (let x = 13; x <= 83; x += 10) s.push(line(x, 16, x, 86, 'sky'));
    for (let y = 26; y <= 86; y += 10) s.push(line(4, y, 86, y, 'sky'));
    // A DOS-style prompt along the top of the screen, with a blinking cursor.
    s.push(rect(3, 3, 94, 11, 'ink'), rect(3, 14, 94, 1, 'gold'));
    s.push(rect(6, 6, 8, 2, 'forest-light'), rect(16, 6, 24, 2, 'parchment'), rect(16, 10, 16, 2, 'stone-light'));
    s.push(rect(42, 6, 3, 2, 'forest-light', undefined, 'blink'));
    // Circuit traces down the left margin, with gold vias.
    s.push(...polyline([[5, 18], [5, 34], [8, 37], [8, 54], [5, 57], [5, 84]], 'gold-dark'));
    s.push(...polyline([[9, 20], [9, 28], [11, 30], [11, 70], [9, 72], [9, 84]], 'gold-dark'));
    for (const [x, y] of [[5, 18], [8, 37], [5, 57], [9, 28], [11, 70], [5, 84], [9, 84]] as const) {
      s.push(circle(x, y, 1, 'gold', 'gold-dark'));
    }
    // A server rack at the right edge: four units, each with a status light.
    s.push(rect(89, 17, 7, 68, 'ink', 'stone-light'));
    for (let u = 0; u < 4; u++) {
      const y = 20 + u * 16;
      s.push(rect(90, y, 5, 13, 'sky-deep', 'stone-light'));
      s.push(line(90.5, y + 4, 94.5, y + 4, 'stone-light'), line(90.5, y + 7, 94.5, y + 7, 'stone-light'));
      const led: Tok = u % 3 === 0 ? 'forest-light' : u % 3 === 1 ? 'gold-light' : 'crimson-light';
      s.push(rect(91, y + 10, 2, 2, led, undefined, u % 2 === 0 ? 'blink' : undefined));
    }
    // The stand and the keyboard below the screen.
    s.push(rect(36, 88, 28, 3, 'parchment-dark', 'ink'));
    s.push(rect(6, 92, 88, 7, 'parchment', 'ink'));
    for (let k = 0; k < 10; k++) s.push(rect(9 + k * 8, 93.5, 6, 1.5, 'stone-light', 'ink'));
    s.push(rect(22, 96, 56, 1.5, 'stone-light', 'ink'));
    return s;
  },
  links(a, b) {
    // Elbow connector: down from the parent, across a bus, down into the child.
    const y1 = a.cy + CARD_H / 2;
    const y2 = b.cy - CARD_H / 2;
    const bus = mid(y1, y2);
    return [
      line(a.cx, y1, a.cx, bus, 'parchment'),
      line(a.cx, bus, b.cx, bus, 'parchment'),
      line(b.cx, bus, b.cx, y2, 'parchment'),
      rect(b.cx - 1, y2 - 1, 2, 2, 'gold'),
    ];
  },
  card({ cx, cy }, i) {
    const x = cx - CARD_W / 2;
    const y = cy - CARD_H / 2;
    return [
      rect(x, y, CARD_W, CARD_H, 'parchment', 'ink'),
      rect(x, y, CARD_W, 3, GITHUB_STRIPS[i % GITHUB_STRIPS.length], 'ink'),
      line(x + 2, cy + 1, x + 12, cy + 1, 'gold-dark'),
      line(x + 2, cy + 4, x + 16, cy + 4, 'gold-dark'),
      circle(cx, cy, 2.5, 'gold', 'gold-dark'),
    ];
  },
  overlay() {
    // The power light on the bezel, blinking like a busy drive.
    return [rect(88, 89, 4, 1.5, 'ink'), circle(94, 89.8, 1.2, 'forest-light', 'ink', 'blink')];
  },
};

// ---- webpage: a 1997 browser window with a hypertext page map ----

const webpageScene: Scene = {
  title: (t) => `Site Map of ${t}`,
  slots: [
    [48, 34],
    [20, 31],
    [76, 31],
    [20, 57],
    [48, 60],
    [76, 57],
    [30, 80],
    [66, 80],
  ],
  edges: [
    [0, 1],
    [0, 2],
    [0, 4],
    [1, 3],
    [2, 5],
    [3, 4],
    [4, 5],
    [4, 6],
    [4, 7],
    [6, 7],
  ],
  backdrop() {
    return [
      rect(0, 0, 100, 100, 'stone-light'),
      // Window frame and title bar, with a page glyph and the title text.
      rect(2, 2, 96, 96, 'stone-light', 'ink'),
      rect(3, 3, 94, 7, 'sky-deep'),
      polygon([[5, 4], [8, 4], [9, 5], [9, 9], [5, 9]], 'parchment', 'ink'),
      rect(11, 5, 22, 3, 'parchment'),
      // Minimize, maximize, and close, each with its glyph.
      rect(76, 4, 5, 5, 'stone-light', 'ink'),
      line(77, 7.5, 80, 7.5, 'ink'),
      rect(82, 4, 5, 5, 'stone-light', 'ink'),
      rect(83, 5, 3, 3, undefined, 'ink'),
      rect(88, 4, 5, 5, 'crimson-light', 'ink'),
      line(89, 5, 92, 8, 'ink'),
      line(92, 5, 89, 8, 'ink'),
      // Toolbar: back and forward, the address bar, and the spinning globe.
      rect(3, 11, 94, 8, 'stone-light', 'parchment-dark'),
      rect(5, 12, 5, 6, 'parchment', 'ink'),
      polygon([[9, 13], [6, 15], [9, 17]], 'sky-deep'),
      rect(11, 12, 5, 6, 'parchment', 'ink'),
      polygon([[12, 13], [15, 15], [12, 17]], 'sky-deep'),
      rect(18, 12, 62, 6, 'parchment', 'ink'),
      rect(19, 13.5, 4, 3, 'gold'),
      rect(25, 14, 26, 2, 'sky-deep'),
      rect(82, 12, 13, 6, 'gold-light', 'ink'),
      circle(88.5, 15, 2.6, 'sky', 'ink'),
      line(85.9, 15, 91.1, 15, 'ink'),
      ...polyline(ellipsePoints(88.5, 15, 1.2, 2.6, 0, -Math.PI / 2, Math.PI / 2, 6), 'ink'),
      ...polyline(ellipsePoints(88.5, 15, 1.2, 2.6, 0, Math.PI / 2, (3 * Math.PI) / 2, 6), 'ink'),
      // Page area, a faint hypertext globe in the corner, and the scroll bar.
      rect(4, 21, 87, 69, 'parchment', 'ink'),
      circle(84, 82, 6, undefined, 'parchment-dark'),
      line(78, 82, 90, 82, 'parchment-dark'),
      ...polyline(ellipsePoints(84, 82, 3, 6, 0, -Math.PI / 2, Math.PI / 2, 6), 'parchment-dark'),
      rect(92, 21, 5, 69, 'stone-light', 'ink'),
      rect(92, 21, 5, 4, 'parchment', 'ink'),
      rect(92, 86, 5, 4, 'parchment', 'ink'),
      rect(92, 28, 5, 16, 'gold', 'ink'),
      // Status bar: the load meter.
      rect(3, 92, 94, 6, 'stone-light', 'parchment-dark'),
      rect(5, 94, 34, 2, 'forest-light'),
      rect(42, 94, 40, 2, 'parchment-dark'),
    ];
  },
  links(a, b) {
    return [line(a.cx, a.cy, b.cx, b.cy, 'sky-deep'), circle(mid(a.cx, b.cx), mid(a.cy, b.cy), 1.2, 'gold', 'ink')];
  },
  card({ cx, cy }, i) {
    const x = cx - CARD_W / 2;
    const y = cy - CARD_H / 2;
    return [
      rect(x, y, CARD_W, CARD_H, CARD_FILLS[i % CARD_FILLS.length], 'ink'),
      rect(x, y, CARD_W, 3, 'sky-deep', 'ink'),
      // A folded page corner.
      polygon([[x + CARD_W - 4, y + CARD_H], [x + CARD_W, y + CARD_H - 4], [x + CARD_W, y + CARD_H]], 'parchment-dark', 'ink'),
      line(x + 2, cy + 3, x + 11, cy + 3, 'sky-deep'),
      line(x + 2, cy + 5, x + 14, cy + 5, 'ink'),
      circle(cx, cy, 2.5, 'gold', 'gold-dark'),
    ];
  },
  overlay() {
    // The connection light in the status bar, and a glint on the spinning globe.
    return [rect(88, 93.5, 6, 3, 'gold-light', 'ink', 'glint'), twinkle(86.5, 13.5, 1.6, 'glint')];
  },
};

// ---- markdown: an open leather-bound folio under a desk lamp ----

const OUTLINE_FILLS: readonly Tok[] = ['gold-light', 'parchment', 'stone-light'];

function outlineDepth(i: number): number {
  return i === 0 ? 0 : i < 4 ? 1 : 2;
}

const markdownScene: Scene = {
  title: (t) => `Outline of ${t}`,
  slots: [
    [22, 26],
    [46, 38],
    [46, 56],
    [46, 74],
    [74, 30],
    [74, 47],
    [74, 64],
    [74, 81],
  ],
  edges: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
  backdrop() {
    const s: Shape[] = [
      // The desk, and the leather cover showing round the pages.
      rect(0, 0, 100, 100, 'wood-light'),
      rect(0, 0, 100, 13, 'gold-dark'),
      rect(4, 4, 30, 2, 'parchment'),
      rect(4, 8, 20, 2, 'parchment-dark'),
      rect(2, 15, 96, 81, 'crimson-light', 'ink'),
      rect(3.5, 16.5, 93, 78, undefined, 'gold'),
      // Two ruled parchment pages that dip into the spine.
      polygon([[6, 18], [48, 20], [48, 92], [6, 90]], 'parchment', 'ink'),
      polygon([[52, 20], [94, 18], [94, 90], [52, 92]], 'parchment', 'ink'),
      rect(48, 18, 4, 75, 'gold-dark', 'ink'),
      line(50, 19, 50, 92, 'ink'),
    ];
    for (let y = 26; y <= 86; y += 6) {
      s.push(line(8, y, 46, y + 1, 'parchment-dark'));
      s.push(line(54, y + 1, 92, y, 'parchment-dark'));
    }
    s.push(line(12, 19, 12, 89, 'crimson-light'));
    // The bookmark ribbon, from the head of the spine past the foot of the book, under the cards.
    s.push(polygon([[53, 15], [57, 15], [57, 98], [55, 95.5], [53, 98]], 'crimson-light', 'ink'));
    // The desk lamp: a stand, an arm, a gold shade, and a flickering bulb.
    s.push(rect(82, 10, 12, 2, 'ink'), line(88, 10, 84, 5, 'ink'), line(84, 5, 90, 2, 'ink'));
    s.push(polygon([[86, 1], [96, 1], [98, 6], [84, 6]], 'gold', 'ink'));
    s.push(circle(91, 7.5, 1.6, 'gold-light', 'gold-dark', 'flicker'));
    return s;
  },
  links(a, b) {
    return [line(a.cx + CARD_W / 2, a.cy, b.cx - CARD_W / 2, b.cy, 'ink')];
  },
  card({ cx, cy }, i) {
    const x = cx - CARD_W / 2;
    const y = cy - CARD_H / 2;
    const depth = outlineDepth(i);
    return [
      rect(x, y, CARD_W, CARD_H, OUTLINE_FILLS[depth], 'ink'),
      rect(x + 2, y + 2, 3, 3, depth === 0 ? 'crimson-light' : depth === 1 ? 'sky-deep' : 'forest-light'),
      line(x + 7, y + 3.5, x + 18, y + 3.5, 'ink'),
      line(x + 2, y + 9, x + 15 - depth * 2, y + 9, 'gold-dark'),
      circle(cx, cy, 2.5, 'gold', 'gold-dark'),
    ];
  },
  overlay() {
    // Brass corner guards on the cover.
    return [
      polygon([[2, 15], [8, 15], [2, 21]], 'gold', 'ink'),
      polygon([[92, 15], [98, 15], [98, 21]], 'gold', 'ink'),
      polygon([[2, 90], [2, 96], [8, 96]], 'gold', 'ink'),
      polygon([[98, 90], [98, 96], [92, 96]], 'gold', 'ink'),
    ];
  },
};

// ---- topic: an Encarta atlas plate, a ringed celestial globe in a double cartouche ----

/** Centre of the topic scene's globe, and of its compass rose hub. */
const HUB = { x: 50, y: 52 } as const;
const GLOBE_R = 30;

const topicScene: Scene = {
  title: (t) => `Concept Chart of ${t}`,
  slots: [
    [50, 26],
    [76, 34],
    [86, 52],
    [76, 70],
    [50, 78],
    [24, 70],
    [14, 52],
    [24, 34],
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 0],
  ],
  backdrop() {
    const s: Shape[] = [
      rect(0, 0, 100, 100, 'parchment'),
      // The cartouche: a title band with scrolled ends.
      rect(14, 4, 72, 10, 'parchment-dark', 'gold-dark'),
      polygon([[14, 4], [9, 9], [14, 14]], 'gold-dark'),
      polygon([[86, 4], [91, 9], [86, 14]], 'gold-dark'),
      rect(20, 6.5, 40, 2.5, 'ink'),
      rect(20, 10.5, 24, 1.5, 'gold-dark'),
      // The far half of the orrery ring, behind the globe.
      ...polyline(ellipsePoints(HUB.x, HUB.y, 40, 8, -0.32, Math.PI, 2 * Math.PI, 16), 'gold-dark'),
      circle(HUB.x, HUB.y, GLOBE_R, 'sky', 'sky-deep'),
    ];
    // Latitude lines (chords of the globe) and longitude arcs.
    for (const dy of [-20, -10, 0, 10, 20]) {
      const hw = Math.sqrt(GLOBE_R * GLOBE_R - dy * dy);
      s.push(line(r1(HUB.x - hw), HUB.y + dy, r1(HUB.x + hw), HUB.y + dy, 'sky-deep'));
    }
    for (const rx of [10, 20]) {
      s.push(...polyline(ellipsePoints(HUB.x, HUB.y, rx, GLOBE_R, 0, -Math.PI / 2, Math.PI / 2, 10), 'sky-deep'));
      s.push(...polyline(ellipsePoints(HUB.x, HUB.y, rx, GLOBE_R, 0, Math.PI / 2, (3 * Math.PI) / 2, 10), 'sky-deep'));
    }
    s.push(line(HUB.x, HUB.y - GLOBE_R, HUB.x, HUB.y + GLOBE_R, 'sky-deep'));
    // The near half of the ring, over the globe.
    s.push(...polyline(ellipsePoints(HUB.x, HUB.y, 40, 8, -0.32, 0, Math.PI, 16), 'gold'));
    // A scale bar and a key strip in the footer.
    s.push(line(8, 93, 38, 93, 'ink'), rect(8, 91, 10, 2, 'ink'), rect(18, 91, 10, 2, 'parchment'), rect(28, 91, 10, 2, 'ink'));
    s.push(rect(62, 90, 6, 5, 'wood-light', 'ink'), rect(70, 89, 6, 6, 'forest-light', 'ink'), rect(78, 91, 6, 4, 'gold', 'ink'));
    return s;
  },
  links(a, b) {
    // Ring edges between neighbouring nodes, drawn as faint chords.
    return [line(a.cx, a.cy, b.cx, b.cy, 'parchment-dark')];
  },
  card({ cx, cy }, i) {
    const x = cx - CARD_W / 2;
    const y = cy - CARD_H / 2;
    return [
      rect(x, y, CARD_W, CARD_H, CARD_FILLS[i % CARD_FILLS.length], 'ink'),
      rect(x, y, 3, CARD_H, 'gold-dark', 'ink'),
      line(x + 6, y + 4, x + 17, y + 4, 'ink'),
      line(x + 6, y + 10, x + 14, y + 10, 'gold-dark'),
      circle(cx, cy, 2.5, 'gold', 'gold-dark'),
    ];
  },
  overlay() {
    return [
      // The 8-point compass rose at the hub: short ordinal points under long cardinal ones.
      polygon(star(HUB.x, HUB.y, 6, 2.4, 4, Math.PI / 4), 'gold', 'ink'),
      polygon(star(HUB.x, HUB.y, 9, 2, 4), 'gold-light', 'ink'),
      circle(HUB.x, HUB.y, 1.6, 'ink'),
      // Glinting stars in the four corners of the plate.
      twinkle(8, 22, 2.4, 'glint'),
      twinkle(92, 22, 2.4, 'glint'),
      twinkle(8, 84, 2, 'glint'),
      twinkle(92, 84, 2, 'glint'),
      // The double cartouche border, drawn last so it frames everything.
      rect(1, 1, 98, 98, undefined, 'gold-dark'),
      rect(3, 3, 94, 94, undefined, 'ink'),
      polygon([[1, 1], [6, 1], [1, 6]], 'gold-dark'),
      polygon([[99, 1], [94, 1], [99, 6]], 'gold-dark'),
      polygon([[1, 99], [6, 99], [1, 94]], 'gold-dark'),
      polygon([[99, 99], [94, 99], [99, 94]], 'gold-dark'),
    ];
  },
};

const SCENES: Record<SourceKind, Scene> = {
  github: githubScene,
  webpage: webpageScene,
  markdown: markdownScene,
  topic: topicScene,
};

/** The scene layouts, for tests that check pins stay in bounds and apart. */
export const SCENE_SLOTS: Readonly<Record<SourceKind, readonly (readonly [number, number])[]>> = {
  github: githubScene.slots,
  webpage: webpageScene.slots,
  markdown: markdownScene.slots,
  topic: topicScene.slots,
};

/**
 * Builds the single diagram `diagram-1`. `rng` is the `'diagram'` stream.
 * `kind` picks the scene: a CRT workstation blueprint for a repository, a 1997 browser window for a
 * web page, an open folio for Markdown, or an atlas plate with a celestial globe for a topic.
 * Unknown kinds use the topic scene. `sections` must be non-empty.
 */
export function buildDiagram(
  sections: readonly Section[],
  discTitle: string,
  rng: () => number,
  kind: SourceKind = 'topic',
): Diagram {
  const scene = SCENES[kind] ?? topicScene;
  const n = sections.length;
  const k = Math.min(n, MAX_NODES);

  const nodes: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const j = jitter(rng);
    const jy = Math.trunc(jitter(rng) / 2);
    const [sx, sy] = scene.slots[i];
    nodes.push({ cx: sx + j, cy: sy + jy });
  }

  const shapes: Shape[] = [...scene.backdrop()];

  if (scene === topicScene) {
    // Spokes run from the hub to every node, under the ring chords.
    for (const p of nodes) shapes.push(line(HUB.x, HUB.y, p.cx, p.cy, 'ink'));
  }
  for (const [a, b] of scene.edges) {
    if (a < k && b < k) shapes.push(...scene.links(nodes[a], nodes[b]));
  }
  nodes.forEach((p, i) => shapes.push(...scene.card(p, i)));
  shapes.push(...scene.overlay());

  const hotspots: Hotspot[] = nodes.map(({ cx, cy }, i) => {
    const section = sections[hotspotSectionIndex(i, n)];
    return {
      label: truncate(section.title, LABEL_MAX) || `Section ${i + 1}`,
      x: cx,
      y: cy,
      section_id: section.section_id,
    };
  });

  return {
    diagram_id: 'diagram-1',
    title: scene.title(discTitle),
    viewBox: '0 0 100 100',
    shapes,
    hotspots,
  };
}
