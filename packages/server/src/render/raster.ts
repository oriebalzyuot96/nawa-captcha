import { cryptoRng, type Rng } from '../rng.js';

export type RGB = readonly [r: number, g: number, b: number];
export type Pt = readonly [x: number, y: number];

/**
 * Minimal software rasterizer. Shapes are drawn at `ss`x supersampling (anti-aliasing) in
 * logical coordinates; `finish()` box-filters down to 1x, where pixel effects (noise, masks,
 * rotation, cropping) operate. Everything ends up as PNG pixels, so no geometry (and therefore
 * no solution) is ever present in markup the client could parse.
 */
export class Raster {
  readonly pw: number;
  readonly ph: number;
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly ss = 1,
  ) {
    this.pw = Math.round(width * ss);
    this.ph = Math.round(height * ss);
    this.data = new Uint8ClampedArray(this.pw * this.ph * 4);
  }

  fill(c: RGB, alpha = 255): this {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = alpha;
    }
    return this;
  }

  /** Linear gradient from `a` to `b` along `angleDeg` (0 = left→right, 90 = top→bottom). */
  gradient(a: RGB, b: RGB, angleDeg: number): this {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const span = Math.abs(dx) * this.pw + Math.abs(dy) * this.ph || 1;
    const ox = dx < 0 ? this.pw : 0;
    const oy = dy < 0 ? this.ph : 0;
    for (let y = 0; y < this.ph; y += 1) {
      for (let x = 0; x < this.pw; x += 1) {
        const t = Math.min(1, Math.max(0, ((x - ox) * dx + (y - oy) * dy) / span));
        const i = (y * this.pw + x) * 4;
        this.data[i] = a[0] + (b[0] - a[0]) * t;
        this.data[i + 1] = a[1] + (b[1] - a[1]) * t;
        this.data[i + 2] = a[2] + (b[2] - a[2]) * t;
        this.data[i + 3] = 255;
      }
    }
    return this;
  }

  private blend(i: number, c: RGB, alpha: number): void {
    const a = alpha / 255;
    const d = this.data;
    const da = (d[i + 3] ?? 0) / 255;
    const outA = a + da * (1 - a);
    if (outA <= 0) return;
    d[i] = (c[0] * a + (d[i] ?? 0) * da * (1 - a)) / outA;
    d[i + 1] = (c[1] * a + (d[i + 1] ?? 0) * da * (1 - a)) / outA;
    d[i + 2] = (c[2] * a + (d[i + 2] ?? 0) * da * (1 - a)) / outA;
    d[i + 3] = outA * 255;
  }

  private span(y: number, x0: number, x1: number, c: RGB, alpha: number): void {
    if (y < 0 || y >= this.ph) return;
    const from = Math.max(0, Math.ceil(x0 - 0.5));
    const to = Math.min(this.pw - 1, Math.floor(x1 - 0.5));
    for (let x = from; x <= to; x += 1) this.blend((y * this.pw + x) * 4, c, alpha);
  }

  /** Even-odd scanline polygon fill. */
  polygon(points: readonly Pt[], c: RGB, alpha = 255): this {
    return this.rings([points], c, alpha);
  }

  /** Even-odd fill of several closed rings at once (a ring inside another becomes a hole). */
  rings(rings: readonly (readonly Pt[])[], c: RGB, alpha = 255): this {
    const s = this.ss;
    const edges: Array<readonly [number, number, number, number]> = [];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const ring of rings) {
      if (ring.length < 3) continue;
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        edges.push([a[0] * s, a[1] * s, b[0] * s, b[1] * s]);
        minY = Math.min(minY, a[1] * s);
        maxY = Math.max(maxY, a[1] * s);
      }
    }
    if (edges.length === 0) return this;
    const yStart = Math.max(0, Math.floor(minY));
    const yEnd = Math.min(this.ph - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = yStart; y <= yEnd; y += 1) {
      const sy = y + 0.5;
      xs.length = 0;
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) this.span(y, xs[k] as number, xs[k + 1] as number, c, alpha);
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, c: RGB, alpha = 255): this {
    const s = this.ss;
    const pcx = cx * s;
    const pcy = cy * s;
    const pr = r * s;
    const y0 = Math.max(0, Math.floor(pcy - pr));
    const y1 = Math.min(this.ph - 1, Math.ceil(pcy + pr));
    for (let y = y0; y <= y1; y += 1) {
      const dy = y + 0.5 - pcy;
      const h = pr * pr - dy * dy;
      if (h < 0) continue;
      const dx = Math.sqrt(h);
      this.span(y, pcx - dx, pcx + dx, c, alpha);
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, alpha = 255): this {
    return this.polygon(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      c,
      alpha,
    );
  }

  /** Thick polyline: one quad per segment plus round joins/caps. */
  stroke(points: readonly Pt[], width: number, c: RGB, alpha = 255): this {
    const half = width / 2;
    for (let i = 0; i + 1 < points.length; i += 1) {
      const [ax, ay] = points[i] as Pt;
      const [bx, by] = points[i + 1] as Pt;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (-(by - ay) / len) * half;
      const ny = ((bx - ax) / len) * half;
      this.polygon(
        [
          [ax + nx, ay + ny],
          [bx + nx, by + ny],
          [bx - nx, by - ny],
          [ax - nx, ay - ny],
        ],
        c,
        alpha,
      );
    }
    for (const [x, y] of points) this.circle(x, y, half, c, alpha);
    return this;
  }

  /** Soft radial light (or shade): opacity eases out from the centre to `r` (logical coords). */
  glow(cx: number, cy: number, r: number, c: RGB, alpha = 255): this {
    const s = this.ss;
    const pcx = cx * s;
    const pcy = cy * s;
    const pr = r * s;
    for (let y = Math.max(0, Math.floor(pcy - pr)); y < Math.min(this.ph, Math.ceil(pcy + pr)); y += 1) {
      for (let x = Math.max(0, Math.floor(pcx - pr)); x < Math.min(this.pw, Math.ceil(pcx + pr)); x += 1) {
        const d = Math.hypot(x + 0.5 - pcx, y + 0.5 - pcy) / pr;
        if (d >= 1) continue;
        const k = (1 - d) * (1 - d);
        this.blend((y * this.pw + x) * 4, c, alpha * k);
      }
    }
    return this;
  }

  /** Polygon with a soft contact shadow under it (offset towards the bottom-right, away from the light). */
  raisedPolygon(points: readonly Pt[], c: RGB, alpha = 255, depth = 3): this {
    for (let i = 3; i >= 1; i -= 1) {
      const o = (depth * i) / 3;
      this.polygon(points.map(([x, y]) => [x + o * 0.7, y + o] as Pt), [10, 14, 30], Math.round(alpha * 0.11));
    }
    this.polygon(points, c, alpha);
    // Specular sheen: a lighter copy nudged towards the light, clipped by drawing it smaller.
    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
    const inner = points.map(([x, y]) => [cx + (x - cx) * 0.62 - depth * 0.35, cy + (y - cy) * 0.62 - depth * 0.45] as Pt);
    this.polygon(inner, [255, 255, 255], Math.round(alpha * 0.16));
    return this;
  }

  /** Darkens towards the edges (an elliptical vignette) for depth. Works at any scale. */
  vignette(strength = 0.22): this {
    const cx = this.pw / 2;
    const cy = this.ph / 2;
    for (let y = 0; y < this.ph; y += 1) {
      for (let x = 0; x < this.pw; x += 1) {
        const dx = (x + 0.5 - cx) / cx;
        const dy = (y + 0.5 - cy) / cy;
        const d = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.8);
        const t = Math.min(1, Math.max(0, (d - 0.55) / 0.6));
        const f = 1 - strength * t * t * (3 - 2 * t);
        const i = (y * this.pw + x) * 4;
        this.data[i] = (this.data[i] ?? 0) * f;
        this.data[i + 1] = (this.data[i + 1] ?? 0) * f;
        this.data[i + 2] = (this.data[i + 2] ?? 0) * f;
      }
    }
    return this;
  }

  /**
   * Directional bevel inside a mask (1x pixel coordinates), lit from the top-left. `raised`
   * lights the top-left edge and shades the bottom-right one; a recess does the opposite.
   */
  bevel(inside: (x: number, y: number) => boolean, bbox: readonly [number, number, number, number], opts: { depth?: number; raised?: boolean; light?: number; shade?: number } = {}): this {
    const depth = opts.depth ?? 3;
    const raised = opts.raised ?? true;
    const light = opts.light ?? 0.55;
    const shade = opts.shade ?? 0.45;
    const [x0, y0, x1, y1] = bbox;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.ph, Math.ceil(y1)); y += 1) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.pw, Math.ceil(x1)); x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        if (!inside(px, py)) continue;
        let towardsLight = 0;
        let awayFromLight = 0;
        for (let k = 1; k <= depth; k += 1) {
          const w = (depth - k + 1) / depth;
          if (!towardsLight && !inside(px - k * 0.75, py - k)) towardsLight = w;
          if (!awayFromLight && !inside(px + k * 0.75, py + k)) awayFromLight = w;
        }
        const up = raised ? towardsLight : awayFromLight;
        const down = raised ? awayFromLight : towardsLight;
        if (!up && !down) continue;
        const i = (y * this.pw + x) * 4;
        for (let ch = 0; ch < 3; ch += 1) {
          let v = this.data[i + ch] ?? 0;
          if (up) v += (255 - v) * light * up;
          if (down) v *= 1 - shade * down;
          this.data[i + ch] = v;
        }
      }
    }
    return this;
  }

  /** Box-filter down to 1x. */
  finish(): Raster {
    if (this.ss === 1) return this;
    const out = new Raster(this.width, this.height, 1);
    const s = this.ss;
    const n = s * s;
    for (let y = 0; y < out.ph; y += 1) {
      for (let x = 0; x < out.pw; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < s; sy += 1) {
          for (let sx = 0; sx < s; sx += 1) {
            const i = ((y * s + sy) * this.pw + (x * s + sx)) * 4;
            const al = this.data[i + 3] ?? 0;
            r += (this.data[i] ?? 0) * al;
            g += (this.data[i + 1] ?? 0) * al;
            b += (this.data[i + 2] ?? 0) * al;
            a += al;
          }
        }
        const o = (y * out.pw + x) * 4;
        if (a > 0) {
          out.data[o] = r / a;
          out.data[o + 1] = g / a;
          out.data[o + 2] = b / a;
        }
        out.data[o + 3] = a / n;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- 1x pixel effects

  /** Per-pixel luminance noise of ±amount, quantized to `step` so PNG compression stays reasonable. */
  noise(amount: number, rng: Rng = cryptoRng, step = 4): this {
    const rnd = rng.bytes(this.pw * this.ph);
    for (let p = 0; p < rnd.length; p += 1) {
      const i = p * 4;
      if ((this.data[i + 3] ?? 0) === 0) continue;
      const n = Math.round((((rnd[p] ?? 0) / 255) * 2 - 1) * amount / step) * step;
      this.data[i] = (this.data[i] ?? 0) + n;
      this.data[i + 1] = (this.data[i + 1] ?? 0) + n;
      this.data[i + 2] = (this.data[i + 2] ?? 0) + n;
    }
    return this;
  }

  /** Applies `fn` to every pixel whose (x+0.5, y+0.5) lies inside `mask`. */
  shade(mask: (x: number, y: number) => boolean, fn: (r: number, g: number, b: number) => RGB, bbox?: readonly [number, number, number, number]): this {
    const [x0, y0, x1, y1] = bbox ?? [0, 0, this.pw, this.ph];
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.ph, Math.ceil(y1)); y += 1) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.pw, Math.ceil(x1)); x += 1) {
        if (!mask(x + 0.5, y + 0.5)) continue;
        const i = (y * this.pw + x) * 4;
        const [r, g, b] = fn(this.data[i] ?? 0, this.data[i + 1] ?? 0, this.data[i + 2] ?? 0);
        this.data[i] = r;
        this.data[i + 1] = g;
        this.data[i + 2] = b;
      }
    }
    return this;
  }

  /** Copies a w×h region; pixels outside `mask` become transparent. */
  crop(x: number, y: number, w: number, h: number, mask?: (x: number, y: number) => boolean): Raster {
    const out = new Raster(w, h, 1);
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        const sx = x + xx;
        const sy = y + yy;
        if (sx < 0 || sy < 0 || sx >= this.pw || sy >= this.ph) continue;
        if (mask && !mask(sx + 0.5, sy + 0.5)) continue;
        const i = (sy * this.pw + sx) * 4;
        const o = (yy * w + xx) * 4;
        out.data[o] = this.data[i] ?? 0;
        out.data[o + 1] = this.data[i + 1] ?? 0;
        out.data[o + 2] = this.data[i + 2] ?? 0;
        out.data[o + 3] = this.data[i + 3] ?? 0;
      }
    }
    return out;
  }

  /** Rotates the image about its centre (bilinear). Pixels outside `circleMask` radius become transparent. */
  rotate(angleDeg: number, circleRadius?: number): Raster {
    const out = new Raster(this.width, this.height, 1);
    const rad = (-angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = this.pw / 2;
    const cy = this.ph / 2;
    for (let y = 0; y < out.ph; y += 1) {
      for (let x = 0; x < out.pw; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist = Math.hypot(dx, dy);
        if (circleRadius !== undefined && dist > circleRadius) continue;
        const sx = cx + dx * cos - dy * sin - 0.5;
        const sy = cy + dx * sin + dy * cos - 0.5;
        const o = (y * out.pw + x) * 4;
        this.sample(sx, sy, out.data, o);
        if (circleRadius !== undefined && dist > circleRadius - 1) out.data[o + 3] = (out.data[o + 3] ?? 0) * (circleRadius - dist);
      }
    }
    return out;
  }

  private sample(x: number, y: number, dst: Uint8ClampedArray, o: number): void {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    for (let ch = 0; ch < 4; ch += 1) {
      let v = 0;
      for (const [ox, oy, w] of [
        [0, 0, (1 - fx) * (1 - fy)],
        [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],
        [1, 1, fx * fy],
      ] as const) {
        const px = Math.min(this.pw - 1, Math.max(0, x0 + ox));
        const py = Math.min(this.ph - 1, Math.max(0, y0 + oy));
        v += (this.data[(py * this.pw + px) * 4 + ch] ?? 0) * w;
      }
      dst[o + ch] = v;
    }
  }
}

/** Random pleasant colour from HSL, as RGB. */
export function hsl(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
