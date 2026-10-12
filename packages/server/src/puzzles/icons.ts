import { pick, randFloat, randInt, sample, shuffle } from '../crypto.js';
import { iconName, prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl } from '../render/raster.js';
import { ICON_KINDS, iconPolygon, type IconKind } from '../render/shapes.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';

export interface IconsSolution {
  readonly cells: readonly number[];
}

export interface IconsPublic {
  readonly image: string;
  readonly rows: number;
  readonly cols: number;
  readonly cellSize: number;
  /** Localized name of the icon to select (shown in the prompt). */
  readonly target: string;
}

const ROWS = 3;
const COLS = 3;
const CELL = 80;

export const icons: PuzzleDefinition<IconsSolution, IconsPublic> = {
  type: 'icons',
  minSolveMs: 1200,
  maxAttempts: 1,
  generate({ level, lang }) {
    const n = ROWS * COLS;
    const target = pick(ICON_KINDS);
    const others = ICON_KINDS.filter((k) => k !== target);
    const count = randInt(2, level >= 2 ? 6 : 5);
    const cells = shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, count).sort((a, b) => a - b);
    const distractors = sample(others, 4);
    const layout: IconKind[] = Array.from({ length: n }, (_, i) => (cells.includes(i) ? target : pick(distractors)));

    const r = new Raster(COLS * CELL, ROWS * CELL, 2);
    const hue = randInt(0, 360);
    r.gradient(hsl(hue, 0.25, 0.93), hsl((hue + 90) % 360, 0.25, 0.82), randInt(0, 360));
    layout.forEach((kind, i) => {
      const cx = (i % COLS) * CELL + CELL / 2 + randFloat(-8, 8);
      const cy = Math.floor(i / COLS) * CELL + CELL / 2 + randFloat(-8, 8);
      // A faint same-colour "ghost" of another shape behind each icon defeats naive colour masks.
      r.polygon(iconPolygon(pick(others), cx + randFloat(-14, 14), cy + randFloat(-14, 14), randFloat(30, 46), randFloat(0, 360)), hsl(randInt(0, 360), 0.4, 0.75), 90);
      r.polygon(iconPolygon(kind, cx, cy, randFloat(42, 56), randFloat(-28, 28)), hsl(randInt(0, 360), randFloat(0.55, 0.85), randFloat(0.35, 0.5)));
    });
    for (let i = 1; i < COLS; i += 1) r.rect(i * CELL - 0.5, 0, 1, ROWS * CELL, [255, 255, 255], 200);
    for (let i = 1; i < ROWS; i += 1) r.rect(0, i * CELL - 0.5, COLS * CELL, 1, [255, 255, 255], 200);

    const name = iconName(target, lang);
    return {
      solution: { cells },
      prompt: prompt('icons', lang, { icon: name }),
      publicData: { image: pngDataUrl(r.finish().noise(10)), rows: ROWS, cols: COLS, cellSize: CELL, target: name },
    };
  },
  check(solution, answer) {
    if (!isRecord(answer) || !Array.isArray(answer['selected'])) return invalid('selected');
    const selected = answer['selected'] as unknown[];
    const n = ROWS * COLS;
    if (selected.length > n || !selected.every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n)) {
      return invalid('selected');
    }
    const set = [...new Set(selected as number[])].sort((a, b) => a - b);
    if (set.length !== selected.length) return invalid('duplicates');
    return set.length === solution.cells.length && set.every((v, i) => v === solution.cells[i]) ? ok : wrong();
  },
};
