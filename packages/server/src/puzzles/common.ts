import { analyzeTrajectory, parseInteraction } from '../heuristics.js';
import { glyphStrokes } from '../render/glyphs.js';
import { Raster, hsl, type Pt, type RGB } from '../render/raster.js';
import { ICON_KINDS, iconPolygon } from '../render/shapes.js';
import type { Rng } from '../rng.js';
import { invalid, ok, wrong, type CheckResult, type Interaction, type TracePoint } from '../types.js';

/**
 * A busy, random backdrop with depth: a lit gradient (key light from the top-left, falling off
 * towards the bottom-right), far shapes that are soft and pale, near shapes with contact shadows
 * and a specular sheen, and a vignette. Drawn at 2x for anti-aliasing.
 */
export function scenicBackground(rng: Rng, w: number, h: number, shapes = 14): Raster {
  const hue = rng.int(0, 360);
  const r = new Raster(w, h, 2).gradient(hsl(hue, 0.55, 0.62), hsl((hue + rng.int(60, 180)) % 360, 0.55, 0.45), rng.int(0, 360));
  // Atmosphere: a warm key light and a cool shadow pool.
  r.glow(rng.float(0, w * 0.35), rng.float(0, h * 0.35), Math.max(w, h) * 0.75, hsl((hue + 30) % 360, 0.9, 0.9), 120);
  r.glow(rng.float(w * 0.7, w), rng.float(h * 0.7, h), Math.max(w, h) * 0.6, hsl((hue + 200) % 360, 0.6, 0.18), 90);
  for (let i = 0; i < shapes; i += 1) {
    const color = hsl(rng.int(0, 360), rng.float(0.4, 0.8), rng.float(0.3, 0.8));
    const size = rng.float(18, 70);
    // Larger shapes read as nearer: they get the contact shadow and sheen; small ones stay hazy.
    const near = size > 40;
    if (rng.int(0, 3) === 0) {
      const cx = rng.float(0, w);
      const cy = rng.float(0, h);
      if (near) r.circle(cx + 2, cy + 3, size / 2, [10, 14, 30], 40);
      r.circle(cx, cy, size / 2, color, rng.int(70, 170));
      if (near) r.glow(cx - size * 0.15, cy - size * 0.18, size * 0.3, [255, 255, 255], 70);
    } else {
      const poly = iconPolygon(rng.pick(ICON_KINDS), rng.float(0, w), rng.float(0, h), size, rng.float(0, 360));
      if (near) r.raisedPolygon(poly, color, rng.int(110, 190), size / 14);
      else r.polygon(poly, color, rng.int(60, 130));
    }
  }
  return r.vignette(0.2);
}

/** A soft pastel backdrop for grids and cards. */
export function softBackground(rng: Rng, w: number, h: number, ss = 2): Raster {
  const hue = rng.int(0, 360);
  return new Raster(w, h, ss)
    .gradient(hsl(hue, 0.3, 0.94), hsl((hue + rng.int(40, 120)) % 360, 0.28, 0.84), rng.int(0, 360))
    .glow(w * 0.18, h * 0.12, Math.max(w, h) * 0.7, [255, 255, 255], 110)
    .vignette(0.08);
}

/** Faint same-colour clutter so cells are not flat colour fields (defeats naive colour masks). */
export function clutter(r: Raster, rng: Rng, x: number, y: number, w: number, h: number, n = 3): void {
  for (let i = 0; i < n; i += 1) {
    r.polygon(iconPolygon(rng.pick(ICON_KINDS), x + rng.float(0, w), y + rng.float(0, h), rng.float(12, 26), rng.float(0, 360)), hsl(rng.int(0, 360), 0.35, 0.78), rng.int(50, 100));
  }
}

/** White grid lines between cells. */
export function gridLines(r: Raster, rows: number, cols: number, cellW: number, cellH: number, ox = 0, oy = 0): void {
  for (let i = 1; i < cols; i += 1) r.rect(ox + i * cellW - 0.75, oy, 1.5, rows * cellH, [255, 255, 255], 220);
  for (let i = 1; i < rows; i += 1) r.rect(ox, oy + i * cellH - 0.75, cols * cellW, 1.5, [255, 255, 255], 220);
}

/** Vivid, readable ink colour. */
export const ink = (rng: Rng): RGB => hsl(rng.int(0, 360), rng.float(0.55, 0.85), rng.float(0.32, 0.46));

export function darken(f: number): (r: number, g: number, b: number) => RGB {
  return (r, g, b) => [r * f, g * f, b * f];
}

export function lighten(f: number): (r: number, g: number, b: number) => RGB {
  return (r, g, b) => [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f];
}

/** Draws text with the stroke font (with a light halo), centred at (cx, cy). */
export function drawText(r: Raster, rng: Rng, text: string, cx: number, cy: number, size: number, color: RGB, opts: { halo?: RGB; weight?: number; jitter?: number; tilt?: number } = {}): void {
  const advance = size * 0.78;
  const chars = [...text];
  let x = cx - ((chars.length - 1) * advance) / 2;
  for (const ch of chars) {
    const strokes = glyphStrokes(ch, { x, y: cy, size, rotateDeg: rng.float(-(opts.tilt ?? 8), opts.tilt ?? 8), jitter: opts.jitter ?? size * 0.03 }, () => rng.next());
    const weight = opts.weight ?? Math.max(1.6, size * 0.13);
    if (opts.halo) for (const s of strokes) r.stroke(s, weight + 3, opts.halo);
    for (const s of strokes) r.stroke(s, weight, color);
    x += advance;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function finiteIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/** Places `count` points inside a rectangle keeping `minGap` between them (and from `avoid`). */
export function scatter(rng: Rng, count: number, box: { x0: number; y0: number; x1: number; y1: number }, minGap: number, avoid: readonly Pt[] = []): Pt[] {
  for (let gap = minGap; gap > 4; gap *= 0.85) {
    const out: Pt[] = [];
    for (let tries = 0; out.length < count && tries < 3000; tries += 1) {
      const p: Pt = [rng.float(box.x0, box.x1), rng.float(box.y0, box.y1)];
      if ([...avoid, ...out].every(([x, y]) => Math.hypot(x - p[0], y - p[1]) >= gap)) out.push(p);
    }
    if (out.length === count) return out;
  }
  throw new Error('nawa-captcha: could not place points');
}

/**
 * Shared check for one-axis drag puzzles: the gesture must look human AND its horizontal travel
 * must agree with the submitted value (so a bot cannot attach a recorded trail to any answer).
 */
export function checkDrag(interactionRaw: unknown, bounds: { w: number; h: number }, expectedTravel: number, travelTolerance: number): CheckResult {
  const interaction = parseInteraction(interactionRaw, bounds);
  if (!interaction) return invalid('interaction');
  const first = interaction.trail[0];
  const last = interaction.trail[interaction.trail.length - 1];
  if (!first || !last) return { ok: false, reason: 'bot-suspected', detail: 'no-trail' };
  if (Math.abs(last[0] - first[0] - expectedTravel) > travelTolerance) {
    return { ok: false, reason: 'bot-suspected', detail: 'trail-mismatch' };
  }
  const verdict = analyzeTrajectory(interaction, { axis: 'x' });
  return verdict.human ? ok : { ok: false, reason: 'bot-suspected', detail: verdict.reasons.join(',') };
}

/** Two-axis variant: the trail must end where the piece was dropped. */
export function checkDrag2d(interactionRaw: unknown, bounds: { w: number; h: number }, end: Pt, tolerance: number): CheckResult {
  const interaction = parseInteraction(interactionRaw, bounds);
  if (!interaction) return invalid('interaction');
  const last = interaction.trail[interaction.trail.length - 1];
  if (!last) return { ok: false, reason: 'bot-suspected', detail: 'no-trail' };
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > tolerance) return { ok: false, reason: 'bot-suspected', detail: 'trail-mismatch' };
  const verdict = analyzeTrajectory(interaction, { axis: 'free' });
  return verdict.human ? ok : { ok: false, reason: 'bot-suspected', detail: verdict.reasons.join(',') };
}

/** Parses `{ selected: number[] }` for an n-cell grid: integers, in range, no duplicates. Sorted. */
export function parseSelected(answer: unknown, n: number): number[] | undefined {
  if (!isRecord(answer) || !Array.isArray(answer['selected'])) return undefined;
  const selected = answer['selected'] as unknown[];
  if (selected.length > n || !selected.every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n)) return undefined;
  const set = [...new Set(selected as number[])].sort((a, b) => a - b);
  return set.length === selected.length ? set : undefined;
}

export function sameSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Grid check: the selection must equal the sealed set exactly. */
export function checkGrid(cells: readonly number[], answer: unknown, n: number): CheckResult {
  const set = parseSelected(answer, n);
  if (!set) return invalid('selected');
  return sameSet(set, cells) ? ok : wrong();
}

/** Order check: `{ order: string[] }` must equal the sealed id order. */
export function checkOrder(order: readonly string[], answer: unknown): CheckResult {
  if (!isRecord(answer) || !Array.isArray(answer['order'])) return invalid('order');
  const given = answer['order'] as unknown[];
  if (given.length !== order.length || !given.every((v) => typeof v === 'string' && v.length <= 16)) return invalid('order');
  return given.every((v, i) => v === order[i]) ? ok : wrong();
}

/**
 * Taps check for "tap in order" puzzles: `{ taps: [x, y, t][], mode }`. Tap i must land within
 * `radius` of target i, timing must be non-decreasing, and pointer taps must not be machine-fast.
 */
export function checkTaps(targets: readonly Pt[], answer: unknown, bounds: { w: number; h: number }, radius: number): CheckResult {
  if (!isRecord(answer)) return invalid('answer');
  const interaction = parseInteraction({ mode: answer['mode'], trail: answer['taps'] }, bounds);
  if (!interaction) return invalid('taps');
  const taps = interaction.trail;
  if (taps.length !== targets.length) return wrong('count');
  for (let i = 0; i < taps.length; i += 1) {
    const [x, y] = taps[i]!;
    const [tx, ty] = targets[i]!;
    if (Math.hypot(tx - x, ty - y) > radius) return wrong('miss');
  }
  return humanTiming(interaction, 90);
}

/** Refuses taps/clicks that are faster than a person can produce or perfectly regular. */
export function humanTiming(interaction: Interaction, minGapMs: number): CheckResult {
  const t = interaction.trail.map((p) => p[2]);
  const gaps = t.slice(1).map((v, i) => v - t[i]!);
  if (interaction.mode !== 'keyboard' && gaps.some((g) => g < minGapMs)) return { ok: false, reason: 'bot-suspected', detail: 'tap-too-fast' };
  if (gaps.length >= 3) {
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    if (sd < 0.5) return { ok: false, reason: 'bot-suspected', detail: 'uniform-timing' };
  }
  return ok;
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const roundPt = ([x, y]: Pt): Pt => [round1(x), round1(y)];

/**
 * An upright outdoor scene (sky above, ground below, sun, clouds, a house and/or tree standing on
 * the ground). People recognise "up" and continuity instantly, which is what rotate and jigsaw need.
 */
export function landscape(rng: Rng, w: number, h: number, opts: { kind?: 'house' | 'tree' | 'both' } = {}): Raster {
  const r = new Raster(w, h, 2);
  const skyHue = rng.int(185, 225);
  r.gradient(hsl(skyHue, 0.7, 0.55), hsl(skyHue, 0.6, 0.86), 90);
  const sunX = rng.float(w * 0.15, w * 0.85);
  const sunY = rng.float(h * 0.13, h * 0.25);
  const sunR = rng.float(10, 15) * (w / 160);
  r.glow(sunX, sunY, sunR * 4.5, hsl(rng.int(40, 55), 0.95, 0.85), 150);
  r.circle(sunX, sunY, sunR, hsl(rng.int(40, 55), 0.95, 0.6));
  r.circle(sunX - sunR * 0.25, sunY - sunR * 0.25, sunR * 0.55, [255, 250, 220], 110);
  // Aerial perspective: pale, desaturated far hills behind the ground.
  const farY = h * rng.float(0.5, 0.56);
  const far: Pt[] = [];
  const farPhase = rng.float(0, 6);
  for (let x = 0; x <= w; x += 8) far.push([x, farY + Math.sin(x / 26 + farPhase) * 7 + Math.sin(x / 9) * 2]);
  far.push([w, h], [0, h]);
  r.polygon(far, hsl(skyHue - 20, 0.25, 0.72), 200);
  for (let c = 0; c < 2; c += 1) {
    const cx = rng.float(20, w - 20);
    const cy = rng.float(h * 0.18, h * 0.34);
    for (let i = 0; i < 3; i += 1) r.circle(cx + (i - 1) * 9, cy + (i === 1 ? -4 : 0), 8, [250, 250, 252], 220);
  }
  const groundY = h * rng.float(0.6, 0.68);
  const wave = rng.float(2, 6);
  const phase = rng.float(0, 6);
  const ground: Pt[] = [];
  for (let x = 0; x <= w; x += 10) ground.push([x, groundY + Math.sin(x / 18 + phase) * wave]);
  ground.push([w, h], [0, h]);
  const groundHue = rng.int(85, 135);
  r.polygon(ground, hsl(groundHue, 0.5, rng.float(0.32, 0.45)));
  // Ground shading: lighter crest, darker foreground.
  r.polygon(ground.map(([x, y]) => [x, y + (y >= h ? 0 : 3)] as Pt).slice(0, -2).concat(ground.slice(0, -2).reverse()), hsl(groundHue, 0.55, 0.62), 90);
  r.rect(0, h * 0.86, w, h * 0.14, hsl(groundHue, 0.5, 0.18), 60);

  const kind = opts.kind ?? rng.pick(['house', 'tree', 'both'] as const);
  const scale = Math.min(w, h) / 160;
  const houseX = kind === 'both' ? rng.float(w * 0.15, w * 0.35) : rng.float(w * 0.28, w * 0.5);
  const base = groundY + 4;
  if (kind !== 'tree') {
    const hw = rng.float(38, 48) * scale;
    const hh = rng.float(26, 34) * scale;
    r.rect(houseX, base - hh, hw, hh, hsl(rng.int(0, 50), 0.45, 0.7));
    r.polygon([[houseX - 6 * scale, base - hh], [houseX + hw / 2, base - hh - rng.float(20, 26) * scale], [houseX + hw + 6 * scale, base - hh]], hsl(rng.int(0, 20), 0.65, 0.4));
    r.rect(houseX + hw / 2 - 5 * scale, base - 16 * scale, 10 * scale, 16 * scale, hsl(25, 0.5, 0.25));
    r.rect(houseX + 5 * scale, base - hh + 6 * scale, 8 * scale, 8 * scale, [235, 245, 255]);
  }
  if (kind !== 'house') {
    const tx = kind === 'both' ? rng.float(w * 0.66, w * 0.82) : rng.float(w * 0.38, w * 0.62);
    r.rect(tx - 4 * scale, base - 34 * scale, 8 * scale, 34 * scale, hsl(28, 0.5, 0.3));
    const leaf = hsl(rng.int(95, 140), 0.55, 0.35);
    r.circle(tx, base - 46 * scale, 15 * scale, leaf).circle(tx - 11 * scale, base - 36 * scale, 11 * scale, leaf).circle(tx + 11 * scale, base - 36 * scale, 11 * scale, leaf);
    r.glow(tx - 5 * scale, base - 52 * scale, 10 * scale, [220, 255, 200], 90);
  }
  return r.vignette(0.18);
}
