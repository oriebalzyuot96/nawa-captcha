import type { ChallengeType, PuzzleDefinition, ViewKind } from '../types.js';
import { createAccessible } from './accessible.js';
import { biggest } from './biggest.js';
import { clock } from './clock.js';
import { colorName } from './color-name.js';
import { count } from './count.js';
import { dice } from './dice.js';
import { findShape } from './find-shape.js';
import { hold } from './hold.js';
import { icons } from './icons.js';
import { iconsObjects } from './icons-objects.js';
import { iconsWeather } from './icons-weather.js';
import { jigsaw } from './jigsaw.js';
import { math } from './math.js';
import { mathCompare } from './math-compare.js';
import { maze } from './maze.js';
import { oddOneOut } from './odd-one-out.js';
import { oddRotation } from './odd-rotation.js';
import { order } from './order.js';
import { orderNumbers } from './order-numbers.js';
import { orderSize } from './order-size.js';
import { orderTime } from './order-time.js';
import { pairs } from './pairs.js';
import { pattern } from './pattern.js';
import { createPow } from './pow.js';
import { rotate } from './rotate.js';
import { rotateMatch } from './rotate-match.js';
import { rotateObject } from './rotate-object.js';
import { shadowDrag } from './shadow-drag.js';
import { shadowPick } from './shadow-pick.js';
import { slideUnlock } from './slide-unlock.js';
import { slider } from './slider.js';
import { spell } from './spell.js';
import { story } from './story.js';
import { symmetry } from './symmetry.js';
import { tapOrder } from './tap-order.js';
import { trace } from './trace.js';
import { traceLetters } from './trace-letters.js';

/** Every visual puzzle, keyed by type (pow and accessible are created with a PoW base difficulty). */
const VISUAL = {
  slider,
  'slide-unlock': slideUnlock,
  'shadow-drag': shadowDrag,
  jigsaw,
  rotate,
  'rotate-object': rotateObject,
  'rotate-match': rotateMatch,
  hold,
  icons,
  'icons-weather': iconsWeather,
  'icons-objects': iconsObjects,
  'odd-one-out': oddOneOut,
  'odd-rotation': oddRotation,
  'color-name': colorName,
  biggest,
  'find-shape': findShape,
  'shadow-pick': shadowPick,
  pattern,
  clock,
  'math-compare': mathCompare,
  symmetry,
  pairs,
  'tap-order': tapOrder,
  spell,
  order,
  'order-size': orderSize,
  'order-numbers': orderNumbers,
  'order-time': orderTime,
  story,
  trace,
  'trace-letters': traceLetters,
  maze,
  math,
  count,
  dice,
} as const satisfies Record<Exclude<ChallengeType, 'pow' | 'accessible'>, PuzzleDefinition<any, any>>;

export function createRegistry(powBaseBits: number): Record<ChallengeType, PuzzleDefinition> {
  return {
    ...(VISUAL as unknown as Record<Exclude<ChallengeType, 'pow' | 'accessible'>, PuzzleDefinition>),
    pow: createPow(powBaseBits) as PuzzleDefinition,
    accessible: createAccessible(powBaseBits) as PuzzleDefinition,
  };
}

/** The widget view each type uses (handy for docs, playgrounds and custom clients). */
export const TYPE_VIEWS: Readonly<Record<ChallengeType, ViewKind>> = Object.fromEntries(
  Object.entries(createRegistry(16)).map(([type, def]) => [type, def.view]),
) as Record<ChallengeType, ViewKind>;

export {
  biggest,
  clock,
  colorName,
  count,
  createAccessible,
  dice,
  findShape,
  hold,
  icons,
  iconsObjects,
  iconsWeather,
  jigsaw,
  math,
  mathCompare,
  maze,
  oddOneOut,
  oddRotation,
  order,
  orderNumbers,
  orderSize,
  orderTime,
  pairs,
  pattern,
  rotate,
  rotateMatch,
  rotateObject,
  shadowDrag,
  shadowPick,
  slideUnlock,
  slider,
  spell,
  story,
  symmetry,
  tapOrder,
  trace,
  traceLetters,
};
export { createIconsPuzzle } from './icons.js';
export { createPow, leadingZeroBits, powBitsFor, solvePow } from './pow.js';
export { normalizeAnswer, TEMPLATES as ACCESSIBLE_TEMPLATES } from './accessible.js';
export { normalizeDigits } from './math.js';
export type { SliderPublic } from './slider.js';
export type { RotatePublic } from './rotate.js';
export type { DragPublic } from './shadow-drag.js';
export type { SwapPublic } from './jigsaw.js';
export type { HoldPublic } from './hold.js';
export type { GridPublic, GridSolution } from './grid.js';
export type { IconsPublic } from './icons.js';
export type { PairsPublic } from './pairs.js';
export type { TapsPublic } from './tap-order.js';
export type { MathPublic } from './math.js';
export type { OrderPublic, OrderTile } from './order.js';
export type { PathPublic, TracePublic } from './trace.js';
export type { PowPublic } from './pow.js';
export type { AccessiblePublic } from './accessible.js';
