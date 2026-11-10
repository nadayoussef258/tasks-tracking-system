import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TeamError, TeamService, generatePassword } from '../../core/services/team.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Credentials, CredentialsComponent } from '../credentials/credentials.component';

type Step = 'dept' | 'manager' | 'done';

/** Super admin: new department → its manager → the details to pass on. */
@Component({
  selector: 'app-dept-wizard',
  imports: [FormsModule, TranslatePipe, CredentialsComponent],
  templateUrl: './dept-wizard.component.html',
  styleUrl: './dept-wizard.component.css',
})
export class DeptWizardComponent {
  open = input(false);
  closed = output<void>();
  /** fired after the department is created (the caller refreshes its data) */
  created = output<string>();

  private team = inject(TeamService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  i18n = inject(TranslationService);

  step = signal<Step>('dept');
  saving = signal(false);
  error = signal('');
  errorCode = signal('');

  code = signal('');
  nameAr = signal('');
  nameEn = signal('');
  color = signal('#19587b');
  deptId = signal('');
  deptLabel = signal('');

  mode = signal<'new' | 'existing'>('new');
  fullName = signal('');
  email = signal('');
  jobTitle = signal('');
  password = signal('');
  showPassword = signal(true);
  creds = signal<Credentials | null>(null);
  managerName = signal('');

  readonly deptValid = computed(() =>
    /^[A-Za-z0-9-]{2,20}$/.test(this.code().trim()) && this.nameAr().trim().length >= 2 && this.nameEn().trim().length >= 2);
  readonly managerValid = computed(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
    return this.mode() === 'existing' ? emailOk : emailOk && this.fullName().trim().length >= 2 && this.password().length >= 8;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.step.set('dept');
      this.code.set(''); this.nameAr.set(''); this.nameEn.set(''); this.color.set('#19587b');
      this.mode.set('new'); this.fullName.set(''); this.email.set(''); this.jobTitle.set('');
      this.password.set(generatePassword()); this.creds.set(null); this.managerName.set('');
      this.clearError();
    });
  }

  async createDept() {
    if (!this.deptValid() || this.saving()) return;
    await this.run(async () => {
      const res = await this.team.createDepartment({
        code: this.code().trim().toUpperCase(), name_ar: this.nameAr().trim(), name_en: this.nameEn().trim(), color: this.color(),
      });
      await this.auth.reloadContext();
      this.auth.selectDepartment(res.department.id);
      this.deptId.set(res.department.id);
      this.deptLabel.set(this.i18n.lang() === 'ar' ? this.nameAr().trim() : this.nameEn().trim());
      this.created.emit(res.department.id);
      this.toast.success(this.i18n.t('team.toast.deptCreated'));
      this.step.set('manager');
    });
  }

  async addManager() {
    if (!this.managerValid() || this.saving()) return;
    await this.run(async () => {
      if (this.mode() === 'existing') {
        const res = await this.team.addExisting({
          email: this.email().trim(), department_id: this.deptId(), member_role: 'manager', job_title: this.jobTitle().trim(),
        });
        this.managerName.set(res.full_name);
        this.creds.set(null);
      } else {
        await this.team.createMember({
          email: this.email().trim(), password: this.password(), full_name: this.fullName().trim(),
          department_id: this.deptId(), member_role: 'manager', job_title: this.jobTitle().trim(),
        });
        this.managerName.set(this.fullName().trim());
        this.creds.set({ name: this.fullName().trim(), email: this.email().trim().toLowerCase(), password: this.password() });
      }
      this.step.set('done');
    });
  }

  switchToExisting() {
    this.mode.set('existing');
    this.clearError();
  }

  goToTeam() {
    this.closed.emit();
    this.router.navigateByUrl('/team');
  }

  newPassword() { this.password.set(generatePassword()); }

  private clearError() { this.error.set(''); this.errorCode.set(''); }

  private async run(fn: () => Promise<void>) {
    this.saving.set(true);
    this.clearError();
    try {
      await fn();
    } catch (err) {
      const code = err instanceof TeamError ? err.code : '';
      const key = 'team.err.' + code;
      const text = this.i18n.t(key);
      this.errorCode.set(code);
      this.error.set(text !== key ? text : this.i18n.t('err.generic'));
    } finally {
      this.saving.set(false);
    }
  }
}