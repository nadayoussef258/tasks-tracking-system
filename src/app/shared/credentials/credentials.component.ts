import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { ToastService } from '../../core/services/toast.service';


export interface Credentials { name: string; email: string; password: string }

/** The login details to pass on to a person, with a copy button. */
@Component({
  selector: 'app-credentials',
  imports: [TranslatePipe],
  template: `
    <div class="alert-x info"><i class="bi bi-check-circle"></i><span>{{ 'team.credsIntro' | t }}</span></div>
    <dl class="creds">
      <dt>{{ 'team.credsUrl' | t }}</dt><dd class="ltr-num">{{ appUrl }}</dd>
      <dt>{{ 'login.email' | t }}</dt><dd class="ltr-num">{{ creds().email }}</dd>
      <dt>{{ 'login.password' | t }}</dt><dd class="ltr-num pw">{{ creds().password }}</dd>
    </dl>
    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
      <p class="small-x muted mb-0">{{ 'team.credsWarning' | t }}</p>
      <button type="button" class="btn-x sm" (click)="copy()"><i class="bi bi-clipboard"></i>{{ 'team.copy' | t }}</button>
    </div>
  `,
  styles: [`
    .creds { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; margin: 0 0 12px; padding: 14px 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
    .creds dt { color: var(--muted); font-size: .84rem; }
    .creds dd { margin: 0; font-weight: 600; word-break: break-all; }
    .creds .pw { font-family: ui-monospace, Consolas, monospace; letter-spacing: .05em; color: var(--accent-dark); }
  `],
})
export class CredentialsComponent {
  creds = input.required<Credentials>();
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);
  readonly appUrl = location.origin;

  async copy() {
    const c = this.creds();
    const text = this.i18n.t('team.credsText', { name: c.name, url: this.appUrl, email: c.email, password: c.password });
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(this.i18n.t('team.toast.copied'));
    } catch {
      this.toast.error(this.i18n.t('err.generic'));
    }
  }
}