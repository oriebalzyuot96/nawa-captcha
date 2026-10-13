import type { Lang } from './types.js';
import type { PictoKind } from './render/pictograms.js';

const PROMPTS = {
  slider: { en: 'Drag the piece into the matching gap.', ar: 'اسحب القطعة إلى الفراغ المطابق لها.' },
  slideUnlock: { en: 'Slide the handle until its arrow points at the ring.', ar: 'اسحب المقبض حتى يشير سهمه إلى الحلقة.' },
  shadowDrag: { en: 'Drag the picture onto its matching shadow.', ar: 'اسحب الصورة إلى الظل المطابق لها.' },
  jigsaw: { en: 'Swap the pieces until the picture is complete.', ar: 'بدّل القطع حتى تكتمل الصورة.' },
  rotate: { en: 'Rotate the picture until it is upright.', ar: 'دوّر الصورة حتى تصبح معتدلة.' },
  rotateObject: { en: 'Rotate the {thing} until it stands upright.', ar: 'دوّر صورة {thing} حتى تصبح معتدلة.' },
  rotateMatch: { en: 'Turn the inner circle until the picture lines up.', ar: 'دوّر الدائرة الداخلية حتى تتطابق الصورة.' },
  hold: { en: 'Press and hold, and let go while the ring is in the green zone.', ar: 'اضغط مطولًا ثم أفلت عندما تكون الحلقة داخل المنطقة الخضراء.' },
  icons: { en: 'Select every {icon}.', ar: 'اختر كل {icon}.' },
  oddOneOut: { en: 'One picture is different from the others. Select it.', ar: 'إحدى الصور مختلفة عن البقية. اخترها.' },
  oddRotation: { en: 'One letter is mirrored (backwards). Select it.', ar: 'أحد الحروف معكوس كالمرآة. اختره.' },
  colorName: { en: 'Select every {color} shape (they have {pattern}).', ar: 'اختر كل شكل {color} (عليه {pattern}).' },
  biggest: { en: 'Select the largest {icon}.', ar: 'اختر أكبر {icon}.' },
  smallest: { en: 'Select the smallest {icon}.', ar: 'اختر أصغر {icon}.' },
  findShape: { en: 'Select every cell that shows the shape in the box.', ar: 'اختر كل خانة فيها الشكل الموجود في المربع.' },
  shadowPick: { en: 'Select the shadow that matches the picture in the box.', ar: 'اختر الظل الذي يطابق الصورة في المربع.' },
  pattern: { en: 'Which picture comes next in the row? Select it.', ar: 'ما الصورة التالية في الصف؟ اخترها.' },
  clock: { en: 'Select the clock that shows {time}.', ar: 'اختر الساعة التي تشير إلى {time}.' },
  mathCompare: { en: 'Select every card whose answer is more than {n}.', ar: 'اختر كل بطاقة ناتجها أكبر من {n}.' },
  symmetry: { en: 'Fill the right half so it mirrors the left half.', ar: 'لوّن النصف الأيمن ليصبح مرآة للنصف الأيسر.' },
  pairs: { en: 'Match the pictures in pairs: select two that are the same.', ar: 'طابق الصور أزواجًا: اختر صورتين متماثلتين.' },
  tapOrder: { en: 'Tap the numbers from smallest to largest.', ar: 'انقر الأرقام من الأصغر إلى الأكبر.' },
  spell: { en: 'Tap the letters to spell the word at the top.', ar: 'انقر الحروف لتكتب الكلمة الظاهرة في الأعلى.' },
  orderDots: { en: 'Order the tiles from fewest dots to most.', ar: 'رتّب البطاقات من الأقل نقاطًا إلى الأكثر.' },
  orderBars: { en: 'Order the tiles from shortest bar to tallest.', ar: 'رتّب البطاقات من أقصر عمود إلى أطوله.' },
  orderSize: { en: 'Order the shapes from smallest to largest.', ar: 'رتّب الأشكال من الأصغر إلى الأكبر.' },
  orderNumbersUp: { en: 'Order the numbers from smallest to largest.', ar: 'رتّب الأعداد من الأصغر إلى الأكبر.' },
  orderNumbersDown: { en: 'Order the numbers from largest to smallest.', ar: 'رتّب الأعداد من الأكبر إلى الأصغر.' },
  orderTime: { en: 'Order the clocks from earliest time to latest.', ar: 'رتّب الساعات من الوقت الأبكر إلى الأحدث.' },
  story: { en: 'Put the pictures in order: {story}.', ar: 'رتّب الصور: {story}.' },
  trace: { en: 'Connect the dots in order, from 1 to {n}.', ar: 'صِل النقاط بالترتيب من 1 إلى {n}.' },
  traceLetters: { en: 'Connect the dots in alphabetical order, from A to {last}.', ar: 'صِل النقاط بالترتيب الأبجدي الإنجليزي من A إلى {last}.' },
  maze: { en: 'Draw a path through the maze from the green dot to the flag.', ar: 'ارسم طريقًا عبر المتاهة من النقطة الخضراء إلى العلم.' },
  math: { en: 'Solve the sum shown in the picture.', ar: 'احسب ناتج العملية في الصورة.' },
  count: { en: 'How many {icon} shapes are in the picture?', ar: 'كم {icon} في الصورة؟' },
  dice: { en: 'Add up the dots on all the dice.', ar: 'اجمع النقاط الموجودة على كل أحجار النرد.' },
  pow: { en: 'Checking your browser…', ar: 'جارٍ التحقق من المتصفح…' },
  accessible: { en: 'Answer the question in words or digits.', ar: 'أجب عن السؤال بالكلمات أو الأرقام.' },
  audioDigits: { en: 'Press Play and type the {n} digits you hear.', ar: 'اضغط تشغيل واكتب الأرقام الـ{n} التي تسمعها (بالإنجليزية).' },
  audioBeeps: { en: 'Press Play and count the high-pitched beeps. Type how many you heard.', ar: 'اضغط تشغيل وعُدّ النغمات الحادّة (العالية)، ثم اكتب عددها.' },
} as const;

export type PromptKey = keyof typeof PROMPTS;

export function prompt(key: PromptKey, lang: Lang, vars: Record<string, string | number> = {}): string {
  return PROMPTS[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

const PICTO_NAMES: Record<PictoKind, { en: string; ar: string }> = {
  star: { en: 'star', ar: 'نجمة' },
  heart: { en: 'heart', ar: 'قلب' },
  triangle: { en: 'triangle', ar: 'مثلث' },
  circle: { en: 'circle', ar: 'دائرة' },
  square: { en: 'square', ar: 'مربع' },
  diamond: { en: 'diamond', ar: 'معيّن' },
  plus: { en: 'plus sign', ar: 'علامة زائد' },
  moon: { en: 'crescent moon', ar: 'هلال' },
  hexagon: { en: 'hexagon', ar: 'شكل سداسي' },
  sun: { en: 'sun', ar: 'شمس' },
  cloud: { en: 'cloud', ar: 'غيمة' },
  drop: { en: 'raindrop', ar: 'قطرة مطر' },
  bolt: { en: 'lightning bolt', ar: 'برق' },
  snowflake: { en: 'snowflake', ar: 'ندفة ثلج' },
  umbrella: { en: 'umbrella', ar: 'مظلة' },
  key: { en: 'key', ar: 'مفتاح' },
  cup: { en: 'cup', ar: 'كوب' },
  bell: { en: 'bell', ar: 'جرس' },
  leaf: { en: 'leaf', ar: 'ورقة شجر' },
  fish: { en: 'fish', ar: 'سمكة' },
  house: { en: 'house', ar: 'بيت' },
  tree: { en: 'tree', ar: 'شجرة' },
  car: { en: 'car', ar: 'سيارة' },
  flag: { en: 'flag', ar: 'علم' },
  apple: { en: 'apple', ar: 'تفاحة' },
};

export function pictoName(kind: PictoKind, lang: Lang): string {
  return PICTO_NAMES[kind][lang];
}

/** @deprecated kept for compatibility; use {@link pictoName}. */
export const iconName = pictoName;

export const COLOR_NAMES = {
  red: { en: 'red', ar: 'أحمر', pattern: { en: 'dots', ar: 'نقاط' } },
  blue: { en: 'blue', ar: 'أزرق', pattern: { en: 'stripes', ar: 'خطوط' } },
  green: { en: 'green', ar: 'أخضر', pattern: { en: 'a cross', ar: 'علامة زائد' } },
  yellow: { en: 'yellow', ar: 'أصفر', pattern: { en: 'a ring', ar: 'حلقة' } },
  purple: { en: 'purple', ar: 'بنفسجي', pattern: { en: 'a zigzag', ar: 'خط متعرّج' } },
} as const;
export type ColorName = keyof typeof COLOR_NAMES;

export const STORIES = {
  plant: { en: 'a seed grows into a flower', ar: 'بذرة تنمو حتى تصبح زهرة' },
  candle: { en: 'a candle burns down', ar: 'شمعة تحترق وتقصر' },
  glass: { en: 'a glass is being filled with water', ar: 'كوب يُملأ بالماء' },
  egg: { en: 'a chick hatches from an egg', ar: 'كتكوت يفقس من بيضة' },
  battery: { en: 'a battery charges up', ar: 'بطارية تُشحن' },
} as const;
export type StoryKind = keyof typeof STORIES;
