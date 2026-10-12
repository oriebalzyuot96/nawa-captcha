import type { Pt } from './raster.js';

export const ICON_KINDS = ['star', 'heart', 'triangle', 'circle', 'square', 'diamond', 'plus', 'moon', 'hexagon'] as const;
export type IconKind = (typeof ICON_KINDS)[number];

function transform(points: readonly Pt[], cx: number, cy: number, size: number, rotDeg: number): Pt[] {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map(([x, y]) => [cx + (x * cos - y * sin) * size, cy + (x * sin + y * cos) * size] as const);
}

function regular(n: number, r = 0.5, phase = -Math.PI / 2): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / n;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
}

/** Unit outlines centred on 0,0 with a nominal diameter of 1. */
function outline(kind: IconKind): Pt[] {
  switch (kind) {
    case 'star':
      return Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 0.52 : 0.22;
        return [Math.cos(a) * r, Math.sin(a) * r + 0.03] as const;
      });
    case 'heart':
      return Array.from({ length: 48 }, (_, i) => {
        const t = (i / 48) * 2 * Math.PI;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [x / 34, -y / 34 + 0.04] as const;
      });
    case 'triangle':
      return regular(3, 0.56, -Math.PI / 2).map(([x, y]) => [x, y + 0.1] as const);
    case 'circle':
      return regular(48, 0.45);
    case 'square':
      return regular(4, 0.55, Math.PI / 4);
    case 'diamond':
      return [
        [0, -0.55],
        [0.38, 0],
        [0, 0.55],
        [-0.38, 0],
      ];
    case 'plus': {
      const a = 0.16;
      const b = 0.48;
      return [
        [-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a],
        [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a],
      ];
    }
    case 'moon': {
      const outer = Array.from({ length: 25 }, (_, i) => {
        const a = Math.PI / 2 + (i / 24) * Math.PI;
        return [Math.cos(a) * 0.48, Math.sin(a) * 0.48] as const;
      });
      const inner = Array.from({ length: 25 }, (_, i) => {
        const a = (3 * Math.PI) / 2 - (i / 24) * Math.PI;
        return [Math.cos(a) * 0.22 - 0.02, Math.sin(a) * 0.48] as const;
      });
      return [...outer, ...inner];
    }
    case 'hexagon':
      return regular(6, 0.5, 0);
  }
}

export function iconPolygon(kind: IconKind, cx: number, cy: number, size: number, rotDeg = 0): Pt[] {
  return transform(outline(kind), cx, cy, size, rotDeg);
}

/**
 * Jigsaw piece mask: a square body with a round knob on the top and right edges, and a round
 * notch cut into the left edge. Returns an inside-test and the bounding box.
 */
export function jigsawMask(x: number, y: number, body: number, variant = 0): { inside: (px: number, py: number) => boolean; bbox: [number, number, number, number] } {
  const knob = body * 0.2;
  const knobs: Array<[number, number]> = [];
  const notches: Array<[number, number]> = [];
  if (variant % 2 === 0) knobs.push([x + body / 2, y]);
  else notches.push([x + body / 2, y]);
  knobs.push([x + body, y + body / 2]);
  notches.push([x, y + body / 2]);
  const inside = (px: number, py: number): boolean => {
    for (const [nx, ny] of notches) if ((px - nx) ** 2 + (py - ny) ** 2 <= knob * knob) return false;
    if (px >= x && px <= x + body && py >= y && py <= y + body) return true;
    for (const [kx, ky] of knobs) if ((px - kx) ** 2 + (py - ky) ** 2 <= knob * knob) return true;
    return false;
  };
  return { inside, bbox: [x - 1, y - knob - 1, x + body + knob + 1, y + body + 1] };
}

/** True if (px,py) lies on the ~1.5px rim of a mask (inside, but a neighbour is outside). */
export function onRim(inside: (x: number, y: number) => boolean, px: number, py: number, w = 1.5): boolean {
  if (!inside(px, py)) return false;
  return !inside(px - w, py) || !inside(px + w, py) || !inside(px, py - w) || !inside(px, py + w);
}
