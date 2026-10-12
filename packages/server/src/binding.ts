import { b64url, hmac } from './crypto.js';

/** Which client attributes a token is bound to. Encoded in the token as `cbm`. */
export type BindMode = 'none' | 'ip' | 'ua' | 'ip+ua';
export const BIND_MODES: readonly BindMode[] = ['none', 'ip', 'ua', 'ip+ua'];

export interface ClientInfo {
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
}

const MAX_UA = 512;

/** `::ffff:1.2.3.4` and `1.2.3.4` are the same client; IPv6 is compared lower-case. */
export function normalizeIp(ip: string | undefined): string {
  if (!ip) return '';
  let value = ip.trim().toLowerCase();
  if (value.startsWith('::ffff:') && value.includes('.')) value = value.slice(7);
  return value;
}

export function normalizeUa(ua: string | undefined): string {
  return (ua ?? '').trim().slice(0, MAX_UA);
}

/**
 * The exact string hashed into `cb`. Mirrored byte-for-byte by the .NET verifier:
 *   ip mode:    "ip=<ip>"
 *   ua mode:    "ua=<ua>"
 *   ip+ua mode: "ip=<ip>\nua=<ua>"
 */
export function bindingMaterial(mode: BindMode, client: ClientInfo): string | undefined {
  const ip = normalizeIp(client.ip);
  const ua = normalizeUa(client.userAgent);
  switch (mode) {
    case 'none':
      return undefined;
    case 'ip':
      return ip ? `ip=${ip}` : undefined;
    case 'ua':
      return ua ? `ua=${ua}` : undefined;
    case 'ip+ua':
      return ip && ua ? `ip=${ip}\nua=${ua}` : undefined;
  }
}

/** Returns base64url(HMAC-SHA256(K_bind, material)), or undefined when the client info is missing. */
export function bindingHash(key: Uint8Array, mode: BindMode, client: ClientInfo): string | undefined {
  const material = bindingMaterial(mode, client);
  return material === undefined ? undefined : b64url(hmac(key, material));
}

/** Pseudonymous per-client key for counters (rate limits, adaptive difficulty). Never stores raw IPs. */
export function clientKey(key: Uint8Array, client: ClientInfo): string {
  const ip = normalizeIp(client.ip);
  return b64url(hmac(key, `ck=${ip || 'unknown'}`)).slice(0, 22);
}
