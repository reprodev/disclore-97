import type { CSSProperties } from 'react';

export type IconName = 'cd' | 'book' | 'diagram' | 'torch' | 'key' | 'speaker' | 'back' | 'forward' | 'home' | 'castle' | 'computer' | 'notepad';

/** Palette letters used in the pixel maps below. Every color is a shared token. */
const PALETTE: Record<string, string> = {
  k: 'var(--color-bevel-edge)',
  w: 'var(--color-bevel-hi)',
  s: 'var(--color-surface)',
  g: 'var(--color-bevel-shadow)',
  b: 'var(--color-title-bg)',
  y: 'var(--color-gold)',
  Y: 'var(--color-gold-dark)',
  r: 'var(--color-crimson)',
  R: 'var(--color-crimson-dark)',
  F: 'var(--color-flame-hot)',
  f: 'var(--color-flame)',
  W: 'var(--color-wood)',
  a: 'var(--color-sky)',
  G: 'var(--color-forest)',
  p: 'var(--color-parchment)',
  x: 'var(--color-crimson-light)',
  S: 'var(--color-stone)',
  D: 'var(--color-stone-dark)',
  L: 'var(--color-stone-light)',
  T: 'var(--color-crt-bg)',
  P: 'var(--color-phosphor)',
};

const SIZE = 16;

/** Centers a map of any size inside a 16x16 grid. */
function centered(rows: string[]): string[] {
  const top = Math.floor((SIZE - rows.length) / 2);
  const out: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    const src = rows[y - top];
    if (src === undefined) {
      out.push('.'.repeat(SIZE));
      continue;
    }
    const left = Math.floor((SIZE - src.length) / 2);
    out.push(('.'.repeat(left) + src).padEnd(SIZE, '.').slice(0, SIZE));
  }
  return out;
}

/** A round disc drawn from a distance function, so it is symmetrical. */
function cdMap(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 7.4) row += '.';
      else if (d > 6.4) row += 'k';
      else if (d <= 1.7) row += '.';
      else if (d <= 2.9) row += 'g';
      else if (dx + dy < -4) row += 'w';
      else if (dx + dy > 3 && dx + dy < 6) row += 'a';
      else row += 's';
    }
    rows.push(row);
  }
  return rows;
}

const BACK_ARROW = [
  '.....k......',
  '....kk......',
  '...kbk......',
  '..kbbbkkkkkk',
  '.kbbbbbbbbbk',
  'kbbbbbbbbbbk',
  '.kbbbbbbbbbk',
  '..kbbbkkkkkk',
  '...kbk......',
  '....kk......',
  '.....k......',
];

const MAPS: Record<IconName, string[]> = {
  cd: cdMap(),
  castle: centered([
    '.....S.S.S......',
    '.....SSSSSS.....',
    '.S.S.SSSSSS.S.S.',
    '.SSSSSSyySSSSSS.',
    '.SSkSSSSSSSSkSS.',
    '.SSSSSSSSSSSSSS.',
    '.SSSSSSSSSSSSSS.',
    '.SSSSSSSSSSSSSS.',
    '.SSSSSkkkkSSSSS.',
    '.SSSSSkWWkSSSSS.',
    '.SSSSSkWWkSSSSS.',
    '.DDDDDkWWkDDDDD.',
  ]),
  computer: centered([
    '..kkkkkkkkkkkk..',
    '..kssssssssssk..',
    '..kskTTTTTTksk..',
    '..kskTPPPTTksk..',
    '..kskTTTTTTksk..',
    '..kskTPPPPTksk..',
    '..kskTTTTTTksk..',
    '..kskkkkkkkksk..',
    '..kssssssssssk..',
    '..kkkkkkkkkkkk..',
    '....kssssssk....',
    '..kssssssssssk..',
    '..kkkkkkkkkkkk..',
  ]),
  notepad: centered([
    '...kkkkkkkkkk...',
    '...kbbbbbbbbk...',
    '...kwwwwwwwwk...',
    '...kwggggggwk...',
    '...kwwwwwwwwk...',
    '...kwggggggwk...',
    '...kwwwwwwwwk...',
    '...kwgggggwwk...',
    '...kwwwwwwwwk...',
    '...kwggggggwk...',
    '...kwwwwwwwwk...',
    '...kwgggwwwwk...',
    '...kwwwwwwwwk...',
    '...kkkkkkkkkk...',
  ]),
  back: centered(BACK_ARROW),
  forward: centered(BACK_ARROW.map((r) => [...r].reverse().join(''))),
  home: centered([
    '......kk......',
    '.....kRRk.....',
    '....kRRRRk....',
    '...kRRRRRRk...',
    '..kRRRRRRRRk..',
    '.kRRRRRRRRRRk.',
    'kkkkkkkkkkkkkk',
    '.kppppppppppk.',
    '.kppkkkkkkppk.',
    '.kppkWWWWkppk.',
    '.kppkWWWWkppk.',
    '.kppkWWWWkppk.',
    'kkkkkkkkkkkkkk',
  ]),
  book: centered([
    'kkkkkkkkkkkk',
    'kRrrrrrrrrrk',
    'kRrYYYYYYrrk',
    'kRrrrrrrrrrk',
    'kRrYYYYYYYrk',
    'kRrrrrrrrrrk',
    'kRrrrYYrrrrk',
    'kRrrYYYYrrrk',
    'kRrrrYYrrrrk',
    'kRrrrrrrrrrk',
    'kRrrrrrrrrrk',
    'kppppppppppk',
    'kkkkkkkkkkkk',
  ]),
  diagram: centered([
    'kkkkkkkkkkkk',
    'kaaaaaaaaaak',
    'kaaaaaayyaak',
    'kaaaaaayyaak',
    'kaaGaaaaaaak',
    'kaGGGaaGaaak',
    'kGGGGGGGGGak',
    'kGGGGGGGGGGk',
    'kkkkkkkkkkkk',
  ]),
  torch: centered([
    '...FF...',
    '..FFF...',
    '..FffF..',
    '.FffffF.',
    '.FfFFfF.',
    '.FfFFfF.',
    '..FffF..',
    '...ff...',
    '.kyyyyk.',
    '..kYYk..',
    '..kWWk..',
    '..kWWk..',
    '..kWWk..',
    '..kWWk..',
    '..kWWk..',
    '...kk...',
  ]),
  key: centered([
    '.kkkk...........',
    'kyyyyk..........',
    'kyYYyk..........',
    'kyYYykkkkkkkkkk.',
    'kyyyyyyyyyyyyyyk',
    '.kyyykkkkkykkyk.',
    '..kkk.....kk.kk.',
  ]),
  speaker: centered([
    '......k.........',
    '.....kk.........',
    '....kwk....k....',
    'kkkkkwk.....k...',
    'kwwwwsk..k...k..',
    'kwssssk...k..k..',
    'kwssssk...k..k..',
    'kwssssk...k..k..',
    'kwssssk...k..k..',
    'kkkkksk..k...k..',
    '....ksk....k....',
    '.....kk.........',
    '......k.........',
  ]),
};

/** Muted overlay: a crimson cross drawn over the speaker waves. */
const MUTE_CROSS: string[] = [
  '.........x...x..',
  '..........x.x...',
  '...........x....',
  '..........x.x...',
  '.........x...x..',
];

interface Run {
  x: number;
  y: number;
  w: number;
  ch: string;
}

function runs(rows: string[], yOffset = 0): Run[] {
  const out: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === '.' || !(ch in PALETTE)) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      out.push({ x, y: y + yOffset, w, ch });
      x += w;
    }
  });
  return out;
}

export interface PixelIconProps {
  name: IconName;
  /** Rendered size in CSS pixels. Use 16 or 32 for crisp scaling. */
  size?: 16 | 32;
  /** Speaker only: draw the muted cross. */
  muted?: boolean;
  className?: string;
}

/** Pixel-art icon drawn as flat SVG rects on a 16x16 grid. Decorative only. */
export function PixelIcon({ name, size = 16, muted = false, className }: PixelIconProps) {
  const style: CSSProperties = { width: size, height: size };
  const cells = runs(MAPS[name]);
  const cross = name === 'speaker' && muted ? runs(MUTE_CROSS, 4) : [];
  return (
    <svg
      className={className ? `pixel-icon ${className}` : 'pixel-icon'}
      viewBox="0 0 16 16"
      style={style}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    >
      {[...cells, ...cross].map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.w} height={1} fill={PALETTE[c.ch]} />
      ))}
    </svg>
  );
}
