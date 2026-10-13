import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  forwardRef,
  input,
  output,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { NG_VALIDATORS, NG_VALUE_ACCESSOR, type ControlValueAccessor, type ValidationErrors, type Validator } from '@angular/forms';
import '@nawa-guard/widget';
import type { NawaGuardElement, NawaGuardErrorDetail, NawaGuardVerifiedDetail } from '@nawa-guard/widget';

/**
 * Angular wrapper for <nawa-guard> that is also a form control:
 *
 *   form = new FormGroup({ email: …, captcha: new FormControl('', { nonNullable: true }) });
 *   <nawa-guard-captcha formControlName="captcha" action="login" [lang]="lang()" />
 *
 * The control value is the pass token ('' until verified). The control is invalid
 * (`{ nawaGuard: true }`) until verified, and `form.reset()` / `setValue('')` loads a fresh
 * challenge — which is what you want after a submit, because pass tokens are single-use.
 */
@Component({
  selector: 'nawa-guard-captcha',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nawa-guard
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
    [attr.sound]="sound() === undefined ? null : sound() ? 'on' : 'off'"
    [attr.volume]="volume() ?? null"
    [attr.muted]="muted() ? '' : null"
  ></nawa-guard>`,
  styles: [':host { display: block; } :host([aria-disabled="true"]) { opacity: 0.6; pointer-events: none; }'],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NawaGuardComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NawaGuardComponent), multi: true },
  ],
  host: { '[attr.aria-disabled]': 'disabled ? "true" : null' },
})
export class NawaGuardComponent implements ControlValueAccessor, Validator, AfterViewInit, OnDestroy {
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

  protected typesAttr(): string | null {
    const t = this.types();
    return t === undefined ? null : typeof t === 'string' ? t : t.join(',');
  }

  readonly verified = output<NawaGuardVerifiedDetail>();
  readonly expired = output<void>();
  readonly failed = output<NawaGuardErrorDetail>();

  private readonly guard = viewChild.required<ElementRef<NawaGuardElement>>('guard');
  private value = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  protected disabled = false;

  // Event names contain ':' which Angular template syntax reserves for global targets
  // (e.g. `window:resize`), so the listeners are attached imperatively.
  private readonly handleVerified = (e: Event): void => {
    const detail = (e as CustomEvent<NawaGuardVerifiedDetail>).detail;
    this.update(detail.token);
    this.verified.emit(detail);
  };
  private readonly handleExpired = (): void => {
    this.update('');
    this.expired.emit();
  };
  private readonly handleError = (e: Event): void => {
    this.update('');
    this.failed.emit((e as CustomEvent<NawaGuardErrorDetail>).detail);
  };

  ngAfterViewInit(): void {
    const el = this.guard().nativeElement;
    el.addEventListener('nawa-guard:verified', this.handleVerified);
    el.addEventListener('nawa-guard:expired', this.handleExpired);
    el.addEventListener('nawa-guard:error', this.handleError);
  }

  ngOnDestroy(): void {
    const el = this.guard().nativeElement;
    el.removeEventListener('nawa-guard:verified', this.handleVerified);
    el.removeEventListener('nawa-guard:expired', this.handleExpired);
    el.removeEventListener('nawa-guard:error', this.handleError);
  }

  /** Clears the token and loads a new challenge. */
  reset(): void {
    this.update('');
    this.guard().nativeElement.reset?.();
  }

  // ---------------------------------------------------------------- ControlValueAccessor

  writeValue(value: string | null): void {
    const next = value ?? '';
    // Only the widget can produce a token; a non-empty write is ignored. Clearing restarts it.
    if (!next && this.value) {
      this.value = '';
      this.guard().nativeElement.reset?.();
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
    const el = this.guard()?.nativeElement;
    if (el) el.inert = isDisabled;
  }

  // ---------------------------------------------------------------- Validator

  validate(): ValidationErrors | null {
    return this.value ? null : { nawaGuard: true };
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
