import { Task, TaskStatus } from "../core/models/models";

/** Mirrors the database rules, so the UI only offers moves that will succeed. */
export function canMoveTo(task: Task, status: TaskStatus, isManager: boolean, isAssignee: boolean): boolean {
  if (task.status === status) return false;
  if (!isManager && !isAssignee) return false;
  if (status === 'cancelled') return isManager;
  if (status === 'done' && task.requires_review && !isManager) return false;
  return true;
}

/** Two initials. The zero-width non-joiner keeps Arabic letters apart ("م‌ع", not "مع"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts[0][0] + (parts.length > 1 ? '\u200C' + parts[parts.length - 1][0] : '');
}

/** "report-2.pdf" → ["report-2", "pdf"], so the extension can be shown left-to-right on its own. */
export function splitFileName(name: string | null): [string, string] {
  const n = name ?? '';
  const i = n.lastIndexOf('.');
  return i > 0 && i >= n.length - 11 ? [n.slice(0, i), n.slice(i + 1)] : [n, ''];
}