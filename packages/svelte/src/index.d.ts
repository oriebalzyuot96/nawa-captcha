import type { Component } from 'svelte';
import type { NawaGuardErrorDetail, NawaGuardVerifiedDetail } from '@nawa-guard/widget';

export type { NawaGuardErrorDetail, NawaGuardVerifiedDetail };

export interface NawaGuardProps {
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
  onverified?: (detail: NawaGuardVerifiedDetail) => void;
  onexpired?: () => void;
  onerror?: (detail: NawaGuardErrorDetail) => void;
}

export declare const NawaGuard: Component<NawaGuardProps, { reset(): void }, 'token'>;
