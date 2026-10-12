import { pick, randInt, randomId, sample, sha256, shuffle } from '../crypto.js';
import { leadingZeroBits, powBitsFor } from './pow.js';
import { prompt } from '../i18n.js';
import { invalid, ok, wrong, type Lang, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';
import { normalizeDigits } from './math.js';

export interface AccessibleSolution {
  /** Normalized accepted answers. */
  readonly accept: readonly string[];
  readonly pow: { readonly salt: string; readonly bits: number };
}

export interface AccessiblePublic {
  /** Plain-text question, designed to be read by a screen reader. No image, no audio. */
  readonly question: string;
  readonly pow: { readonly algorithm: 'SHA-256'; readonly salt: string; readonly bits: number };
}

const NUMBERS: Record<Lang, readonly (readonly string[])[]> = {
  en: [['zero'], ['one'], ['two'], ['three'], ['four'], ['five'], ['six'], ['seven'], ['eight'], ['nine'], ['ten']],
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
  ],
};

const DAYS: Record<Lang, readonly string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};

const COLOURS: Record<Lang, readonly string[]> = {
  en: ['red', 'blue', 'green', 'yellow', 'black', 'white'],
  ar: ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض'],
};

const THINGS: Record<Lang, readonly string[]> = {
  en: ['table', 'river', 'chair', 'book', 'bread', 'door', 'window', 'spoon'],
  ar: ['طاولة', 'نهر', 'كرسي', 'كتاب', 'خبز', 'باب', 'نافذة', 'ملعقة'],
};

/**
 * Normalizes free-text answers: case, whitespace, punctuation, Arabic diacritics/tatweel, alef and
 * teh-marbuta/alef-maqsura variants, a leading definite article, and Arabic-Indic digits.
 */
export function normalizeAnswer(text: string): string {
  let t = normalizeDigits(text.normalize('NFKC')).toLowerCase();
  t = t.replace(/[ً-ٰٟـ]/g, '');
  t = t.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(the\s+|ال)/u, '');
  return t;
}

function numberAnswers(n: number, lang: Lang): string[] {
  const words = [...(NUMBERS.en[n] ?? []), ...(NUMBERS[lang][n] ?? [])];
  return [String(n), ...words].map(normalizeAnswer);
}

function numberWord(n: number, lang: Lang): string {
  return NUMBERS[lang][n]?.[0] ?? String(n);
}

type Question = { question: string; accept: string[] };

const GENERATORS: Array<(lang: Lang) => Question> = [
  (lang) => {
    const [a, b] = sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2) as [number, number];
    const q = lang === 'ar' ? `أيّ العددين أكبر: ${numberWord(a, lang)} أم ${numberWord(b, lang)}؟` : `Which number is larger: ${numberWord(a, lang)} or ${numberWord(b, lang)}?`;
    return { question: q, accept: numberAnswers(Math.max(a, b), lang) };
  },
  (lang) => {
    const a = randInt(1, 6);
    const b = randInt(1, 5);
    const q = lang === 'ar' ? `كم يساوي ${numberWord(a, lang)} زائد ${numberWord(b, lang)}؟` : `What is ${numberWord(a, lang)} plus ${numberWord(b, lang)}?`;
    return { question: q, accept: numberAnswers(a + b, lang) };
  },
  (lang) => {
    const d = randInt(0, 7);
    const day = DAYS[lang][d] as string;
    const next = (d + 1) % 7;
    const q = lang === 'ar' ? `ما اليوم الذي يأتي بعد يوم ${day}؟` : `Which day comes after ${day}?`;
    return { question: q, accept: [DAYS[lang][next] as string, DAYS.en[next] as string].map(normalizeAnswer) };
  },
  (lang) => {
    const ci = randInt(0, COLOURS[lang].length);
    const colour = COLOURS[lang][ci] as string;
    const options = shuffle([colour, ...sample(THINGS[lang], 2)]);
    const list = options.join(lang === 'ar' ? '، ' : ', ');
    const q = lang === 'ar' ? `أيّ هذه الكلمات اسم لون: ${list}؟` : `Which of these words is a colour: ${list}?`;
    return { question: q, accept: [colour, COLOURS.en[ci] as string].map(normalizeAnswer) };
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
    minSolveMs: 2000,
    maxAttempts: 2,
    generate({ lang, level }) {
      const { question, accept } = pick(GENERATORS)(lang);
      const pow = { salt: randomId(16), bits: powBitsFor(powBaseBits, level) };
      return {
        solution: { accept: [...new Set(accept)], pow },
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
