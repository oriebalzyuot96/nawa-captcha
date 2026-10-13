import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { NG_VALIDATORS, NG_VALUE_ACCESSOR, type ControlValueAccessor, type ValidationErrors, type Validator } from '@angular/forms';
import '@nawa-captcha/widget';
import type { NawaCaptchaElement, NawaCaptchaErrorDetail, NawaCaptchaVerifiedDetail } from '@nawa-captcha/widget';

/** Inputs, outputs, ControlValueAccessor and Validator shared by both selectors. */
@Directive()
abstract class NawaCaptchaControl implements ControlValueAccessor, Validator, AfterViewInit, OnDestroy {
  readonly siteKey = input<string>();
  readonly endpoint = input<string>();
  readonly action = input<string>();
  readonly lang = input<'ar' | 'en'>();
  /** Hidden input name (for classic form posts). */
  readonly name = input<string>();
  /** Requested puzzle type; honoured only if the server allows client choice. */
  readonly type = input<string>();
  /** Narrows the server's allowed puzzle types (array or comma-separated). Never widens it. */
  readonly types = input<string | readonly string[]>();
  /** Theme preset (orca, midnight, aurora, sand, ocean, mono), auto, or light/dark/high-contrast. */
  readonly theme = input<string>();
  readonly appearance = input<'auto' | 'light' | 'dark' | 'high-contrast'>();
  /** UI sound effects on by default (the visitor's own toggle still wins). */
  readonly sound = input<boolean>();
  readonly volume = input<number>();
  /** Silences the widget (app-level mute). */
  readonly muted = input<boolean>();

  readonly verified = output<NawaCaptchaVerifiedDetail>();
  readonly expired = output<void>();
  readonly failed = output<NawaCaptchaErrorDetail>();

  protected abstract element(): NawaCaptchaElement | undefined;

  private value = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  protected disabled = false;

  protected typesAttr(): string | null {
    const t = this.types();
    return t === undefined ? null : typeof t === 'string' ? t : t.join(',');
  }

  protected soundAttr(): string | null {
    const s = this.sound();
    return s === undefined ? null : s ? 'on' : 'off';
  }

  // Event names contain ':' which Angular template syntax reserves for global targets
  // (e.g. `window:resize`), so the listeners are attached imperatively.
  private readonly handleVerified = (e: Event): void => {
    const detail = (e as CustomEvent<NawaCaptchaVerifiedDetail>).detail;
    this.update(detail.token);
    this.verified.emit(detail);
  };
  private readonly handleExpired = (): void => {
    this.update('');
    this.expired.emit();
  };
  private readonly handleError = (e: Event): void => {
    this.update('');
    this.failed.emit((e as CustomEvent<NawaCaptchaErrorDetail>).detail);
  };

  ngAfterViewInit(): void {
    const el = this.element();
    el?.addEventListener('nawa-captcha:verified', this.handleVerified);
    el?.addEventListener('nawa-captcha:expired', this.handleExpired);
    el?.addEventListener('nawa-captcha:error', this.handleError);
  }

  ngOnDestroy(): void {
    const el = this.element();
    el?.removeEventListener('nawa-captcha:verified', this.handleVerified);
    el?.removeEventListener('nawa-captcha:expired', this.handleExpired);
    el?.removeEventListener('nawa-captcha:error', this.handleError);
  }

  /** Clears the token and loads a new challenge. */
  reset(): void {
    this.update('');
    this.element()?.reset?.();
  }

  // ---------------------------------------------------------------- ControlValueAccessor

  writeValue(value: string | null): void {
    const next = value ?? '';
    // Only the widget can produce a token; a non-empty write is ignored. Clearing restarts it.
    if (!next && this.value) {
      this.value = '';
      this.element()?.reset?.();
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    const el = this.element();
    if (el) el.inert = isDisabled;
  }

  // ---------------------------------------------------------------- Validator

  validate(): ValidationErrors | null {
    return this.value ? null : { nawaCaptcha: true };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  private update(token: string): void {
    this.value = token;
    this.onChange(token);
    this.onTouched();
    this.onValidatorChange();
  }
}

/**
 * Angular binding for <nawa-captcha> that is also a form control. The component's host element
 * IS the web component, so there is no wrapper element:
 *
 *   form = new FormGroup({ email: …, captcha: new FormControl('', { nonNullable: true }) });
 *   <nawa-captcha formControlName="captcha" action="login" [lang]="lang()" />
 *
 * The control value is the pass token ('' until verified). The control is invalid
 * (`{ nawaCaptcha: true }`) until verified, and `form.reset()` / `setValue('')` loads a fresh
 * challenge — which is what you want after a submit, because pass tokens are single-use.
 */
@Component({
  selector: 'nawa-captcha',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [':host { display: block; } :host([aria-disabled="true"]) { opacity: 0.6; pointer-events: none; }'],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NawaCaptchaComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NawaCaptchaComponent), multi: true },
  ],
  host: {
    '[attr.site-key]': 'siteKey() ?? null',
    '[attr.endpoint]': 'endpoint() ?? null',
    '[attr.action]': 'action() ?? null',
    '[attr.lang]': 'lang() ?? null',
    '[attr.name]': 'name() ?? null',
    '[attr.type]': 'type() ?? null',
    '[attr.types]': 'typesAttr()',
    '[attr.theme]': 'theme() ?? null',
    '[attr.appearance]': 'appearance() ?? null',
    '[attr.sound]': 'soundAttr()',
    '[attr.volume]': 'volume() ?? null',
    '[attr.muted]': "muted() ? '' : null",
    '[attr.aria-disabled]': 'disabled ? "true" : null',
  },
})
export class NawaCaptchaComponent extends NawaCaptchaControl {
  private readonly host = inject<ElementRef<NawaCaptchaElement>>(ElementRef);

  protected element(): NawaCaptchaElement {
    return this.host.nativeElement;
  }
}

/**
 * @deprecated Use `<nawa-captcha>` ({@link NawaCaptchaComponent}). The pre-rename
 * `<nawa-guard-captcha>` selector keeps working for this release and wraps a <nawa-captcha>.
 */
@Component({
  selector: 'nawa-guard-captcha',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nawa-captcha
    #guard
    [attr.site-key]="siteKey() ?? null"
    [attr.endpoint]="endpoint() ?? null"
    [attr.action]="action() ?? null"
    [attr.lang]="lang() ?? null"
    [attr.name]="name() ?? null"
    [attr.type]="type() ?? null"
    [attr.types]="typesAttr()"
    [attr.theme]="theme() ?? null"
    [attr.appearance]="appearance() ?? null"
    [attr.sound]="soundAttr()"
    [attr.volume]="volume() ?? null"
    [attr.muted]="muted() ? '' : null"
  ></nawa-captcha>`,
  styles: [':host { display: block; } :host([aria-disabled="true"]) { opacity: 0.6; pointer-events: none; }'],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NawaGuardComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NawaGuardComponent), multi: true },
  ],
  host: { '[attr.aria-disabled]': 'disabled ? "true" : null' },
})
export class NawaGuardComponent extends NawaCaptchaControl {
  private readonly guard = viewChild<ElementRef<NawaCaptchaElement>>('guard');

  protected element(): NawaCaptchaElement | undefined {
    return this.guard()?.nativeElement;
  }
}
