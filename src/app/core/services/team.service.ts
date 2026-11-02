import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string | null;
  account_type: string | null;
  member_role: 'manager' | 'member';
  job_title: string | null;
  is_active: boolean;
  account_blocked: boolean;
  created_at: string;
  can_manage: boolean;
}

/** Error from the task-users function, with its code (email_exists, weak_password…). */
export class TeamError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Account management through the task-users Edge Function. */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private sb = inject(SupabaseService).client;

  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.functions.invoke('task-users', { body });
    if (error) {
      let code = 'generic';
      let message = error.message;
      try {
        const res = (error as any).context as Response | undefined;
        const json = res ? await res.json() : null;
        if (json?.code) code = json.code;
        if (json?.error) message = json.error;
      } catch { /* not JSON */ }
      throw new TeamError(code, message);
    }
    return data as T;
  }

  async listMembers(departmentId: string): Promise<TeamMember[]> {
    return (await this.call<{ members: TeamMember[] }>({ action: 'list_members', department_id: departmentId })).members;
  }

  createMember(p: { email: string; password: string; full_name: string; department_id: string; member_role: 'manager' | 'member'; job_title: string }) {
    return this.call<{ user_id: string }>({ action: 'create_member', ...p });
  }

  /** An account that already exists (e.g. IT staff) joins this department. */
  addExisting(p: { email: string; department_id: string; member_role: 'manager' | 'member'; job_title: string }) {
    return this.call<{ user_id: string; full_name: string }>({ action: 'add_existing', ...p });
  }

  /** Job title / role / active — through the database rules (task_set_member). */
  async updateMember(m: { user_id: string; is_active: boolean }, departmentId: string, role: 'manager' | 'member', jobTitle: string) {
    const { error } = await this.sb.rpc('task_set_member', {
      p_user_id: m.user_id, p_department_id: departmentId, p_member_role: role,
      p_job_title: jobTitle.trim() || null, p_is_active: m.is_active,
    });
    if (error) {
      const code = /task_only_super_admin_manages_managers|task_not_allowed|task_cannot_edit_self/.test(error.message) ? 'not_allowed' : 'generic';
      throw new TeamError(code, error.message);
    }
  }

  resetPassword(userId: string, newPassword: string) {
    return this.call<{ success: true }>({ action: 'reset_password', user_id: userId, new_password: newPassword });
  }

  setStatus(userId: string, status: 'disable' | 'enable') {
    return this.call<{ success: true; account_blocked: boolean }>({ action: 'set_status', user_id: userId, status });
  }

  createDepartment(p: { code: string; name_ar: string; name_en: string; color: string }) {
    return this.call<{ department: { id: string } }>({ action: 'create_department', ...p });
  }
}

/** Readable random password: 10 characters, no look-alikes (0/O, 1/l). */
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}