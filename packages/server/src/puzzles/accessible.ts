import { sha256 } from '../crypto.js';
import { prompt } from '../i18n.js';
import type { Rng } from '../rng.js';
import { invalid, ok, wrong, type Lang, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';
import { normalizeDigits } from './math.js';
import { leadingZeroBits, powBitsFor } from './pow.js';

export interface AccessibleSolution {
  /** Normalized accepted answers. */
  readonly accept: readonly string[];
  readonly pow: { readonly salt: string; readonly bits: number };
}

/** View `accessible`: a plain-text question (no image, no audio) plus a silent proof-of-work tax. */
export interface AccessiblePublic {
  /** Plain-text question, designed to be read by a screen reader. */
  readonly question: string;
  readonly pow: { readonly algorithm: 'SHA-256'; readonly salt: string; readonly bits: number };
}

type Bi = { readonly en: string; readonly ar: string };
type BiList = { readonly en: readonly string[]; readonly ar: readonly string[] };

const NUMBERS: Record<Lang, readonly (readonly string[])[]> = {
  en: [
    ['zero'], ['one'], ['two'], ['three'], ['four'], ['five'], ['six'], ['seven'], ['eight'], ['nine'], ['ten'],
    ['eleven'], ['twelve'], ['thirteen'], ['fourteen'], ['fifteen'], ['sixteen'], ['seventeen'], ['eighteen'], ['nineteen'], ['twenty'],
  ],
  ar: [
    ['صفر'],
    ['واحد', 'واحدة'],
    ['اثنان', 'اثنين', 'اثنتان'],
    ['ثلاثة', 'ثلاث'],
    ['أربعة', 'أربع'],
    ['خمسة', 'خمس'],
    ['ستة', 'ست'],
    ['سبعة', 'سبع'],
    ['ثمانية', 'ثماني', 'ثمان'],
    ['تسعة', 'تسع'],
    ['عشرة', 'عشر'],
    ['أحد عشر', 'إحدى عشرة', 'احدعش'],
    ['اثنا عشر', 'اثني عشر', 'اثنتا عشرة', 'اطنعش'],
    ['ثلاثة عشر', 'ثلاث عشرة', 'ثلطعش'],
    ['أربعة عشر', 'أربع عشرة', 'اربعطعش'],
    ['خمسة عشر', 'خمس عشرة', 'خمسطعش'],
    ['ستة عشر', 'ست عشرة', 'سطعش'],
    ['سبعة عشر', 'سبع عشرة', 'سبعطعش'],
    ['ثمانية عشر', 'ثماني عشرة', 'ثمنطعش'],
    ['تسعة عشر', 'تسع عشرة', 'تسعطعش'],
    ['عشرون', 'عشرين'],
  ],
};

const DAYS: BiList = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};

const MONTHS: { en: readonly string[]; ar: readonly string[]; arLevant: readonly string[] } = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  arLevant: ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'],
};

const SEASONS: BiList = { en: ['spring', 'summer', 'autumn', 'winter'], ar: ['الربيع', 'الصيف', 'الخريف', 'الشتاء'] };

const COLOURS: BiList = { en: ['red', 'blue', 'green', 'yellow', 'black', 'white'], ar: ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض'] };

const THINGS: BiList = {
  en: ['table', 'river', 'chair', 'book', 'bread', 'door', 'window', 'spoon', 'stone', 'cloud'],
  ar: ['طاولة', 'نهر', 'كرسي', 'كتاب', 'خبز', 'باب', 'نافذة', 'ملعقة', 'حجر', 'غيمة'],
};

const CATEGORY: Record<'animal' | 'fruit' | 'body' | 'shape' | 'drink', { name: Bi; items: BiList }> = {
  animal: { name: { en: 'an animal', ar: 'اسم حيوان' }, items: { en: ['cat', 'horse', 'lion', 'rabbit', 'camel', 'sheep'], ar: ['قطة', 'حصان', 'أسد', 'أرنب', 'جمل', 'خروف'] } },
  fruit: { name: { en: 'a fruit', ar: 'اسم فاكهة' }, items: { en: ['apple', 'banana', 'orange', 'grape', 'mango', 'peach'], ar: ['تفاحة', 'موزة', 'برتقالة', 'عنب', 'مانجو', 'خوخ'] } },
  body: { name: { en: 'a part of the body', ar: 'عضو من أعضاء الجسم' }, items: { en: ['hand', 'nose', 'ear', 'foot', 'eye', 'knee'], ar: ['يد', 'أنف', 'أذن', 'قدم', 'عين', 'ركبة'] } },
  shape: { name: { en: 'a shape', ar: 'اسم شكل هندسي' }, items: { en: ['circle', 'square', 'triangle'], ar: ['دائرة', 'مربع', 'مثلث'] } },
  drink: { name: { en: 'something you drink', ar: 'شيء يُشرب' }, items: { en: ['water', 'milk', 'juice', 'tea'], ar: ['ماء', 'حليب', 'عصير', 'شاي'] } },
};

const OPPOSITES: ReadonlyArray<{ word: Bi; answer: BiList }> = [
  { word: { en: 'hot', ar: 'حار' }, answer: { en: ['cold'], ar: ['بارد', 'بارده'] } },
  { word: { en: 'big', ar: 'كبير' }, answer: { en: ['small', 'little'], ar: ['صغير'] } },
  { word: { en: 'up', ar: 'فوق' }, answer: { en: ['down'], ar: ['تحت', 'أسفل'] } },
  { word: { en: 'day', ar: 'النهار' }, answer: { en: ['night'], ar: ['الليل', 'ليل'] } },
  { word: { en: 'open', ar: 'مفتوح' }, answer: { en: ['closed', 'shut'], ar: ['مغلق', 'مسكر', 'مقفل'] } },
  { word: { en: 'fast', ar: 'سريع' }, answer: { en: ['slow'], ar: ['بطيء', 'بطيئ'] } },
  { word: { en: 'full', ar: 'ممتلئ' }, answer: { en: ['empty'], ar: ['فارغ'] } },
  { word: { en: 'left', ar: 'يسار' }, answer: { en: ['right'], ar: ['يمين'] } },
];

const COMPARE: ReadonlyArray<{ q: Bi; a: Bi; b: Bi }> = [
  { q: { en: 'Which is heavier', ar: 'أيهما أثقل' }, a: { en: 'a stone', ar: 'حجر' }, b: { en: 'a feather', ar: 'ريشة' } },
  { q: { en: 'Which is bigger', ar: 'أيهما أكبر' }, a: { en: 'an elephant', ar: 'فيل' }, b: { en: 'a mouse', ar: 'فأر' } },
  { q: { en: 'Which is faster', ar: 'أيهما أسرع' }, a: { en: 'a car', ar: 'سيارة' }, b: { en: 'a snail', ar: 'حلزون' } },
  { q: { en: 'Which is hotter', ar: 'أيهما أسخن' }, a: { en: 'fire', ar: 'نار' }, b: { en: 'ice', ar: 'ثلج' } },
  { q: { en: 'Which is taller', ar: 'أيهما أطول' }, a: { en: 'a tree', ar: 'شجرة' }, b: { en: 'a flower', ar: 'زهرة' } },
];

const USES: ReadonlyArray<{ q: Bi; a: Bi; b: Bi }> = [
  { q: { en: 'What do you write with', ar: 'بماذا تكتب' }, a: { en: 'a pen', ar: 'قلم' }, b: { en: 'a spoon', ar: 'ملعقة' } },
  { q: { en: 'What do you drink from', ar: 'من أي شيء تشرب' }, a: { en: 'a cup', ar: 'كوب' }, b: { en: 'a shoe', ar: 'حذاء' } },
  { q: { en: 'What do you sleep on', ar: 'على أي شيء تنام' }, a: { en: 'a bed', ar: 'سرير' }, b: { en: 'a plate', ar: 'صحن' } },
  { q: { en: 'What do you read', ar: 'ماذا تقرأ' }, a: { en: 'a book', ar: 'كتاب' }, b: { en: 'a hammer', ar: 'مطرقة' } },
  { q: { en: 'What keeps you dry in the rain', ar: 'ما الذي يحميك من المطر' }, a: { en: 'an umbrella', ar: 'مظلة' }, b: { en: 'a sock', ar: 'جورب' } },
];

const SOUNDS: ReadonlyArray<{ sound: Bi; answer: BiList }> = [
  { sound: { en: 'meow', ar: 'مياو' }, answer: { en: ['cat', 'kitten'], ar: ['قطة', 'قط', 'هرة', 'بسة'] } },
  { sound: { en: 'woof', ar: 'هو هو' }, answer: { en: ['dog', 'puppy'], ar: ['كلب'] } },
  { sound: { en: 'moo', ar: 'مووو' }, answer: { en: ['cow'], ar: ['بقرة', 'بقره'] } },
  { sound: { en: 'baa', ar: 'ماء ماء' }, answer: { en: ['sheep', 'lamb'], ar: ['خروف', 'نعجة', 'ماعز', 'غنم'] } },
];

const FACTS: ReadonlyArray<{ q: Bi; answer: BiList }> = [
  { q: { en: 'What colour is the sky on a clear day?', ar: 'ما لون السماء في يوم صافٍ؟' }, answer: { en: ['blue'], ar: ['أزرق', 'زرقاء'] } },
  { q: { en: 'What colour is fresh grass?', ar: 'ما لون العشب الطازج؟' }, answer: { en: ['green'], ar: ['أخضر', 'خضراء'] } },
  { q: { en: 'What colour is snow?', ar: 'ما لون الثلج؟' }, answer: { en: ['white'], ar: ['أبيض', 'بيضاء'] } },
  { q: { en: 'What colour is a ripe banana?', ar: 'ما لون الموزة الناضجة؟' }, answer: { en: ['yellow'], ar: ['أصفر', 'صفراء'] } },
  { q: { en: 'What do we call frozen water?', ar: 'ماذا نسمي الماء المتجمد؟' }, answer: { en: ['ice'], ar: ['ثلج', 'جليد'] } },
  { q: { en: 'What do bees make?', ar: 'ماذا يصنع النحل؟' }, answer: { en: ['honey'], ar: ['عسل'] } },
  { q: { en: 'Which animal is called the ship of the desert?', ar: 'أي حيوان يُسمّى سفينة الصحراء؟' }, answer: { en: ['camel'], ar: ['جمل', 'الجمل', 'ناقة'] } },
  { q: { en: 'What shines in the sky during the day?', ar: 'ما الذي يضيء السماء في النهار؟' }, answer: { en: ['sun', 'the sun'], ar: ['شمس', 'الشمس'] } },
];

const COUNTS: ReadonlyArray<{ q: Bi; n: number }> = [
  { q: { en: 'How many days are there in a week?', ar: 'كم يومًا في الأسبوع؟' }, n: 7 },
  { q: { en: 'How many months are there in a year?', ar: 'كم شهرًا في السنة؟' }, n: 12 },
  { q: { en: 'How many legs does a cat have?', ar: 'كم رِجلًا للقطة؟' }, n: 4 },
  { q: { en: 'How many legs does a bird have?', ar: 'كم رِجلًا للطائر؟' }, n: 2 },
  { q: { en: 'How many legs does a spider have?', ar: 'كم رِجلًا للعنكبوت؟' }, n: 8 },
  { q: { en: 'How many wheels does a bicycle have?', ar: 'كم عجلة للدراجة الهوائية؟' }, n: 2 },
  { q: { en: 'How many wheels does a car usually have?', ar: 'كم عجلة للسيارة عادةً؟' }, n: 4 },
  { q: { en: 'How many sides does a triangle have?', ar: 'كم ضلعًا للمثلث؟' }, n: 3 },
  { q: { en: 'How many sides does a square have?', ar: 'كم ضلعًا للمربع؟' }, n: 4 },
  { q: { en: 'How many fingers are on one hand?', ar: 'كم إصبعًا في اليد الواحدة؟' }, n: 5 },
  { q: { en: 'How many eyes does a person have?', ar: 'كم عينًا للإنسان؟' }, n: 2 },
];

const WORDS_FOR_LETTERS: BiList = {
  en: ['cat', 'sun', 'book', 'tree', 'milk', 'door', 'fish', 'lamp', 'hand', 'rain'],
  ar: ['باب', 'شمس', 'قمر', 'كتاب', 'نهر', 'بيت', 'ورد', 'جبل', 'سمك', 'قلم'],
};

/**
 * Normalizes free-text answers: case, whitespace, punctuation, Arabic diacritics/tatweel, alef and
 * teh-marbuta/alef-maqsura variants, a leading definite article or English article, and Arabic-Indic digits.
 */
export function normalizeAnswer(text: string): string {
  let t = normalizeDigits(text.normalize('NFKC')).toLowerCase();
  t = t.replace(/[ً-ٰٟـ]/g, '');
  t = t.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(the\s+|an?\s+|ال)/u, '');
  return t;
}

const num = (n: number, lang: Lang): string => NUMBERS[lang][n]?.[0] ?? String(n);
const numberAnswers = (n: number): string[] => [String(n), ...(NUMBERS.en[n] ?? []), ...(NUMBERS.ar[n] ?? [])];
const list = (items: readonly string[], lang: Lang): string => items.join(lang === 'ar' ? '، ' : ', ');
const both = (b: BiList): string[] => [...b.en, ...b.ar];
const q = (lang: Lang, en: string, ar: string): string => (lang === 'ar' ? ar : en);
/** "a stone" → also accept "stone". */
const bare = (s: string): string[] => [s, s.replace(/^(a|an|the)\s+/i, '')];

type Question = { question: string; accept: string[] };
type Template = (lang: Lang, rng: Rng) => Question;

/**
 * Over 50 question templates (each randomised), in Arabic and English. Answers are accepted in either
 * language, as words or digits, after {@link normalizeAnswer}.
 */
export const TEMPLATES: readonly Template[] = [
  // ---- numbers
  (lang, rng) => {
    const [a, b] = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2) as [number, number];
    return { question: q(lang, `Which number is larger: ${num(a, lang)} or ${num(b, lang)}?`, `أيّ العددين أكبر: ${num(a, lang)} أم ${num(b, lang)}؟`), accept: numberAnswers(Math.max(a, b)) };
  },
  (lang, rng) => {
    const [a, b] = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2) as [number, number];
    return { question: q(lang, `Which number is smaller: ${num(a, lang)} or ${num(b, lang)}?`, `أيّ العددين أصغر: ${num(a, lang)} أم ${num(b, lang)}؟`), accept: numberAnswers(Math.min(a, b)) };
  },
  (lang, rng) => {
    const a = rng.int(1, 7);
    const b = rng.int(1, 6);
    return { question: q(lang, `What is ${num(a, lang)} plus ${num(b, lang)}?`, `كم يساوي ${num(a, lang)} زائد ${num(b, lang)}؟`), accept: numberAnswers(a + b) };
  },
  (lang, rng) => {
    const a = rng.int(5, 11);
    const b = rng.int(1, a);
    return { question: q(lang, `What is ${num(a, lang)} minus ${num(b, lang)}?`, `كم يساوي ${num(a, lang)} ناقص ${num(b, lang)}؟`), accept: numberAnswers(a - b) };
  },
  (lang, rng) => {
    const a = rng.int(2, 5);
    const b = rng.int(2, 5);
    return { question: q(lang, `What is ${num(a, lang)} times ${num(b, lang)}?`, `كم يساوي ${num(a, lang)} ضرب ${num(b, lang)}؟`), accept: numberAnswers(a * b) };
  },
  (lang, rng) => {
    const n = rng.int(1, 19);
    return { question: q(lang, `Which number comes right after ${n}?`, `ما العدد الذي يأتي بعد ${n} مباشرة؟`), accept: numberAnswers(n + 1) };
  },
  (lang, rng) => {
    const n = rng.int(2, 21);
    return { question: q(lang, `Which number comes right before ${n}?`, `ما العدد الذي يأتي قبل ${n} مباشرة؟`), accept: numberAnswers(n - 1) };
  },
  (lang, rng) => {
    const n = rng.int(2, 11);
    return { question: q(lang, `What is double ${num(n, lang)}?`, `ما ضعف العدد ${num(n, lang)}؟`), accept: numberAnswers(n * 2) };
  },
  (lang, rng) => {
    const n = rng.int(1, 11) * 2;
    return { question: q(lang, `What is half of ${n}?`, `ما نصف العدد ${n}؟`), accept: numberAnswers(n / 2) };
  },
  (lang, rng) => {
    const nums = rng.sample([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], 3);
    return { question: q(lang, `Which is the largest of these numbers: ${list(nums.map(String), lang)}?`, `ما أكبر هذه الأعداد: ${list(nums.map(String), lang)}؟`), accept: numberAnswers(Math.max(...nums)) };
  },
  (lang, rng) => {
    const odd = rng.sample([1, 3, 5, 7, 9, 11, 13, 15], 2);
    const even = rng.pick([2, 4, 6, 8, 10, 12, 14, 16]);
    const nums = rng.shuffle([...odd, even]);
    return { question: q(lang, `Which of these numbers is even: ${list(nums.map(String), lang)}?`, `أيّ هذه الأعداد زوجي: ${list(nums.map(String), lang)}؟`), accept: numberAnswers(even) };
  },
  (lang, rng) => {
    const nums = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
    const pos = rng.int(0, 4);
    const ord = { en: ['first', 'second', 'third', 'fourth'], ar: ['الأول', 'الثاني', 'الثالث', 'الرابع'] };
    return { question: q(lang, `What is the ${ord.en[pos]} number in this list: ${list(nums.map(String), lang)}?`, `ما العدد ${ord.ar[pos]} في هذه القائمة: ${list(nums.map(String), lang)}؟`), accept: numberAnswers(nums[pos]!) };
  },
  (lang, rng) => {
    const n = rng.int(2, 10);
    return { question: q(lang, `Write the word "${NUMBERS.en[n]![0]}" as a number.`, `اكتب كلمة «${NUMBERS.ar[n]![0]}» بالأرقام.`), accept: [String(n)] };
  },
  (lang, rng) => {
    const word = rng.pick(lang === 'ar' ? WORDS_FOR_LETTERS.ar : WORDS_FOR_LETTERS.en);
    return { question: q(lang, `How many letters are in the word "${word}"?`, `كم حرفًا في كلمة «${word}»؟`), accept: numberAnswers([...word].length) };
  },
  // ---- counting facts
  ...COUNTS.map((c): Template => (lang) => ({ question: c.q[lang], accept: numberAnswers(c.n) })),
  // ---- days, months, seasons
  (lang, rng) => {
    const d = rng.int(0, 7);
    return { question: q(lang, `Which day comes after ${DAYS.en[d]}?`, `ما اليوم الذي يأتي بعد يوم ${DAYS.ar[d]}؟`), accept: [DAYS.en[(d + 1) % 7]!, DAYS.ar[(d + 1) % 7]!] };
  },
  (lang, rng) => {
    const d = rng.int(0, 7);
    return { question: q(lang, `Which day comes before ${DAYS.en[d]}?`, `ما اليوم الذي يأتي قبل يوم ${DAYS.ar[d]}؟`), accept: [DAYS.en[(d + 6) % 7]!, DAYS.ar[(d + 6) % 7]!] };
  },
  (lang, rng) => {
    const d = rng.int(0, 7);
    return { question: q(lang, `If today is ${DAYS.en[d]}, what day will it be in two days?`, `إذا كان اليوم ${DAYS.ar[d]}، فما اليوم بعد يومين؟`), accept: [DAYS.en[(d + 2) % 7]!, DAYS.ar[(d + 2) % 7]!] };
  },
  (lang, rng) => {
    const m = rng.int(0, 11);
    return { question: q(lang, `Which month comes after ${MONTHS.en[m]}?`, `ما الشهر الذي يأتي بعد ${MONTHS.ar[m]} (${MONTHS.arLevant[m]})؟`), accept: [MONTHS.en[m + 1]!, MONTHS.ar[m + 1]!, MONTHS.arLevant[m + 1]!, String(m + 2)] };
  },
  (lang, rng) => {
    const m = rng.int(1, 12);
    return { question: q(lang, `Which month comes before ${MONTHS.en[m]}?`, `ما الشهر الذي يأتي قبل ${MONTHS.ar[m]} (${MONTHS.arLevant[m]})؟`), accept: [MONTHS.en[m - 1]!, MONTHS.ar[m - 1]!, MONTHS.arLevant[m - 1]!, String(m)] };
  },
  (lang) => ({ question: q(lang, 'What is the first month of the year?', 'ما الشهر الأول في السنة؟'), accept: [MONTHS.en[0]!, MONTHS.ar[0]!, MONTHS.arLevant[0]!, '1'] }),
  (lang, rng) => {
    const s = rng.int(0, 4);
    return { question: q(lang, `Which season comes after ${SEASONS.en[s]}?`, `ما الفصل الذي يأتي بعد ${SEASONS.ar[s]}؟`), accept: [SEASONS.en[(s + 1) % 4]!, SEASONS.ar[(s + 1) % 4]!, ...(s === 1 ? ['fall'] : [])] };
  },
  (lang, rng) => {
    const words = rng.sample(THINGS[lang], 2);
    const d = rng.int(0, 7);
    return { question: q(lang, `Which of these words is a day of the week: ${list(rng.shuffle([...words, DAYS.en[d]!]), lang)}?`, `أيّ هذه الكلمات اسم يوم من أيام الأسبوع: ${list(rng.shuffle([...words, DAYS.ar[d]!]), lang)}؟`), accept: [DAYS.en[d]!, DAYS.ar[d]!] };
  },
  // ---- colours
  (lang, rng) => {
    const ci = rng.int(0, COLOURS.en.length);
    const options = rng.shuffle([COLOURS[lang][ci]!, ...rng.sample(THINGS[lang], 2)]);
    return { question: q(lang, `Which of these words is a colour: ${list(options, lang)}?`, `أيّ هذه الكلمات اسم لون: ${list(options, lang)}؟`), accept: [COLOURS.en[ci]!, COLOURS.ar[ci]!] };
  },
  ...FACTS.map((f): Template => (lang) => ({ question: f.q[lang], accept: both(f.answer) })),
  // ---- categories
  ...(Object.keys(CATEGORY) as (keyof typeof CATEGORY)[]).map((key): Template => (lang, rng) => {
    const cat = CATEGORY[key];
    const i = rng.int(0, cat.items.en.length);
    const options = rng.shuffle([cat.items[lang][i]!, ...rng.sample(THINGS[lang], 2)]);
    return { question: q(lang, `Which of these is ${cat.name.en}: ${list(options, lang)}?`, `أيّ هذه الكلمات ${cat.name.ar}: ${list(options, lang)}؟`), accept: [cat.items.en[i]!, cat.items.ar[i]!] };
  }),
  (lang, rng) => {
    const fruits = rng.sample([0, 1, 2, 3, 4, 5], 3);
    const t = rng.int(0, THINGS.en.length);
    const items = rng.shuffle([...fruits.map((i) => CATEGORY.fruit.items[lang][i]!), THINGS[lang][t]!]);
    return { question: q(lang, `Which word does not belong: ${list(items, lang)}?`, `أيّ كلمة لا تنتمي إلى المجموعة: ${list(items, lang)}؟`), accept: [THINGS.en[t]!, THINGS.ar[t]!] };
  },
  (lang, rng) => {
    const o = rng.pick(OPPOSITES);
    return { question: q(lang, `What is the opposite of "${o.word.en}"?`, `ما عكس كلمة «${o.word.ar}»؟`), accept: both(o.answer) };
  },
  (lang, rng) => {
    const c = rng.pick(COMPARE);
    const [x, y] = rng.next() < 0.5 ? [c.a, c.b] : [c.b, c.a];
    return { question: q(lang, `${c.q.en}: ${x.en} or ${y.en}?`, `${c.q.ar}: ${x.ar} أم ${y.ar}؟`), accept: [...bare(c.a.en), c.a.ar] };
  },
  (lang, rng) => {
    const u = rng.pick(USES);
    const [x, y] = rng.next() < 0.5 ? [u.a, u.b] : [u.b, u.a];
    return { question: q(lang, `${u.q.en}: ${x.en} or ${y.en}?`, `${u.q.ar}: ${x.ar} أم ${y.ar}؟`), accept: [...bare(u.a.en), u.a.ar] };
  },
  (lang, rng) => {
    const s = rng.pick(SOUNDS);
    return { question: q(lang, `Which animal says "${s.sound.en}"?`, `أيّ حيوان يقول «${s.sound.ar}»؟`), accept: both(s.answer) };
  },
  // ---- letters
  (lang, rng) => {
    const word = rng.pick(WORDS_FOR_LETTERS[lang]);
    return { question: q(lang, `What is the first letter of the word "${word}"?`, `ما الحرف الأول من كلمة «${word}»؟`), accept: [[...word][0]!] };
  },
  (lang, rng) => {
    const word = rng.pick(WORDS_FOR_LETTERS[lang]);
    const chars = [...word];
    return { question: q(lang, `What is the last letter of the word "${word}"?`, `ما الحرف الأخير من كلمة «${word}»؟`), accept: [chars[chars.length - 1]!] };
  },
];

/**
 * Text questions are inherently machine-readable, so the accessible type also carries a
 * proof-of-work "tax" that the widget computes silently while the person types. Switching to the
 * accessible mode therefore never makes bulk abuse cheaper than the visual puzzles.
 */
export function createAccessible(powBaseBits: number): PuzzleDefinition<AccessibleSolution, AccessiblePublic> {
  return {
    type: 'accessible',
    view: 'accessible',
    minSolveMs: 2000,
    maxAttempts: 2,
    generate({ lang, level, rng }) {
      const { question, accept } = rng.pick(TEMPLATES)(lang, rng);
      const pow = { salt: rng.id(16), bits: powBitsFor(powBaseBits, level) };
      return {
        solution: { accept: [...new Set(accept.map(normalizeAnswer))].filter((a) => a.length > 0), pow },
        prompt: prompt('accessible', lang),
        publicData: { question, pow: { algorithm: 'SHA-256', ...pow } },
      };
    },
    check(solution, answer) {
      if (!isRecord(answer) || typeof answer['text'] !== 'string' || answer['text'].length > 64) return invalid('text');
      if (typeof answer['nonce'] !== 'string' || !/^\d{1,16}$/.test(answer['nonce'])) return invalid('nonce');
      if (leadingZeroBits(sha256(`${solution.pow.salt}:${answer['nonce']}`)) < solution.pow.bits) return wrong('pow');
      const given = normalizeAnswer(answer['text']);
      return given.length > 0 && solution.accept.includes(given) ? ok : wrong();
    },
  };
}
