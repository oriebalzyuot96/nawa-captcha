import { clamp, h, nextId, pct, round1, s, safeImg } from './dom.js';
import { cellGrid, pointerMode, Trail, verifyButton, type InputMode, type PuzzleView, type ViewHost } from './views.js';

// ------------------------------------------------------------------------------- drag (2D)

/** View `drag`: move a piece anywhere over a picture (pointer or arrow keys) and drop it. */
export function dragView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const W = Number(data['width']);
  const H = Number(data['height']);
  const pw = Number(data['pieceWidth']);
  const ph = Number(data['pieceHeight']);
  const startX = Number(data['startX']);
  const startY = Number(data['startY']);
  let x = startX;
  let y = startY;
  let moved = false;
  const trail = new Trail();
  const hintId = nextId('ng-hint');
  const piece = h('div', { class: 'drag-piece', tabindex: 0, role: 'application', 'aria-label': host.t('dragLabel'), 'aria-describedby': hintId }, safeImg(data['piece'], ''));
  piece.style.width = pct(pw / W);
  piece.style.height = pct(ph / H);
  const stage = h('div', { class: 'stage', dir: 'ltr', style: `aspect-ratio:${W}/${H}` }, safeImg(data['background'], host.t('imageAlt')), piece);
  const render = (): void => {
    piece.style.left = pct(x / W);
    piece.style.top = pct(y / H);
  };
  const submit = (): void => {
    if (moved) host.submit({ x: round1(x), y: round1(y), interaction: trail.export() });
  };
  let active = -1;
  let origin: [number, number, number, number] = [0, 0, 0, 0];
  const scale = (): number => W / (stage.getBoundingClientRect().width || W);
  piece.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || active !== -1) return;
    e.preventDefault();
    active = e.pointerId;
    piece.setPointerCapture(e.pointerId);
    origin = [e.clientX, e.clientY, x, y];
    piece.classList.add('dragging');
    trail.add(x, y, pointerMode(e));
  });
  piece.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    const k = scale();
    x = clamp(origin[2] + (e.clientX - origin[0]) * k, -pw / 4, W - (pw * 3) / 4);
    y = clamp(origin[3] + (e.clientY - origin[1]) * k, -ph / 4, H - (ph * 3) / 4);
    if (Math.hypot(x - origin[2], y - origin[3]) > 2) moved = true;
    trail.add(x, y, pointerMode(e));
    render();
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== active) return;
    active = -1;
    piece.classList.remove('dragging');
    trail.add(x, y, pointerMode(e));
    submit();
  };
  piece.addEventListener('pointerup', end);
  piece.addEventListener('pointercancel', end);
  piece.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 12 : 3;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      submit();
      return;
    }
    if (!m) return;
    e.preventDefault();
    if (trail.length === 0) trail.add(x, y, 'keyboard');
    x = clamp(x + m[0], -pw / 4, W - (pw * 3) / 4);
    y = clamp(y + m[1], -ph / 4, H - (ph * 3) / 4);
    moved = true;
    trail.add(x, y, 'keyboard');
    render();
  });
  render();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, h('p', { class: 'hint', id: hintId }, host.t('dragHint'))),
    focus: () => piece.focus(),
    reset() {
      x = startX;
      y = startY;
      moved = false;
      trail.clear();
      render();
    },
  };
}

// ------------------------------------------------------------------------------- swap (jigsaw)

/** View `swap`: picture pieces in a frame; select two pieces (or drag one onto another) to swap them. */
export function swapView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const rows = Number(data['rows']);
  const cols = Number(data['cols']);
  const W = Number(data['width']);
  const H = Number(data['height']);
  const tiles = (Array.isArray(data['tiles']) ? (data['tiles'] as Array<{ id?: unknown; image?: unknown }>) : []).filter((t) => typeof t.id === 'string');
  const initial = tiles.map((t) => t.id as string);
  let order = [...initial];
  let picked: number | undefined;
  let focusIndex = 0;
  const hintId = nextId('ng-hint');
  const frame = h('div', { class: 'swap', dir: 'ltr', role: 'group', 'aria-describedby': hintId, style: `aspect-ratio:${W}/${H};grid-template:repeat(${rows},1fr)/repeat(${cols},1fr)` });
  const images = new Map(tiles.map((t) => [t.id as string, t.image]));
  const buttons: HTMLButtonElement[] = [];

  const render = (): void => {
    buttons.forEach((b, i) => {
      b.replaceChildren(safeImg(images.get(order[i]!), ''));
      b.setAttribute('aria-pressed', String(picked === i));
      b.tabIndex = i === focusIndex ? 0 : -1;
    });
  };
  const choose = (i: number): void => {
    if (picked === undefined) {
      picked = i;
      host.announce(host.t('pieceSelected', { i: i + 1 }));
    } else if (picked === i) picked = undefined;
    else {
      const a = picked;
      [order[a], order[i]] = [order[i]!, order[a]!];
      picked = undefined;
      host.announce(host.t('pieceSwapped', { a: a + 1, b: i + 1 }));
    }
    render();
  };
  for (let i = 0; i < rows * cols; i += 1) {
    const b = h('button', { type: 'button', class: 'swap-tile', 'aria-label': host.t('piece', { i: i + 1, n: rows * cols }) });
    b.addEventListener('click', () => {
      focusIndex = i;
      choose(i);
    });
    b.addEventListener('keydown', (e) => {
      const deltas: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
      const d = deltas[e.key];
      if (d === undefined) return;
      e.preventDefault();
      const n = i + d;
      if (n < 0 || n >= rows * cols || (Math.abs(d) === 1 && Math.floor(n / cols) !== Math.floor(i / cols))) return;
      focusIndex = n;
      render();
      buttons[n]!.focus();
    });
    // Drag one piece onto another to swap them.
    let down: { id: number; x: number; y: number } | undefined;
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY };
      b.setPointerCapture(e.pointerId);
    });
    b.addEventListener('pointerup', (e) => {
      if (!down || down.id !== e.pointerId) return;
      const far = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12;
      down = undefined;
      if (!far) return; // a click; handled by the click listener
      e.preventDefault();
      const target = buttons.findIndex((o) => {
        const r = o.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (target >= 0 && target !== i) {
        picked = i;
        choose(target);
      }
      // Swallow the click that follows a drag.
      b.addEventListener('click', (ev) => ev.stopImmediatePropagation(), { once: true, capture: true });
    });
    buttons.push(b);
    frame.append(b);
  }
  render();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, frame, h('p', { class: 'hint', id: hintId }, host.t('swapHint')), h('div', { class: 'row' }, verifyButton(host, () => host.submit({ order: [...order] })))),
    focus: () => buttons[focusIndex]?.focus(),
    reset() {
      order = [...initial];
      picked = undefined;
      render();
    },
  };
}

// ------------------------------------------------------------------------------- hold

/** View `hold`: press and hold; a progress arc sweeps over the dial; release in the target zone. */
export function holdView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const size = Number(data['size']);
  const cycle = Number(data['cycleMs']) || 3000;
  const radius = Number(data['radius']);
  const strokeW = Number(data['stroke']);
  const hintId = nextId('ng-hint');
  const circ = 2 * Math.PI * radius;
  const arc = s('circle', { class: 'hold-arc', cx: size / 2, cy: size / 2, r: radius, 'stroke-width': Math.max(4, strokeW - 8), 'stroke-dasharray': circ.toFixed(2), 'stroke-dashoffset': circ.toFixed(2), transform: `rotate(-90 ${size / 2} ${size / 2})` });
  const svg = s('svg', { class: 'draw', viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' }, arc);
  const button = h('button', { type: 'button', class: 'hold-btn', 'aria-describedby': hintId }, host.t('holdLabel'));
  const stage = h('div', { class: 'hold-stage' }, safeImg(data['image'], host.t('imageAlt')), svg, button);
  let started: number | undefined;
  let mode: InputMode = 'mouse';
  let raf = 0;
  let toggled = false;
  const frame = (): void => {
    if (started === undefined) return;
    const p = Math.min(1, (performance.now() - started) / cycle);
    arc.setAttribute('stroke-dashoffset', (circ * (1 - p)).toFixed(2));
    if (p < 1) raf = requestAnimationFrame(frame);
  };
  const start = (m: InputMode): void => {
    if (started !== undefined) return;
    mode = m;
    started = performance.now();
    button.classList.add('holding');
    host.announce(host.t('holdGoing'));
    raf = requestAnimationFrame(frame);
  };
  const stop = (): void => {
    if (started === undefined) return;
    const heldMs = Math.round(performance.now() - started);
    started = undefined;
    toggled = false;
    cancelAnimationFrame(raf);
    button.classList.remove('holding');
    host.submit({ heldMs, mode });
  };
  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    start(pointerMode(e));
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) start('keyboard');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      // Toggle mode for people who cannot hold a key down.
      if (started === undefined) {
        toggled = true;
        start('keyboard');
      } else if (toggled) stop();
    }
  });
  button.addEventListener('keyup', (e) => {
    if (e.key === ' ' && !toggled) {
      e.preventDefault();
      stop();
    }
  });
  host.signal.addEventListener('abort', () => cancelAnimationFrame(raf));
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, h('p', { class: 'hint', id: hintId }, host.t('holdHint'))),
    focus: () => button.focus(),
    reset() {
      started = undefined;
      arc.setAttribute('stroke-dashoffset', circ.toFixed(2));
    },
  };
}

// ------------------------------------------------------------------------------- pairs

/** View `pairs`: link matching cells two at a time. */
export function pairsView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const n = Number(data['rows']) * Number(data['cols']);
  const pairOf = new Map<number, number>();
  const labelOf = new Map<number, number>();
  let pending: number | undefined;
  const verify = verifyButton(host, () => {
    const pairs: Array<[number, number]> = [];
    for (const [a, b] of pairOf) if (a < b) pairs.push([a, b]);
    host.submit({ pairs });
  });
  const g = cellGrid(host, { ...data, select: 'many' }, (i) => {
    if (pairOf.has(i)) {
      const j = pairOf.get(i)!;
      pairOf.delete(i);
      pairOf.delete(j);
      labelOf.delete(i);
      labelOf.delete(j);
      host.announce(host.t('pairUndone'));
    } else if (pending === undefined) pending = i;
    else if (pending === i) pending = undefined;
    else {
      const used = new Set(labelOf.values());
      let k = 1;
      while (used.has(k)) k += 1;
      pairOf.set(i, pending).set(pending, i);
      labelOf.set(i, k).set(pending, k);
      pending = undefined;
      host.announce(host.t('pairMade', { k }));
    }
    render();
  });
  const base = g.cells.map((c) => c?.getAttribute('aria-label') ?? '');
  const render = (): void => {
    g.cells.forEach((c, i) => {
      if (!c) return;
      const k = labelOf.get(i);
      c.setAttribute('aria-pressed', String(pending === i || k !== undefined));
      c.dataset['pair'] = k === undefined ? '' : String(k);
      c.replaceChildren(...(k === undefined ? [] : [h('span', { class: 'badge', 'aria-hidden': 'true' }, String(k))]));
      c.setAttribute('aria-label', k === undefined ? base[i]! : `${base[i]}, ${host.t('pairLabel', { k })}`);
    });
    verify.disabled = pairOf.size < n;
  };
  render();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, g.stage, h('p', { class: 'hint', id: g.hintId }, host.t('pairsHint')), h('div', { class: 'row' }, verify)),
    focus: g.focus,
    reset() {
      pairOf.clear();
      labelOf.clear();
      pending = undefined;
      render();
    },
  };
}

// ------------------------------------------------------------------------------- taps

/** View `taps`: tap points on a picture in order (numbered markers); keyboard crosshair + Space. */
export function tapsView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const W = Number(data['width']);
  const H = Number(data['height']);
  const count = Number(data['count']) || 1;
  const trail = new Trail();
  const hintId = nextId('ng-hint');
  const marks = s('g');
  const cross = s('g', { class: 'cross', visibility: 'hidden' }, s('line', { x1: -9, y1: 0, x2: 9, y2: 0 }), s('line', { x1: 0, y1: -9, x2: 0, y2: 9 }), s('circle', { r: 4, fill: 'none' }));
  const svg = s('svg', { class: 'draw', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, marks, cross);
  const stage = h('div', { class: 'stage', dir: 'ltr', tabindex: 0, role: 'application', 'aria-label': host.t('tapsLabel'), 'aria-describedby': hintId, style: `aspect-ratio:${W}/${H}` }, safeImg(data['image'], host.t('imageAlt')), svg);
  let cursor: [number, number] = [W / 2, H / 2];
  const verify = verifyButton(host, () => host.submit({ mode: trail.mode, taps: trail.export().trail }));
  const undo = h('button', { type: 'button', class: 'btn secondary' }, host.t('undo'));
  const sync = (): void => {
    verify.disabled = trail.length !== count;
    undo.disabled = trail.length === 0;
  };
  const tap = (x: number, y: number, mode: InputMode): void => {
    if (trail.length >= count) return;
    trail.add(x, y, mode);
    marks.append(s('g', { class: 'tap', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, s('circle', { r: 9 }), s('text', { 'text-anchor': 'middle', y: 4 }, String(trail.length))));
    host.announce(host.t('tapsCount', { n: trail.length, total: count }));
    sync();
  };
  undo.addEventListener('click', () => {
    trail.pop();
    marks.lastChild?.remove();
    sync();
  });
  let down: { id: number; x: number; y: number } | undefined;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14;
    down = undefined;
    if (moved) return;
    const r = stage.getBoundingClientRect();
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, pointerMode(e));
  });
  const moveCross = (): void => cross.setAttribute('transform', `translate(${cursor[0].toFixed(1)} ${cursor[1].toFixed(1)})`);
  stage.addEventListener('focus', () => {
    cross.setAttribute('visibility', stage.matches(':focus-visible') ? 'visible' : 'hidden');
    moveCross();
  });
  stage.addEventListener('blur', () => cross.setAttribute('visibility', 'hidden'));
  stage.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 16 : 4;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      cursor = [clamp(cursor[0] + m[0], 0, W), clamp(cursor[1] + m[1], 0, H)];
      cross.setAttribute('visibility', 'visible');
      moveCross();
    } else if (e.key === ' ') {
      e.preventDefault();
      tap(cursor[0], cursor[1], 'keyboard');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (trail.length === count) verify.click();
      else tap(cursor[0], cursor[1], 'keyboard');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undo.click();
    }
  });
  sync();
  return {
    el: h('div', { class: 'row', style: 'display:grid' }, stage, h('p', { class: 'hint', id: hintId }, host.t('tapsHint')), h('div', { class: 'row' }, verify, undo)),
    focus: () => stage.focus(),
    reset() {
      trail.clear();
      marks.replaceChildren();
      sync();
    },
  };
}

