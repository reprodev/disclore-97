import type { Diagram, Hotspot, Section, Shape } from '../manifest';
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

function rect(x: number, y: number, width: number, height: number, fill?: Tok, stroke?: Tok): Shape {
  return {
    kind: 'rect',
    x,
    y,
    width,
    height,
    fill: fill ? tok(fill) : 'none',
    stroke: stroke ? tok(stroke) : 'none',
  };
}

function circle(cx: number, cy: number, r: number, fill?: Tok, stroke?: Tok): Shape {
  return { kind: 'circle', cx, cy, r, fill: fill ? tok(fill) : 'none', stroke: stroke ? tok(stroke) : 'none' };
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: Tok): Shape {
  return { kind: 'line', x1, y1, x2, y2, stroke: tok(stroke) };
}

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
  /** Drawn after the cards (frames, title blocks) so they sit on top. */
  overlay: () => Shape[];
}

const mid = (a: number, b: number): number => Math.round((a + b) / 2);

// ---- github: repository architecture blueprint (module boxes + connectors) ----

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
    const s: Shape[] = [rect(0, 0, 100, 100, 'sky-deep')];
    for (let x = 10; x <= 90; x += 10) s.push(line(x, 16, x, 89, 'sky'));
    for (let y = 26; y <= 86; y += 10) s.push(line(3, y, 97, y, 'sky'));
    // Header band with a repository glyph, footer band for the title block.
    s.push(rect(0, 0, 100, 14, 'ink'), rect(0, 14, 100, 2, 'gold'));
    s.push(rect(4, 4, 6, 6, 'gold', 'gold-dark'), rect(12, 4, 6, 6, 'parchment', 'gold-dark'));
    s.push(rect(22, 5, 34, 2, 'parchment'), rect(22, 9, 22, 2, 'stone-light'));
    s.push(rect(0, 90, 100, 10, 'ink'));
    // Dimension line down the left edge.
    s.push(line(5, 22, 5, 84, 'gold-light'), line(3, 22, 7, 22, 'gold-light'), line(3, 84, 7, 84, 'gold-light'));
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
    return [
      rect(58, 91, 40, 8, 'parchment', 'gold'),
      line(70, 91, 70, 99, 'gold-dark'),
      line(84, 91, 84, 99, 'gold-dark'),
      rect(60, 93, 8, 4, 'gold'),
      rect(72, 93, 10, 2, 'ink'),
      rect(86, 93, 10, 4, 'sky'),
      rect(3, 92, 6, 6, 'gold', 'gold-dark'),
      rect(12, 94, 30, 2, 'sky'),
    ];
  },
};

// ---- webpage: hypertext browser frame with a linked-page node map ----

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
      // Window frame and title bar.
      rect(2, 2, 96, 96, 'stone-light', 'ink'),
      rect(3, 3, 94, 7, 'sky-deep'),
      rect(5, 5, 24, 3, 'parchment'),
      rect(76, 4, 5, 5, 'stone-light', 'ink'),
      rect(82, 4, 5, 5, 'stone-light', 'ink'),
      rect(88, 4, 5, 5, 'crimson-light', 'ink'),
      // Toolbar with navigation buttons and an address field.
      rect(3, 11, 94, 8, 'stone-light', 'parchment-dark'),
      rect(5, 12, 5, 6, 'parchment', 'ink'),
      rect(11, 12, 5, 6, 'parchment', 'ink'),
      rect(18, 12, 62, 6, 'parchment', 'ink'),
      rect(20, 14, 26, 2, 'sky-deep'),
      rect(82, 12, 13, 6, 'gold-light', 'ink'),
      // Page area and scroll bar.
      rect(4, 21, 87, 69, 'parchment', 'ink'),
      rect(92, 21, 5, 69, 'stone-light', 'ink'),
      rect(92, 26, 5, 18, 'gold', 'ink'),
      // Status bar with a load meter.
      rect(3, 92, 94, 6, 'stone-light', 'parchment-dark'),
      rect(5, 94, 34, 2, 'forest-light'),
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
      line(x + 2, cy + 3, x + 11, cy + 3, 'sky-deep'),
      line(x + 2, cy + 5, x + 16, cy + 5, 'ink'),
      circle(cx, cy, 2.5, 'gold', 'gold-dark'),
    ];
  },
  overlay() {
    return [];
  },
};

// ---- markdown: encyclopedia outline chart (ruled page, heading tree) ----

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
    const s: Shape[] = [rect(0, 0, 100, 100, 'parchment')];
    // Ruled paper with a margin rule.
    for (let y = 22; y <= 86; y += 6) s.push(line(5, y, 95, y, 'parchment-dark'));
    s.push(line(9, 17, 9, 89, 'crimson-light'));
    // Header band: a heading glyph and two text rules.
    s.push(rect(0, 0, 100, 14, 'sky-deep'), rect(0, 14, 100, 1, 'gold-dark'));
    s.push(rect(4, 3, 8, 8, 'gold', 'gold-dark'), rect(16, 5, 30, 2, 'parchment'), rect(16, 9, 20, 2, 'parchment-dark'));
    s.push(rect(0, 90, 100, 10, 'parchment-dark'));
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
    // Double rule frame, drawn last so it sits over the page edges.
    return [
      rect(2, 16, 96, 73, undefined, 'gold-dark'),
      rect(4, 18, 92, 69, undefined, 'ink'),
      rect(2, 16, 4, 4, 'gold-dark'),
      rect(94, 16, 4, 4, 'gold-dark'),
      rect(2, 85, 4, 4, 'gold-dark'),
      rect(94, 85, 4, 4, 'gold-dark'),
    ];
  },
};

// ---- topic: encyclopedia concept chart (hub, rings, spokes) ----

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
    return [
      rect(0, 0, 100, 100, 'parchment'),
      // Header band and plate frame.
      rect(0, 0, 100, 14, 'sky-deep'),
      rect(0, 14, 100, 1, 'gold-dark'),
      rect(6, 4, 24, 3, 'parchment'),
      rect(6, 9, 14, 2, 'parchment-dark'),
      circle(90, 7, 4, 'gold', 'gold-dark'),
      rect(0, 90, 100, 10, 'parchment-dark'),
      // Concentric rings and a crosshair behind the hub.
      circle(50, 52, 34, undefined, 'parchment-dark'),
      circle(50, 52, 22, undefined, 'parchment-dark'),
      line(50, 17, 50, 88, 'parchment-dark'),
      line(6, 52, 94, 52, 'parchment-dark'),
      // Scale bar in the footer.
      line(6, 95, 36, 95, 'ink'),
      rect(6, 93, 10, 2, 'ink'),
      rect(16, 93, 10, 2, 'parchment'),
      rect(26, 93, 10, 2, 'ink'),
      rect(60, 93, 6, 5, 'wood-light', 'ink'),
      rect(68, 91, 6, 7, 'forest-light', 'ink'),
      rect(76, 94, 6, 4, 'gold', 'ink'),
      rect(84, 92, 6, 6, 'crimson-light', 'ink'),
    ];
  },
  links(a, b) {
    // Spokes run from the hub; ring edges between neighbors are drawn as faint chords.
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
      circle(50, 52, 10, 'gold-light', 'gold-dark'),
      circle(50, 52, 6, 'gold', 'ink'),
      circle(50, 52, 2, 'ink'),
      rect(2, 16, 96, 73, undefined, 'wood-light'),
    ];
  },
};

const SCENES: Record<SourceKind, Scene> = {
  github: githubScene,
  webpage: webpageScene,
  markdown: markdownScene,
  topic: topicScene,
  // A stitched disc is a set of related articles from several sources: the concept chart fits it.
  stitched: topicScene,
};

/**
 * Builds the single diagram `diagram-1`. `rng` is the `'diagram'` stream.
 * `kind` picks the scene: a repository blueprint, a browser site map, a markdown
 * outline, or a topic concept chart. Unknown kinds use the topic scene.
 * `sections` must be non-empty.
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
    // Spokes run from the hub at (50, 52) to every node, under the ring chords.
    for (const p of nodes) shapes.push(line(50, 52, p.cx, p.cy, 'ink'));
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
