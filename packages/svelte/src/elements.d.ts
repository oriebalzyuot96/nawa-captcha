import type { HTMLAttributes } from 'svelte/elements';

// Lets Svelte's type checker know the <nawa-guard> custom element and its attributes.
declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    'nawa-guard': HTMLAttributes<HTMLElement> & {
      'site-key'?: string | undefined;
      endpoint?: string | undefined;
      action?: string | undefined;
      name?: string | undefined;
      type?: string | undefined;
    };
  }
}

export {};
