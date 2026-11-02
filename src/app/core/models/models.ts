export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type MemberRole = 'manager' | 'member';

/** Columns shown on the Kanban board, in order. */
export const BOARD_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'done'];
export const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export interface Department {
  department_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  color: string;
  member_role: MemberRole | null;
}

export interface TaskContext {
  user_id: string;
  full_name: string;
  is_super_admin: boolean;
  departments: Department[];
}

export interface Task {
  id: string;
  task_number: string;
  department_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  blocked_reason: string | null;
  progress: number;
  requires_review: boolean;
  assigned_to: string | null;
  created_by: string | null;
  start_date: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  source_type: 'manual' | 'ticket';
  ticket_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskDraft = Pick<Task, 'title' | 'description' | 'priority' | 'assigned_to' | 'start_date' | 'due_date' | 'requires_review'>;

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  done_at: string | null;
  done_by: string | null;
  sort_order: number;
  created_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string | null;
  kind: 'comment' | 'created' | 'status_change' | 'assignment' | 'deliverable' | 'review' | 'system';
  content: string | null;
  meta: Record<string, any>;
  created_at: string;
}

export interface Deliverable {
  id: string;
  task_id: string;
  kind: 'file' | 'link';
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  url: string | null;
  note: string | null;
  review_status: 'pending' | 'approved' | 'changes_requested';
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface TaskNotification {
  id: string;
  task_id: string;
  type: 'assigned' | 'status_changed' | 'comment' | 'deliverable_submitted' | 'deliverable_reviewed' | 'due_soon';
  title: string;
  meta: Record<string, any>;
  actor_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Member {
  user_id: string;
  full_name: string;
  email: string | null;
  member_role: MemberRole;
  job_title: string | null;
  is_active: boolean;
}

/** 'YYYY-MM-DD' for today in the user's time zone. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isOverdue(t: Pick<Task, 'due_date' | 'status'>): boolean {
  return !!t.due_date && t.status !== 'done' && t.status !== 'cancelled' && t.due_date < todayIso();
}