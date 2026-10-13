import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import '@nawa-captcha/widget';
import type { NawaCaptchaElement, NawaCaptchaErrorDetail, NawaCaptchaVerifiedDetail } from '@nawa-captcha/widget';

export type { NawaCaptchaErrorDetail, NawaCaptchaVerifiedDetail };

export interface NawaCaptchaProps {
  /** Public site key (never the secret). */
  siteKey?: string;
  /** Base URL of your captcha endpoints. Default `/captcha`. */
  endpoint?: string;
  /** Action name the backend will expect, e.g. "login". */
  action?: string;
  lang?: 'ar' | 'en';
  /** Name of the hidden form field. Default `nawa-captcha-token`. */
  name?: string;
  /** Requested puzzle type (honoured only if the server allows client choice). */
  type?: string;
  /**
   * Narrows the server's allowed puzzle types for this widget, e.g. ['slider', 'rotate'] or "slider,rotate".
   * It can never widen the server's allow-list (the server is authoritative).
   */
  types?: string | readonly string[];
  /** Theme preset (`pelagic`, `midnight`, `aurora`, `sand`, `ocean`, `mono`), `auto` (default), or `light`/`dark`/`high-contrast`. */
  theme?: string;
  /** `auto` (default, follows the OS), `light`, `dark` or `high-contrast`. */
  appearance?: 'auto' | 'light' | 'dark' | 'high-contrast';
  /** Turns UI sound effects on by default (the visitor's own toggle choice still wins). Off by default. */
  sound?: boolean;
  /** UI sound volume 0..1 (default 0.6). */
  volume?: number;
  /** Silences the widget regardless of the visitor's choice (e.g. your app's own mute). */
  muted?: boolean;
  className?: string;
  onVerify?: (token: string, detail: NawaCaptchaVerifiedDetail) => void;
  onExpire?: () => void;
  onError?: (detail: NawaCaptchaErrorDetail) => void;
}

function typesAttr(types: string | readonly string[] | undefined): string | undefined {
  if (types === undefined) return undefined;
  return typeof types === 'string' ? types : types.join(',');
}

export interface NawaCaptchaHandle {
  /** Clears the token and loads a new challenge (call after the token was used). */
  reset(): void;
  readonly token: string;
}

/** React wrapper for <nawa-captcha>. Works with React 18 and 19, including SSR (renders the bare tag). */
export const NawaCaptcha = forwardRef(function NawaCaptcha(props: NawaCaptchaProps, ref: Ref<NawaCaptchaHandle>) {
  const el = useRef<NawaCaptchaElement | null>(null);
  // Latest callbacks without re-binding DOM listeners on every render.
  const callbacks = useRef(props);
  callbacks.current = props;

  useImperativeHandle(ref, () => ({
    reset: () => el.current?.reset(),
    get token() {
      return el.current?.token ?? '';
    },
  }));

  useEffect(() => {
    const node = el.current;
    if (!node) return undefined;
    const onVerified = (e: Event): void => {
      const detail = (e as CustomEvent<NawaCaptchaVerifiedDetail>).detail;
      callbacks.current.onVerify?.(detail.token, detail);
    };
    const onExpired = (): void => callbacks.current.onExpire?.();
    const onError = (e: Event): void => callbacks.current.onError?.((e as CustomEvent<NawaCaptchaErrorDetail>).detail);
    node.addEventListener('nawa-captcha:verified', onVerified);
    node.addEventListener('nawa-captcha:expired', onExpired);
    node.addEventListener('nawa-captcha:error', onError);
    return () => {
      node.removeEventListener('nawa-captcha:verified', onVerified);
      node.removeEventListener('nawa-captcha:expired', onExpired);
      node.removeEventListener('nawa-captcha:error', onError);
    };
  }, []);

  return createElement('nawa-captcha', {
    ref: el,
    'site-key': props.siteKey,
    endpoint: props.endpoint,
    action: props.action,
    lang: props.lang,
    name: props.name,
    type: props.type,
    types: typesAttr(props.types),
    theme: props.theme,
    appearance: props.appearance,
    // Booleans work both as React 18 attributes ("true"/"false") and React 19 element properties.
    sound: props.sound,
    volume: props.volume,
    muted: props.muted,
    className: props.className,
  });
});

export interface UseNawaCaptcha {
  /** Current pass token ('' until verified, and again after expiry). */
  readonly token: string;
  readonly verified: boolean;
  readonly error: NawaCaptchaErrorDetail | undefined;
  /** Spread onto <NawaCaptcha {...bind} />. */
  readonly bind: Pick<NawaCaptchaProps, 'onVerify' | 'onExpire' | 'onError'> & { ref: Ref<NawaCaptchaHandle> };
  /** Clears the token and requests a fresh challenge (tokens are single-use). */
  reset(): void;
}

/**
 * const guard = useNawaCaptcha();
 * <NawaCaptcha action="login" {...guard.bind} />
 * fetch('/api/login', { headers: { 'X-Nawa-Captcha-Token': guard.token } }).finally(guard.reset)
 */
export function useNawaCaptcha(): UseNawaCaptcha {
  const [token, setToken] = useState('');
  const [error, setError] = useState<NawaCaptchaErrorDetail | undefined>();
  const handle = useRef<NawaCaptchaHandle>(null);
  const reset = useCallback(() => {
    setToken('');
    handle.current?.reset();
  }, []);
  const bind = useMemo(
    () => ({
      ref: handle,
      onVerify: (t: string) => {
        setError(undefined);
        setToken(t);
      },
      onExpire: () => setToken(''),
      onError: (d: NawaCaptchaErrorDetail) => {
        setToken('');
        setError(d);
      },
    }),
    [],
  );
  return { token, verified: token !== '', error, bind, reset };
}

// Deprecated aliases (Nawa Guard was renamed to Nawa Captcha); they keep working for this release.
/** @deprecated Renamed to {@link NawaCaptcha}. */
export const NawaGuard = NawaCaptcha;
/** @deprecated Renamed to {@link useNawaCaptcha}. */
export const useNawaGuard = useNawaCaptcha;
/** @deprecated Renamed to NawaCaptchaProps. */
export type NawaGuardProps = NawaCaptchaProps;
/** @deprecated Renamed to NawaCaptchaHandle. */
export type NawaGuardHandle = NawaCaptchaHandle;
/** @deprecated Renamed to UseNawaCaptcha. */
export type UseNawaGuard = UseNawaCaptcha;
/** @deprecated Renamed to NawaCaptchaVerifiedDetail / NawaCaptchaErrorDetail. */
export type { NawaCaptchaErrorDetail as NawaGuardErrorDetail, NawaCaptchaVerifiedDetail as NawaGuardVerifiedDetail };
