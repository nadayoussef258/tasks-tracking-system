import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';


/** Top of a department's pages: back to the overview + Board / Team tabs. */
@Component({
  selector: 'app-dept-nav',
  imports: [RouterLink, TranslatePipe],
  template: `
    <nav class="dept-nav" [attr.aria-label]="'deptNav.label' | t">
      @if (auth.isSuperAdmin()) {
        <a routerLink="/overview" class="crumb"><i class="bi bi-arrow-right flip-ltr"></i>{{ 'nav.overview' | t }}</a>
        <span class="sep" aria-hidden="true">/</span>
      }
      <span class="dept"><span class="dot" [style.background]="auth.currentDepartment()?.color"></span>{{ i18n.deptName(auth.currentDepartment()) }}</span>
      <span class="tabs">
        <a routerLink="/board" [class.on]="active() === 'board'" [attr.aria-current]="active() === 'board' ? 'page' : null"><i class="bi bi-columns-gap"></i>{{ 'nav.board' | t }}</a>
        <a routerLink="/team" [class.on]="active() === 'team'" [attr.aria-current]="active() === 'team' ? 'page' : null"><i class="bi bi-people"></i>{{ 'nav.team' | t }}</a>
      </span>
    </nav>
  `,
  styles: [`
    .dept-nav { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; font-size: .86rem; }
    .crumb { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; text-decoration: none; color: var(--accent); }
    .crumb:hover { text-decoration: underline; }
    .sep { color: var(--faint); }
    .dept { display: inline-flex; align-items: center; gap: 7px; font-weight: 700; color: var(--text); }
    .tabs { margin-inline-start: auto; display: inline-flex; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
    .tabs a { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; color: var(--muted); font-weight: 600; text-decoration: none; }
    .tabs a:hover { color: var(--text); }
    .tabs a.on { background: var(--accent); color: #fff; }
    :host-context([dir='ltr']) .flip-ltr { display: inline-block; transform: scaleX(-1); }
  `],
})
export class DeptNavComponent {
  active = input<'board' | 'team'>('board');
  auth = inject(AuthService);
  i18n = inject(TranslationService);
}