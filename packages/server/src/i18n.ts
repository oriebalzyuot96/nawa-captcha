import type { Lang } from './types.js';
import type { IconKind } from './render/shapes.js';

const PROMPTS = {
  slider: { en: 'Drag the piece into the matching gap.', ar: 'اسحب القطعة إلى الفراغ المطابق لها.' },
  rotate: { en: 'Rotate the picture until it is upright.', ar: 'دوّر الصورة حتى تصبح معتدلة.' },
  icons: { en: 'Select every {icon}.', ar: 'اختر كل {icon}.' },
  math: { en: 'Solve the sum shown in the picture.', ar: 'احسب ناتج العملية في الصورة.' },
  orderDots: { en: 'Order the tiles from fewest dots to most.', ar: 'رتّب البطاقات من الأقل نقاطًا إلى الأكثر.' },
  orderBars: { en: 'Order the tiles from shortest bar to tallest.', ar: 'رتّب البطاقات من أقصر عمود إلى أطوله.' },
  trace: { en: 'Connect the dots in order, from 1 to {n}.', ar: 'صِل النقاط بالترتيب من 1 إلى {n}.' },
  pow: { en: 'Checking your browser…', ar: 'جارٍ التحقق من المتصفح…' },
  accessible: { en: 'Answer the question in words or digits.', ar: 'أجب عن السؤال بالكلمات أو الأرقام.' },
} as const;

export type PromptKey = keyof typeof PROMPTS;

export function prompt(key: PromptKey, lang: Lang, vars: Record<string, string | number> = {}): string {
  return PROMPTS[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

const ICON_NAMES: Record<IconKind, { en: string; ar: string }> = {
  star: { en: 'star', ar: 'نجمة' },
  heart: { en: 'heart', ar: 'قلب' },
  triangle: { en: 'triangle', ar: 'مثلث' },
  circle: { en: 'circle', ar: 'دائرة' },
  square: { en: 'square', ar: 'مربع' },
  diamond: { en: 'diamond', ar: 'معيّن' },
  plus: { en: 'plus sign', ar: 'علامة زائد' },
  moon: { en: 'crescent moon', ar: 'هلال' },
  hexagon: { en: 'hexagon', ar: 'شكل سداسي' },
};

export function iconName(kind: IconKind, lang: Lang): string {
  return ICON_NAMES[kind][lang];
}
