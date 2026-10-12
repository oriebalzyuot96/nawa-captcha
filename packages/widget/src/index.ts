import { NawaGuardElement } from './element.js';

export { NawaGuardElement, type NawaGuardErrorDetail, type NawaGuardVerifiedDetail } from './element.js';
export { STRINGS, type Lang } from './strings.js';

export const TAG_NAME = 'nawa-guard';

/** Registers <nawa-guard>. Safe to call repeatedly and during SSR (no-op without DOM). */
export function defineNawaGuard(tag = TAG_NAME): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) customElements.define(tag, tag === TAG_NAME ? NawaGuardElement : class extends NawaGuardElement {});
}

defineNawaGuard();
