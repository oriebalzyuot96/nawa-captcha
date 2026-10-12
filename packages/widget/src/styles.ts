/*
 * Theming: every colour/radius/font resolves --nawa-guard-* (widget-specific override) →
 * --nw-* (Nawa UI design tokens, inherited through the shadow boundary) → a neutral fallback.
 * Dropping the widget into any Nawa UI theme (light, dark, high-contrast) therefore just works.
 */
export const STYLES = /* css */ `
:host {
  --_primary: var(--nawa-guard-primary, var(--nw-primary, #5b34d6));
  --_primary-hover: var(--nawa-guard-primary-hover, var(--nw-primary-hover, #4925b8));
  --_primary-soft: var(--nawa-guard-primary-soft, var(--nw-primary-soft, rgb(91 52 214 / 0.12)));
  --_on-primary: var(--nawa-guard-on-primary, var(--nw-on-primary, #ffffff));
  --_surface: var(--nawa-guard-surface, var(--nw-surface, #ffffff));
  --_surface-alt: var(--nawa-guard-surface-alt, var(--nw-surface-alt, #f4f8f9));
  --_text: var(--nawa-guard-text, var(--nw-text, #16262d));
  --_muted: var(--nawa-guard-text-muted, var(--nw-text-muted, #4b6873));
  --_border: var(--nawa-guard-border, var(--nw-border, #dbe5e8));
  --_control-border: var(--nawa-guard-control-border, var(--nw-control-border, #768c95));
  --_focus: var(--nawa-guard-focus, var(--nw-focus, #5b34d6));
  --_danger: var(--nawa-guard-danger, var(--nw-danger, #c0262d));
  --_danger-soft: var(--nawa-guard-danger-soft, var(--nw-danger-soft, #fdecea));
  --_success: var(--nawa-guard-success, var(--nw-success, #0f6b33));
  --_success-soft: var(--nawa-guard-success-soft, var(--nw-success-soft, #e7f6ec));
  --_radius: var(--nawa-guard-radius, var(--nw-radius, 12px));
  --_radius-sm: var(--nawa-guard-radius-sm, var(--nw-radius-sm, 8px));
  --_font: var(--nawa-guard-font, var(--nw-font, system-ui, -apple-system, "Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif));
  --_ease: var(--nw-ease, cubic-bezier(0.2, 0.8, 0.2, 1));
  --_shadow: var(--nw-shadow-sm, 0 1px 2px rgb(0 0 0 / 0.06));
  display: block;
  max-inline-size: 360px;
  font-family: var(--_font);
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--_text);
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.ng {
  background: var(--_surface);
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  box-shadow: var(--_shadow);
  padding: 12px;
  display: grid;
  gap: 10px;
}
.head { display: flex; align-items: center; gap: 8px; }
.title { font-weight: 600; flex: 1; margin: 0; font-size: 1em; }
.tools { display: flex; gap: 4px; }
.icon-btn {
  inline-size: 40px; block-size: 40px; display: inline-grid; place-items: center;
  border: 1px solid transparent; border-radius: var(--_radius-sm); background: transparent;
  color: var(--_muted); cursor: pointer; padding: 0;
}
.icon-btn:hover { background: var(--_surface-alt); color: var(--_text); }
.icon-btn[aria-pressed="true"] { background: var(--_primary-soft); color: var(--_primary); border-color: var(--_primary); }
.icon-btn svg { inline-size: 20px; block-size: 20px; }
.prompt { margin: 0; color: var(--_text); }
.hint { margin: 0; color: var(--_muted); font-size: 0.85em; }
.status { min-block-size: 1.4em; margin: 0; font-size: 0.9em; color: var(--_muted); }
.status[data-tone="error"] { color: var(--_danger); }
.status[data-tone="success"] { color: var(--_success); }
:focus-visible { outline: 3px solid var(--_focus); outline-offset: 2px; }
button { font: inherit; }
.btn {
  min-block-size: 44px; padding: 0 18px; border-radius: var(--_radius-sm); cursor: pointer;
  border: 1px solid var(--_primary); background: var(--_primary); color: var(--_on-primary); font-weight: 600;
}
.btn:hover { background: var(--_primary-hover); }
.btn.secondary { background: transparent; color: var(--_primary); }
.btn.secondary:hover { background: var(--_primary-soft); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.stage {
  position: relative; inline-size: 100%; border-radius: var(--_radius-sm); overflow: hidden;
  background: var(--_surface-alt); touch-action: none; user-select: none; -webkit-user-select: none;
}
.stage > img:not(.piece), .fill-img { display: block; inline-size: 100%; block-size: auto; pointer-events: none; }
.piece { position: absolute; cursor: grab; touch-action: none; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45)); }
.piece:active { cursor: grabbing; }
.track {
  position: relative; block-size: 44px; border-radius: 999px; background: var(--_surface-alt);
  border: 1px solid var(--_control-border); touch-action: none; user-select: none;
}
.track-fill { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 999px; background: var(--_primary-soft); }
.thumb {
  position: absolute; inset-block-start: -1px; block-size: 44px; inline-size: 56px; border-radius: 999px;
  background: var(--_primary); color: var(--_on-primary); display: grid; place-items: center; cursor: grab;
  touch-action: none; transition: background-color 0.15s var(--_ease);
}
.thumb:active { cursor: grabbing; }
.thumb svg { inline-size: 22px; block-size: 22px; }
.rot-stage { inline-size: min(100%, 180px); margin-inline: auto; aspect-ratio: 1; border-radius: 50%; position: relative; overflow: hidden; background: var(--_surface-alt); }
.rot-stage img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.grid { position: absolute; inset: 0; display: grid; }
.cell {
  border: 0; background: transparent; cursor: pointer; position: relative; padding: 0;
  outline-offset: -4px;
}
.cell[aria-pressed="true"]::after {
  content: ""; position: absolute; inset: 4px; border: 3px solid var(--_primary); border-radius: var(--_radius-sm);
  background: color-mix(in srgb, var(--_primary) 18%, transparent);
}
.cell[aria-pressed="true"]::before {
  content: "✓"; position: absolute; inset-block-start: 6px; inset-inline-end: 8px; z-index: 1;
  inline-size: 22px; block-size: 22px; border-radius: 50%; background: var(--_primary); color: var(--_on-primary);
  font-size: 14px; line-height: 22px; text-align: center;
}
.cell:focus-visible { outline: 3px solid var(--_focus); }
.tiles { display: flex; gap: 8px; list-style: none; margin: 0; padding: 0; justify-content: center; flex-wrap: nowrap; touch-action: none; }
.tiles > li { flex: 0 1 64px; min-inline-size: 40px; }
.tile {
  inline-size: 100%; block-size: auto; aspect-ratio: 1; border-radius: var(--_radius-sm); border: 2px solid var(--_border); padding: 0;
  overflow: hidden; background: var(--_surface-alt); cursor: grab; touch-action: none; position: relative;
  transition: transform 0.15s var(--_ease), border-color 0.15s var(--_ease);
}
.tile img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.tile[aria-pressed="true"], .tile.dragging { border-color: var(--_primary); transform: scale(1.06); box-shadow: 0 4px 10px rgb(0 0 0 / 0.2); z-index: 1; }
.tile .pos {
  position: absolute; inset-block-end: 2px; inset-inline-start: 2px; min-inline-size: 18px; block-size: 18px; border-radius: 9px;
  background: var(--_surface); color: var(--_text); font-size: 12px; line-height: 18px; text-align: center; border: 1px solid var(--_border);
}
.draw { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; pointer-events: none; }
.draw polyline { fill: none; stroke: var(--_primary); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; opacity: 0.85; }
.draw .cross { stroke: var(--_focus); stroke-width: 2; }
.draw .kpt { fill: var(--_primary); }
input[type="text"] {
  font: inherit; min-block-size: 44px; padding: 0 12px; border-radius: var(--_radius-sm); inline-size: 100%;
  border: 1px solid var(--_control-border); background: var(--_surface); color: var(--_text);
}
label { font-weight: 600; font-size: 0.9em; }
.question { margin: 0; font-size: 1.05em; padding: 10px 12px; background: var(--_surface-alt); border-radius: var(--_radius-sm); }
.progress { block-size: 6px; border-radius: 3px; background: var(--_surface-alt); overflow: hidden; }
.progress > div { block-size: 100%; inline-size: 40%; background: var(--_primary); animation: ng-slide 1.1s var(--_ease) infinite alternate; }
@keyframes ng-slide { from { margin-inline-start: 0; } to { margin-inline-start: 60%; } }
.done { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--_radius-sm); background: var(--_success-soft); color: var(--_success); font-weight: 600; }
.done svg { inline-size: 24px; block-size: 24px; flex: none; }
.error-box { display: grid; gap: 8px; padding: 10px 12px; border-radius: var(--_radius-sm); background: var(--_danger-soft); color: var(--_danger); }
.step { font-size: 0.78em; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--_primary-soft); color: var(--_primary); white-space: nowrap; }
.rot-stage.framed { inline-size: min(100%, 200px); border-radius: var(--_radius-sm); box-shadow: inset 0 0 0 1px var(--_border); }
.rot-stage .rot-base { position: absolute; inset: 0; }
.rot-stage.framed > img:last-child { position: relative; }
.drag-piece { position: absolute; cursor: grab; touch-action: none; border-radius: var(--_radius-sm); filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.35)); }
.drag-piece img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.drag-piece.dragging { cursor: grabbing; filter: drop-shadow(0 6px 10px rgb(0 0 0 / 0.4)); }
.swap { display: grid; gap: 3px; inline-size: 100%; padding: 3px; border-radius: var(--_radius-sm); background: var(--_border); }
.swap-tile { padding: 0; border: 0; border-radius: 4px; overflow: hidden; cursor: pointer; background: var(--_surface-alt); position: relative; touch-action: none; }
.swap-tile img { inline-size: 100%; block-size: 100%; display: block; object-fit: cover; pointer-events: none; }
.swap-tile[aria-pressed="true"] { outline: 3px solid var(--_primary); outline-offset: -3px; }
.swap-tile[aria-pressed="true"]::after { content: ""; position: absolute; inset: 0; background: color-mix(in srgb, var(--_primary) 22%, transparent); }
.hold-stage { position: relative; inline-size: min(100%, 200px); aspect-ratio: 1; margin-inline: auto; border-radius: 50%; overflow: hidden; }
.hold-stage > img { inline-size: 100%; block-size: 100%; display: block; pointer-events: none; }
.hold-arc { fill: none; stroke: var(--_primary); stroke-linecap: round; opacity: 0.9; }
.hold-btn {
  position: absolute; inset: 31%; border-radius: 50%; border: 0; cursor: pointer; font-weight: 700; font-size: 0.8em; line-height: 1.1;
  background: var(--_primary); color: var(--_on-primary); box-shadow: 0 4px 12px rgb(0 0 0 / 0.25); touch-action: none; user-select: none; -webkit-user-select: none;
  transition: transform 0.12s var(--_ease);
}
.hold-btn.holding { transform: scale(0.92); background: var(--_primary-hover); }
.cell.locked { pointer-events: none; }
.cell .badge {
  position: absolute; inset-block-start: 5px; inset-inline-start: 5px; z-index: 1; min-inline-size: 22px; block-size: 22px; border-radius: 11px;
  background: var(--_primary); color: var(--_on-primary); font-size: 13px; font-weight: 700; line-height: 22px; text-align: center;
}
.cell[data-pair]:not([data-pair=""])::before { content: none; }
.draw .tap circle { fill: var(--_primary); stroke: #fff; stroke-width: 2; }
.draw .tap text { fill: var(--_on-primary); font: 700 11px var(--_font); }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.shake { animation: ng-shake 0.32s linear; }
@keyframes ng-shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .progress > div { inline-size: 100%; opacity: 0.6; }
}
@media (forced-colors: active) {
  .ng, .track, .tile, input[type="text"], .question, .done, .error-box { border: 1px solid CanvasText; }
  .thumb, .btn { forced-color-adjust: none; background: ButtonText; color: ButtonFace; border: 1px solid ButtonText; }
  .btn.secondary { background: ButtonFace; color: ButtonText; }
  .cell[aria-pressed="true"]::after, .tile[aria-pressed="true"] { border-color: Highlight; background: transparent; }
  .cell[aria-pressed="true"]::before { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  .draw polyline, .draw .cross { stroke: Highlight; }
  .draw .kpt, .draw .tap circle { fill: Highlight; }
  .hold-arc { stroke: Highlight; }
  .hold-btn, .step, .cell .badge { forced-color-adjust: none; background: ButtonText; color: ButtonFace; }
  .swap-tile[aria-pressed="true"] { outline-color: Highlight; }
  .progress > div { background: Highlight; }
  :focus-visible { outline-color: Highlight; }
}
`;
