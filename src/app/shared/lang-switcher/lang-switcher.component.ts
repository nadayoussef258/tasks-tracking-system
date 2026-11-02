import { Component, inject } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation.service';

/** Floating language button (same as the ticketing system). */
@Component({
  selector: 'app-lang-switcher',
  template: `
    <button type="button" class="lang-fab" (click)="i18n.toggle()"
            [attr.aria-label]="i18n.lang() === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'">
      <i class="bi bi-translate"></i>
      <span [attr.lang]="i18n.lang() === 'ar' ? 'en' : 'ar'">{{ i18n.lang() === 'ar' ? 'English' : 'العربية' }}</span>
    </button>
  `,
  styles: [`
    .lang-fab {
      position: fixed; bottom: 22px; inset-inline-end: 22px; z-index: 1040;
      display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px 0 16px;
      border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--accent);
      font: 600 .9rem var(--font); cursor: pointer;
      box-shadow: 0 6px 20px rgba(17,24,39,.12), 0 2px 6px rgba(17,24,39,.06);
      transition: transform .15s, background .15s;
    }
    .lang-fab:hover { transform: translateY(-2px); background: var(--accent-light); }
    .lang-fab:focus-visible { outline: 3px solid var(--accent-mid); outline-offset: 2px; }
    @media print { .lang-fab { display: none; } }
  `],
})
export class LangSwitcherComponent {
  i18n = inject(TranslationService);
}