import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateDatePipe } from '../../core/i18n/t.pipe';
import { initials } from '../task-rules';
import { BOARD_STATUSES, isOverdue, Task, TaskStatus } from '../../core/models/models';
import { TasksService } from '../../core/services/tasks.service';

export interface MoveRequest { task: Task; status: TaskStatus }

/** Kanban board: one column per status, cards move by drag & drop. */
@Component({
  selector: 'app-task-board',
  imports: [RouterLink, TranslatePipe, TranslateDatePipe],
  templateUrl: './task-board.component.html',
  styleUrl: './task-board.component.css',
})
export class TaskBoardComponent {
  tasks = input.required<Task[]>();
  showAssignee = input(true);
  /** Can this card go to this column? */
  canMove = input.required<(task: Task, status: TaskStatus) => boolean>();
  move = output<MoveRequest>();

  private svc = inject(TasksService);
  readonly statuses = BOARD_STATUSES;
  dragging = signal<Task | null>(null);
  overColumn = signal<TaskStatus | null>(null);

  readonly columns = computed(() => {
    const byStatus = new Map<TaskStatus, Task[]>(this.statuses.map((s) => [s, []]));
    for (const t of this.tasks()) byStatus.get(t.status)?.push(t);
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const list of byStatus.values()) {
      list.sort((a, b) => rank[a.priority] - rank[b.priority]
        || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
    }
    return this.statuses.map((s) => ({ status: s, tasks: byStatus.get(s)! }));
  });

  name = (id: string | null) => this.svc.name(id);
  initials = initials;
  late = isOverdue;

  onDragStart(ev: DragEvent, task: Task) {
    this.dragging.set(task);
    ev.dataTransfer?.setData('text/plain', task.id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd() {
    this.dragging.set(null);
    this.overColumn.set(null);
  }

  allowed(status: TaskStatus): boolean {
    const t = this.dragging();
    return !!t && this.canMove()(t, status);
  }

  onDragOver(ev: DragEvent, status: TaskStatus) {
    if (!this.allowed(status)) return;
    ev.preventDefault();
    this.overColumn.set(status);
  }

  onDrop(ev: DragEvent, status: TaskStatus) {
    ev.preventDefault();
    const t = this.dragging();
    this.onDragEnd();
    if (t && this.canMove()(t, status)) this.move.emit({ task: t, status });
  }
}