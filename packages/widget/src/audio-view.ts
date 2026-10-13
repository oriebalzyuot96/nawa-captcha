import { h, icon, nextId, safeAudioSrc } from './dom.js';
import { solvePow } from './pow.js';
import { verifyButton, type PuzzleView, type ViewHost } from './views.js';

type Ctx = AudioContext;

function base64ToBuffer(dataUrl: string): ArrayBuffer {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/**
 * View `audio`: a Play button (limited replays), an answer field and Verify. No transcript is ever
 * shown. Playback uses Web Audio (decoded from the data: WAV, so no media-src CSP is needed), with
 * an <audio> fallback. Nothing plays until the person presses Play.
 */
export function audioView(host: ViewHost, data: Record<string, unknown>): PuzzleView {
  const src = safeAudioSrc(data['audio']);
  const kind = data['kind'] === 'beeps' ? 'beeps' : 'digits';
  const maxPlays = Math.max(1, Math.min(5, Number(data['maxPlays']) || 3));
  const length = Number(data['length']) || 0;
  const pow = data['pow'] as { salt?: unknown; bits?: unknown } | undefined;
  const nonce = solvePow(String(pow?.salt ?? ''), Number(pow?.bits ?? 0), host.signal);
  const aid = nextId('ng-a');
  const nid = nextId('ng-note');
  let plays = 0;
  let playing = false;
  let ctx: Ctx | undefined;
  let buffer: AudioBuffer | undefined;
  let source: AudioBufferSourceNode | undefined;
  let fallback: HTMLAudioElement | undefined;

  const bars = h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
  const label = h('span', { class: 'play-label' });
  const play = h('button', { type: 'button', class: 'play-btn', 'aria-describedby': nid }, h('span', { class: 'play-orb', 'aria-hidden': 'true' }, icon('play')), bars, label);
  const input = h('input', {
    type: 'text',
    id: aid,
    autocomplete: 'off',
    spellcheck: 'false',
    dir: 'ltr',
    maxlength: kind === 'digits' ? 16 : 12,
    inputmode: kind === 'digits' ? 'numeric' : 'text',
    enterkeyhint: 'done',
    'aria-describedby': nid,
  });
  const verify = verifyButton(host, () => void submit());

  const render = (): void => {
    const left = maxPlays - plays;
    play.disabled = !src || playing || left <= 0;
    play.classList.toggle('is-playing', playing);
    label.textContent = !src ? host.t('noPlays') : playing ? host.t('playing') : left <= 0 ? host.t('noPlays') : plays === 0 ? host.t('play') : host.t('playAgain', { n: left });
  };

  const ended = (): void => {
    if (!playing) return;
    playing = false;
    source = undefined;
    const left = maxPlays - plays;
    host.announce(left > 0 ? host.t('playEnded', { n: left }) : host.t('playEndedLast'));
    render();
    input.focus();
  };

  const start = async (): Promise<void> => {
    if (!src || playing || plays >= maxPlays) return;
    playing = true;
    plays += 1;
    render();
    host.announce(host.t('playStarted'));
    try {
      const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('no web audio');
      ctx ??= new Ctor();
      if (ctx.state === 'suspended') await ctx.resume();
      buffer ??= await ctx.decodeAudioData(base64ToBuffer(src));
      if (host.signal.aborted) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = ended;
      source.start();
    } catch {
      try {
        fallback ??= new Audio(src);
        fallback.onended = ended;
        fallback.currentTime = 0;
        await fallback.play();
      } catch {
        playing = false;
        host.announce(host.t('audioUnsupported'));
        render();
      }
    }
  };
  play.addEventListener('click', () => void start());

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

  const stop = (): void => {
    try {
      source?.stop();
    } catch {
      // already stopped
    }
    fallback?.pause();
    void ctx?.close().catch(() => undefined);
  };
  host.signal.addEventListener('abort', stop, { once: true });

  render();
  const fieldLabel = kind === 'digits' && length ? `${host.t('audioDigits')} (${length})` : host.t(kind === 'digits' ? 'audioDigits' : 'audioBeeps');
  return {
    el: h(
      'div',
      { class: 'row audio-row', style: 'display:grid' },
      h('div', { class: 'audio-stage' }, play),
      h('label', { for: aid }, fieldLabel),
      h('div', { class: 'row', style: 'flex-wrap:nowrap' }, input, verify),
      h('p', { class: 'hint', id: nid }, src ? host.t('audioNote') : host.t('audioUnsupported')),
    ),
    focus: () => (play.disabled ? input : play).focus(),
    reset() {
      input.value = '';
    },
  };
}
