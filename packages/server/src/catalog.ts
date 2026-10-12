import type { ChallengeType } from './types.js';

export type TypeFamily = 'drag' | 'select' | 'tap' | 'order' | 'draw' | 'type' | 'invisible';

export interface TypeInfo {
  readonly family: TypeFamily;
  readonly en: string;
  readonly ar: string;
  /** Rough chance that a blind guess passes one attempt (documentation; see README). */
  readonly guess: string;
}

/** Human-readable names for docs, galleries and playgrounds. */
export const TYPE_INFO: Readonly<Record<ChallengeType, TypeInfo>> = {
  slider: { family: 'drag', en: 'Slider jigsaw', ar: 'لغز السحب', guess: '≈ 8%' },
  'slide-unlock': { family: 'drag', en: 'Slide to the target', ar: 'اسحب إلى الهدف', guess: '≈ 7%' },
  'shadow-drag': { family: 'drag', en: 'Drag to the shadow', ar: 'اسحب إلى الظل', guess: '< 2%' },
  jigsaw: { family: 'drag', en: 'Jigsaw (4 pieces)', ar: 'أحجية من 4 قطع', guess: '1 in 23' },
  rotate: { family: 'drag', en: 'Rotate the scene', ar: 'تدوير المشهد', guess: '≈ 7%' },
  'rotate-object': { family: 'drag', en: 'Rotate the object', ar: 'تدوير الشيء', guess: '≈ 7%' },
  'rotate-match': { family: 'drag', en: 'Align the inner circle', ar: 'محاذاة الدائرة الداخلية', guess: '≈ 7%' },
  hold: { family: 'drag', en: 'Hold and release', ar: 'اضغط ثم أفلت', guess: '≈ 1 in 4' },
  icons: { family: 'select', en: 'Select matching shapes', ar: 'اختيار الأشكال المطابقة', guess: '< 1%' },
  'icons-weather': { family: 'select', en: 'Select weather icons', ar: 'اختيار رموز الطقس', guess: '< 1%' },
  'icons-objects': { family: 'select', en: 'Select everyday objects', ar: 'اختيار الأشياء', guess: '< 1%' },
  'odd-one-out': { family: 'select', en: 'Odd one out', ar: 'المختلف', guess: '1 in 9' },
  'odd-rotation': { family: 'select', en: 'Find the mirrored letter', ar: 'الحرف المعكوس', guess: '1 in 6' },
  'color-name': { family: 'select', en: 'Colour by name + pattern', ar: 'اللون بالاسم والنقش', guess: '< 1%' },
  biggest: { family: 'select', en: 'Largest / smallest', ar: 'الأكبر / الأصغر', guess: '1 in 9' },
  'find-shape': { family: 'select', en: 'Find the shape', ar: 'ابحث عن الشكل', guess: '< 1%' },
  'shadow-pick': { family: 'select', en: 'Pick the shadow', ar: 'اختر الظل', guess: '1 in 6' },
  pattern: { family: 'select', en: 'What comes next', ar: 'ما التالي', guess: '1 in 6' },
  clock: { family: 'select', en: 'Read the clock', ar: 'قراءة الساعة', guess: '1 in 6' },
  'math-compare': { family: 'select', en: 'Compare sums', ar: 'مقارنة النواتج', guess: '1 in 62' },
  symmetry: { family: 'select', en: 'Complete the mirror', ar: 'أكمل التماثل', guess: '< 0.1%' },
  pairs: { family: 'select', en: 'Match pairs', ar: 'مطابقة الأزواج', guess: '1 in 105' },
  'tap-order': { family: 'tap', en: 'Tap numbers in order', ar: 'انقر الأرقام بالترتيب', guess: '< 0.1%' },
  spell: { family: 'tap', en: 'Spell the word', ar: 'تهجئة الكلمة', guess: '< 0.1%' },
  order: { family: 'order', en: 'Order dots / bars', ar: 'ترتيب النقاط والأعمدة', guess: '1 in 24' },
  'order-size': { family: 'order', en: 'Order by size', ar: 'الترتيب حسب الحجم', guess: '1 in 24' },
  'order-numbers': { family: 'order', en: 'Order numbers', ar: 'ترتيب الأعداد', guess: '1 in 24' },
  'order-time': { family: 'order', en: 'Order clock times', ar: 'ترتيب الأوقات', guess: '1 in 24' },
  story: { family: 'order', en: 'Picture story', ar: 'قصة مصورة', guess: '1 in 6–24' },
  trace: { family: 'draw', en: 'Connect the dots', ar: 'توصيل النقاط', guess: '< 0.1%' },
  'trace-letters': { family: 'draw', en: 'Connect A–E', ar: 'توصيل الحروف', guess: '< 0.1%' },
  maze: { family: 'draw', en: 'Maze', ar: 'متاهة', guess: '< 0.1%' },
  math: { family: 'type', en: 'Math image', ar: 'عملية حسابية', guess: '≈ 10%' },
  count: { family: 'type', en: 'Count the objects', ar: 'عدّ الأشياء', guess: '≈ 1 in 5' },
  dice: { family: 'type', en: 'Dice total', ar: 'مجموع النرد', guess: '≈ 1 in 6' },
  pow: { family: 'invisible', en: 'Invisible proof-of-work', ar: 'إثبات عمل غير مرئي', guess: 'n/a (CPU cost)' },
  accessible: { family: 'invisible', en: 'Accessible text question', ar: 'سؤال نصي ميسّر', guess: 'machine-readable' },
};
