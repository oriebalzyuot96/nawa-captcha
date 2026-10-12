import type { Rng } from '../rng.js';
import { Raster, hsl } from '../render/raster.js';
import { checkGrid, gridLines, softBackground } from './common.js';
import type { CheckResult } from '../types.js';

/**
 * View `grid`: one PNG with a rows×cols grid of selectable cells (optionally below a header strip
 * holding a reference picture). The widget lays transparent toggle buttons over the cells.
 */
export interface GridPublic {
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly rows: number;
  readonly cols: number;
  /** Image y where the grid starts (a header/reference strip sits above it). */
  readonly gridTop: number;
  /** 'one': exactly one cell may be selected; 'many': any subset. */
  readonly select: 'one' | 'many';
  /** Cells that are part of the picture but not selectable. */
  readonly locked?: readonly number[];
  /** Localized name of what to select, when the prompt names it. */
  readonly target?: string;
}

export interface GridSolution {
  readonly cells: readonly number[];
  /** Number of cells in the grid. */
  readonly n: number;
}

export interface GridCanvas {
  readonly r: Raster;
  readonly cellW: number;
  readonly cellH: number;
  readonly gridTop: number;
  readonly width: number;
  readonly height: number;
  center(i: number): readonly [number, number];
}

/** A pastel canvas with an optional header strip and a cell grid below it. */
export function gridCanvas(rng: Rng, rows: number, cols: number, cellW: number, cellH = cellW, header = 0): GridCanvas {
  const width = cols * cellW;
  const height = header + rows * cellH;
  const r = softBackground(rng, width, height);
  if (header > 0) r.rect(0, 0, width, header, [255, 255, 255], 120).rect(0, header - 1, width, 2, hsl(rng.int(0, 360), 0.2, 0.7), 160);
  return {
    r,
    cellW,
    cellH,
    gridTop: header,
    width,
    height,
    center: (i) => [(i % cols) * cellW + cellW / 2, header + Math.floor(i / cols) * cellH + cellH / 2],
  };
}

export function finishGrid(g: GridCanvas, rows: number, cols: number): Raster {
  gridLines(g.r, rows, cols, g.cellW, g.cellH, 0, g.gridTop);
  return g.r;
}

/** A rounded "reference" frame in the header strip. */
export function referenceBox(r: Raster, rng: Rng, cx: number, cy: number, size: number): void {
  const c = hsl(rng.int(0, 360), 0.45, 0.45);
  r.rect(cx - size / 2 - 3, cy - size / 2 - 3, size + 6, size + 6, c).rect(cx - size / 2, cy - size / 2, size, size, [255, 255, 255]);
}

/** The selection must equal the sealed set exactly. */
export function checkGridSolution(solution: GridSolution, answer: unknown): CheckResult {
  return checkGrid(solution.cells, answer, solution.n);
}
