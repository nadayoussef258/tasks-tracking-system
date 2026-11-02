import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TeamError, TeamMember, TeamService, generatePassword } from '../../core/services/team.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { initials } from '../../shared/task-rules';

type Modal = 'member' | 'password' | 'dept' | null;

/** Team management: members of a department, accounts, departments (super admin). */
@Component({
  selector: 'app-team',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
})
export class TeamComponent {
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  private team = inject(TeamService);
  private toast = inject(ToastService);

  readonly dept = this.auth.currentDepartment;
  members = signal<TeamMember[]>([]);
  loading = signal(true);
  loadError = signal('');

  modal = signal<Modal>(null);
  saving = signal(false);
  formError = signal('');
  showPassword = signal(true);
  /** shown after an account is created / a password is reset, to pass on */
  creds = signal<{ name: string; email: string; password: string } | null>(null);

  // add member
  fullName = signal('');
  email = signal('');
  jobTitle = signal('');
  role = signal<'member' | 'manager'>('member');
  password = signal('');
  // reset password
  target = signal<TeamMember | null>(null);
  // add department
  deptCode = signal('');
  deptNameAr = signal('');
  deptNameEn = signal('');
  deptColor = signal('#4f46e5');

  readonly managers = computed(() => this.members().filter((m) => m.member_role === 'manager'));
  readonly appUrl = location.origin;
  readonly memberValid = computed(() =>
    this.fullName().trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()) && this.password().length >= 8);
  readonly deptValid = computed(() =>
    /^[A-Za-z0-9-]{2,20}$/.test(this.deptCode().trim()) && this.deptNameAr().trim().length >= 2 && this.deptNameEn().trim().length >= 2);
  initials = initials;

  constructor() {
    effect(() => {
      const d = this.dept();
      if (d) untracked(() => this.load());
    });
  }

  async load() {
    const d = this.dept();
    if (!d) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.members.set(await this.team.listMembers(d.department_id));
    } catch (err) {
      this.loadError.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  // ------------------------------------------------------------- modals
  openMember(role: 'member' | 'manager' = 'member') {
    this.fullName.set(''); this.email.set(''); this.jobTitle.set('');
    this.role.set(this.auth.isSuperAdmin() ? role : 'member');
    this.password.set(generatePassword());
    this.open('member');
  }

  openPassword(m: TeamMember) {
    this.target.set(m);
    this.password.set(generatePassword());
    this.open('password');
  }

  openDept() {
    this.deptCode.set(''); this.deptNameAr.set(''); this.deptNameEn.set(''); this.deptColor.set('#4f46e5');
    this.open('dept');
  }

  private open(m: Modal) {
    this.formError.set('');
    this.creds.set(null);
    this.showPassword.set(true);
    this.modal.set(m);
  }

  close() {
    this.modal.set(null);
    this.creds.set(null);
  }

  newPassword() { this.password.set(generatePassword()); }

  // ------------------------------------------------------------ actions
  async createMember() {
    const d = this.dept();
    if (!d || !this.memberValid() || this.saving()) return;
    await this.run(async () => {
      await this.team.createMember({
        email: this.email().trim(), password: this.password(), full_name: this.fullName().trim(),
        department_id: d.department_id, member_role: this.role(), job_title: this.jobTitle().trim(),
      });
      this.creds.set({ name: this.fullName().trim(), email: this.email().trim().toLowerCase(), password: this.password() });
      this.toast.success(this.i18n.t('team.toast.created'));
      this.load();
    });
  }

  async resetPassword() {
    const m = this.target();
    if (!m || this.password().length < 8 || this.saving()) return;
    await this.run(async () => {
      await this.team.resetPassword(m.user_id, this.password());
      this.creds.set({ name: m.full_name, email: m.email ?? '', password: this.password() });
      this.toast.success(this.i18n.t('team.toast.passwordReset'));
    });
  }

  async toggleStatus(m: TeamMember) {
    const disable = m.is_active;
    if (disable && !confirm(this.i18n.t('team.confirmDisable', { name: m.full_name }))) return;
    try {
      await this.team.setStatus(m.user_id, disable ? 'disable' : 'enable');
      this.toast.success(this.i18n.t(disable ? 'team.toast.disabled' : 'team.toast.enabled', { name: m.full_name }));
      this.load();
    } catch (err) {
      this.toast.error(this.message(err));
    }
  }

  async createDept() {
    if (!this.deptValid() || this.saving()) return;
    await this.run(async () => {
      const res = await this.team.createDepartment({
        code: this.deptCode().trim().toUpperCase(), name_ar: this.deptNameAr().trim(),
        name_en: this.deptNameEn().trim(), color: this.deptColor(),
      });
      await this.auth.reloadContext();
      this.auth.selectDepartment(res.department.id);
      this.toast.success(this.i18n.t('team.toast.deptCreated'));
      // next natural step: the department's manager
      this.openMember('manager');
    });
  }

  async copyCreds() {
    const c = this.creds();
    if (!c) return;
    const text = this.i18n.t('team.credsText', { name: c.name, url: this.appUrl, email: c.email, password: c.password });
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(this.i18n.t('team.toast.copied'));
    } catch {
      this.toast.error(this.i18n.t('err.generic'));
    }
  }

  // ------------------------------------------------------------ helpers
  private async run(fn: () => Promise<void>) {
    this.saving.set(true);
    this.formError.set('');
    try { await fn(); } catch (err) { this.formError.set(this.message(err)); } finally { this.saving.set(false); }
  }

  private message(err: unknown): string {
    const code = err instanceof TeamError ? err.code : '';
    const key = 'team.err.' + code;
    const text = this.i18n.t(key);
    return text !== key ? text : this.i18n.t('err.generic');
  }
}