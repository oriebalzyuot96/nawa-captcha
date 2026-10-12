import { clamp, h, icon, nextId, pct, round1, s, safeImg } from './dom.js';
import { solvePow } from './pow.js';
import type { Lang, StringKey } from './strings.js';

export type InputMode = 'mouse' | 'touch' | 'pen' | 'keyboard';
type Pt = [number, number, number];

export interface ViewHost {
  readonly lang: Lang;
  readonly rtl: boolean;
  t(key: StringKey, vars?: Record<string, string | number>): string;
  submit(answer: Record<string, unknown>): void;
  announce(message: string): void;
  /** Aborted when the challenge is replaced. */
  readonly signal: AbortSignal;
}

export interface PuzzleView {
  readonly el: HTMLElement;
  focus(): void;
  /** Called after a wrong answer when the same challenge may be retried. */
  reset(): void;
}

const MAX_TRAIL = 800;

/** Records the gesture the server's heuristics will look at (image coordinates, ms). */
export class Trail {
  private pts: Pt[] = [];
  private t0 = 0;
  mode: InputMode = 'mouse';

  get length(): number {
    return this.pts.length;
  }

  add(x: number, y: number, mode: InputMode): void {
    const now = performance.now();
    if (this.pts.length === 0) this.t0 = now;
    this.mode = mode;
    this.pts.push([round1(x), round1(y), Math.round(now - this.t0)]);
  }

  pop(): void {
    this.pts.pop();
  }

  points(): readonly Pt[] {
    return this.pts;
  }

  clear(): void {
    this.pts = [];
  }

  export(): { mode: InputMode; trail: Pt[] } {
    let trail = this.pts;
    if (trail.length > MAX_TRAIL) {
      const step = trail.length / (MAX_TRAIL - 1);
      trail = Array.from({ length: MAX_TRAIL - 1 }, (_, i) => this.pts[Math.floor(i * step)]!).concat([this.pts[this.pts.length - 1]!]);
    }
    return { mode: this.mode, trail };
  }
}

export const pointerMode = (e: PointerEvent): InputMode => (e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse');

export function verifyButton(host: ViewHost, onClick: () => void): HTMLButtonElement {
  const b = h('button', { type: 'button', class: 'btn' }, host.t('verify'));
  b.addEventListener('click', onClick);
  return b;
}

/** Wires a horizontal drag on `targets`, reporting the client-x delta since pointerdown. */
function horizontalDrag(
  targets: HTMLElement[],
  handlers: { start(e: PointerEvent): void; move(dx: number, e: PointerEvent): void; end(e: PointerEvent): void },
): void {
  for (const target of targets) {
    let startX = 0;
    let active = -1;
    target.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || active !== -1) return;
      e.preventDefault();
      active = e.pointerId;
      startX = e.clientX;
      target.setPointerCapture(e.pointerId);
      handlers.start(e);
    });
    target.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      handlers.move(e.clientX - startX, e);
    });
    const finish = (e: PointerEvent): void => {
      if (e.pointerId !== active) return;
      active = -1;
      handlers.end(e);
    };
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
  }
}

function sliderTrack(label: string, hintId: string, max: number, valueText?: (v: number) => string) {
  const fill = h('div', { class: 'track-fill' });
  const thumb = h('div', { class: 'thumb', role: 'slider', tabindex: 0, 'aria-label': label, 'aria-describedby': hintId, 'aria-valuemin': 0, 'aria-valuemax': Math.round(max), 'aria-valuenow': 0 });
  thumb.append(icon('arrows'));
  const track = h('div', { class: 'track', dir: 'ltr' }, fill, thumb);
  const render = (value: number): void => {
    const ratio = max > 0 ? value / max : 0;
    thumb.style.left = `calc((100% - 56px) * ${ratio.toFixed(5)})`;
    fill.style.width = `calc((100% - 56px) * ${ratio.toFixed(5)} + 28px)`;
    thumb.setAttribute('aria-valuenow', String(Math.round(value)));
    if (valueText) thumb.setAttribute('aria-valuetext', valueText(value));
  };
  return { track, thumb, render };
}

// ------------------------------------------------------------------------------- slider

export function sliderView(host: ViewHost, data: Record<string, number | string>): PuzzleView {
  const W = Number(data['width']);
  const H = Number(data['height']);
  const pieceW = Number(data['pieceWidth']);
  const pieceY = Number(data['pieceY']);
  const startX = Number(data['startX']);
  const maxX = W - pieceW;
  let x = startX;
  let origin = startX;
  let moved = false;
  const trail = new Trail();

  const hintId = nextId('ng-hint');
  const stage = h('div', { class: 'stage', dir: 'ltr', style: `aspect-ratio:${W}/${H}` });
  const piece = safeImg(data['piece'], '');
  piece.className = 'piece';
  piece.setAttribute('aria-hidden', 'true');
  piece.style.width = pct(pieceW / W);
  piece.style.top = pct(pieceY / H);
  stage.append(safeImg(data['background'], host.t('imageAlt')), piece);
  const { track, thumb, render: renderTrack } = sliderTrack(host.t('sliderLabel'), hintId, maxX);
  const hint = h('p', { class: 'hint', id: hintId }, host.t('sliderHint'));

  const render = (): void => {
    piece.style.left = pct(x / W);
    renderTrack(x - startX);
  };
  const scale = (): number => W / (stage.getBoundingClientRect().width || W);
  const pointerY = (e: PointerEvent): number => (e.clientY - stage.getBoundingClientRect().top) * scale();
  const submit = (): void => {
    if (!moved) return;
    host.submit({ x: round1(x), interaction: trail.export() });
  };

  horizontalDrag([piece, thumb], {
    start(e) {
      origin = x;
      // The trail records the piece's position over time (plus the real pointer y), so its
      // horizontal travel always matches the submitted x even when the piece hits an edge.
      trail.add(x, pointerY(e), pointerMode(e));
    },
    move(dx, e) {
      x = clamp(origin + dx * scale(), 0, maxX);
      if (Math.abs(x - origin) > 1) moved = true;
      trail.add(x, pointerY(e), pointerMode(e));
      render();
    },
    end(e) {
      trail.add(x, pointerY(e), pointerMode(e));
      submit();
    },
  });

  thumb.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 2;
    let next = x;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = x + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = x - step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = maxX;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      submit();
      return;
    } else return;
    e.preventDefault();
    if (trail.length === 0) trail.add(x, pieceY, 'keyboard');
    x = clamp(next, 0, maxX);
    moved = true;
    trail.add(x, pieceY, 'keyboard');
    render();
  });

  render();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, track, hint),
    focus: () => thumb.focus(),
    reset() {
      x = startX;
      moved = false;
      trail.clear();
      render();
    },
  };
}

// ------------------------------------------------------------------------------- rotate

export function rotateView(host: ViewHost, data: Record<string, number | string>): PuzzleView {
  const TRACK = Number(data['track']) || 300;
  let angle = 0;
  let origin = 0;
  let moved = false;
  const trail = new Trail();
  const hintId = nextId('ng-hint');
  const img = safeImg(data['image'], host.t('imageAlt'));
  const base = typeof data['base'] === 'string' ? safeImg(data['base'], '') : undefined;
  if (base) {
    base.className = 'rot-base';
    base.setAttribute('aria-hidden', 'true');
  }
  const stage = h('div', { class: base ? 'rot-stage framed' : 'rot-stage' }, base ?? null, img);
  const { track, thumb, render: renderTrack } = sliderTrack(host.t('rotateLabel'), hintId, 360, (v) => host.t('rotateValue', { n: Math.round(v) }));
  const hint = h('p', { class: 'hint', id: hintId }, host.t('rotateHint'));
  const render = (): void => {
    img.style.transform = `rotate(${angle.toFixed(1)}deg)`;
    renderTrack(angle);
  };
  const usable = (): number => Math.max(1, track.getBoundingClientRect().width - 56);
  const trailY = (e: PointerEvent): number => {
    const r = track.getBoundingClientRect();
    return (e.clientY - r.top - r.height / 2) * (TRACK / usable());
  };
  const submit = (): void => {
    if (moved) host.submit({ angle: round1(angle), interaction: trail.export() });
  };

  horizontalDrag([thumb], {
    start(e) {
      origin = angle;
      trail.add((angle / 360) * TRACK, trailY(e), pointerMode(e));
    },
    move(dx, e) {
      angle = clamp(origin + (dx / usable()) * 360, 0, 359.9);
      if (Math.abs(angle - origin) > 1) moved = true;
      trail.add((angle / 360) * TRACK, trailY(e), pointerMode(e));
      render();
    },
    end(e) {
      trail.add((angle / 360) * TRACK, trailY(e), pointerMode(e));
      submit();
    },
  });
  thumb.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 15 : 3;
    let next = angle;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = angle + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = angle - step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 359;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      submit();
      return;
    } else return;
    e.preventDefault();
    if (trail.length === 0) trail.add(0, 0, 'keyboard');
    angle = clamp(next, 0, 359.9);
    moved = true;
    trail.add((angle / 360) * TRACK, 0, 'keyboard');
    render();
  });
  render();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, track, hint),
    focus: () => thumb.focus(),
    reset() {
      angle = 0;
      moved = false;
      trail.clear();
      render();
    },
  };
}

// ------------------------------------------------------------------------------- picture grid

export interface CellGrid {
  readonly stage: HTMLElement;
  readonly cells: (HTMLButtonElement | undefined)[];
  readonly hintId: string;
  focus(): void;
}

/**
 * A picture with transparent cell buttons laid over its grid area (below an optional header
 * strip). Arrow keys move a roving focus between the selectable cells.
 */
export function cellGrid(host: ViewHost, data: Record<string, unknown>, onActivate: (i: number) => void): CellGrid {
  const rows = Number(data['rows']);
  const cols = Number(data['cols']);
  const width = Number(data['width']) || cols * Number(data['cellSize']);
  const height = Number(data['height']) || rows * Number(data['cellSize']);
  const top = Number(data['gridTop']) || 0;
  const locked = new Set(Array.isArray(data['locked']) ? (data['locked'] as unknown[]).filter((v): v is number => typeof v === 'number') : []);
  const hintId = nextId('ng-hint');
  const grid = h('div', { class: 'grid', dir: 'ltr', role: 'group', 'aria-describedby': hintId, style: `top:${pct(top / height)};height:${pct((height - top) / height)};grid-template:repeat(${rows},1fr)/repeat(${cols},1fr)` });
  const cells: (HTMLButtonElement | undefined)[] = [];
  const first = Array.from({ length: rows * cols }, (_, i) => i).find((i) => !locked.has(i)) ?? 0;
  for (let i = 0; i < rows * cols; i += 1) {
    if (locked.has(i)) {
      grid.append(h('div', { class: 'cell locked', 'aria-hidden': 'true' }));
      cells.push(undefined);
      continue;
    }
    const cell = h('button', { type: 'button', class: 'cell', 'aria-pressed': 'false', tabindex: i === first ? 0 : -1, 'aria-label': host.t('cell', { r: Math.floor(i / cols) + 1, c: (i % cols) + 1 }) });
    cell.addEventListener('click', () => onActivate(i));
    cell.addEventListener('keydown', (e) => {
      const deltas: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      const d = deltas[e.key];
      if (!d) return;
      e.preventDefault();
      let c = i % cols;
      let r = Math.floor(i / cols);
      // Skip over locked cells in the direction of travel.
      for (;;) {
        c += d[0];
        r += d[1];
        if (c < 0 || c >= cols || r < 0 || r >= rows) return;
        const next = cells[r * cols + c];
        if (next) {
          cell.tabIndex = -1;
          next.tabIndex = 0;
          next.focus();
          return;
        }
      }
    });
    cells.push(cell);
    grid.append(cell);
  }
  const stage = h('div', { class: 'stage', style: `aspect-ratio:${width}/${height}` }, safeImg(data['image'], host.t('imageAlt')), grid);
  return { stage, cells, hintId, focus: () => (cells.find((c) => c?.tabIndex === 0) ?? cells.find(Boolean))?.focus() };
}

/** View `grid`: select one or many cells, then Verify. */
export function gridView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const single = data['select'] === 'one';
  const g: CellGrid = cellGrid(host, data, (i) => {
    const cell = g.cells[i]!;
    const on = cell.getAttribute('aria-pressed') !== 'true';
    if (single) for (const c of g.cells) c?.setAttribute('aria-pressed', 'false');
    cell.setAttribute('aria-pressed', String(on));
  });
  const submit = (): void => host.submit({ selected: g.cells.flatMap((c, i) => (c?.getAttribute('aria-pressed') === 'true' ? [i] : [])) });
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, g.stage, h('p', { class: 'hint', id: g.hintId }, host.t('gridHint')), h('div', { class: 'row' }, verifyButton(host, submit))),
    focus: g.focus,
    reset() {
      for (const c of g.cells) c?.setAttribute('aria-pressed', 'false');
    },
  };
}

/** @deprecated the icons view is now the generic grid view. */
export const iconsView = gridView;


// ------------------------------------------------------------------------------- math

export function mathView(host: ViewHost, data: Record<string, number | string>): PuzzleView {
  const id = nextId('ng-answer');
  const input = h('input', { type: 'text', id, inputmode: 'numeric', autocomplete: 'off', spellcheck: 'false', dir: 'ltr', maxlength: 6, enterkeyhint: 'done' });
  const submit = (): void => {
    if (input.value.trim()) host.submit({ value: input.value.trim() });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  const img = safeImg(data['image'], host.t('imageAlt'));
  img.className = 'fill-img';
  const stage = h('div', { class: 'stage', style: `aspect-ratio:${data['width']}/${data['height']}` }, img);
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, h('label', { for: id }, host.t('answer')), h('div', { class: 'row', style: 'flex-wrap:nowrap' }, input, verifyButton(host, submit))),
    focus: () => input.focus(),
    reset() {
      input.value = '';
    },
  };
}

// ------------------------------------------------------------------------------- order

export function orderView(host: ViewHost, data: { tiles?: Array<{ id: string; image: string }> }): PuzzleView {
  const tiles = (data.tiles ?? []).filter((t) => typeof t.id === 'string');
  const initial = tiles.map((t) => t.id);
  const hintId = nextId('ng-hint');
  const list = h('ol', { class: 'tiles', 'aria-describedby': hintId });
  const items = new Map<string, HTMLLIElement>();
  let grabbed: string | undefined;
  let drag: { id: string; pointer: number } | undefined;

  const order = (): string[] => [...list.children].map((li) => (li as HTMLElement).dataset['id']!);
  const label = (): void => {
    const ids = order();
    ids.forEach((id, i) => {
      const li = items.get(id)!;
      const btn = li.querySelector('button')!;
      btn.setAttribute('aria-label', host.t('tile', { i: i + 1, n: ids.length }));
      li.querySelector('.pos')!.textContent = String(i + 1);
    });
  };
  const moveTo = (id: string, index: number): void => {
    const li = items.get(id)!;
    const ids = order().filter((x) => x !== id);
    const target = clamp(index, 0, ids.length);
    const ref = target < ids.length ? items.get(ids[target]!)! : null;
    if (li.nextSibling !== ref || li === ref) list.insertBefore(li, ref);
    label();
  };

  for (const tile of tiles) {
    const btn = h('button', { type: 'button', class: 'tile', 'aria-pressed': 'false' }, safeImg(tile.image, ''), h('span', { class: 'pos', 'aria-hidden': 'true' }));
    const li = h('li', { 'data-id': tile.id }, btn);
    items.set(tile.id, li);
    list.append(li);

    btn.addEventListener('keydown', (e) => {
      const idx = order().indexOf(tile.id);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        grabbed = grabbed === tile.id ? undefined : tile.id;
        for (const [id, item] of items) item.querySelector('button')!.setAttribute('aria-pressed', String(id === grabbed));
        host.announce(host.t(grabbed ? 'tileGrabbed' : 'tileDropped', { i: idx + 1, n: tiles.length }));
        return;
      }
      if (e.key === 'Escape' && grabbed) {
        grabbed = undefined;
        btn.setAttribute('aria-pressed', 'false');
        return;
      }
      if (grabbed !== tile.id) return;
      const forward = host.rtl ? 'ArrowLeft' : 'ArrowRight';
      const backward = host.rtl ? 'ArrowRight' : 'ArrowLeft';
      let delta = 0;
      if (e.key === forward || e.key === 'ArrowDown') delta = 1;
      else if (e.key === backward || e.key === 'ArrowUp') delta = -1;
      else return;
      e.preventDefault();
      moveTo(tile.id, idx + delta);
      btn.focus();
      host.announce(host.t('tileMoved', { i: order().indexOf(tile.id) + 1, n: tiles.length }));
    });

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || drag) return;
      e.preventDefault();
      drag = { id: tile.id, pointer: e.pointerId };
      // Capture on the list, not the tile: re-inserting a captured node would release capture.
      list.setPointerCapture(e.pointerId);
      btn.classList.add('dragging');
    });
  }
  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dragId = drag.id;
    // Insertion index = how many other tiles lie before the pointer in reading direction.
    let index = 0;
    for (const id of order()) {
      if (id === dragId) continue;
      const r = items.get(id)!.getBoundingClientRect();
      const centre = r.left + r.width / 2;
      if (host.rtl ? e.clientX < centre : e.clientX > centre) index += 1;
    }
    if (index !== order().indexOf(dragId)) moveTo(dragId, index);
  });
  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.pointer) return;
    items.get(drag.id)!.querySelector('button')!.classList.remove('dragging');
    drag = undefined;
  };
  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointercancel', endDrag);
  label();

  return {
    el: h('div', { class: 'row', style: 'display:grid' }, list, h('p', { class: 'hint', id: hintId }, host.t('orderHint')), h('div', { class: 'row' }, verifyButton(host, () => host.submit({ order: order() })))),
    focus: () => (list.querySelector('button') as HTMLButtonElement | null)?.focus(),
    reset() {
      grabbed = undefined;
      for (const id of initial) list.append(items.get(id)!);
      for (const item of items.values()) item.querySelector('button')!.setAttribute('aria-pressed', 'false');
      label();
    },
  };
}

// ------------------------------------------------------------------------------- path (trace, maze)

export function pathView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const W = Number(data['width']);
  const H = Number(data['height']);
  const gridData = data['grid'] as { cols?: unknown; rows?: unknown } | undefined;
  const gcols = Number(gridData?.cols) || 0;
  const grows = Number(gridData?.rows) || 0;
  const cellMode = gcols > 0 && grows > 0;
  const cw = cellMode ? W / gcols : 0;
  const ch = cellMode ? H / grows : 0;
  const trail = new Trail();
  const hintId = nextId('ng-hint');
  const svg = s('svg', { class: 'draw', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const cross = s('g', { class: 'cross', visibility: 'hidden' }, s('line', { x1: -9, y1: 0, x2: 9, y2: 0 }), s('line', { x1: 0, y1: -9, x2: 0, y2: 9 }), s('circle', { r: 4, fill: 'none' }));
  svg.append(cross);
  let stroke: SVGPolylineElement | undefined;
  let kbLine: SVGPolylineElement | undefined;
  let penDown = false;
  let cursor: [number, number] = cellMode ? [cw / 2, Math.floor(grows / 2) * ch + ch / 2] : [W / 2, H / 2];
  const stage = h('div', { class: 'stage', dir: 'ltr', tabindex: 0, role: 'application', 'aria-label': host.t('traceLabel'), 'aria-describedby': hintId, style: `aspect-ratio:${W}/${H}` }, safeImg(data['image'], host.t('imageAlt')), svg);
  const verify = verifyButton(host, () => host.submit({ interaction: trail.export() }));
  const clear = h('button', { type: 'button', class: 'btn secondary' }, host.t('clear'));
  const sync = (): void => {
    verify.disabled = trail.length < 2;
  };
  const toImage = (e: PointerEvent): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const append = (line: SVGPolylineElement, x: number, y: number): void => {
    line.setAttribute('points', `${line.getAttribute('points') ?? ''} ${x.toFixed(1)},${y.toFixed(1)}`.trim());
  };
  const resetAll = (): void => {
    trail.clear();
    for (const el of [...svg.querySelectorAll('polyline, .kpt')]) el.remove();
    stroke = undefined;
    kbLine = undefined;
    penDown = false;
    sync();
  };
  clear.addEventListener('click', resetAll);

  let active = -1;
  let last: [number, number] = [0, 0];
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (cellMode && trail.length) resetAll(); // a maze is one continuous line
    active = e.pointerId;
    stage.setPointerCapture(e.pointerId);
    const [x, y] = toImage(e);
    stroke = s('polyline');
    svg.insertBefore(stroke, cross);
    append(stroke, x, y);
    trail.add(x, y, pointerMode(e));
    last = [x, y];
    sync();
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active || !stroke) return;
    const [x, y] = toImage(e);
    if (Math.hypot(x - last[0], y - last[1]) < 1.5) return;
    append(stroke, x, y);
    trail.add(x, y, pointerMode(e));
    last = [x, y];
    sync();
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId === active) active = -1;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  const moveCross = (): void => cross.setAttribute('transform', `translate(${cursor[0].toFixed(1)} ${cursor[1].toFixed(1)})`);
  const placePoint = (): void => {
    if (!kbLine) {
      kbLine = s('polyline');
      svg.insertBefore(kbLine, cross);
    }
    append(kbLine, cursor[0], cursor[1]);
    svg.insertBefore(s('circle', { class: 'kpt', cx: cursor[0].toFixed(1), cy: cursor[1].toFixed(1), r: 3.5 }), cross);
    trail.add(cursor[0], cursor[1], 'keyboard');
    sync();
  };
  stage.addEventListener('focus', () => {
    cross.setAttribute('visibility', stage.matches(':focus-visible') ? 'visible' : 'hidden');
    moveCross();
  });
  stage.addEventListener('blur', () => cross.setAttribute('visibility', 'hidden'));
  stage.addEventListener('keydown', (e) => {
    const step = cellMode ? 1 : e.shiftKey ? 16 : 4;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      cursor = cellMode
        ? [clamp(cursor[0] + m[0] * cw, cw / 2, W - cw / 2), clamp(cursor[1] + m[1] * ch, ch / 2, H - ch / 2)]
        : [clamp(cursor[0] + m[0], 0, W), clamp(cursor[1] + m[1], 0, H)];
      cross.setAttribute('visibility', 'visible');
      moveCross();
      if (cellMode && penDown) placePoint();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (cellMode) {
        if (e.key === 'Enter' && trail.length >= 2) {
          host.submit({ interaction: trail.export() });
          return;
        }
        if (!penDown) {
          resetAll();
          penDown = true;
          placePoint();
          host.announce(host.t('mazePen'));
        }
        return;
      }
      placePoint();
      host.announce(host.t('tracePoints', { n: trail.length }));
    } else if (e.key === 'Backspace' && kbLine) {
      e.preventDefault();
      const pts = (kbLine.getAttribute('points') ?? '').trim().split(/\s+/);
      pts.pop();
      kbLine.setAttribute('points', pts.join(' '));
      svg.querySelectorAll('.kpt').item(svg.querySelectorAll('.kpt').length - 1)?.remove();
      trail.pop();
      if (cellMode) {
        const prev = trail.points()[trail.length - 1];
        if (prev) cursor = [prev[0], prev[1]];
        else penDown = false;
        moveCross();
      }
      host.announce(host.t('tracePoints', { n: trail.length }));
      sync();
    }
  });
  sync();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, h('p', { class: 'hint', id: hintId }, host.t(cellMode ? 'mazeHint' : 'traceHint')), h('div', { class: 'row' }, verify, clear)),
    focus: () => stage.focus(),
    reset: resetAll,
  };
}

/** @deprecated use {@link pathView}. */
export const traceView = pathView;


// ------------------------------------------------------------------------------- proof of work

export function powView(host: ViewHost, data: Record<string, number | string>): PuzzleView {
  const el = h('div', { class: 'row', style: 'display:grid', 'aria-busy': 'true' }, h('p', { class: 'hint' }, host.t('powWorking')), h('div', { class: 'progress', 'aria-hidden': 'true' }, h('div')));
  const run = (): void => {
    void solvePow(String(data['salt']), Number(data['bits']), host.signal).then((nonce) => {
      if (nonce !== undefined && !host.signal.aborted) host.submit({ nonce });
    });
  };
  queueMicrotask(run);
  return { el, focus: () => undefined, reset: run };
}

// ------------------------------------------------------------------------------- accessible

export function accessibleView(host: ViewHost, data: { question?: unknown; pow?: { salt?: unknown; bits?: unknown } }): PuzzleView {
  const qid = nextId('ng-q');
  const aid = nextId('ng-a');
  // The proof-of-work tax runs while the person reads and types, so it costs them nothing.
  const nonce = solvePow(String(data.pow?.salt ?? ''), Number(data.pow?.bits ?? 0), host.signal);
  const input = h('input', { type: 'text', id: aid, autocomplete: 'off', spellcheck: 'false', 'aria-describedby': qid, maxlength: 64, enterkeyhint: 'done' });
  let sending = false;
  const submit = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    const n = await nonce;
    sending = false;
    if (n !== undefined && !host.signal.aborted) host.submit({ text, nonce: n });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  });
  return {
    el: h(
      'div',
      { class: 'row', style: 'display:grid' },
      h('p', { class: 'question', id: qid }, String(data.question ?? '')),
      h('label', { for: aid }, host.t('answer')),
      h('div', { class: 'row', style: 'flex-wrap:nowrap' }, input, verifyButton(host, () => void submit())),
      h('p', { class: 'hint' }, host.t('a11yNote')),
    ),
    focus: () => input.focus(),
    reset() {
      input.value = '';
    },
  };
}
