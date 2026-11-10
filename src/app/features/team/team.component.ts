import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TeamError, TeamMember, TeamService, generatePassword } from '../../core/services/team.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { initials } from '../../shared/task-rules';
import { Credentials, CredentialsComponent } from '../../shared/credentials/credentials.component';
import { DeptNavComponent } from '../../shared/dept-nav/dept-nav.component';


type Modal = 'member' | 'password' | 'edit' | null;

/** Team management: members of a department and their accounts. */
@Component({
  selector: 'app-team',
  imports: [FormsModule, TranslatePipe, CredentialsComponent, DeptNavComponent],
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
  formErrorCode = signal('');
  showPassword = signal(true);
  creds = signal<Credentials | null>(null);

  // add member
  mode = signal<'new' | 'existing'>('new');
  fullName = signal('');
  email = signal('');
  jobTitle = signal('');
  role = signal<'member' | 'manager'>('member');
  password = signal('');
  // reset password / edit
  target = signal<TeamMember | null>(null);

  readonly managers = computed(() => this.members().filter((m) => m.member_role === 'manager'));
  readonly memberValid = computed(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
    return this.mode() === 'existing' ? emailOk : emailOk && this.fullName().trim().length >= 2 && this.password().length >= 8;
  });
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

  /** Same rules as the database: the super admin edits anyone else; a manager edits the members of his team. */
  canEdit(m: TeamMember): boolean {
    if (m.user_id === this.auth.userId()) return false;
    return this.auth.isSuperAdmin() || m.member_role === 'member';
  }

  // ------------------------------------------------------------- modals
  openMember(role: 'member' | 'manager' = 'member') {
    this.mode.set('new');
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

  openEdit(m: TeamMember) {
    this.target.set(m);
    this.jobTitle.set(m.job_title ?? '');
    this.role.set(m.member_role);
    this.open('edit');
  }

  private open(m: Modal) {
    this.setError('', '');
    this.creds.set(null);
    this.showPassword.set(true);
    this.modal.set(m);
  }

  close() { this.modal.set(null); this.creds.set(null); }

  newPassword() { this.password.set(generatePassword()); }

  switchToExisting() { this.mode.set('existing'); this.setError('', ''); }

  // ------------------------------------------------------------ actions
  async addMember() {
    const d = this.dept();
    if (!d || !this.memberValid() || this.saving()) return;
    await this.run(async () => {
      if (this.mode() === 'existing') {
        const res = await this.team.addExisting({
          email: this.email().trim(), department_id: d.department_id, member_role: this.role(), job_title: this.jobTitle().trim(),
        });
        this.toast.success(this.i18n.t('team.toast.added', { name: res.full_name }));
        this.close();
      } else {
        await this.team.createMember({
          email: this.email().trim(), password: this.password(), full_name: this.fullName().trim(),
          department_id: d.department_id, member_role: this.role(), job_title: this.jobTitle().trim(),
        });
        this.creds.set({ name: this.fullName().trim(), email: this.email().trim().toLowerCase(), password: this.password() });
        this.toast.success(this.i18n.t('team.toast.created'));
      }
      this.load();
    });
  }

  async saveEdit() {
    const m = this.target();
    const d = this.dept();
    if (!m || !d || this.saving()) return;
    await this.run(async () => {
      await this.team.updateMember(m, d.department_id, this.auth.isSuperAdmin() ? this.role() : m.member_role, this.jobTitle());
      this.toast.success(this.i18n.t('toast.saved'));
      this.close();
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

  submit() {
    const m = this.modal();
    if (m === 'member') this.addMember();
    else if (m === 'password') this.resetPassword();
    else if (m === 'edit') this.saveEdit();
  }

  // ------------------------------------------------------------ helpers
  private setError(text: string, code: string) { this.formError.set(text); this.formErrorCode.set(code); }

  private async run(fn: () => Promise<void>) {
    this.saving.set(true);
    this.setError('', '');
    try {
      await fn();
    } catch (err) {
      this.setError(this.message(err), err instanceof TeamError ? err.code : '');
    } finally {
      this.saving.set(false);
    }
  }

  private message(err: unknown): string {
    const code = err instanceof TeamError ? err.code : '';
    const key = 'team.err.' + code;
    const text = this.i18n.t(key);
    return text !== key ? text : this.i18n.t('err.generic');
  }
}