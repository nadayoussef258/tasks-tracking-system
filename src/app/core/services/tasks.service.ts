import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  ChecklistItem, Deliverable, Member, Task, TaskDraft, TaskNotification, TaskStatus, TaskUpdate,
} from '../models/models';

const BUCKET = 'task-deliverables';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Done tasks stay on the board for this many days. */
const DONE_VISIBLE_DAYS = 14;

@Injectable({ providedIn: 'root' })
export class TasksService {
  private sb = inject(SupabaseService).client;
  private names = new Map<string, string>();

  // ------------------------------------------------------------- tasks
  async listTasks(opts: { departmentId?: string; assignedTo?: string }): Promise<Task[]> {
    const since = new Date(Date.now() - DONE_VISIBLE_DAYS * 864e5).toISOString();
    let q = this.sb.from('tasks').select('*')
      .is('archived_at', null)
      .neq('status', 'cancelled')
      .or(`status.neq.done,completed_at.gte."${since}"`); // quoted: the value has . and :
    if (opts.departmentId) q = q.eq('department_id', opts.departmentId);
    if (opts.assignedTo) q = q.eq('assigned_to', opts.assignedTo);
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    return (data ?? []) as Task[];
  }

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await this.sb.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Task | null;
  }

  async createTask(departmentId: string, draft: TaskDraft): Promise<Task> {
    const { data, error } = await this.sb.from('tasks')
      .insert({ ...draft, department_id: departmentId }).select('*').single();
    if (error) throw error;
    return data as Task;
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const { data, error } = await this.sb.from('tasks').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data as Task;
  }

  changeStatus(task: Task, status: TaskStatus, reason?: string): Promise<Task> {
    return this.updateTask(task.id, status === 'blocked'
      ? { status, blocked_reason: (reason ?? '').trim() }
      : { status });
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await this.sb.from('tasks').delete().eq('id', id);
    if (error) throw error;
  }

  // --------------------------------------------------------- checklist
  async checklist(taskId: string): Promise<ChecklistItem[]> {
    const { data, error } = await this.sb.from('task_checklist_items').select('*')
      .eq('task_id', taskId).order('sort_order').order('created_at');
    if (error) throw error;
    return (data ?? []) as ChecklistItem[];
  }

  async addChecklistItem(taskId: string, title: string, sortOrder: number): Promise<void> {
    const { error } = await this.sb.from('task_checklist_items')
      .insert({ task_id: taskId, title: title.trim(), sort_order: sortOrder });
    if (error) throw error;
  }

  async toggleChecklistItem(id: string, isDone: boolean): Promise<void> {
    const { error } = await this.sb.from('task_checklist_items').update({ is_done: isDone }).eq('id', id);
    if (error) throw error;
  }

  async removeChecklistItem(id: string): Promise<void> {
    const { error } = await this.sb.from('task_checklist_items').delete().eq('id', id);
    if (error) throw error;
  }

  // ---------------------------------------------------- timeline / comments
  async updates(taskId: string): Promise<TaskUpdate[]> {
    const { data, error } = await this.sb.from('task_updates').select('*')
      .eq('task_id', taskId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TaskUpdate[];
  }

  async addComment(taskId: string, content: string): Promise<void> {
    const { error } = await this.sb.from('task_updates').insert({ task_id: taskId, kind: 'comment', content: content.trim() });
    if (error) throw error;
  }

  // ------------------------------------------------------- deliverables
  async deliverables(taskId: string): Promise<Deliverable[]> {
    const { data, error } = await this.sb.from('task_deliverables').select('*')
      .eq('task_id', taskId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Deliverable[];
  }

  /** Storage keys can't hold every character (Arabic names, spaces…): store under a random name, keep the real name in the row. */
  async uploadFile(taskId: string, file: File, note: string): Promise<void> {
    if (file.size > MAX_FILE_BYTES) throw new Error('Payload too large');
    const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
    const path = `${taskId}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`;
    const { error: upErr } = await this.sb.storage.from(BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upErr) throw upErr;

    const { error } = await this.sb.from('task_deliverables').insert({
      task_id: taskId, kind: 'file', file_path: path, file_name: file.name,
      file_size: file.size, mime_type: file.type || null, note: note.trim() || null,
    });
    if (error) {
      await this.sb.storage.from(BUCKET).remove([path]); // no orphan files
      throw error;
    }
  }

  async addLink(taskId: string, url: string, note: string): Promise<void> {
    const { error } = await this.sb.from('task_deliverables')
      .insert({ task_id: taskId, kind: 'link', url: url.trim(), note: note.trim() || null });
    if (error) throw error;
  }

  async review(id: string, result: 'approved' | 'changes_requested', note: string): Promise<void> {
    const { error } = await this.sb.from('task_deliverables')
      .update({ review_status: result, review_note: note.trim() || null }).eq('id', id);
    if (error) throw error;
  }

  async removeDeliverable(d: Deliverable): Promise<void> {
    const { error } = await this.sb.from('task_deliverables').delete().eq('id', d.id);
    if (error) throw error;
    if (d.kind === 'file' && d.file_path) await this.sb.storage.from(BUCKET).remove([d.file_path]);
  }

  /** Temporary download link (1 hour) that keeps the original file name. */
  async fileUrl(d: Deliverable): Promise<string> {
    const { data, error } = await this.sb.storage.from(BUCKET)
      .createSignedUrl(d.file_path!, 3600, { download: d.file_name ?? true });
    if (error) throw error;
    return data.signedUrl;
  }

  // ------------------------------------------------------------- people
  /** Display names, cached. */
  async loadNames(ids: (string | null | undefined)[]): Promise<void> {
    const missing = [...new Set(ids.filter((id): id is string => !!id && !this.names.has(id)))];
    if (!missing.length) return;
    const { data, error } = await this.sb.rpc('task_people', { p_ids: missing });
    if (error) return;
    for (const p of (data ?? []) as { id: string; full_name: string }[]) this.names.set(p.id, p.full_name);
  }

  name(id: string | null | undefined): string {
    return id ? this.names.get(id) ?? '' : '';
  }

  async members(departmentId: string): Promise<Member[]> {
    const { data, error } = await this.sb.rpc('task_get_department_members', { p_department_id: departmentId });
    if (error) throw error;
    const list = (data ?? []) as Member[];
    for (const m of list) this.names.set(m.user_id, m.full_name);
    return list;
  }

  // ------------------------------------------------------ notifications
  async notifications(limit = 20): Promise<TaskNotification[]> {
    const { data, error } = await this.sb.from('task_notifications').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as TaskNotification[];
  }

  async unreadCount(): Promise<number> {
    const { count, error } = await this.sb.from('task_notifications')
      .select('id', { count: 'exact', head: true }).eq('is_read', false);
    if (error) return 0;
    return count ?? 0;
  }

  async markRead(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.sb.from('task_notifications').update({ is_read: true }).in('id', ids);
  }
}