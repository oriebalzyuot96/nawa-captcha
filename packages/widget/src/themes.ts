/*
 * Theme presets for <nawa-captcha>. Every preset has a light and a dark palette; high contrast is
 * its own pair. All text/UI pairs are checked against WCAG 2.2 AA by `npm run check:contrast`
 * (and the widget test suite), which fails CI on any failing pair.
 *
 * Resolution order for each colour (first defined wins):
 *   --nawa-captcha-*          per-widget override (CSS custom property on the element or an ancestor;
 *                             the pre-rename --nawa-guard-* names still work)
 *   explicit preset           theme="midnight" etc., or the high-contrast palette
 *   --oc-*                    Orca UI design tokens (inherited from the page)
 *   --nw-*                    legacy Nawa UI tokens (Orca UI's previous name)
 *   built-in default          Orca violet, light or dark following the appearance
 */

export const THEME_PRESETS = ['orca', 'midnight', 'aurora', 'sand', 'ocean', 'mono'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
/** `theme` attribute values: a preset, `auto` (default), or an appearance shorthand. */
export type ThemeName = ThemePreset | 'auto' | 'light' | 'dark' | 'high-contrast';
export type Appearance = 'auto' | 'light' | 'dark' | 'high-contrast';
export type Scheme = 'light' | 'dark';

export interface Palette {
  readonly primary: string;
  readonly primaryHover: string;
  /** Tinted background for selected/active states; primary text sits on it. */
  readonly primarySoft: string;
  readonly onPrimary: string;
  /** Decorative second hue (glows, gradients). Never carries text. */
  readonly accent: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  /** Borders of inputs and tracks (WCAG 1.4.11: ≥ 3:1). */
  readonly controlBorder: string;
  readonly focus: string;
  readonly danger: string;
  readonly dangerSoft: string;
  readonly success: string;
  readonly successSoft: string;
}

export const PALETTES: Readonly<Record<ThemePreset | 'high-contrast', Readonly<Record<Scheme, Palette>>>> = {
  orca: {
    light: { primary: '#5b34d6', primaryHover: '#4a25bd', primarySoft: '#ede8ff', onPrimary: '#ffffff', accent: '#14b8c8', surface: '#ffffff', surfaceAlt: '#f4f1fd', text: '#1b1530', muted: '#575170', border: '#e1dbf3', controlBorder: '#857ca3', focus: '#5b34d6', danger: '#b42330', dangerSoft: '#fdecee', success: '#0f6b3a', successSoft: '#e6f5ec' },
    dark: { primary: '#b6a2ff', primaryHover: '#cbbdff', primarySoft: '#2d2553', onPrimary: '#1a0f45', accent: '#4fe3f0', surface: '#17132a', surfaceAlt: '#211c3a', text: '#f3f0ff', muted: '#b9b0d8', border: '#372f5c', controlBorder: '#857aaf', focus: '#c9bbff', danger: '#ff98a0', dangerSoft: '#3b1b26', success: '#6fe0a0', successSoft: '#15322a' },
  },
  midnight: {
    light: { primary: '#2f48c4', primaryHover: '#243ba6', primarySoft: '#e6ebfb', onPrimary: '#ffffff', accent: '#8b6cff', surface: '#fbfcff', surfaceAlt: '#eff2fb', text: '#0f1a33', muted: '#4a5677', border: '#d8dff0', controlBorder: '#7a86a6', focus: '#2f48c4', danger: '#b42330', dangerSoft: '#fdecee', success: '#0f6b3a', successSoft: '#e6f5ec' },
    dark: { primary: '#93a9ff', primaryHover: '#b2c1ff', primarySoft: '#1c2850', onPrimary: '#0a1230', accent: '#b69cff', surface: '#0c1224', surfaceAlt: '#141c34', text: '#e9eefc', muted: '#a6b2d2', border: '#26325a', controlBorder: '#6f7ca6', focus: '#acbcff', danger: '#ff98a0', dangerSoft: '#3a1a26', success: '#6fe0a0', successSoft: '#12302a' },
  },
  aurora: {
    light: { primary: '#0b7a63', primaryHover: '#08624f', primarySoft: '#dcf3ea', onPrimary: '#ffffff', accent: '#8b5cf6', surface: '#fbfffd', surfaceAlt: '#ebf7f2', text: '#0d2420', muted: '#3f5f58', border: '#cfe6de', controlBorder: '#6b8d84', focus: '#0b7a63', danger: '#b42330', dangerSoft: '#fdecee', success: '#0f6b3a', successSoft: '#e3f4ea' },
    dark: { primary: '#4fe0b5', primaryHover: '#7aeccb', primarySoft: '#133a35', onPrimary: '#04201a', accent: '#b18cff', surface: '#08161a', surfaceAlt: '#0f2328', text: '#e3fbf4', muted: '#9fc6bb', border: '#1e3c42', controlBorder: '#5f8d84', focus: '#6ff0c8', danger: '#ff98a0', dangerSoft: '#3a1a24', success: '#6fe0a0', successSoft: '#11302a' },
  },
  sand: {
    light: { primary: '#9a4a12', primaryHover: '#7f3c0d', primarySoft: '#f7e8d8', onPrimary: '#ffffff', accent: '#d99a2b', surface: '#fffdf8', surfaceAlt: '#f7f0e4', text: '#2a2116', muted: '#65553f', border: '#e8dcc8', controlBorder: '#93816a', focus: '#9a4a12', danger: '#b02a2a', dangerSoft: '#fdecea', success: '#2f6a12', successSoft: '#ecf4e2' },
    dark: { primary: '#f0b36b', primaryHover: '#f6c88f', primarySoft: '#3a2c1a', onPrimary: '#2a1a06', accent: '#f2d08a', surface: '#1d1913', surfaceAlt: '#2a241b', text: '#f7efe1', muted: '#cbbca2', border: '#3f3628', controlBorder: '#8c7c63', focus: '#f5c27f', danger: '#ff9a8f', dangerSoft: '#3b1e18', success: '#9fdc7a', successSoft: '#22301a' },
  },
  ocean: {
    light: { primary: '#0566a6', primaryHover: '#04558a', primarySoft: '#ddeef8', onPrimary: '#ffffff', accent: '#00b3a4', surface: '#fbfeff', surfaceAlt: '#eaf5fb', text: '#0b2230', muted: '#3d5d6e', border: '#cde3ee', controlBorder: '#6a8c9e', focus: '#0566a6', danger: '#b42330', dangerSoft: '#fdecee', success: '#0f6b3a', successSoft: '#e6f5ec' },
    dark: { primary: '#5cc3ff', primaryHover: '#8ad4ff', primarySoft: '#0f3550', onPrimary: '#032032', accent: '#4fe3d2', surface: '#071a26', surfaceAlt: '#0d2534', text: '#e3f4fc', muted: '#9fc3d4', border: '#1b3a4c', controlBorder: '#5b8aa1', focus: '#7fd0ff', danger: '#ff98a0', dangerSoft: '#3a1a24', success: '#6fe0a0', successSoft: '#10302a' },
  },
  mono: {
    light: { primary: '#1c1c1f', primaryHover: '#000000', primarySoft: '#e9e9ec', onPrimary: '#ffffff', accent: '#8a8a92', surface: '#ffffff', surfaceAlt: '#f3f3f4', text: '#111113', muted: '#535358', border: '#dedee2', controlBorder: '#84848b', focus: '#1c1c1f', danger: '#b01e2a', dangerSoft: '#fbeced', success: '#1b6630', successSoft: '#e8f3eb' },
    dark: { primary: '#f2f2f3', primaryHover: '#ffffff', primarySoft: '#2c2c30', onPrimary: '#111113', accent: '#a0a0a8', surface: '#141416', surfaceAlt: '#1e1e21', text: '#f2f2f3', muted: '#b3b3b9', border: '#333338', controlBorder: '#7a7a82', focus: '#f2f2f3', danger: '#ff9aa2', dangerSoft: '#381c20', success: '#86e0a2', successSoft: '#183022' },
  },
  'high-contrast': {
    light: { primary: '#3300a8', primaryHover: '#220070', primarySoft: '#ffffff', onPrimary: '#ffffff', accent: '#000000', surface: '#ffffff', surfaceAlt: '#ffffff', text: '#000000', muted: '#1a1a1a', border: '#000000', controlBorder: '#000000', focus: '#0033cc', danger: '#9e0000', dangerSoft: '#ffffff', success: '#005a1e', successSoft: '#ffffff' },
    dark: { primary: '#ffe14d', primaryHover: '#fff07a', primarySoft: '#000000', onPrimary: '#000000', accent: '#ffffff', surface: '#000000', surfaceAlt: '#000000', text: '#ffffff', muted: '#e8e8e8', border: '#ffffff', controlBorder: '#ffffff', focus: '#00e5ff', danger: '#ff8080', dangerSoft: '#000000', success: '#6dff9e', successSoft: '#000000' },
  },
};

/** Token name ↔ palette key. Orca UI (`--oc-*`) and legacy Nawa UI (`--nw-*`) use the same suffixes. */
export const TOKENS: ReadonlyArray<readonly [keyof Palette, string]> = [
  ['primary', 'primary'],
  ['primaryHover', 'primary-hover'],
  ['primarySoft', 'primary-soft'],
  ['onPrimary', 'on-primary'],
  ['accent', 'accent'],
  ['surface', 'surface'],
  ['surfaceAlt', 'surface-alt'],
  ['text', 'text'],
  ['muted', 'text-muted'],
  ['border', 'border'],
  ['controlBorder', 'control-border'],
  ['focus', 'focus'],
  ['danger', 'danger'],
  ['dangerSoft', 'danger-soft'],
  ['success', 'success'],
  ['successSoft', 'success-soft'],
];

// ------------------------------------------------------------------------------- contrast

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every foreground/background pair the widget actually renders, with its WCAG 2.2 AA minimum. */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [fg: keyof Palette, bg: keyof Palette, min: number, use: string]> = [
  ['text', 'surface', 4.5, 'body text'],
  ['text', 'surfaceAlt', 4.5, 'text on wells (question, inputs)'],
  ['muted', 'surface', 4.5, 'hints and status'],
  ['muted', 'surfaceAlt', 4.5, 'hints on wells'],
  ['onPrimary', 'primary', 4.5, 'primary button label'],
  ['onPrimary', 'primaryHover', 4.5, 'primary button label (hover)'],
  ['primary', 'surface', 4.5, 'secondary button label, links'],
  ['primary', 'primarySoft', 4.5, 'step badge, pressed icon button'],
  ['primary', 'surfaceAlt', 3, 'selection outline, slider thumb on track'],
  ['focus', 'surface', 3, 'focus ring'],
  ['focus', 'surfaceAlt', 3, 'focus ring on wells'],
  ['controlBorder', 'surface', 3, 'input/track border'],
  ['controlBorder', 'surfaceAlt', 3, 'track border on wells'],
  ['danger', 'surface', 4.5, 'error status'],
  ['danger', 'dangerSoft', 4.5, 'error box'],
  ['success', 'surface', 4.5, 'success status'],
  ['success', 'successSoft', 4.5, 'verified box'],
];

export interface ContrastFailure {
  readonly palette: string;
  readonly fg: keyof Palette;
  readonly bg: keyof Palette;
  readonly ratio: number;
  readonly min: number;
  readonly use: string;
}

/** Checks every pair of every palette; returns the failures (empty = all AA). */
export function checkContrast(): { checked: number; failures: ContrastFailure[] } {
  const failures: ContrastFailure[] = [];
  let checked = 0;
  for (const [name, schemes] of Object.entries(PALETTES)) {
    for (const [scheme, p] of Object.entries(schemes) as Array<[Scheme, Palette]>) {
      for (const [fg, bg, min, use] of CONTRAST_PAIRS) {
        checked += 1;
        const ratio = contrastRatio(p[fg], p[bg]);
        if (ratio < min) failures.push({ palette: `${name}/${scheme}`, fg, bg, ratio: Math.round(ratio * 100) / 100, min, use });
      }
    }
  }
  return { checked, failures };
}

// ------------------------------------------------------------------------------- resolution

export function isPreset(v: string | null | undefined): v is ThemePreset {
  return !!v && (THEME_PRESETS as readonly string[]).includes(v);
}

/**
 * Resolves the `theme` and `appearance` attributes plus the user's system preferences into the
 * palette the widget renders. `explicit` is false when page tokens (Orca UI) may take over.
 */
export function resolveTheme(
  theme: string | null | undefined,
  appearance: string | null | undefined,
  system: { dark: boolean; moreContrast: boolean },
): { preset: ThemePreset; scheme: Scheme; highContrast: boolean; explicit: boolean } {
  const t = (theme ?? '').trim().toLowerCase();
  let a = (appearance ?? '').trim().toLowerCase();
  if (t === 'light' || t === 'dark' || t === 'high-contrast') a = t;
  const preset: ThemePreset = isPreset(t) ? t : 'orca';
  const highContrast = a === 'high-contrast' || ((a === '' || a === 'auto') && system.moreContrast);
  const scheme: Scheme = a === 'light' ? 'light' : a === 'dark' ? 'dark' : system.dark ? 'dark' : 'light';
  return { preset, scheme, highContrast, explicit: isPreset(t) || highContrast };
}

/** CSS declarations for one palette as `--<prefix>-<token>` custom properties. */
export function paletteVars(p: Palette, prefix: string): string {
  return TOKENS.map(([key, name]) => `--${prefix}-${name}:${p[key]};`).join('');
}

/** The theme layer of the stylesheet (generated so the CSS and the contrast check share one source). */
export function themeCss(): string {
  const out: string[] = [];
  // Defaults (light/dark follow data-scheme): used only when neither a preset nor page tokens apply.
  out.push(`.ng{${paletteVars(PALETTES.orca.light, '_d')}}`);
  out.push(`.ng[data-scheme="dark"]{${paletteVars(PALETTES.orca.dark, '_d')}}`);
  for (const preset of THEME_PRESETS) {
    out.push(`.ng[data-theme="${preset}"][data-scheme="light"]{${paletteVars(PALETTES[preset].light, '_t')}}`);
    out.push(`.ng[data-theme="${preset}"][data-scheme="dark"]{${paletteVars(PALETTES[preset].dark, '_t')}}`);
  }
  // High contrast wins over presets and page tokens.
  out.push(`.ng[data-contrast="high"][data-scheme="light"]{${paletteVars(PALETTES['high-contrast'].light, '_t')}}`);
  out.push(`.ng[data-contrast="high"][data-scheme="dark"]{${paletteVars(PALETTES['high-contrast'].dark, '_t')}}`);
  // The resolved tokens.
  const resolve = TOKENS.map(([, name]) => `--_${name}:var(--nawa-captcha-${name},var(--nawa-guard-${name},var(--_t-${name},var(--oc-${name},var(--nw-${name},var(--_d-${name}))))));`).join('');
  out.push(`.ng{${resolve}}`);
  return out.join('\n');
}
