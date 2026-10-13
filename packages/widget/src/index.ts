import { LEGACY_TAG_NAME, NawaCaptchaElement, NawaGuardLegacyElement } from './element.js';

export { NawaCaptchaElement, type NawaCaptchaErrorDetail, type NawaCaptchaVerifiedDetail } from './element.js';
/** @deprecated Renamed to {@link NawaCaptchaElement} (Nawa Guard is now Nawa Captcha). */
export { NawaCaptchaElement as NawaGuardElement } from './element.js';
/** @deprecated Renamed to NawaCaptchaVerifiedDetail / NawaCaptchaErrorDetail. */
export type { NawaCaptchaErrorDetail as NawaGuardErrorDetail, NawaCaptchaVerifiedDetail as NawaGuardVerifiedDetail } from './element.js';
/** @deprecated Renamed to setNawaCaptchaMuted / isNawaCaptchaMuted. */
export { setNawaCaptchaMuted as setNawaGuardMuted, isNawaCaptchaMuted as isNawaGuardMuted } from './sound.js';
export { STRINGS, type Lang } from './strings.js';
export { SoundEngine, setNawaCaptchaMuted, isNawaCaptchaMuted, SOUND_STORAGE_KEY, type Cue, type SoundEnv, type AudioContextLike, type StorageLike } from './sound.js';
export { THEME_PRESETS, PALETTES, CONTRAST_PAIRS, checkContrast, contrastRatio, resolveTheme, themeCss, type Appearance, type Palette, type ThemeName, type ThemePreset } from './themes.js';

export const TAG_NAME = 'nawa-captcha';
export { LEGACY_TAG_NAME };

/**
 * Registers <nawa-captcha> and, for this release, the deprecated <nawa-guard> alias (which keeps
 * the old default field name "nawa-guard-token"). Safe to call repeatedly and during SSR.
 */
export function defineNawaCaptcha(tag = TAG_NAME): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, tag === TAG_NAME ? NawaCaptchaElement : class extends NawaCaptchaElement {});
  if (tag === TAG_NAME && !customElements.get(LEGACY_TAG_NAME)) customElements.define(LEGACY_TAG_NAME, NawaGuardLegacyElement);
}

/** @deprecated Renamed to {@link defineNawaCaptcha}. */
export const defineNawaGuard = defineNawaCaptcha;

defineNawaCaptcha();
