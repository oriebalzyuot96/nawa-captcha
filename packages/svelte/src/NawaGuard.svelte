<!--
  Svelte 5 wrapper for <nawa-guard>.
  <NawaGuard bind:token action="login" lang="ar" onverified={(d) => …} />
  `token` is bindable: it holds the pass token ('' until verified). Call `reset()` (via bind:this)
  after the token has been used, because pass tokens are single-use.
-->
<script lang="ts">
  import '@nawa-guard/widget';
  import type { NawaGuardElement, NawaGuardErrorDetail, NawaGuardVerifiedDetail } from '@nawa-guard/widget';

  interface Props {
    siteKey?: string;
    endpoint?: string;
    action?: string;
    lang?: 'ar' | 'en';
    name?: string;
    type?: string;
    /** Narrows the server's allowed puzzle types (array or comma-separated). Never widens it. */
    types?: string | readonly string[];
    token?: string;
    onverified?: (detail: NawaGuardVerifiedDetail) => void;
    onexpired?: () => void;
    onerror?: (detail: NawaGuardErrorDetail) => void;
  }

  let { siteKey, endpoint, action, lang, name, type, types, token = $bindable(''), onverified, onexpired, onerror }: Props = $props();

  let el: NawaGuardElement | undefined = $state();
  const typesAttr = $derived(types === undefined ? undefined : typeof types === 'string' ? types : types.join(','));

  $effect(() => {
    const node = el;
    if (!node) return;
    const verified = (e: Event): void => {
      const detail = (e as CustomEvent<NawaGuardVerifiedDetail>).detail;
      token = detail.token;
      onverified?.(detail);
    };
    const expired = (): void => {
      token = '';
      onexpired?.();
    };
    const failed = (e: Event): void => {
      token = '';
      onerror?.((e as CustomEvent<NawaGuardErrorDetail>).detail);
    };
    node.addEventListener('nawa-guard:verified', verified);
    node.addEventListener('nawa-guard:expired', expired);
    node.addEventListener('nawa-guard:error', failed);
    return () => {
      node.removeEventListener('nawa-guard:verified', verified);
      node.removeEventListener('nawa-guard:expired', expired);
      node.removeEventListener('nawa-guard:error', failed);
    };
  });

  /** Clears the token and loads a fresh challenge. */
  export function reset(): void {
    token = '';
    el?.reset();
  }
</script>

<nawa-guard bind:this={el} site-key={siteKey} {endpoint} {action} {lang} {name} {type} types={typesAttr}></nawa-guard>
