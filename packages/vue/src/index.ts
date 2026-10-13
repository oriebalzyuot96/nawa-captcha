import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import '@nawa-guard/widget';
import type { NawaGuardElement, NawaGuardErrorDetail, NawaGuardVerifiedDetail } from '@nawa-guard/widget';

export type { NawaGuardErrorDetail, NawaGuardVerifiedDetail };

/**
 * <NawaGuard v-model="token" action="login" lang="ar" @verified="…" />
 *
 * `v-model` holds the pass token ('' until verified). Setting it back to '' (e.g. after a
 * failed submit, since tokens are single-use) makes the widget load a fresh challenge.
 */
export const NawaGuard = defineComponent({
  name: 'NawaGuard',
  props: {
    modelValue: { type: String, default: '' },
    siteKey: { type: String, default: undefined },
    endpoint: { type: String, default: undefined },
    action: { type: String, default: undefined },
    lang: { type: String as PropType<'ar' | 'en'>, default: undefined },
    name: { type: String, default: undefined },
    type: { type: String, default: undefined },
    /** Narrows the server's allowed puzzle types (array or comma-separated). Never widens it. */
    types: { type: [String, Array] as PropType<string | readonly string[]>, default: undefined },
    /** Theme preset or appearance shorthand (see the widget README). */
    theme: { type: String, default: undefined },
    appearance: { type: String as PropType<'auto' | 'light' | 'dark' | 'high-contrast'>, default: undefined },
    /** UI sound effects on by default (the visitor's toggle still wins). */
    sound: { type: Boolean, default: undefined },
    volume: { type: Number, default: undefined },
    muted: { type: Boolean, default: undefined },
  },
  emits: {
    'update:modelValue': (token: string) => typeof token === 'string',
    verified: (detail: NawaGuardVerifiedDetail) => !!detail,
    expired: () => true,
    error: (detail: NawaGuardErrorDetail) => !!detail,
  },
  setup(props, { emit, expose }) {
    const el = ref<NawaGuardElement | null>(null);
    let current = '';

    const onVerified = (e: Event): void => {
      const detail = (e as CustomEvent<NawaGuardVerifiedDetail>).detail;
      current = detail.token;
      emit('update:modelValue', detail.token);
      emit('verified', detail);
    };
    const onExpired = (): void => {
      current = '';
      emit('update:modelValue', '');
      emit('expired');
    };
    const onError = (e: Event): void => {
      current = '';
      emit('update:modelValue', '');
      emit('error', (e as CustomEvent<NawaGuardErrorDetail>).detail);
    };

    onMounted(() => {
      el.value?.addEventListener('nawa-guard:verified', onVerified);
      el.value?.addEventListener('nawa-guard:expired', onExpired);
      el.value?.addEventListener('nawa-guard:error', onError);
    });
    onBeforeUnmount(() => {
      el.value?.removeEventListener('nawa-guard:verified', onVerified);
      el.value?.removeEventListener('nawa-guard:expired', onExpired);
      el.value?.removeEventListener('nawa-guard:error', onError);
    });
    watch(
      () => props.modelValue,
      (value) => {
        if (!value && current) {
          current = '';
          el.value?.reset();
        }
      },
    );

    const reset = (): void => {
      current = '';
      emit('update:modelValue', '');
      el.value?.reset();
    };
    expose({ reset });

    return () =>
      h('nawa-guard', {
        ref: el,
        'site-key': props.siteKey,
        endpoint: props.endpoint,
        action: props.action,
        lang: props.lang,
        name: props.name,
        type: props.type,
        types: props.types === undefined ? undefined : typeof props.types === 'string' ? props.types : props.types.join(','),
        theme: props.theme,
        appearance: props.appearance,
        sound: props.sound,
        volume: props.volume,
        muted: props.muted,
      });
  },
});

export default NawaGuard;
