import { pick, randFloat, randInt } from '../crypto.js';
import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl } from '../render/raster.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { checkDrag, finiteIn, isRecord } from './common.js';

export interface RotateSolution {
  /** The clockwise rotation the user must apply to make the picture upright. */
  readonly angle: number;
}

export interface RotatePublic {
  readonly size: number;
  readonly image: string;
  /** Virtual length of the rotation track in trail coordinates; full track = 360°. */
  readonly track: number;
}

const D = 160;
const TRACK = 300;

/** An upright outdoor scene: sky above, ground below, a house and/or tree standing on it. */
function drawScene(): Raster {
  const r = new Raster(D, D, 2);
  const skyHue = randInt(185, 225);
  r.gradient(hsl(skyHue, 0.7, 0.55), hsl(skyHue, 0.6, 0.85), 90);
  r.circle(randFloat(30, D - 30), randFloat(22, 40), randFloat(10, 15), hsl(randInt(40, 55), 0.95, 0.6));
  for (let c = 0; c < 2; c += 1) {
    const cx = randFloat(20, D - 20);
    const cy = randFloat(30, 55);
    for (let i = 0; i < 3; i += 1) r.circle(cx + (i - 1) * 9, cy + (i === 1 ? -4 : 0), 8, [250, 250, 252], 220);
  }
  const groundY = D * randFloat(0.6, 0.68);
  const wave = randFloat(2, 6);
  const ground: Array<[number, number]> = [];
  for (let x = 0; x <= D; x += 10) ground.push([x, groundY + Math.sin(x / 18) * wave]);
  ground.push([D, D], [0, D]);
  r.polygon(ground, hsl(randInt(85, 135), 0.5, randFloat(0.32, 0.45)));

  const kind = pick(['house', 'tree', 'both'] as const);
  const houseX = kind === 'both' ? randFloat(28, 60) : randFloat(45, 80);
  if (kind !== 'tree') {
    const w = randFloat(38, 48);
    const h = randFloat(26, 34);
    const base = groundY + 4;
    r.rect(houseX, base - h, w, h, hsl(randInt(0, 50), 0.45, 0.7));
    r.polygon([[houseX - 6, base - h], [houseX + w / 2, base - h - randFloat(20, 26)], [houseX + w + 6, base - h]], hsl(randInt(0, 20), 0.65, 0.4));
    r.rect(houseX + w / 2 - 5, base - 16, 10, 16, hsl(25, 0.5, 0.25));
    r.rect(houseX + 5, base - h + 6, 8, 8, [235, 245, 255]);
  }
  if (kind !== 'house') {
    const tx = kind === 'both' ? randFloat(105, 130) : randFloat(60, 100);
    const base = groundY + 4;
    r.rect(tx - 4, base - 34, 8, 34, hsl(28, 0.5, 0.3));
    const leaf = hsl(randInt(95, 140), 0.55, 0.35);
    r.circle(tx, base - 46, 15, leaf).circle(tx - 11, base - 36, 11, leaf).circle(tx + 11, base - 36, 11, leaf);
  }
  return r;
}

export const rotate: PuzzleDefinition<RotateSolution, RotatePublic> = {
  type: 'rotate',
  minSolveMs: 500,
  maxAttempts: 2,
  generate({ lang }) {
    // Never close to upright, so a no-op submission cannot pass.
    const shown = randInt(35, 326);
    const image = drawScene().finish().noise(8).rotate(shown, D / 2);
    return {
      solution: { angle: (360 - shown) % 360 },
      prompt: prompt('rotate', lang),
      publicData: { size: D, image: pngDataUrl(image), track: TRACK },
    };
  },
  check(solution, answer, { level }) {
    if (!isRecord(answer) || !finiteIn(answer['angle'], 0, 360)) return invalid('angle');
    const angle = answer['angle'];
    const drag = checkDrag(answer['interaction'], { w: TRACK, h: 60 }, (angle / 360) * TRACK, 10);
    if (!drag.ok) return drag;
    let diff = Math.abs(angle - solution.angle) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff <= (level >= 2 ? 9 : 12) ? ok : wrong();
  },
};
