import { Component, computed, inject, input, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe, TranslateDatePipe } from '../../core/i18n/t.pipe';
import { ChecklistItem, Deliverable, Task, TaskStatus, TaskUpdate, isOverdue } from '../../core/models/models';
import { MAX_FILE_BYTES, TasksService } from '../../core/services/tasks.service';
import { ToastService } from '../../core/services/toast.service';
import { errorKey } from '../../core/models/errors';
import { canMoveTo, initials, splitFileName } from '../../shared/task-rules';
import { TaskFormComponent } from '../../shared/task-form/task-form.component';
import { environment } from '../../../environments/environment';
import { TextDialogComponent } from '../../shared/text-dialog/text-dialog.component';

interface StatusAction { status: TaskStatus; label: string; icon: string; kind: 'primary' | 'success' | 'plain' }

@Component({
  selector: 'app-task-detail',
  imports: [FormsModule, RouterLink, TranslatePipe, TranslateDatePipe, TaskFormComponent, TextDialogComponent],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.css',
})
export class TaskDetailComponent {
  /** route param :id (withComponentInputBinding) */
  id = input.required<string>();

  auth = inject(AuthService);
  i18n = inject(TranslationService);
  private svc = inject(TasksService);
  private toast = inject(ToastService);
  private router = inject(Router);

  task = signal<Task | null>(null);
  checklist = signal<ChecklistItem[]>([]);
  deliverables = signal<Deliverable[]>([]);
  updates = signal<TaskUpdate[]>([]);
  loading = signal(true);
  notFound = signal(false);
  busy = signal(false);

  newItem = signal('');
  comment = signal('');
  linkUrl = signal('');
  linkNote = signal('');
  fileNote = signal('');
  showLinkForm = signal(false);
  uploading = signal(false);

  editOpen = signal(false);
  blockOpen = signal(false);
  changesFor = signal<Deliverable | null>(null);

  readonly ticketUrl = computed(() => {
    const t = this.task();
    return t?.ticket_id && environment.ticketingUrl ? `${environment.ticketingUrl.replace(/\/$/, '')}/admin/ticket/${t.ticket_id}` : null;
  });
  readonly isManager = computed(() => this.auth.canManage(this.task()?.department_id));
  readonly isAssignee = computed(() => !!this.task() && this.task()!.assigned_to === this.auth.userId());
  readonly canWork = computed(() => this.isManager() || this.isAssignee());
  readonly late = computed(() => !!this.task() && isOverdue(this.task()!));
  readonly doneCount = computed(() => this.checklist().filter((c) => c.is_done).length);

  readonly actions = computed<StatusAction[]>(() => {
    const t = this.task();
    if (!t) return [];
    const mgr = this.isManager();
    const a = (status: TaskStatus, label: string, icon: string, kind: StatusAction['kind'] = 'plain') => ({ status, label, icon, kind });
    let list: StatusAction[] = [];
    switch (t.status) {
      case 'todo':
        list = [a('in_progress', 'action.start', 'bi-play-fill', 'primary'), a('blocked', 'action.block', 'bi-pause-circle')];
        break;
      case 'in_progress':
        list = t.requires_review && !mgr
          ? [a('in_review', 'action.sendReview', 'bi-send', 'primary')]
          : [a('done', 'action.done', 'bi-check2-circle', 'success')];
        if (t.requires_review && mgr) list.unshift(a('in_review', 'action.sendReview', 'bi-send'));
        list.push(a('blocked', 'action.block', 'bi-pause-circle'));
        break;
      case 'in_review':
        list = mgr
          ? [a('done', 'action.approve', 'bi-check2-all', 'success'), a('in_progress', 'action.return', 'bi-arrow-counterclockwise')]
          : [a('in_progress', 'action.backToWork', 'bi-arrow-counterclockwise')];
        break;
      case 'blocked':
        // stopped: resume the work, or reopen it as new
        list = [a('in_progress', 'action.resume', 'bi-play-fill', 'primary'), a('todo', 'action.reopen', 'bi-arrow-counterclockwise')];
        break;
      case 'done':
        list = [a('in_progress', 'action.reopen', 'bi-arrow-counterclockwise')];
        break;
      case 'cancelled':
        list = [a('todo', 'action.restore', 'bi-arrow-counterclockwise')];
        break;
    }
    return list.filter((x) => canMoveTo(t, x.status, mgr, this.isAssignee()));
  });

  initials = initials;
  splitName = splitFileName;
  name = (id: string | null) => this.svc.name(id);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  // ------------------------------------------------------------- loading
  async load(id: string) {
    this.loading.set(true);
    this.notFound.set(false);
    try {
      const t = await this.svc.getTask(id);
      if (!t) { this.notFound.set(true); return; }
      const [items, files, ups] = await Promise.all([this.svc.checklist(id), this.svc.deliverables(id), this.svc.updates(id)]);
      await this.svc.loadNames([t.assigned_to, t.created_by, ...files.map((f) => f.uploaded_by), ...files.map((f) => f.reviewed_by),
        ...ups.map((u) => u.author_id), ...ups.filter((u) => u.kind === 'assignment').map((u) => u.meta?.['to'])]);
      this.task.set(t);
      this.checklist.set(items);
      this.deliverables.set(files);
      this.updates.set(ups);
    } catch (err) {
      this.notFound.set(true);
      this.fail(err);
    } finally {
      this.loading.set(false);
    }
  }

  /** After a change: triggers update the task (progress, status) and add timeline entries. */
  private async refresh(parts: { checklist?: boolean; deliverables?: boolean } = {}) {
    const id = this.task()!.id;
    const [t, ups, items, files] = await Promise.all([
      this.svc.getTask(id), this.svc.updates(id),
      parts.checklist ? this.svc.checklist(id) : Promise.resolve(null),
      parts.deliverables ? this.svc.deliverables(id) : Promise.resolve(null),
    ]);
    await this.svc.loadNames([t?.assigned_to, ...ups.map((u) => u.author_id), ...(files ?? []).flatMap((f) => [f.uploaded_by, f.reviewed_by])]);
    if (t) this.task.set(t);
    this.updates.set(ups);
    if (items) this.checklist.set(items);
    if (files) this.deliverables.set(files);
  }

  // -------------------------------------------------------------- status
  runAction(a: StatusAction) {
    if (a.status === 'blocked') { this.blockOpen.set(true); return; }
    this.setStatus(a.status);
  }

  async setStatus(status: TaskStatus, reason?: string) {
    const t = this.task();
    if (!t || this.busy()) return;
    this.busy.set(true);
    try {
      this.task.set(await this.svc.changeStatus(t, status, reason));
      this.toast.success(this.i18n.t('toast.moved', { task: t.task_number, status: this.i18n.t('status.' + status) }));
      await this.refresh();
    } catch (err) { this.fail(err); } finally { this.busy.set(false); }
  }

  confirmBlock(reason: string) {
    this.blockOpen.set(false);
    this.setStatus('blocked', reason);
  }

  cancelTask() {
    if (confirm(this.i18n.t('detail.confirmCancel'))) this.setStatus('cancelled');
  }

  async deleteTask() {
    const t = this.task();
    if (!t || !confirm(this.i18n.t('detail.confirmDelete'))) return;
    try {
      await this.svc.deleteTask(t.id);
      this.toast.success(this.i18n.t('toast.deleted', { task: t.task_number }));
      this.router.navigateByUrl(this.auth.homeUrl());
    } catch (err) { this.fail(err); }
  }

  onEdited(t: Task) {
    this.editOpen.set(false);
    this.task.set(t);
    this.toast.success(this.i18n.t('toast.saved'));
    this.refresh();
  }

  async setProgress(value: string) {
    const t = this.task();
    if (!t) return;
    try { this.task.set(await this.svc.updateTask(t.id, { progress: Number(value) })); } catch (err) { this.fail(err); }
  }

  // ----------------------------------------------------------- checklist
  async addItem() {
    const title = this.newItem().trim();
    if (!title) return;
    try {
      await this.svc.addChecklistItem(this.task()!.id, title, this.checklist().length + 1);
      this.newItem.set('');
      await this.refresh({ checklist: true });
    } catch (err) { this.fail(err); }
  }

  async toggleItem(item: ChecklistItem) {
    this.checklist.update((l) => l.map((c) => (c.id === item.id ? { ...c, is_done: !c.is_done } : c)));
    try {
      await this.svc.toggleChecklistItem(item.id, !item.is_done);
      await this.refresh({ checklist: true });
    } catch (err) { this.fail(err); await this.refresh({ checklist: true }); }
  }

  async removeItem(item: ChecklistItem) {
    try {
      await this.svc.removeChecklistItem(item.id);
      await this.refresh({ checklist: true });
    } catch (err) { this.fail(err); }
  }

  // -------------------------------------------------------- deliverables
  async onFile(ev: Event) {
    const inputEl = ev.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { this.toast.error(this.i18n.t('err.fileTooBig')); return; }
    this.uploading.set(true);
    try {
      await this.svc.uploadFile(this.task()!.id, file, this.fileNote());
      this.fileNote.set('');
      this.toast.success(this.i18n.t('toast.uploaded'));
      await this.refresh({ deliverables: true });
    } catch (err) { this.fail(err); } finally { this.uploading.set(false); }
  }

  async addLink() {
    const url = this.linkUrl().trim();
    if (!/^https?:\/\//i.test(url)) { this.toast.error(this.i18n.t('err.badLink')); return; }
    try {
      await this.svc.addLink(this.task()!.id, url, this.linkNote());
      this.linkUrl.set(''); this.linkNote.set(''); this.showLinkForm.set(false);
      await this.refresh({ deliverables: true });
    } catch (err) { this.fail(err); }
  }

  async openFile(d: Deliverable) {
    try { window.open(await this.svc.fileUrl(d), '_blank', 'noopener'); } catch (err) { this.fail(err); }
  }

  async approve(d: Deliverable) {
    try { await this.svc.review(d.id, 'approved', ''); await this.refresh({ deliverables: true }); } catch (err) { this.fail(err); }
  }

  async requestChanges(note: string) {
    const d = this.changesFor();
    this.changesFor.set(null);
    if (!d) return;
    try { await this.svc.review(d.id, 'changes_requested', note); await this.refresh({ deliverables: true }); } catch (err) { this.fail(err); }
  }

  canRemove(d: Deliverable): boolean {
    return this.isManager() || (d.uploaded_by === this.auth.userId() && d.review_status === 'pending');
  }

  async removeDeliverable(d: Deliverable) {
    if (!confirm(this.i18n.t('detail.confirmRemoveFile'))) return;
    try { await this.svc.removeDeliverable(d); await this.refresh({ deliverables: true }); } catch (err) { this.fail(err); }
  }

  // ------------------------------------------------------------- comments
  async sendComment() {
    const text = this.comment().trim();
    if (!text) return;
    try {
      await this.svc.addComment(this.task()!.id, text);
      this.comment.set('');
      await this.refresh();
    } catch (err) { this.fail(err); }
  }

  // ------------------------------------------------------------- helpers
  /** One line for a timeline entry. */
  updateText(u: TaskUpdate): string {
    const m = u.meta ?? {};
    switch (u.kind) {
      case 'created': return this.i18n.t(m['source'] === 'ticket' ? 'timeline.createdFromTicket' : 'timeline.created');
      case 'status_change': return this.i18n.t('timeline.status', { from: this.i18n.t('status.' + m['from']), to: this.i18n.t('status.' + m['to']) });
      case 'assignment': return m['to'] ? this.i18n.t('timeline.assigned', { name: this.name(m['to']) || '—' }) : this.i18n.t('timeline.unassigned');
      case 'deliverable': return this.i18n.t('timeline.deliverable', { name: u.content ?? '' });
      case 'review': return this.i18n.t('timeline.review.' + m['result']);
      case 'system': return this.i18n.t(u.content === 'ticket_sync_failed' ? 'timeline.ticketSyncFailed' : 'timeline.system');
      default: return '';
    }
  }

  updateIcon(u: TaskUpdate): string {
    return ({ created: 'bi-plus-circle', status_change: 'bi-arrow-left-right', assignment: 'bi-person-check',
      deliverable: 'bi-paperclip', review: 'bi-patch-check', system: 'bi-exclamation-triangle', comment: 'bi-chat-left-text' } as Record<string, string>)[u.kind];
  }

  fileSize(bytes: number | null): string {
    if (!bytes) return '';
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private fail(err: unknown) {
    this.toast.error(this.i18n.t(errorKey(err) || 'err.generic'));
  }
}