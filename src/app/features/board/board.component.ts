import { Component, computed, effect, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { BoardPageBase } from '../../shared/board-page.base';
import { TaskBoardComponent } from '../../shared/task-board/task-board.component';
import { TaskFormComponent } from '../../shared/task-form/task-form.component';
import { Member, Task } from '../../core/models/models';
import { TextDialogComponent } from '../../shared/text-dialog/text-dialog.component';

/** A department's board — managers and the super admin. */
@Component({
  selector: 'app-board',
  imports: [FormsModule, TranslatePipe, TaskBoardComponent, TaskFormComponent, TextDialogComponent],
  templateUrl: './board.component.html',
})
export class BoardComponent extends BoardPageBase {
  readonly dept = this.auth.currentDepartment;
  members = signal<Member[]>([]);
  assignee = signal<string>('all');
  search = signal('');
  formOpen = signal(false);

  readonly visible = computed(() => {
    const who = this.assignee();
    const q = this.search().trim().toLowerCase();
    return this.tasks().filter((t) =>
      (who === 'all' || (who === 'none' ? !t.assigned_to : t.assigned_to === who))
      && (!q || t.title.toLowerCase().includes(q) || t.task_number.toLowerCase().includes(q)));
  });

  constructor() {
    super();
    // reload whenever the selected department changes
    effect(() => {
      const d = this.dept();
      if (!d) return;
      untracked(() => {
        this.assignee.set('all');
        this.load();
        this.svc.members(d.department_id).then((m) => this.members.set(m.filter((x) => x.is_active))).catch(() => this.members.set([]));
      });
    });
  }

  protected fetch(): Promise<Task[]> {
    return this.svc.listTasks({ departmentId: this.dept()!.department_id });
  }

  onCreated(t: Task) {
    this.formOpen.set(false);
    this.svc.loadNames([t.assigned_to]).then(() => this.tasks.update((l) => [t, ...l]));
    this.toast.success(this.i18n.t('toast.created', { task: t.task_number }));
  }
}