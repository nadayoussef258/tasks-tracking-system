import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { AuthService, NotMemberError } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private i18n = inject(TranslationService);
  private route = inject(ActivatedRoute);

  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');

  async onLogin() {
    if (!this.email() || !this.password() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email(), this.password(), this.route.snapshot.queryParamMap.get('next'));
    } catch (err: any) {
      this.error.set(
        err instanceof NotMemberError ? this.i18n.t('login.notMember')
        : err?.message === 'Invalid login credentials' ? this.i18n.t('login.invalid')
        : /banned/i.test(err?.message ?? '') ? this.i18n.t('login.disabled')
        : this.i18n.t('login.failed'));
    } finally {
      this.loading.set(false);
    }
  }
}