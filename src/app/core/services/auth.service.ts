import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { Department, TaskContext } from '../models/models';

const DEPT_KEY = 'tasks.department';

/** Thrown when the account exists but is not part of the tasks system. */
export class NotMemberError extends Error {
  constructor() { super('not_member'); }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService).client;
  private router = inject(Router);

  private _ctx = signal<TaskContext | null>(null);
  private _departments = signal<Department[]>([]);
  private _currentDeptId = signal<string | null>(this.savedDept());

  readonly user = this._ctx.asReadonly();
  readonly departments = this._departments.asReadonly();
  readonly isLoggedIn = computed(() => !!this._ctx());
  readonly isSuperAdmin = computed(() => !!this._ctx()?.is_super_admin);
  readonly userId = computed(() => this._ctx()?.user_id ?? null);

  /** Departments this person manages (all of them for the super admin). */
  readonly managedDepartments = computed(() =>
    this._departments().filter((d) => this.isSuperAdmin() || d.member_role === 'manager'));
  readonly isManager = computed(() => this.managedDepartments().length > 0);

  /** The department shown on the board. */
  readonly currentDepartment = computed<Department | null>(() => {
    const list = this.managedDepartments();
    return list.find((d) => d.department_id === this._currentDeptId()) ?? list[0] ?? null;
  });

  constructor() {
    this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && this._ctx()) {
        this.clear();
        this.router.navigateByUrl('/login');
      }
    });
  }

  /** Runs before the first route: restores the session after a refresh. */
  async init(): Promise<void> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return;
    try {
      await this.loadContext();
    } catch {
      await this.sb.auth.signOut();
      this.clear();
    }
  }
async reloadContext(): Promise<void> {
  await this.loadContext();
}
  async login(email: string, password: string, next?: string | null): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    try {
      await this.loadContext();
    } catch (err) {
      await this.sb.auth.signOut();
      this.clear();
      throw err;
    }
    // back to the page the person was opening (e.g. the link in an email)
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : null;
    await this.router.navigateByUrl(safeNext ?? this.homeUrl());
  }

  async logout(): Promise<void> {
    this.clear();
    await this.sb.auth.signOut();
    await this.router.navigateByUrl('/login');
  }

  homeUrl(): string {
    return this.isManager() ? '/board' : '/my-tasks';
  }

  canManage(departmentId: string | null | undefined): boolean {
    if (!departmentId) return false;
    return this.isSuperAdmin() || this._departments().some((d) => d.department_id === departmentId && d.member_role === 'manager');
  }

  department(id: string | null | undefined): Department | undefined {
    return this._departments().find((d) => d.department_id === id);
  }

  selectDepartment(id: string) {
    this._currentDeptId.set(id);
    try { localStorage.setItem(DEPT_KEY, id); } catch { /* ignore */ }
  }

  private async loadContext() {
    const { data, error } = await this.sb.rpc('task_my_context');
    if (error) throw error;
    const ctx = data as TaskContext | null;
    if (!ctx || (!ctx.is_super_admin && !ctx.departments?.length)) throw new NotMemberError();

    let departments: Department[] = ctx.departments ?? [];
    if (ctx.is_super_admin) {
      // the super admin sees every active department
      const { data: all, error: dErr } = await this.sb.from('service_departments')
        .select('id, code, name_ar, name_en, color, sort_order').eq('is_active', true).order('sort_order');
      if (!dErr && all?.length) {
        departments = all.map((d: any) => ({
          department_id: d.id, code: d.code, name_ar: d.name_ar, name_en: d.name_en, color: d.color,
          member_role: 'manager' as const,
        }));
      }
    }
    this._departments.set(departments);
    this._ctx.set(ctx);
  }

  private clear() {
    this._ctx.set(null);
    this._departments.set([]);
  }

  private savedDept(): string | null {
    try { return localStorage.getItem(DEPT_KEY); } catch { return null; }
  }
}