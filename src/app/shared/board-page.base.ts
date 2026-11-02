import { computed, inject, signal } from '@angular/core';
import { TranslationService } from '../core/i18n/translation.service';

import { MoveRequest } from './task-board/task-board.component';
import { AuthService } from '../core/services/auth.service';
import { TasksService } from '../core/services/tasks.service';
import { ToastService } from '../core/services/toast.service';
import { isOverdue, Task, TaskStatus } from '../core/models/models';
import { errorKey } from '../core/models/errors';
import { canMoveTo } from './task-rules';

/** Shared logic of the two board pages: loading, moving cards, the "blocked" reason. */
export abstract class BoardPageBase {
  protected auth = inject(AuthService);
  protected svc = inject(TasksService);
  protected i18n = inject(TranslationService);
  protected toast = inject(ToastService);

  tasks = signal<Task[]>([]);
  loading = signal(true);
  loadError = signal('');
  pendingBlock = signal<Task | null>(null);

  readonly stats = computed(() => {
    const list = this.tasks();
    return {
      open: list.filter((t) => t.status !== 'done').length,
      inProgress: list.filter((t) => t.status === 'in_progress').length,
      review: list.filter((t) => t.status === 'in_review').length,
      overdue: list.filter((t) => isOverdue(t)).length,
    };
  });

  readonly canMove = (task: Task, status: TaskStatus) =>
    canMoveTo(task, status, this.auth.canManage(task.department_id), task.assigned_to === this.auth.userId());

  protected abstract fetch(): Promise<Task[]>;

  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const list = await this.fetch();
      await this.svc.loadNames(list.map((t) => t.assigned_to));
      this.tasks.set(list);
    } catch (err) {
      this.loadError.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  onMove(req: MoveRequest) {
    if (req.status === 'blocked') {
      this.pendingBlock.set(req.task);
      return;
    }
    this.applyStatus(req.task, req.status);
  }

  confirmBlock(reason: string) {
    const t = this.pendingBlock();
    this.pendingBlock.set(null);
    if (t) this.applyStatus(t, 'blocked', reason);
  }

  private async applyStatus(task: Task, status: TaskStatus, reason?: string) {
    const before = this.tasks();
    // move the card right away; put it back if the database refuses
    this.tasks.update((l) => l.map((t) => (t.id === task.id ? { ...t, status, blocked_reason: reason ?? null } : t)));
    try {
      const saved = await this.svc.changeStatus(task, status, reason);
      this.tasks.update((l) => l.map((t) => (t.id === saved.id ? saved : t)));
      this.toast.success(this.i18n.t('toast.moved', { task: task.task_number, status: this.i18n.t('status.' + status) }));
    } catch (err) {
      this.tasks.set(before);
      this.toast.error(this.message(err));
    }
  }

  protected message(err: unknown): string {
    const key = errorKey(err);
    return this.i18n.t(key || 'err.generic');
  }
}