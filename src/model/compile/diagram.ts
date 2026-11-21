import type { Diagram, Hotspot, Section, Shape } from '../manifest';
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

const MAX_NODES = 8;
const LABEL_MAX = 40;
const CARD_FILLS = ['sky', 'forest-light', 'gold-light', 'crimson-light', 'wood-light', 'stone-light'];

function tok(name: string): string {
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

/**
 * Builds the single diagram `diagram-1`. `rng` is the `'diagram'` stream.
 * `sections` must be non-empty.
 */
export function buildDiagram(sections: readonly Section[], discTitle: string, rng: () => number): Diagram {
  const n = sections.length;
  const k = Math.min(n, MAX_NODES);

  const nodes: { cx: number; cy: number }[] = [];
  for (let i = 0; i < k; i++) {
    const j = jitter(rng);
    const jy = jitter(rng);
    nodes.push({ cx: 18 + (i % 3) * 32 + j, cy: 30 + Math.floor(i / 3) * 24 + jy });
  }

  const shapes: Shape[] = [
    { kind: 'rect', x: 0, y: 0, width: 100, height: 100, fill: tok('parchment'), stroke: 'none' },
    { kind: 'rect', x: 0, y: 0, width: 100, height: 14, fill: tok('sky-deep'), stroke: 'none' },
    { kind: 'rect', x: 0, y: 90, width: 100, height: 10, fill: tok('parchment-dark'), stroke: 'none' },
  ];

  for (let i = 1; i < k; i++) {
    shapes.push({
      kind: 'line',
      x1: nodes[i - 1].cx,
      y1: nodes[i - 1].cy,
      x2: nodes[i].cx,
      y2: nodes[i].cy,
      stroke: tok('ink'),
    });
  }

  nodes.forEach(({ cx, cy }, i) => {
    shapes.push({
      kind: 'rect',
      x: cx - 10,
      y: cy - 7,
      width: 20,
      height: 14,
      fill: tok(CARD_FILLS[i % CARD_FILLS.length]),
      stroke: tok('ink'),
    });
    shapes.push({ kind: 'circle', cx, cy, r: 2.5, fill: tok('gold'), stroke: tok('gold-dark') });
  });

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
    title: `Map of ${discTitle}`,
    viewBox: '0 0 100 100',
    shapes,
    hotspots,
  };
}
