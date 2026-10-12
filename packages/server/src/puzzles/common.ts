import { pick, randFloat, randInt } from '../crypto.js';
import { analyzeTrajectory, parseInteraction } from '../heuristics.js';
import { Raster, hsl, type RGB } from '../render/raster.js';
import { ICON_KINDS, iconPolygon } from '../render/shapes.js';
import { invalid, ok, type CheckResult } from '../types.js';

/** A busy, random backdrop: gradient + translucent shapes. Drawn at 2x for anti-aliasing. */
export function scenicBackground(w: number, h: number, shapes = 14): Raster {
  const hue = randInt(0, 360);
  const r = new Raster(w, h, 2).gradient(hsl(hue, 0.55, 0.62), hsl((hue + randInt(60, 180)) % 360, 0.55, 0.45), randInt(0, 360));
  for (let i = 0; i < shapes; i += 1) {
    const color = hsl(randInt(0, 360), randFloat(0.4, 0.8), randFloat(0.3, 0.8));
    const size = randFloat(18, 70);
    if (randInt(0, 3) === 0) r.circle(randFloat(0, w), randFloat(0, h), size / 2, color, randInt(70, 170));
    else r.polygon(iconPolygon(pick(ICON_KINDS), randFloat(0, w), randFloat(0, h), size, randFloat(0, 360)), color, randInt(70, 170));
  }
  return r;
}

export function darken(f: number): (r: number, g: number, b: number) => RGB {
  return (r, g, b) => [r * f, g * f, b * f];
}

export function lighten(f: number): (r: number, g: number, b: number) => RGB {
  return (r, g, b) => [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f];
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function finiteIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/**
 * Shared check for one-axis drag puzzles: the gesture must look human AND its horizontal travel
 * must agree with the submitted value (so a bot cannot attach a recorded trail to any answer).
 */
export function checkDrag(
  interactionRaw: unknown,
  bounds: { w: number; h: number },
  expectedTravel: number,
  travelTolerance: number,
): CheckResult {
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
