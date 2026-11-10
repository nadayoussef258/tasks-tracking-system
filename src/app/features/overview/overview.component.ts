import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TasksService } from '../../core/services/tasks.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe, TranslateDatePipe } from '../../core/i18n/t.pipe';
import { BOARD_STATUSES, Department, Task, TaskStatus, isOverdue } from '../../core/models/models';
import { initials } from '../../shared/task-rules';
import { DeptWizardComponent } from '../../shared/dept-wizard/dept-wizard.component';

const WEEK_MS = 7 * 864e5;

interface DeptStats {
  dept: Department;
  counts: Record<TaskStatus, number>;
  active: number;
  overdue: number;
  unassigned: number;
  doneWeek: number;
}

interface PersonLoad {
  id: string;
  name: string;
  depts: string;
  open: number;
  inProgress: number;
  review: number;
  overdue: number;
}

/** Super admin: every department on one page. */
@Component({
  selector: 'app-overview',
  imports: [RouterLink, TranslatePipe, TranslateDatePipe, DeptWizardComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css',
})
export class OverviewComponent implements OnInit {
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  private svc = inject(TasksService);
  private router = inject(Router);

  tasks = signal<Task[]>([]);
  loading = signal(true);
  error = signal('');
  readonly statuses = BOARD_STATUSES;
  wizardOpen = signal(false);

  /** tasks that still need work (done ones are only kept for "done this week") */
  private readonly open = computed(() => this.tasks().filter((t) => t.status !== 'done'));

  readonly kpis = computed(() => {
    const open = this.open();
    const weekAgo = Date.now() - WEEK_MS;
    return {
      open: open.length,
      inProgress: open.filter((t) => t.status === 'in_progress').length,
      review: open.filter((t) => t.status === 'in_review').length,
      blocked: open.filter((t) => t.status === 'blocked').length,
      overdue: open.filter((t) => isOverdue(t)).length,
      doneWeek: this.tasks().filter((t) => t.status === 'done' && t.completed_at && Date.parse(t.completed_at) >= weekAgo).length,
    };
  });

  readonly departments = computed<DeptStats[]>(() => {
    const weekAgo = Date.now() - WEEK_MS;
    return this.auth.departments().map((dept) => {
      const list = this.tasks().filter((t) => t.department_id === dept.department_id);
      const counts = Object.fromEntries(this.statuses.map((s) => [s, 0])) as Record<TaskStatus, number>;
      for (const t of list) if (t.status in counts) counts[t.status]++;
      const open = list.filter((t) => t.status !== 'done');
      return {
        dept, counts,
        active: list.length,
        overdue: open.filter((t) => isOverdue(t)).length,
        unassigned: open.filter((t) => !t.assigned_to).length,
        doneWeek: list.filter((t) => t.status === 'done' && t.completed_at && Date.parse(t.completed_at) >= weekAgo).length,
      };
    });
  });

  readonly people = computed<PersonLoad[]>(() => {
    const map = new Map<string, PersonLoad & { deptIds: Set<string> }>();
    for (const t of this.open()) {
      if (!t.assigned_to) continue;
      let p = map.get(t.assigned_to);
      if (!p) {
        p = { id: t.assigned_to, name: this.svc.name(t.assigned_to) || '—', depts: '', open: 0, inProgress: 0, review: 0, overdue: 0, deptIds: new Set() };
        map.set(t.assigned_to, p);
      }
      p.open++;
      p.deptIds.add(t.department_id);
      if (t.status === 'in_progress') p.inProgress++;
      if (t.status === 'in_review') p.review++;
      if (isOverdue(t)) p.overdue++;
    }
    return [...map.values()]
      .map((p) => ({ ...p, depts: [...p.deptIds].map((id) => this.i18n.deptName(this.auth.department(id))).filter(Boolean).join('، ') }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  });

  readonly maxLoad = computed(() => Math.max(1, ...this.people().map((p) => p.open)));

  readonly overdueList = computed(() =>
    this.open().filter((t) => isOverdue(t)).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')).slice(0, 12));
  readonly reviewList = computed(() =>
    this.open().filter((t) => t.status === 'in_review').sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, 12));
  readonly blockedList = computed(() =>
    this.open().filter((t) => t.status === 'blocked').sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, 12));

  initials = initials;
  name = (id: string | null) => this.svc.name(id);
  deptOf = (t: Task) => this.auth.department(t.department_id);

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = await this.svc.listTasks({});
      await this.svc.loadNames(list.map((t) => t.assigned_to));
      this.tasks.set(list);
    } catch {
      this.error.set(this.i18n.t('err.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  openDept(d: Department, page: '/board' | '/team') {
    this.auth.selectDepartment(d.department_id);
    this.router.navigateByUrl(page);
  }

  pct(n: number, total: number): number {
    return total ? (n / total) * 100 : 0;
  }
}