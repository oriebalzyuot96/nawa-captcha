import type { Component } from 'svelte';
import type { NawaCaptchaErrorDetail, NawaCaptchaVerifiedDetail } from '@nawa-captcha/widget';

export type { NawaCaptchaErrorDetail, NawaCaptchaVerifiedDetail };

export interface NawaCaptchaProps {
  siteKey?: string;
  endpoint?: string;
  action?: string;
  lang?: 'ar' | 'en';
  name?: string;
  type?: string;
  /** Narrows the server's allowed puzzle types. Never widens it. */
  types?: string | readonly string[];
  /** Theme preset or appearance shorthand (see the widget README). */
  theme?: string;
  appearance?: 'auto' | 'light' | 'dark' | 'high-contrast';
  sound?: boolean;
  volume?: number;
  muted?: boolean;
  token?: string;
  onverified?: (detail: NawaCaptchaVerifiedDetail) => void;
  onexpired?: () => void;
  onerror?: (detail: NawaCaptchaErrorDetail) => void;
}

export declare const NawaCaptcha: Component<NawaCaptchaProps, { reset(): void }, 'token'>;
/** @deprecated Renamed to {@link NawaCaptcha} (Nawa Guard is now Nawa Captcha). */
export declare const NawaGuard: typeof NawaCaptcha;
/** @deprecated Renamed to NawaCaptchaProps. */
export type NawaGuardProps = NawaCaptchaProps;
