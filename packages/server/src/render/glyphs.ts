import type { Pt } from './raster.js';

/**
 * A tiny single-stroke font on a 0.6×1 box. Used for raster labels and the math SVG, so no
 * challenge text ever travels as a <text> element or a font the client could read back.
 */
export const GLYPHS: Readonly<Record<string, readonly (readonly Pt[])[]>> = {
  '0': [[[0.3, 0], [0.52, 0.12], [0.6, 0.5], [0.52, 0.88], [0.3, 1], [0.08, 0.88], [0, 0.5], [0.08, 0.12], [0.3, 0]]],
  '1': [[[0.08, 0.22], [0.34, 0], [0.34, 1]], [[0.12, 1], [0.54, 1]]],
  '2': [[[0.02, 0.22], [0.14, 0.05], [0.32, 0], [0.5, 0.08], [0.56, 0.28], [0.46, 0.5], [0.02, 1], [0.6, 1]]],
  '3': [[[0.02, 0.1], [0.3, 0], [0.54, 0.14], [0.5, 0.38], [0.24, 0.48], [0.54, 0.6], [0.58, 0.84], [0.3, 1], [0, 0.9]]],
  '4': [[[0.46, 1], [0.46, 0], [0, 0.68], [0.6, 0.68]]],
  '5': [[[0.56, 0], [0.06, 0], [0.02, 0.45], [0.3, 0.37], [0.56, 0.54], [0.56, 0.84], [0.3, 1], [0, 0.92]]],
  '6': [[[0.5, 0.02], [0.2, 0.16], [0.02, 0.55], [0.05, 0.86], [0.3, 1], [0.55, 0.86], [0.56, 0.62], [0.3, 0.5], [0.04, 0.62]]],
  '7': [[[0, 0], [0.6, 0], [0.18, 1]]],
  '8': [[[0.3, 0.48], [0.06, 0.3], [0.1, 0.06], [0.3, 0], [0.5, 0.06], [0.54, 0.3], [0.3, 0.48], [0.02, 0.7], [0.08, 0.94], [0.3, 1], [0.52, 0.94], [0.58, 0.7], [0.3, 0.48]]],
  '9': [[[0.56, 0.38], [0.3, 0.5], [0.04, 0.38], [0.04, 0.12], [0.3, 0], [0.56, 0.12], [0.56, 0.45], [0.42, 0.85], [0.1, 1]]],
  '+': [[[0.3, 0.25], [0.3, 0.75]], [[0.05, 0.5], [0.55, 0.5]]],
  '-': [[[0.05, 0.5], [0.55, 0.5]]],
  'x': [[[0.1, 0.3], [0.5, 0.7]], [[0.5, 0.3], [0.1, 0.7]]],
  '=': [[[0.05, 0.38], [0.55, 0.38]], [[0.05, 0.62], [0.55, 0.62]]],
  '?': [[[0.04, 0.2], [0.18, 0.02], [0.44, 0.02], [0.58, 0.2], [0.5, 0.38], [0.3, 0.52], [0.3, 0.72]], [[0.3, 0.9], [0.3, 0.96]]],
};

export interface GlyphPlacement {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly rotateDeg?: number;
  readonly jitter?: number;
}

/** Glyph strokes transformed to absolute coordinates, with per-point jitter. */
export function glyphStrokes(ch: string, p: GlyphPlacement, rand: () => number): Pt[][] {
  const strokes = GLYPHS[ch];
  if (!strokes) return [];
  const rad = ((p.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const j = p.jitter ?? 0;
  return strokes.map((stroke) =>
    stroke.map(([gx, gy]) => {
      const lx = (gx - 0.3) * p.size + (rand() * 2 - 1) * j;
      const ly = (gy - 0.5) * p.size + (rand() * 2 - 1) * j;
      return [p.x + lx * cos - ly * sin, p.y + lx * sin + ly * cos] as const;
    }),
  );
}
