type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

/** Tiny hyperscript. Text is always inserted as text nodes, never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function setAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    // CSSOM writes are allowed under a strict CSP; a `style` attribute would need 'unsafe-inline'.
    if (k === 'style') (el as HTMLElement).style.cssText = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

/** Static, trusted icon markup (constants in this file only). */
export type IconName = 'refresh' | 'a11y' | 'check' | 'arrows' | 'rotate' | 'alert' | 'sound-on' | 'sound-off' | 'play' | 'clock' | 'shield' | 'text' | 'headphones';

export function icon(name: IconName): SVGSVGElement {
  const paths: Record<typeof name, string[]> = {
    refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
    a11y: ['M10.5 4.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0','M5 8.5l7 1.5 7-1.5', 'M12 10v4l-3 6', 'M12 14l3 6'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    arrows: ['M9 6l-6 6 6 6', 'M15 6l6 6-6 6'],
    rotate: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v5h5'],
    alert: ['M12 8v5', 'M12 16.5v.01', 'M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
    'sound-on': ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
    'sound-off': ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
    play: ['M8 5.5v13l10.5-6.5z'],
    clock: ['M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17', 'M12 7.5V12l3 2'],
    shield: ['M12 3l7.5 2.8v5.7c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V5.8z', 'M8.8 12.2l2.2 2.2 4.3-4.6'],
    text: ['M5 6.5h14', 'M5 11h14', 'M5 15.5h9'],
    headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15.5a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2z', 'M20 15.5a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z'],
  };
  return s(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' },
    ...paths[name].map((d) => s('path', { d })),
  );
}

const IMG_RE = /^data:image\/(png|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

const WAV_RE = /^data:audio\/wav;base64,[A-Za-z0-9+/]+={0,2}$/;

/** Only a server-rendered data: WAV is accepted for the audio challenge. */
export function safeAudioSrc(src: unknown): string | undefined {
  return typeof src === 'string' && src.length < 4_000_000 && WAV_RE.test(src) ? src : undefined;
}

/** Only server-rendered data: images are accepted; anything else (http:, javascript:, html) is refused. */
export function safeImg(src: unknown, alt: string): HTMLImageElement {
  const img = h('img', { alt, draggable: 'false', decoding: 'async' });
  if (typeof src === 'string' && src.length < 2_000_000 && IMG_RE.test(src)) img.src = src;
  return img;
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
export const round1 = (v: number): number => Math.round(v * 10) / 10;
export const pct = (v: number): string => `${(v * 100).toFixed(4)}%`;

let uid = 0;
export const nextId = (prefix: string): string => `${prefix}-${(uid += 1)}`;
