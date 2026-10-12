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
  token?: string;
  onverified?: (detail: NawaGuardVerifiedDetail) => void;
  onexpired?: () => void;
  onerror?: (detail: NawaGuardErrorDetail) => void;
}

export declare const NawaGuard: Component<NawaGuardProps, { reset(): void }, 'token'>;
