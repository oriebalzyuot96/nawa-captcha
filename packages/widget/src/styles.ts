import { themeCss } from './themes.js';

/*
 * Visual design: a layered "acrylic" card with real depth.
 * - Layers: an aurora glow layer behind the content (::before), a pointer-following specular
 *   highlight (::after), raised controls lit from the top-left, recessed wells for the puzzle
 *   frame, tracks and inputs, and puzzle pieces that float above the frame's glass.
 * - Motion: subtle perspective tilt and parallax (driven by --_rx/--_ry/--_px/--_py from JS),
 *   piece lift/settle, a success burst with a drawn checkmark, an error shake. All of it is off
 *   under prefers-reduced-motion; high contrast and forced colours drop decoration entirely.
 * - Colours come from the theme layer (themes.ts), which resolves --nawa-captcha-* → preset →
 *   Orca UI --oc-* → legacy Nawa UI --nw-* → built-in default.
 */
export const STYLES = /* css */ `
:host {
  display: block;
  max-inline-size: 380px;
  font-family: var(--nawa-captcha-font, var(--nawa-guard-font, var(--oc-font, var(--nw-font, system-ui, -apple-system, "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif))));
  font-size: 0.95rem;
  line-height: 1.45;
  perspective: 1100px;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
${themeCss()}
.ng {
  --_radius: var(--nawa-captcha-radius, var(--nawa-guard-radius, var(--oc-radius-lg, var(--oc-radius, var(--nw-radius, 18px)))));
  --_radius-sm: var(--nawa-captcha-radius-sm, var(--nawa-guard-radius-sm, var(--oc-radius-sm, var(--nw-radius-sm, 12px))));
  --_ease: var(--oc-ease, var(--nw-ease, cubic-bezier(0.2, 0.8, 0.2, 1)));
  --_spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --_sh: 24 14 64;
  --_hl: 255 255 255;
  --_hl-a: 0.95;
  --_depth: 0.2;
  --_glass: 0.55;
  color-scheme: light;
  position: relative;
  isolation: isolate;
  display: grid;
  gap: 12px;
  padding: 14px;
  color: var(--_text);
  border-radius: var(--_radius);
  border: 1px solid color-mix(in srgb, var(--_border) 85%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--_surface) 90%, #fff) 0%, var(--_surface) 42%, color-mix(in srgb, var(--_surface) 95%, var(--_primary)) 100%);
  box-shadow:
    inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)),
    inset 0 -1px 0 rgb(var(--_sh) / 0.05),
    0 1px 2px rgb(var(--_sh) / 0.08),
    0 10px 22px -10px rgb(var(--_sh) / var(--_depth)),
    0 30px 60px -28px color-mix(in srgb, var(--_primary) 45%, transparent);
  transform: rotateX(var(--_ry, 0deg)) rotateY(var(--_rx, 0deg));
  transition: transform 0.7s var(--_ease), box-shadow 0.35s var(--_ease);
}
.ng[data-scheme="dark"] {
  --_sh: 0 0 0;
  --_hl: 255 255 255;
  --_hl-a: 0.1;
  --_depth: 0.6;
  --_glass: 0.18;
  color-scheme: dark;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--_surface) 88%, #fff) 0%, var(--_surface) 40%, color-mix(in srgb, var(--_surface) 90%, var(--_primary)) 100%);
}
.ng[data-tilt] { transition: transform 0.14s linear, box-shadow 0.35s var(--_ease); }
.ng[data-pressed] { --_rx: 0deg !important; --_ry: 0deg !important; transition: transform 0.12s var(--_ease); }
/* Aurora glow layer (parallax: drifts against the tilt). */
.ng::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background:
    radial-gradient(70% 60% at calc(12% + var(--_px, 0) * -6%) calc(-8% + var(--_py, 0) * -6%), color-mix(in srgb, var(--_primary) 14%, transparent), transparent 70%),
    radial-gradient(60% 55% at calc(100% + var(--_px, 0) * -6%) calc(108% + var(--_py, 0) * -6%), color-mix(in srgb, var(--_accent) 12%, transparent), transparent 70%);
}
/* Specular highlight that follows the pointer. */
.ng::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 6;
  background: radial-gradient(240px circle at var(--_mx, 30%) var(--_my, -20%), rgb(255 255 255 / calc(var(--_glass) * 0.32)), transparent 60%);
  opacity: 0; transition: opacity 0.4s var(--_ease);
}
.ng[data-tilt]::after { opacity: 1; }

/* ---------------------------------------------------------------- header */
.head { display: flex; align-items: center; gap: 10px; min-block-size: 40px; }
.mark {
  inline-size: 34px; block-size: 34px; flex: none; display: grid; place-items: center; border-radius: 11px;
  color: var(--_on-primary);
  background: linear-gradient(150deg, color-mix(in srgb, var(--_primary) 78%, #fff), var(--_primary) 55%, var(--_primary-hover));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 -2px 3px rgb(0 0 0 / 0.18), 0 4px 10px -3px color-mix(in srgb, var(--_primary) 70%, transparent), 0 1px 2px rgb(var(--_sh) / 0.25);
  transform: translateZ(0);
}
.mark svg { inline-size: 20px; block-size: 20px; filter: drop-shadow(0 1px 0 rgb(0 0 0 / 0.18)); }
.titles { flex: 1; min-inline-size: 0; display: grid; gap: 2px; }
.title { font-weight: 650; margin: 0; font-size: 1em; letter-spacing: -0.005em; line-height: 1.25; }
.tools { display: flex; gap: 6px; }
.icon-btn {
  inline-size: 38px; block-size: 38px; display: inline-grid; place-items: center; padding: 0; cursor: pointer;
  border-radius: 12px; border: 1px solid var(--_border); color: var(--_text-muted);
  background: linear-gradient(180deg, color-mix(in srgb, var(--_surface) 70%, #fff), var(--_surface-alt));
  box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 1px 2px rgb(var(--_sh) / 0.1), 0 3px 8px -4px rgb(var(--_sh) / 0.18);
  transition: transform 0.18s var(--_spring), box-shadow 0.2s var(--_ease), color 0.15s, background-color 0.15s;
}
.ng[data-scheme="dark"] .icon-btn { background: linear-gradient(180deg, color-mix(in srgb, var(--_surface-alt) 85%, #fff), var(--_surface-alt)); }
.icon-btn:hover { color: var(--_text); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 2px 3px rgb(var(--_sh) / 0.12), 0 8px 14px -6px rgb(var(--_sh) / 0.25); }
.icon-btn:active { transform: translateY(1px); box-shadow: inset 0 2px 3px rgb(var(--_sh) / 0.15); }
.icon-btn[aria-pressed="true"] { background: var(--_primary-soft); color: var(--_primary); border-color: var(--_primary); }
.icon-btn svg { inline-size: 20px; block-size: 20px; }
.step {
  justify-self: start; font-size: 0.74em; font-weight: 700; padding: 1px 8px; border-radius: 999px; white-space: nowrap;
  background: var(--_primary-soft); color: var(--_primary); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_primary) 30%, transparent);
}

/* ---------------------------------------------------------------- accessible switch */
.alt { display: flex; gap: 3px; padding: 3px; border-radius: 13px; background: var(--_surface-alt); box-shadow: inset 0 1px 3px rgb(var(--_sh) / 0.16); border: 1px solid var(--_border); }
.alt button {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-block-size: 36px; padding: 0 10px;
  border: 0; border-radius: 10px; background: transparent; color: var(--_text-muted); font: inherit; font-weight: 600; font-size: 0.9em; cursor: pointer;
  transition: background-color 0.2s var(--_ease), box-shadow 0.2s var(--_ease), color 0.15s;
}
.alt button svg { inline-size: 18px; block-size: 18px; }
.alt button[aria-pressed="true"] { background: var(--_surface); color: var(--_primary); box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 1px 2px rgb(var(--_sh) / 0.14), 0 4px 10px -6px rgb(var(--_sh) / 0.3); }

/* ---------------------------------------------------------------- text */
.prompt { margin: 0; color: var(--_text); font-weight: 520; }
.hint { margin: 0; color: var(--_text-muted); font-size: 0.85em; }
.status { min-block-size: 1.4em; margin: 0; font-size: 0.88em; color: var(--_text-muted); display: flex; align-items: center; gap: 6px; }
.status:empty { display: block; min-block-size: 0; margin-block-start: -12px; }
.status[data-tone="error"] { color: var(--_danger); }
.status[data-tone="success"] { color: var(--_success); }
.status[data-tone="error"]:not(:empty)::before, .status[data-tone="success"]:not(:empty)::before {
  content: ""; inline-size: 8px; block-size: 8px; border-radius: 50%; flex: none; background: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 22%, transparent);
}
.notice {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 12px; font-size: 0.85em; font-weight: 600;
  color: var(--_danger); background: var(--_danger-soft); border: 1px solid color-mix(in srgb, var(--_danger) 30%, transparent);
  animation: ng-drop 0.4s var(--_spring);
}
.notice svg { inline-size: 18px; block-size: 18px; flex: none; }
:focus-visible { outline: 3px solid var(--_focus); outline-offset: 2px; }
button { font: inherit; }
label { font-weight: 600; font-size: 0.88em; }

/* ---------------------------------------------------------------- buttons */
.btn {
  position: relative; min-block-size: 44px; padding: 0 20px; border-radius: 13px; cursor: pointer; font-weight: 650; letter-spacing: 0.005em;
  border: 1px solid var(--_primary-hover); color: var(--_on-primary);
  background: linear-gradient(180deg, color-mix(in srgb, var(--_primary) 90%, #fff) 0%, var(--_primary) 50%, var(--_primary-hover) 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.32), inset 0 -2px 0 rgb(0 0 0 / 0.14), 0 1px 2px rgb(var(--_sh) / 0.2), 0 8px 16px -8px color-mix(in srgb, var(--_primary) 70%, transparent);
  transition: transform 0.18s var(--_spring), box-shadow 0.2s var(--_ease), filter 0.2s;
}
.btn:hover { transform: translateY(-1px); filter: brightness(1.04); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.32), inset 0 -2px 0 rgb(0 0 0 / 0.14), 0 2px 4px rgb(var(--_sh) / 0.2), 0 12px 22px -10px color-mix(in srgb, var(--_primary) 75%, transparent); }
.btn:active { transform: translateY(1px); box-shadow: inset 0 2px 4px rgb(0 0 0 / 0.25); }
.btn.secondary { color: var(--_primary); border-color: color-mix(in srgb, var(--_primary) 55%, var(--_border)); background: linear-gradient(180deg, color-mix(in srgb, var(--_surface) 70%, #fff), var(--_surface)); box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 1px 2px rgb(var(--_sh) / 0.1), 0 4px 10px -6px rgb(var(--_sh) / 0.2); }
.ng[data-scheme="dark"] .btn.secondary { background: var(--_surface); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: grayscale(0.3); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* ---------------------------------------------------------------- puzzle frame (recessed well, parallax glass) */
.stage {
  position: relative; inline-size: 100%; border-radius: var(--_radius-sm); overflow: hidden;
  background: var(--_surface-alt); touch-action: none; user-select: none; -webkit-user-select: none;
  border: 1px solid color-mix(in srgb, var(--_border) 70%, rgb(var(--_sh) / 0.3));
  box-shadow: 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 12px 24px -16px rgb(var(--_sh) / calc(var(--_depth) * 1.6));
}
.stage::before {
  content: ""; position: absolute; inset: 0; z-index: 3; pointer-events: none; border-radius: inherit;
  box-shadow: inset 0 2px 7px rgb(0 0 0 / 0.3), inset 0 0 0 1px rgb(0 0 0 / 0.06), inset 0 -1px 0 rgb(255 255 255 / 0.22);
}
.stage::after {
  content: ""; position: absolute; inset: -12px; z-index: 5; pointer-events: none;
  background: linear-gradient(112deg, rgb(255 255 255 / 0.2) 0%, rgb(255 255 255 / 0.06) 22%, transparent 38%, transparent 72%, rgb(255 255 255 / 0.05) 86%, transparent 100%);
  transform: translate(calc(var(--_px, 0) * -7px), calc(var(--_py, 0) * -5px));
  transition: transform 0.6s var(--_ease);
}
.ng[data-tilt] .stage::after { transition: transform 0.14s linear; }
.stage > img:not(.piece), .fill-img { display: block; inline-size: 100%; block-size: auto; pointer-events: none; }
.piece {
  position: absolute; z-index: 4; cursor: grab; touch-action: none;
  filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.4)) drop-shadow(0 5px 6px rgb(0 0 0 / 0.32));
  transition: filter 0.2s var(--_ease), transform 0.2s var(--_spring);
}
.piece.dragging { cursor: grabbing; transform: translateY(-3px) scale(1.06); filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.35)) drop-shadow(0 14px 14px rgb(0 0 0 / 0.38)); transition: filter 0.2s var(--_ease), transform 0.18s var(--_spring); }
.settle { animation: ng-settle 0.42s var(--_ease); }
@keyframes ng-settle { 0% { transform: translateY(-3px) scale(1.06); } 45% { transform: translateY(1px) scale(0.97); } 75% { transform: scale(1.015); } 100% { transform: none; } }

/* ---------------------------------------------------------------- slider track (groove) + thumb (3D pill) */
.track {
  position: relative; block-size: 46px; border-radius: 999px; touch-action: none; user-select: none;
  border: 1px solid var(--_control-border);
  background: linear-gradient(180deg, color-mix(in srgb, var(--_surface-alt) 92%, #000) 0%, var(--_surface-alt) 45%);
  box-shadow: inset 0 2px 4px rgb(var(--_sh) / 0.18), inset 0 -1px 0 rgb(var(--_hl) / calc(var(--_hl-a) * 0.6)), 0 1px 0 rgb(var(--_hl) / var(--_hl-a));
}
.ng[data-scheme="dark"] .track { background: linear-gradient(180deg, color-mix(in srgb, var(--_surface-alt) 70%, #000) 0%, var(--_surface-alt) 50%); }
.track-fill {
  position: absolute; inset-block: 3px; inset-inline-start: 3px; border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--_primary) 10%, transparent), color-mix(in srgb, var(--_primary) 32%, transparent));
}
.thumb {
  position: absolute; inset-block-start: -1px; block-size: 46px; inline-size: 56px; border-radius: 999px; z-index: 1;
  display: grid; place-items: center; cursor: grab; touch-action: none; color: var(--_on-primary);
  background: linear-gradient(180deg, color-mix(in srgb, var(--_primary) 88%, #fff) 0%, var(--_primary) 52%, var(--_primary-hover) 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4), inset 0 -3px 0 rgb(0 0 0 / 0.16), 0 2px 3px rgb(var(--_sh) / 0.3), 0 8px 16px -6px color-mix(in srgb, var(--_primary) 75%, transparent);
  transition: box-shadow 0.2s var(--_ease), transform 0.18s var(--_spring);
}
.thumb:hover { transform: scale(1.03); }
.thumb:active { cursor: grabbing; transform: scale(0.98); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.3), inset 0 -1px 0 rgb(0 0 0 / 0.16), 0 1px 2px rgb(var(--_sh) / 0.3), 0 3px 8px -3px color-mix(in srgb, var(--_primary) 70%, transparent); }
.thumb svg { inline-size: 22px; block-size: 22px; filter: drop-shadow(0 1px 0 rgb(0 0 0 / 0.2)); }

/* ---------------------------------------------------------------- rotate */
.rot-stage {
  inline-size: min(100%, 184px); margin-inline: auto; aspect-ratio: 1; border-radius: 50%; position: relative; overflow: hidden;
  background: var(--_surface-alt);
  box-shadow: 0 0 0 5px var(--_surface), 0 0 0 6px var(--_border), 0 16px 28px -14px rgb(var(--_sh) / calc(var(--_depth) * 2)), 0 2px 4px rgb(var(--_sh) / 0.15);
}
.rot-stage::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; box-shadow: inset 0 3px 8px rgb(0 0 0 / 0.3), inset 0 -2px 4px rgb(255 255 255 / 0.18); background: radial-gradient(70% 60% at 30% 20%, rgb(255 255 255 / 0.22), transparent 60%); }
.rot-stage img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.rot-stage.framed { inline-size: min(100%, 204px); border-radius: var(--_radius-sm); }
.rot-stage .rot-base { position: absolute; inset: 0; }
.rot-stage.framed > img:last-child { position: relative; filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.3)); }

/* ---------------------------------------------------------------- grids */
.grid { position: absolute; inset: 0; display: grid; z-index: 2; }
.cell { border: 0; background: transparent; cursor: pointer; position: relative; padding: 0; outline-offset: -4px; transition: transform 0.15s var(--_spring); }
.cell:hover:not([aria-pressed="true"])::after { content: ""; position: absolute; inset: 4px; border-radius: var(--_radius-sm); background: rgb(255 255 255 / 0.14); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.5); }
.cell[aria-pressed="true"]::after {
  content: ""; position: absolute; inset: 4px; border: 3px solid var(--_primary); border-radius: var(--_radius-sm);
  background: color-mix(in srgb, var(--_primary) 18%, transparent);
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.75), 0 6px 14px -4px color-mix(in srgb, var(--_primary) 70%, transparent), inset 0 0 12px color-mix(in srgb, var(--_primary) 35%, transparent);
  animation: ng-pop 0.28s var(--_spring);
}
.cell[aria-pressed="true"]::before {
  content: "✓"; position: absolute; inset-block-start: 7px; inset-inline-end: 9px; z-index: 1;
  inline-size: 22px; block-size: 22px; border-radius: 50%; color: var(--_on-primary); font-size: 13px; font-weight: 800; line-height: 22px; text-align: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--_primary) 85%, #fff), var(--_primary-hover));
  box-shadow: 0 2px 5px rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.4), 0 0 0 2px rgb(255 255 255 / 0.85);
  animation: ng-pop 0.32s var(--_spring);
}
@keyframes ng-pop { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; } }
.cell:focus-visible { outline: 3px solid var(--_focus); }
.cell.locked { pointer-events: none; }
.cell .badge {
  position: absolute; inset-block-start: 6px; inset-inline-start: 6px; z-index: 1; min-inline-size: 22px; block-size: 22px; border-radius: 11px;
  color: var(--_on-primary); font-size: 13px; font-weight: 800; line-height: 22px; text-align: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--_primary) 85%, #fff), var(--_primary-hover));
  box-shadow: 0 2px 5px rgb(0 0 0 / 0.35), 0 0 0 2px rgb(255 255 255 / 0.85); animation: ng-pop 0.3s var(--_spring);
}
.cell[data-pair]:not([data-pair=""])::before { content: none; }

/* ---------------------------------------------------------------- order tiles (raised cards) */
.tiles { display: flex; gap: 8px; list-style: none; margin: 0; padding: 4px 0 2px; justify-content: center; flex-wrap: nowrap; touch-action: none; }
.tiles > li { flex: 0 1 66px; min-inline-size: 40px; }
.tile {
  inline-size: 100%; block-size: auto; aspect-ratio: 1; border-radius: 14px; border: 1px solid var(--_border); padding: 0;
  overflow: hidden; background: var(--_surface-alt); cursor: grab; touch-action: none; position: relative;
  box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 2px 0 color-mix(in srgb, var(--_border) 80%, rgb(var(--_sh) / 0.4)), 0 8px 14px -8px rgb(var(--_sh) / calc(var(--_depth) * 1.8));
  transition: transform 0.22s var(--_spring), box-shadow 0.2s var(--_ease), border-color 0.15s;
}
.tile:hover { transform: translateY(-2px); }
.tile img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.tile[aria-pressed="true"], .tile.dragging { border-color: var(--_primary); transform: translateY(-4px) scale(1.07); z-index: 1; box-shadow: 0 0 0 2px var(--_primary), 0 16px 22px -10px rgb(var(--_sh) / 0.5); }
.tile .pos {
  position: absolute; inset-block-end: 3px; inset-inline-start: 3px; min-inline-size: 19px; block-size: 19px; border-radius: 10px;
  background: var(--_surface); color: var(--_text); font-size: 12px; font-weight: 700; line-height: 19px; text-align: center; border: 1px solid var(--_border);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
}

/* ---------------------------------------------------------------- drawing overlays */
.draw { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; pointer-events: none; z-index: 2; }
.draw polyline { fill: none; stroke: var(--_primary); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; opacity: 0.92; filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.45)); }
.draw .cross { stroke: var(--_focus); stroke-width: 2; filter: drop-shadow(0 0 1px #fff); }
.draw .kpt { fill: var(--_primary); stroke: #fff; stroke-width: 1.5; }
.draw .tap circle { fill: var(--_primary); stroke: #fff; stroke-width: 2; filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.45)); }
.draw .tap .tap-ring { fill: none; stroke: var(--_primary); stroke-width: 2; filter: none; transform-box: fill-box; transform-origin: center; animation: ng-ripple 0.6s var(--_ease) forwards; }
@keyframes ng-ripple { from { transform: scale(1); opacity: 0.9; } to { transform: scale(2.6); opacity: 0; } }
.draw .tap text { fill: var(--_on-primary); font: 700 11px var(--nawa-captcha-font, system-ui, sans-serif); }

/* ---------------------------------------------------------------- inputs (recessed) */
input[type="text"] {
  font: inherit; min-block-size: 44px; padding: 0 12px; border-radius: 12px; inline-size: 100%;
  border: 1px solid var(--_control-border); background: var(--_surface); color: var(--_text);
  box-shadow: inset 0 2px 3px rgb(var(--_sh) / 0.1), 0 1px 0 rgb(var(--_hl) / var(--_hl-a));
  transition: border-color 0.15s, box-shadow 0.2s var(--_ease);
}
input[type="text"]:focus-visible { outline: none; border-color: var(--_focus); box-shadow: inset 0 2px 3px rgb(var(--_sh) / 0.1), 0 0 0 3px color-mix(in srgb, var(--_focus) 30%, transparent), 0 0 0 1px var(--_focus); }
.question { margin: 0; font-size: 1.05em; padding: 12px 14px; background: var(--_surface-alt); border-radius: 12px; border: 1px solid var(--_border); box-shadow: inset 0 1px 3px rgb(var(--_sh) / 0.1); }

/* ---------------------------------------------------------------- drag / swap / hold */
.drag-piece { position: absolute; z-index: 4; cursor: grab; touch-action: none; border-radius: var(--_radius-sm); filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.35)) drop-shadow(0 6px 7px rgb(0 0 0 / 0.3)); transition: filter 0.2s var(--_ease), transform 0.2s var(--_spring); }
.drag-piece img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.drag-piece.dragging { cursor: grabbing; transform: translateY(-3px) scale(1.06); filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.3)) drop-shadow(0 16px 16px rgb(0 0 0 / 0.38)); }
.swap {
  display: grid; gap: 3px; inline-size: 100%; padding: 4px; border-radius: var(--_radius-sm);
  background: linear-gradient(180deg, color-mix(in srgb, var(--_border) 80%, #000), var(--_border));
  box-shadow: inset 0 2px 5px rgb(0 0 0 / 0.25), 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 12px 22px -14px rgb(var(--_sh) / 0.5);
}
.swap-tile { padding: 0; border: 0; border-radius: 6px; overflow: hidden; cursor: pointer; background: var(--_surface-alt); position: relative; touch-action: none; box-shadow: 0 1px 2px rgb(0 0 0 / 0.3); transition: transform 0.2s var(--_spring); }
.swap-tile::before { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none; border-radius: inherit; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4), inset 0 -2px 3px rgb(0 0 0 / 0.18); }
.swap-tile img { inline-size: 100%; block-size: 100%; display: block; object-fit: cover; pointer-events: none; }
.swap-tile[aria-pressed="true"] { outline: 3px solid var(--_primary); outline-offset: -3px; transform: scale(0.96); }
.swap-tile[aria-pressed="true"]::after { content: ""; position: absolute; inset: 0; background: color-mix(in srgb, var(--_primary) 22%, transparent); }
.hold-stage { position: relative; inline-size: min(100%, 204px); aspect-ratio: 1; margin-inline: auto; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 5px var(--_surface), 0 0 0 6px var(--_border), 0 16px 28px -14px rgb(var(--_sh) / calc(var(--_depth) * 2)); }
.hold-stage > img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.hold-arc { fill: none; stroke: var(--_primary); stroke-linecap: round; opacity: 0.95; filter: drop-shadow(0 0 3px color-mix(in srgb, var(--_primary) 70%, transparent)); }
.hold-btn {
  position: absolute; inset: 30%; border-radius: 50%; border: 0; cursor: pointer; font-weight: 750; font-size: 0.78em; line-height: 1.1;
  color: var(--_on-primary); touch-action: none; user-select: none; -webkit-user-select: none;
  background: radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--_primary) 70%, #fff) 0%, var(--_primary) 48%, var(--_primary-hover) 100%);
  box-shadow: inset 0 -4px 8px rgb(0 0 0 / 0.25), inset 0 2px 2px rgb(255 255 255 / 0.35), 0 8px 18px -4px rgb(0 0 0 / 0.45);
  transition: transform 0.15s var(--_spring), box-shadow 0.15s var(--_ease);
}
.hold-btn.holding { transform: scale(0.92); box-shadow: inset 0 3px 8px rgb(0 0 0 / 0.35), 0 3px 8px -2px rgb(0 0 0 / 0.4); }

/* ---------------------------------------------------------------- audio challenge */
.audio-stage {
  display: grid; place-items: center; padding: 18px 12px; border-radius: var(--_radius-sm);
  background: radial-gradient(80% 90% at 50% 0%, color-mix(in srgb, var(--_primary) 14%, var(--_surface-alt)), var(--_surface-alt));
  border: 1px solid var(--_border); box-shadow: inset 0 2px 6px rgb(var(--_sh) / 0.14), 0 1px 0 rgb(var(--_hl) / var(--_hl-a));
}
.play-btn {
  display: inline-flex; align-items: center; gap: 12px; min-block-size: 52px; padding: 6px 20px 6px 6px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--_border); color: var(--_text); font-weight: 650;
  background: linear-gradient(180deg, color-mix(in srgb, var(--_surface) 70%, #fff), var(--_surface));
  box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 2px 3px rgb(var(--_sh) / 0.14), 0 10px 20px -10px rgb(var(--_sh) / 0.4);
  transition: transform 0.18s var(--_spring), box-shadow 0.2s var(--_ease);
}
.ng[data-scheme="dark"] .play-btn { background: var(--_surface); }
.play-btn:hover:not(:disabled) { transform: translateY(-1px); }
.play-btn:active:not(:disabled) { transform: translateY(1px); }
.play-btn:disabled { cursor: default; opacity: 0.75; }
.play-orb {
  inline-size: 40px; block-size: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--_on-primary);
  background: radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--_primary) 72%, #fff), var(--_primary) 55%, var(--_primary-hover));
  box-shadow: inset 0 -3px 5px rgb(0 0 0 / 0.2), inset 0 1px 1px rgb(255 255 255 / 0.4), 0 4px 10px -3px color-mix(in srgb, var(--_primary) 80%, transparent);
}
.play-orb svg { inline-size: 20px; block-size: 20px; fill: currentColor; stroke-width: 1.5; margin-inline-start: 2px; }
.eq { display: none; align-items: flex-end; gap: 3px; block-size: 18px; }
.eq i { inline-size: 4px; border-radius: 2px; background: var(--_primary); block-size: 40%; animation: ng-eq 0.9s var(--_ease) infinite alternate; }
.eq i:nth-child(2) { animation-delay: -0.3s; } .eq i:nth-child(3) { animation-delay: -0.6s; } .eq i:nth-child(4) { animation-delay: -0.15s; }
.play-btn.is-playing .eq { display: inline-flex; }
.play-btn.is-playing .play-orb { animation: ng-pulse 1.2s var(--_ease) infinite; }
@keyframes ng-eq { from { block-size: 25%; } to { block-size: 100%; } }
@keyframes ng-pulse { 0%, 100% { box-shadow: inset 0 -3px 5px rgb(0 0 0 / 0.2), 0 0 0 0 color-mix(in srgb, var(--_primary) 45%, transparent); } 50% { box-shadow: inset 0 -3px 5px rgb(0 0 0 / 0.2), 0 0 0 8px color-mix(in srgb, var(--_primary) 0%, transparent); } }

/* ---------------------------------------------------------------- loading (crafted) */
.loading { display: grid; gap: 10px; }
.skel {
  position: relative; overflow: hidden; border-radius: var(--_radius-sm); aspect-ratio: 2 / 1; display: grid; place-items: center;
  background: linear-gradient(160deg, var(--_surface-alt), color-mix(in srgb, var(--_surface-alt) 88%, var(--_primary)));
  border: 1px solid var(--_border); box-shadow: inset 0 2px 7px rgb(var(--_sh) / 0.16); perspective: 400px;
}
.skel::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 20%, rgb(255 255 255 / calc(var(--_glass) * 0.7)) 50%, transparent 80%); transform: translateX(-100%); animation: ng-shimmer 1.6s var(--_ease) infinite; }
.skel-bar { block-size: 46px; border-radius: 999px; background: var(--_surface-alt); border: 1px solid var(--_border); box-shadow: inset 0 2px 4px rgb(var(--_sh) / 0.12); position: relative; overflow: hidden; }
.skel-bar::after { content: ""; position: absolute; inset-block: 3px; inset-inline-start: 3px; inline-size: 52px; border-radius: 999px; background: color-mix(in srgb, var(--_primary) 30%, var(--_surface-alt)); }
.stack { position: relative; inline-size: 56px; block-size: 56px; transform-style: preserve-3d; transform: rotateX(58deg) rotateZ(45deg); }
.stack i {
  position: absolute; inset: 0; border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--_primary) 70%, #fff), var(--_primary));
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.35) inset, 6px 6px 14px rgb(var(--_sh) / 0.35);
  animation: ng-float 1.8s var(--_ease) infinite;
}
.stack i:nth-child(1) { opacity: 0.35; animation-delay: 0s; }
.stack i:nth-child(2) { opacity: 0.65; animation-delay: 0.15s; }
.stack i:nth-child(3) { opacity: 1; animation-delay: 0.3s; }
@keyframes ng-float { 0%, 100% { transform: translateZ(calc(var(--z, 1) * 9px)); } 50% { transform: translateZ(calc(var(--z, 1) * 22px)); } }
.stack i { transform: translateZ(calc(var(--z, 1) * 9px)); }
.stack i:nth-child(1) { --z: 0.4; } .stack i:nth-child(2) { --z: 1; } .stack i:nth-child(3) { --z: 1.6; }
@keyframes ng-shimmer { to { transform: translateX(100%); } }
.progress { block-size: 6px; border-radius: 3px; background: var(--_surface-alt); overflow: hidden; box-shadow: inset 0 1px 2px rgb(var(--_sh) / 0.15); }
.progress > div { block-size: 100%; inline-size: 40%; border-radius: 3px; background: linear-gradient(90deg, var(--_primary), var(--_accent)); animation: ng-slide 1.1s var(--_ease) infinite alternate; }
@keyframes ng-slide { from { margin-inline-start: 0; } to { margin-inline-start: 60%; } }
.body { position: relative; display: grid; }
.body.verifying > * { opacity: 0.6; transition: opacity 0.2s; }
.body.verifying::after { content: ""; position: absolute; inset-inline: 0; inset-block-start: -6px; block-size: 3px; border-radius: 2px; background: linear-gradient(90deg, transparent, var(--_primary), var(--_accent), transparent); background-size: 200% 100%; animation: ng-scan 1s linear infinite; }
@keyframes ng-scan { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* ---------------------------------------------------------------- verified (checkmark morph + burst) */
.done {
  position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 14px; padding: 14px 16px; border-radius: var(--_radius-sm);
  background: var(--_success-soft); color: var(--_success); border: 1px solid color-mix(in srgb, var(--_success) 32%, transparent);
  box-shadow: inset 0 1px 0 rgb(var(--_hl) / calc(var(--_hl-a) * 0.7)), 0 12px 26px -14px color-mix(in srgb, var(--_success) 70%, transparent);
  animation: ng-rise 0.45s var(--_spring);
}
.done-title { display: block; font-size: 1.05em; }
.done-sub { display: block; font-size: 0.88em; font-weight: 500; }
.seal { position: relative; inline-size: 46px; block-size: 46px; }
.seal-orb {
  position: absolute; inset: 0; border-radius: 50%; color: #fff; display: grid; place-items: center;
  background: radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--_success) 55%, #fff), var(--_success) 60%, color-mix(in srgb, var(--_success) 80%, #000));
  box-shadow: inset 0 -3px 6px rgb(0 0 0 / 0.22), inset 0 1px 1px rgb(255 255 255 / 0.5), 0 6px 14px -4px color-mix(in srgb, var(--_success) 80%, transparent);
  animation: ng-morph 0.5s var(--_spring);
}
.ng[data-scheme="dark"] .seal-orb { color: var(--_success-soft); }
.seal-orb svg { inline-size: 26px; block-size: 26px; overflow: visible; }
.seal-orb path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: ng-draw 0.45s 0.18s var(--_ease) forwards; }
@keyframes ng-draw { to { stroke-dashoffset: 0; } }
@keyframes ng-morph { 0% { transform: scale(0.3) rotate(-40deg); border-radius: 30%; opacity: 0; } 60% { transform: scale(1.12) rotate(6deg); border-radius: 50%; opacity: 1; } 100% { transform: none; } }
@keyframes ng-rise { from { transform: translateY(6px) scale(0.98); opacity: 0; } to { transform: none; opacity: 1; } }
.spark { position: absolute; inset-block-start: 50%; inset-inline-start: 50%; inline-size: 6px; block-size: 6px; margin: -3px; border-radius: 50%; background: var(--_success); opacity: 0; pointer-events: none; animation: ng-burst 0.7s 0.12s var(--_ease) forwards; }
.spark:nth-child(even) { background: var(--_accent); inline-size: 4px; block-size: 4px; margin: -2px; }
@keyframes ng-burst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(1); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-36px) scale(0.3); } }
.ng[data-state="verified"] { border-color: color-mix(in srgb, var(--_success) 45%, var(--_border)); box-shadow: inset 0 1px 0 rgb(var(--_hl) / var(--_hl-a)), 0 1px 2px rgb(var(--_sh) / 0.08), 0 10px 22px -10px rgb(var(--_sh) / var(--_depth)), 0 30px 60px -28px color-mix(in srgb, var(--_success) 50%, transparent); }

/* ---------------------------------------------------------------- error */
.error-box {
  display: grid; grid-template-columns: auto 1fr; gap: 10px 12px; align-items: center; padding: 14px; border-radius: var(--_radius-sm);
  background: var(--_danger-soft); color: var(--_danger); border: 1px solid color-mix(in srgb, var(--_danger) 32%, transparent);
  animation: ng-rise 0.4s var(--_spring);
}
.error-box .row { grid-column: 1 / -1; }
.err-icon {
  inline-size: 40px; block-size: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff;
  background: linear-gradient(150deg, color-mix(in srgb, var(--_danger) 70%, #fff), var(--_danger) 60%, color-mix(in srgb, var(--_danger) 80%, #000));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4), inset 0 -2px 3px rgb(0 0 0 / 0.2), 0 6px 12px -5px color-mix(in srgb, var(--_danger) 70%, transparent);
}
.ng[data-scheme="dark"] .err-icon { color: var(--_danger-soft); }
.err-icon svg { inline-size: 22px; block-size: 22px; }
.ng[data-flash="error"] { animation: ng-flash-error 0.7s var(--_ease); }
.ng[data-flash="success"] { animation: ng-flash-success 0.7s var(--_ease); }
@keyframes ng-flash-error { 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--_danger) 55%, transparent), 0 12px 30px -10px color-mix(in srgb, var(--_danger) 60%, transparent); } }
@keyframes ng-flash-success { 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--_success) 55%, transparent), 0 12px 30px -10px color-mix(in srgb, var(--_success) 60%, transparent); } }
.shake { animation: ng-shake 0.4s var(--_ease); }
@keyframes ng-shake { 15% { transform: translateX(-6px) rotate(-0.4deg); } 35% { transform: translateX(5px) rotate(0.3deg); } 55% { transform: translateX(-3px); } 75% { transform: translateX(2px); } }
@keyframes ng-drop { from { transform: translateY(-6px); opacity: 0; } to { transform: none; opacity: 1; } }

/* The verified/error panels already show the message; the live region stays for screen readers. */
.ng:is([data-state="verified"], [data-state="error"]) .status { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; margin: 0; }
/* Narrow containers (phones, sidebars). */
.ng { container-type: inline-size; }
@container (max-width: 340px) {
  .head { gap: 8px; }
  .tools { gap: 4px; }
  .icon-btn { inline-size: 34px; block-size: 34px; border-radius: 11px; }
  .icon-btn svg { inline-size: 18px; block-size: 18px; }
  .mark { inline-size: 30px; block-size: 30px; border-radius: 10px; }
  .title { font-size: 0.95em; }
}

/* ---------------------------------------------------------------- footer */
.foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-block-start: 10px; margin-block-start: -2px; border-block-start: 1px solid var(--_border); font-size: 0.76em; color: var(--_text-muted); min-block-size: 30px; }
.brandline { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; letter-spacing: 0.01em; }
.brandline svg { inline-size: 15px; block-size: 15px; color: var(--_primary); }
.vol { display: inline-flex; align-items: center; gap: 6px; }
.vol input { inline-size: 92px; accent-color: var(--_primary); block-size: 24px; margin: 0; cursor: pointer; }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---------------------------------------------------------------- high contrast palette: no decoration */
.ng[data-contrast="high"] { background: var(--_surface); box-shadow: none; border: 2px solid var(--_border); transform: none !important; }
.ng[data-contrast="high"]::before, .ng[data-contrast="high"]::after, .ng[data-contrast="high"] .stage::after, .ng[data-contrast="high"] .skel::after, .ng[data-contrast="high"] .spark { display: none; }
.ng[data-contrast="high"] :is(.btn, .thumb, .mark, .play-orb, .hold-btn, .cell[aria-pressed="true"]::before, .cell .badge) { background: var(--_primary); box-shadow: none; }
.ng[data-contrast="high"] :is(.btn.secondary, .icon-btn, .play-btn, .alt button[aria-pressed="true"]) { background: var(--_surface); box-shadow: none; border: 2px solid var(--_border); }
.ng[data-contrast="high"] .icon-btn[aria-pressed="true"] { background: var(--_primary-soft); border-color: var(--_primary); }
.ng[data-contrast="high"] :is(.track, input[type="text"], .question, .stage, .tile, .alt, .audio-stage, .skel) { box-shadow: none; border: 2px solid var(--_control-border); background: var(--_surface); }
.ng[data-contrast="high"] .seal-orb, .ng[data-contrast="high"] .err-icon { box-shadow: none; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .ng { transform: none !important; }
  .ng::after, .spark { display: none; }
  .stage::after { transform: none !important; }
  .progress > div { inline-size: 100%; opacity: 0.6; }
  .seal-orb path { stroke-dashoffset: 0; }
  .eq i { block-size: 70%; }
}
@media (forced-colors: active) {
  .ng { forced-color-adjust: auto; border: 1px solid CanvasText; transform: none !important; }
  .ng::before, .ng::after, .stage::before, .stage::after, .rot-stage::after, .swap-tile::before, .skel::after, .spark, .eq { display: none; }
  .track, .tile, input[type="text"], .question, .done, .error-box, .alt, .audio-stage, .skel, .icon-btn, .play-btn, .stage { border: 1px solid CanvasText; }
  .thumb, .btn, .mark, .play-orb, .seal-orb, .err-icon { forced-color-adjust: none; background: ButtonText; color: ButtonFace; border: 1px solid ButtonText; }
  .btn.secondary, .alt button[aria-pressed="true"] { forced-color-adjust: none; background: ButtonFace; color: ButtonText; border: 2px solid ButtonText; }
  .icon-btn[aria-pressed="true"] { border: 2px solid Highlight; }
  .cell[aria-pressed="true"]::after, .tile[aria-pressed="true"] { border-color: Highlight; background: transparent; }
  .cell[aria-pressed="true"]::before { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  .draw polyline, .draw .cross { stroke: Highlight; }
  .draw .kpt, .draw .tap circle { fill: Highlight; }
  .hold-arc { stroke: Highlight; }
  .hold-btn, .step, .cell .badge { forced-color-adjust: none; background: ButtonText; color: ButtonFace; }
  .swap-tile[aria-pressed="true"] { outline-color: Highlight; }
  .progress > div { background: Highlight; }
  .status[data-tone]::before { background: CanvasText; box-shadow: none; }
  :focus-visible { outline-color: Highlight; }
}
`;
