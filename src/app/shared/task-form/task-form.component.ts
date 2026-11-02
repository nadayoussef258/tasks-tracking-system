import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Member, PRIORITIES, Task, TaskDraft, TaskPriority } from '../../core/models/models';
import { TasksService } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { errorKey } from '../../core/models/errors';

/** Create a task, or edit one (managers). */
@Component({
  selector: 'app-task-form',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './task-form.component.html',
})
export class TaskFormComponent {
  open = input(false);
  departmentId = input<string | null>(null);
  task = input<Task | null>(null);
  saved = output<Task>();
  closed = output<void>();

  private svc = inject(TasksService);
  private i18n = inject(TranslationService);
  auth = inject(AuthService);
  readonly priorities = PRIORITIES;

  members = signal<Member[]>([]);
  saving = signal(false);
  error = signal('');

  title = signal('');
  description = signal('');
  priority = signal<TaskPriority>('medium');
  assignedTo = signal<string>('');
  startDate = signal('');
  dueDate = signal('');
  requiresReview = signal(false);

  readonly isEdit = computed(() => !!this.task());
  readonly isTicketTask = computed(() => this.task()?.source_type === 'ticket');
  readonly deptId = computed(() => this.task()?.department_id ?? this.departmentId());
  readonly datesInvalid = computed(() => !!this.startDate() && !!this.dueDate() && this.dueDate() < this.startDate());
  readonly valid = computed(() => this.title().trim().length >= 3 && !this.datesInvalid());

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const t = this.task();
      this.title.set(t?.title ?? '');
      this.description.set(t?.description ?? '');
      this.priority.set(t?.priority ?? 'medium');
      this.assignedTo.set(t?.assigned_to ?? '');
      this.startDate.set(t?.start_date ?? '');
      this.dueDate.set(t?.due_date ?? '');
      this.requiresReview.set(t?.requires_review ?? false);
      this.error.set('');
      this.loadMembers();
    });
  }

  private async loadMembers() {
    const id = this.deptId();
    if (!id) return;
    try {
      const list = (await this.svc.members(id)).filter((m) => m.is_active);
      // the super admin may also take a task himself
      const me = this.auth.user();
      if (me?.is_super_admin && !list.some((m) => m.user_id === me.user_id)) {
        list.push({ user_id: me.user_id, full_name: me.full_name, email: null, member_role: 'manager', job_title: null, is_active: true });
      }
      this.members.set(list);
    } catch {
      this.members.set([]);
    }
  }

  async save() {
    if (!this.valid() || this.saving()) return;
    const draft: TaskDraft = {
      title: this.title().trim(),
      description: this.description().trim() || null,
      priority: this.priority(),
      assigned_to: this.assignedTo() || null,
      start_date: this.startDate() || null,
      due_date: this.dueDate() || null,
      requires_review: this.requiresReview(),
    };
    this.saving.set(true);
    this.error.set('');
    try {
      const t = this.task();
      let result: Task;
      if (t) {
        const patch: Partial<Task> = { ...draft };
        if (t.source_type === 'ticket') delete patch.assigned_to; // follows the ticket
        result = await this.svc.updateTask(t.id, patch);
      } else {
        result = await this.svc.createTask(this.deptId()!, draft);
      }
      this.saved.emit(result);
    } catch (err) {
      const key = errorKey(err);
      this.error.set(key ? this.i18n.t(key) : this.i18n.t('err.generic'));
    } finally {
      this.saving.set(false);
    }
  }
}