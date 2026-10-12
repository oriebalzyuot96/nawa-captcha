import type { Pt, Raster, RGB } from './raster.js';
import { ICON_KINDS, iconPolygon, type IconKind } from './shapes.js';

/*
 * A small pictogram library drawn with the software rasterizer. Every pictogram is a list of ops
 * in a unit box centred on 0,0 (nominal size 1). Ops tagged `accent` are drawn in a second colour
 * (details such as wheels or a leaf vein); in silhouette mode everything is one colour, so the
 * outline is identical to the coloured version (what the shadow puzzles rely on).
 */

type Op =
  | { readonly k: 'rings'; readonly rings: readonly (readonly Pt[])[]; readonly accent?: boolean }
  | { readonly k: 'circle'; readonly x: number; readonly y: number; readonly r: number; readonly accent?: boolean }
  | { readonly k: 'line'; readonly pts: readonly Pt[]; readonly w: number; readonly accent?: boolean };

const ring = (cx: number, cy: number, r: number, n = 40, ry = r): Pt[] =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * ry] as const);
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const poly = (...pts: Pt[]): Op => ({ k: 'rings', rings: [pts] });

function geometric(kind: IconKind): Op[] {
  return [{ k: 'rings', rings: [iconPolygon(kind, 0, 0, 1)] }];
}

function leafRing(ax: number, ay: number, bx: number, by: number, w: number): Pt[] {
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const o = Math.sin(t * Math.PI) * w;
    pts.push([ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]);
  }
  for (let i = 15; i > 0; i -= 1) {
    const t = i / 16;
    const o = Math.sin(t * Math.PI) * w;
    pts.push([ax + (bx - ax) * t - nx * o, ay + (by - ay) * t - ny * o]);
  }
  return pts;
}

const PICTOS = {
  sun: (): Op[] => [
    { k: 'circle', x: 0, y: 0, r: 0.22 },
    ...Array.from({ length: 8 }, (_, i): Op => {
      const a = (i / 8) * Math.PI * 2;
      return { k: 'line', pts: [[Math.cos(a) * 0.31, Math.sin(a) * 0.31], [Math.cos(a) * 0.47, Math.sin(a) * 0.47]], w: 0.08 };
    }),
  ],
  cloud: (): Op[] => [
    { k: 'circle', x: -0.2, y: 0.06, r: 0.17 },
    { k: 'circle', x: 0.0, y: -0.07, r: 0.23 },
    { k: 'circle', x: 0.22, y: 0.06, r: 0.16 },
    { k: 'rings', rings: [rect(-0.2, 0.04, 0.22, 0.23)] },
  ],
  drop: (): Op[] => [{ k: 'circle', x: 0, y: 0.13, r: 0.27 }, poly([0, -0.48], [-0.235, 0.0], [0.235, 0.0])],
  bolt: (): Op[] => [poly([0.12, -0.5], [-0.26, 0.06], [-0.02, 0.06], [-0.14, 0.5], [0.27, -0.1], [0.03, -0.1], [0.17, -0.5])],
  snowflake: (): Op[] =>
    [0, 60, 120].flatMap((deg): Op[] => {
      const a = (deg * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const arm: Op = { k: 'line', pts: [[-c * 0.46, -s * 0.46], [c * 0.46, s * 0.46]], w: 0.07 };
      const twigs = [1, -1].flatMap((dir): Op[] => {
        const bx = c * 0.28 * dir;
        const by = s * 0.28 * dir;
        const b1 = a + (dir > 0 ? 0 : Math.PI) + 0.7;
        const b2 = a + (dir > 0 ? 0 : Math.PI) - 0.7;
        return [
          { k: 'line', pts: [[bx, by], [bx + Math.cos(b1) * 0.15, by + Math.sin(b1) * 0.15]], w: 0.055 },
          { k: 'line', pts: [[bx, by], [bx + Math.cos(b2) * 0.15, by + Math.sin(b2) * 0.15]], w: 0.055 },
        ];
      });
      return [arm, ...twigs];
    }),
  umbrella: (): Op[] => [
    {
      k: 'rings',
      rings: [
        [
          ...Array.from({ length: 21 }, (_, i): Pt => [Math.cos(Math.PI + (i / 20) * Math.PI) * 0.46, Math.sin(Math.PI + (i / 20) * Math.PI) * 0.4 + 0.02]),
          [0.31, 0.06], [0.155, 0.0], [0, 0.06], [-0.155, 0.0], [-0.31, 0.06],
        ],
      ],
    },
    { k: 'line', pts: [[0, 0.02], [0, 0.36], [-0.03, 0.43], [-0.1, 0.45], [-0.16, 0.4]], w: 0.065 },
  ],
  key: (): Op[] => [
    { k: 'rings', rings: [ring(-0.25, 0, 0.19), ring(-0.25, 0, 0.085)] },
    { k: 'rings', rings: [rect(-0.08, -0.05, 0.47, 0.05)] },
    { k: 'rings', rings: [rect(0.27, 0.0, 0.34, 0.17)] },
    { k: 'rings', rings: [rect(0.39, 0.0, 0.46, 0.13)] },
  ],
  cup: (): Op[] => [
    { k: 'rings', rings: [ring(0.25, 0.0, 0.15, 30), ring(0.25, 0.0, 0.075, 30)] },
    poly([-0.32, -0.26], [0.22, -0.26], [0.16, 0.28], [-0.26, 0.28]),
    { k: 'rings', rings: [rect(-0.38, 0.3, 0.3, 0.37)], accent: true },
  ],
  bell: (): Op[] => [
    { k: 'circle', x: 0, y: -0.41, r: 0.07 },
    poly([-0.09, -0.36], [0.09, -0.36], [0.2, -0.24], [0.23, 0.1], [0.37, 0.25], [-0.37, 0.25], [-0.23, 0.1], [-0.2, -0.24]),
    { k: 'circle', x: 0, y: 0.33, r: 0.09, accent: true },
  ],
  leaf: (): Op[] => [
    { k: 'rings', rings: [leafRing(-0.38, 0.38, 0.42, -0.42, 0.24)] },
    { k: 'line', pts: [[-0.48, 0.48], [-0.38, 0.38], [0.3, -0.3]], w: 0.045, accent: true },
  ],
  fish: (): Op[] => [
    { k: 'rings', rings: [ring(-0.07, 0, 0.33, 40, 0.21), ring(-0.24, -0.05, 0.045, 16)] },
    poly([0.2, 0], [0.47, -0.22], [0.42, 0], [0.47, 0.22]),
  ],
  house: (): Op[] => [
    {
      k: 'rings',
      rings: [
        [[-0.3, -0.06], [0.3, -0.06], [0.3, 0.42], [0.07, 0.42], [0.07, 0.16], [-0.07, 0.16], [-0.07, 0.42], [-0.3, 0.42]],
        rect(0.13, 0.02, 0.24, 0.12),
      ],
    },
    poly([-0.44, -0.02], [0, -0.44], [0.44, -0.02]),
  ],
  tree: (): Op[] => [
    { k: 'rings', rings: [rect(-0.065, 0.08, 0.065, 0.48)], accent: true },
    { k: 'circle', x: 0, y: -0.16, r: 0.28 },
    { k: 'circle', x: -0.19, y: 0.04, r: 0.2 },
    { k: 'circle', x: 0.19, y: 0.04, r: 0.2 },
  ],
  car: (): Op[] => [
    {
      k: 'rings',
      rings: [
        [[-0.47, 0.13], [-0.47, -0.02], [-0.31, -0.07], [-0.17, -0.25], [0.15, -0.25], [0.29, -0.07], [0.47, -0.03], [0.47, 0.13]],
        [[-0.13, -0.2], [-0.02, -0.2], [-0.02, -0.08], [-0.22, -0.08]],
        [[0.03, -0.2], [0.13, -0.2], [0.21, -0.08], [0.03, -0.08]],
      ],
    },
    { k: 'circle', x: -0.26, y: 0.15, r: 0.12, accent: true },
    { k: 'circle', x: 0.26, y: 0.15, r: 0.12, accent: true },
  ],
  flag: (): Op[] => [
    { k: 'line', pts: [[-0.3, -0.46], [-0.3, 0.48]], w: 0.07, accent: true },
    poly([-0.3, -0.46], [0.4, -0.27], [-0.3, -0.06]),
  ],
  apple: (): Op[] => [
    { k: 'circle', x: -0.11, y: 0.08, r: 0.27 },
    { k: 'circle', x: 0.11, y: 0.08, r: 0.27 },
    { k: 'line', pts: [[0, -0.16], [0.03, -0.42]], w: 0.06, accent: true },
    { k: 'rings', rings: [leafRing(0.05, -0.3, 0.3, -0.42, 0.08)] },
  ],
} as const;

export type PictoKind = IconKind | keyof typeof PICTOS;
export const PICTO_KINDS: readonly PictoKind[] = [...ICON_KINDS, ...(Object.keys(PICTOS) as (keyof typeof PICTOS)[])];

/** Pictogram families used by the "select all matching" puzzles. */
export const FAMILIES = {
  shapes: ICON_KINDS as readonly PictoKind[],
  weather: ['sun', 'cloud', 'drop', 'bolt', 'snowflake', 'umbrella', 'moon', 'star'] as readonly PictoKind[],
  objects: ['key', 'cup', 'bell', 'leaf', 'fish', 'house', 'tree', 'car', 'flag', 'apple'] as readonly PictoKind[],
} as const;

/** Pictograms with an obvious "up" (used by rotate-object) and an obvious handedness (odd-rotation). */
export const UPRIGHT_KINDS: readonly PictoKind[] = ['house', 'tree', 'bell', 'cup', 'umbrella', 'flag', 'apple', 'car'];

function opsOf(kind: PictoKind): readonly Op[] {
  return (ICON_KINDS as readonly string[]).includes(kind) ? geometric(kind as IconKind) : PICTOS[kind as keyof typeof PICTOS]();
}

export interface PictoStyle {
  readonly color: RGB;
  /** Detail colour; defaults to a darker shade of `color`. */
  readonly accent?: RGB;
  readonly alpha?: number;
  /** Draw everything in `color` (a shadow / silhouette). */
  readonly silhouette?: boolean;
  /** Mirror horizontally before rotating. */
  readonly mirror?: boolean;
}

/** Draws a pictogram centred at (cx, cy), `size` px across, rotated `rotDeg` clockwise. */
export function drawPicto(r: Raster, kind: PictoKind, cx: number, cy: number, size: number, rotDeg: number, style: PictoStyle): Raster {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const mx = style.mirror ? -1 : 1;
  const tx = ([x, y]: Pt): Pt => [cx + (x * mx * cos - y * sin) * size, cy + (x * mx * sin + y * cos) * size];
  const accent = style.silhouette ? style.color : (style.accent ?? ([style.color[0] * 0.55, style.color[1] * 0.55, style.color[2] * 0.55] as const));
  const alpha = style.alpha ?? 255;
  for (const op of opsOf(kind)) {
    const c = op.accent ? accent : style.color;
    if (op.k === 'rings') r.rings(op.rings.map((rg) => rg.map(tx)), c, alpha);
    else if (op.k === 'circle') {
      const [x, y] = tx([op.x, op.y]);
      r.circle(x, y, op.r * size, c, alpha);
    } else r.stroke(op.pts.map(tx), op.w * size, c, alpha);
  }
  return r;
}
