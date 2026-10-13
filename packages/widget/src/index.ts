import { NawaGuardElement } from './element.js';

export { NawaGuardElement, type NawaGuardErrorDetail, type NawaGuardVerifiedDetail } from './element.js';
export { STRINGS, type Lang } from './strings.js';
export { SoundEngine, setNawaGuardMuted, isNawaGuardMuted, SOUND_STORAGE_KEY, type Cue, type SoundEnv, type AudioContextLike, type StorageLike } from './sound.js';
export { THEME_PRESETS, PALETTES, CONTRAST_PAIRS, checkContrast, contrastRatio, resolveTheme, themeCss, type Appearance, type Palette, type ThemeName, type ThemePreset } from './themes.js';

export const TAG_NAME = 'nawa-guard';

/** Registers <nawa-guard>. Safe to call repeatedly and during SSR (no-op without DOM). */
export function defineNawaGuard(tag = TAG_NAME): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, tag === TAG_NAME ? NawaGuardElement : class extends NawaGuardElement {});
}

defineNawaGuard();
