import { pick, randFloat, randInt, shuffle } from '../crypto.js';
import { prompt } from '../i18n.js';
import { glyphStrokes } from '../render/glyphs.js';
import { hsl, type Pt, type RGB } from '../render/raster.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';

export interface MathSolution {
  readonly value: number;
}

export interface MathPublic {
  readonly image: string;
  readonly width: number;
  readonly height: number;
}

const W = 260;
const H = 90;

const css = ([r, g, b]: RGB): string => `rgb(${r},${g},${b})`;
const f1 = (n: number): string => n.toFixed(1);

function pathD(points: readonly Pt[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f1(x)} ${f1(y)}`).join('');
}

function expression(level: number): { text: string; value: number } {
  const op = level >= 2 ? pick(['+', '-', 'x'] as const) : level === 1 ? pick(['+', '-'] as const) : '+';
  if (op === 'x') {
    const a = randInt(2, 10);
    const b = randInt(2, 10);
    return { text: `${a}x${b}`, value: a * b };
  }
  if (op === '-') {
    const a = randInt(6, 20);
    const b = randInt(1, a);
    return { text: `${a}-${b}`, value: a - b };
  }
  const max = level >= 1 ? 20 : 10;
  const a = randInt(1, max);
  const b = randInt(1, max);
  return { text: `${a}+${b}`, value: a + b };
}

/** Accepts ASCII, Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits. */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Renders the sum as an SVG of jittered single-stroke glyphs. Every glyph stroke and every noise
 * stroke is an identical-looking <path>, emitted in random order, so the expression is not
 * available as text, font codepoints, or document order. (A determined attacker can still
 * rasterize + OCR it, which is why math is a low-assurance type — see README.)
 */
function renderSvg(text: string): string {
  const ink = hsl(randInt(0, 360), 0.55, 0.32);
  const paths: string[] = [];
  const glyphs = [...text, '=', '?'];
  const size = randFloat(34, 42);
  let x = randFloat(18, 34);
  for (const ch of glyphs) {
    for (const stroke of glyphStrokes(ch, { x: x + size * 0.3, y: H / 2 + randFloat(-8, 8), size, rotateDeg: randFloat(-14, 14), jitter: 1.6 }, () => randFloat())) {
      // Split each stroke into overlapping pieces so the path list does not mirror the glyph list.
      for (let i = 0; i + 1 < stroke.length; i += randInt(1, 3)) {
        paths.push(`<path d="${pathD(stroke.slice(i, i + 3))}" stroke="${css(ink)}" stroke-width="${f1(randFloat(2.6, 3.6))}"/>`);
      }
    }
    x += size * randFloat(0.68, 0.82);
  }
  for (let i = 0; i < 9; i += 1) {
    const pts: Pt[] = [];
    let px = randFloat(0, W);
    let py = randFloat(0, H);
    for (let k = 0; k < 3; k += 1) {
      pts.push([px, py]);
      px += randFloat(-40, 40);
      py += randFloat(-25, 25);
    }
    paths.push(`<path d="${pathD(pts)}" stroke="${css(ink)}" stroke-width="${f1(randFloat(0.8, 1.6))}" opacity="${f1(randFloat(0.35, 0.7))}"/>`);
  }
  // Faint decoy digits: visible to people as background, but same element type as real ink.
  for (let i = 0; i < 3; i += 1) {
    for (const stroke of glyphStrokes(String(randInt(0, 10)), { x: randFloat(10, W - 10), y: randFloat(14, H - 14), size: randFloat(14, 20), rotateDeg: randFloat(-40, 40), jitter: 1 }, () => randFloat())) {
      paths.push(`<path d="${pathD(stroke)}" stroke="${css(ink)}" stroke-width="1.2" opacity="0.25"/>`);
    }
  }
  const dots = Array.from({ length: 40 }, () => `<circle cx="${f1(randFloat(0, W))}" cy="${f1(randFloat(0, H))}" r="${f1(randFloat(0.6, 1.8))}" fill="${css(hsl(randInt(0, 360), 0.5, 0.5))}" opacity="0.5"/>`);
  const bg = hsl(randInt(0, 360), 0.3, 0.93);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${css(bg)}"/>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${shuffle([...paths, ...dots]).join('')}</g></svg>`
  );
}

export const math: PuzzleDefinition<MathSolution, MathPublic> = {
  type: 'math',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang }) {
    const { text, value } = expression(level);
    const svg = renderSvg(text);
    return {
      solution: { value },
      prompt: prompt('math', lang),
      publicData: { image: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`, width: W, height: H },
    };
  },
  check(solution, answer) {
    if (!isRecord(answer) || typeof answer['value'] !== 'string' || answer['value'].length > 8) return invalid('value');
    const text = normalizeDigits(answer['value'].trim());
    if (!/^-?\d{1,4}$/.test(text)) return invalid('value');
    return Number.parseInt(text, 10) === solution.value ? ok : wrong();
  },
};
