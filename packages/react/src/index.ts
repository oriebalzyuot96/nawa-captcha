import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import '@nawa-guard/widget';
import type { NawaGuardElement, NawaGuardErrorDetail, NawaGuardVerifiedDetail } from '@nawa-guard/widget';

export type { NawaGuardErrorDetail, NawaGuardVerifiedDetail };

export interface NawaGuardProps {
  /** Public site key (never the secret). */
  siteKey?: string;
  /** Base URL of your captcha endpoints. Default `/captcha`. */
  endpoint?: string;
  /** Action name the backend will expect, e.g. "login". */
  action?: string;
  lang?: 'ar' | 'en';
  /** Name of the hidden form field. Default `nawa-guard-token`. */
  name?: string;
  /** Requested puzzle type (honoured only if the server allows client choice). */
  type?: string;
  /**
   * Narrows the server's allowed puzzle types for this widget, e.g. ['slider', 'rotate'] or "slider,rotate".
   * It can never widen the server's allow-list (the server is authoritative).
   */
  types?: string | readonly string[];
  className?: string;
  onVerify?: (token: string, detail: NawaGuardVerifiedDetail) => void;
  onExpire?: () => void;
  onError?: (detail: NawaGuardErrorDetail) => void;
}

function typesAttr(types: string | readonly string[] | undefined): string | undefined {
  if (types === undefined) return undefined;
  return typeof types === 'string' ? types : types.join(',');
}

export interface NawaGuardHandle {
  /** Clears the token and loads a new challenge (call after the token was used). */
  reset(): void;
  readonly token: string;
}

/** React wrapper for <nawa-guard>. Works with React 18 and 19, including SSR (renders the bare tag). */
export const NawaGuard = forwardRef(function NawaGuard(props: NawaGuardProps, ref: Ref<NawaGuardHandle>) {
  const el = useRef<NawaGuardElement | null>(null);
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
      const detail = (e as CustomEvent<NawaGuardVerifiedDetail>).detail;
      callbacks.current.onVerify?.(detail.token, detail);
    };
    const onExpired = (): void => callbacks.current.onExpire?.();
    const onError = (e: Event): void => callbacks.current.onError?.((e as CustomEvent<NawaGuardErrorDetail>).detail);
    node.addEventListener('nawa-guard:verified', onVerified);
    node.addEventListener('nawa-guard:expired', onExpired);
    node.addEventListener('nawa-guard:error', onError);
    return () => {
      node.removeEventListener('nawa-guard:verified', onVerified);
      node.removeEventListener('nawa-guard:expired', onExpired);
      node.removeEventListener('nawa-guard:error', onError);
    };
  }, []);

  return createElement('nawa-guard', {
    ref: el,
    'site-key': props.siteKey,
    endpoint: props.endpoint,
    action: props.action,
    lang: props.lang,
    name: props.name,
    type: props.type,
    types: typesAttr(props.types),
    className: props.className,
  });
});

export interface UseNawaGuard {
  /** Current pass token ('' until verified, and again after expiry). */
  readonly token: string;
  readonly verified: boolean;
  readonly error: NawaGuardErrorDetail | undefined;
  /** Spread onto <NawaGuard {...bind} />. */
  readonly bind: Pick<NawaGuardProps, 'onVerify' | 'onExpire' | 'onError'> & { ref: Ref<NawaGuardHandle> };
  /** Clears the token and requests a fresh challenge (tokens are single-use). */
  reset(): void;
}

/**
 * const guard = useNawaGuard();
 * <NawaGuard action="login" {...guard.bind} />
 * fetch('/api/login', { headers: { 'X-Nawa-Guard-Token': guard.token } }).finally(guard.reset)
 */
export function useNawaGuard(): UseNawaGuard {
  const [token, setToken] = useState('');
  const [error, setError] = useState<NawaGuardErrorDetail | undefined>();
  const handle = useRef<NawaGuardHandle>(null);
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
      onError: (d: NawaGuardErrorDetail) => {
        setToken('');
        setError(d);
      },
    }),
    [],
  );
  return { token, verified: token !== '', error, bind, reset };
}
