/** Database rules raise these codes (see 01_tasks_schema.sql). */
const KNOWN = [
  'task_only_manager_can_edit', 'task_only_manager_can_cancel', 'task_review_required',
  'task_ticket_reassign_in_ticketing', 'task_assignee_not_in_department', 'task_column_read_only',
  'task_not_allowed', 'tasks_blocked_reason_check', 'tasks_dates_check',
];

/** Translation key for an error, or '' when unknown. */
export function errorKey(err: unknown): string {
  const msg = String((err as any)?.message ?? err ?? '');
  const hit = KNOWN.find((c) => msg.includes(c));
  if (hit) return 'err.' + hit;
  if (/row-level security|permission denied/i.test(msg)) return 'err.forbidden';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'err.network';
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return 'err.fileTooBig';
  return '';
}