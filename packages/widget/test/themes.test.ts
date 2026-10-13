import { describe, expect, it } from 'vitest';
import { STYLES } from '../src/styles.js';
import { checkContrast, contrastRatio, CONTRAST_PAIRS, PALETTES, resolveTheme, THEME_PRESETS, themeCss, TOKENS } from '../src/themes.js';

describe('themes: WCAG 2.2 AA', () => {
  it('every preset (light + dark) and high contrast passes every rendered pair', () => {
    const { checked, failures } = checkContrast();
    expect(checked).toBe(Object.keys(PALETTES).length * 2 * CONTRAST_PAIRS.length);
    expect(failures).toEqual([]);
  });

  it('computes WCAG contrast ratios correctly', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('ships the six presets with complete palettes', () => {
    expect([...THEME_PRESETS]).toEqual(['orca', 'midnight', 'aurora', 'sand', 'ocean', 'mono']);
    for (const p of Object.values(PALETTES)) for (const scheme of [p.light, p.dark]) for (const [key] of TOKENS) expect(scheme[key]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('themes: resolution', () => {
  const light = { dark: false, moreContrast: false };
  const dark = { dark: true, moreContrast: false };
  const more = { dark: false, moreContrast: true };

  it('auto follows prefers-color-scheme and prefers-contrast', () => {
    expect(resolveTheme(null, null, light)).toEqual({ preset: 'orca', scheme: 'light', highContrast: false, explicit: false });
    expect(resolveTheme('auto', null, dark)).toMatchObject({ scheme: 'dark', explicit: false });
    expect(resolveTheme('auto', null, more)).toMatchObject({ highContrast: true, explicit: true });
  });

  it('presets are explicit; appearance shorthands work', () => {
    expect(resolveTheme('midnight', 'dark', light)).toEqual({ preset: 'midnight', scheme: 'dark', highContrast: false, explicit: true });
    expect(resolveTheme('sand', null, dark)).toMatchObject({ preset: 'sand', scheme: 'dark' });
    expect(resolveTheme('dark', null, light)).toMatchObject({ preset: 'orca', scheme: 'dark', explicit: false });
    expect(resolveTheme('high-contrast', null, dark)).toMatchObject({ highContrast: true, scheme: 'dark' });
    expect(resolveTheme('ocean', 'light', more)).toMatchObject({ preset: 'ocean', scheme: 'light', highContrast: false });
    expect(resolveTheme('nonsense', null, light)).toMatchObject({ preset: 'orca', explicit: false });
  });
});

describe('themes: CSS', () => {
  const css = themeCss();

  it('resolves --nawa-captcha-* (legacy --nawa-guard-*) → preset → Orca UI (--oc-*) → legacy Nawa UI (--nw-*) → default, for every token', () => {
    for (const [, name] of TOKENS) {
      expect(css).toContain(`--_${name}:var(--nawa-captcha-${name},var(--nawa-guard-${name},var(--_t-${name},var(--oc-${name},var(--nw-${name},var(--_d-${name}))))));`);
    }
  });

  it('emits light and dark blocks for every preset plus high contrast', () => {
    for (const p of THEME_PRESETS) {
      expect(css).toContain(`.ng[data-theme="${p}"][data-scheme="light"]{`);
      expect(css).toContain(`.ng[data-theme="${p}"][data-scheme="dark"]{`);
    }
    expect(css).toContain('.ng[data-contrast="high"][data-scheme="dark"]{');
  });

  it('turns off tilt/parallax/burst for reduced motion and handles forced colors', () => {
    const reduced = STYLES.slice(STYLES.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/animation: none !important; transition: none !important/);
    expect(reduced).toMatch(/\.ng \{ transform: none !important; \}/);
    expect(reduced).toMatch(/\.spark \{ display: none; \}|\.ng::after, \.spark \{ display: none; \}/);
    expect(STYLES).toContain('@media (forced-colors: active)');
  });

  it('keeps a visible focus indicator', () => {
    expect(STYLES).toContain(':focus-visible { outline: 3px solid var(--_focus); outline-offset: 2px; }');
  });
});
