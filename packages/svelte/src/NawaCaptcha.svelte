<!--
  Svelte 5 wrapper for <nawa-captcha>.
  <NawaCaptcha bind:token action="login" lang="ar" onverified={(d) => …} />
  `token` is bindable: it holds the pass token ('' until verified). Call `reset()` (via bind:this)
  after the token has been used, because pass tokens are single-use.
-->
<script lang="ts">
  import '@nawa-captcha/widget';
  import type { NawaCaptchaElement, NawaCaptchaErrorDetail, NawaCaptchaVerifiedDetail } from '@nawa-captcha/widget';

  interface Props {
    siteKey?: string;
    endpoint?: string;
    action?: string;
    lang?: 'ar' | 'en';
    name?: string;
    type?: string;
    /** Narrows the server's allowed puzzle types (array or comma-separated). Never widens it. */
    types?: string | readonly string[];
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

  let { siteKey, endpoint, action, lang, name, type, types, theme, appearance, sound, volume, muted, token = $bindable(''), onverified, onexpired, onerror }: Props = $props();

  let el: NawaCaptchaElement | undefined = $state();
  const typesAttr = $derived(types === undefined ? undefined : typeof types === 'string' ? types : types.join(','));

  $effect(() => {
    const node = el;
    if (!node) return;
    const verified = (e: Event): void => {
      const detail = (e as CustomEvent<NawaCaptchaVerifiedDetail>).detail;
      token = detail.token;
      onverified?.(detail);
    };
    const expired = (): void => {
      token = '';
      onexpired?.();
    };
    const failed = (e: Event): void => {
      token = '';
      onerror?.((e as CustomEvent<NawaCaptchaErrorDetail>).detail);
    };
    node.addEventListener('nawa-captcha:verified', verified);
    node.addEventListener('nawa-captcha:expired', expired);
    node.addEventListener('nawa-captcha:error', failed);
    return () => {
      node.removeEventListener('nawa-captcha:verified', verified);
      node.removeEventListener('nawa-captcha:expired', expired);
      node.removeEventListener('nawa-captcha:error', failed);
    };
  });

  /** Clears the token and loads a fresh challenge. */
  export function reset(): void {
    token = '';
    el?.reset();
  }
</script>

<nawa-captcha bind:this={el} site-key={siteKey} {endpoint} {action} {lang} {name} {type} types={typesAttr} {theme} {appearance} {sound} {volume} {muted}></nawa-captcha>
