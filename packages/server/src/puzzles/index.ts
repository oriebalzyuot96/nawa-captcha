import type { ChallengeType, PuzzleDefinition } from '../types.js';
import { createAccessible } from './accessible.js';
import { icons } from './icons.js';
import { math } from './math.js';
import { order } from './order.js';
import { createPow } from './pow.js';
import { rotate } from './rotate.js';
import { slider } from './slider.js';
import { trace } from './trace.js';

export function createRegistry(powBaseBits: number): Record<ChallengeType, PuzzleDefinition> {
  return {
    slider: slider as PuzzleDefinition,
    rotate: rotate as PuzzleDefinition,
    icons: icons as PuzzleDefinition,
    math: math as PuzzleDefinition,
    order: order as PuzzleDefinition,
    trace: trace as PuzzleDefinition,
    pow: createPow(powBaseBits) as PuzzleDefinition,
    accessible: createAccessible(powBaseBits) as PuzzleDefinition,
  };
}

export { createAccessible, icons, math, order, rotate, slider, trace };
export { createPow, leadingZeroBits, powBitsFor, solvePow } from './pow.js';
export { normalizeAnswer } from './accessible.js';
export { normalizeDigits } from './math.js';
export type { SliderPublic } from './slider.js';
export type { RotatePublic } from './rotate.js';
export type { IconsPublic } from './icons.js';
export type { MathPublic } from './math.js';
export type { OrderPublic, OrderTile } from './order.js';
export type { TracePublic } from './trace.js';
export type { PowPublic } from './pow.js';
export type { AccessiblePublic } from './accessible.js';
