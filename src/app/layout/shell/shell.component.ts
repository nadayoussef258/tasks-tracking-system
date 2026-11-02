import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateDatePipe, TranslatePipe } from '../../core/i18n/t.pipe';
import { AuthService } from '../../core/services/auth.service';
import { TasksService } from '../../core/services/tasks.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { ToastService } from '../../core/services/toast.service';
import { TaskNotification } from '../../core/models/models';


/** Top bar + page area for every signed-in page. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, TranslateDatePipe],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit {
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  toast = inject(ToastService);
  private svc = inject(TasksService);
  private router = inject(Router);

  unread = signal(0);
  bellOpen = signal(false);
  notifications = signal<TaskNotification[]>([]);
  loadingNotifs = signal(false);

  readonly roleLabel = computed(() =>
    this.auth.isSuperAdmin() ? 'role.superAdmin' : this.auth.isManager() ? 'role.manager' : 'role.member');

  constructor() {
    const timer = setInterval(() => this.refreshCount(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() { this.refreshCount(); }

  async refreshCount() { this.unread.set(await this.svc.unreadCount()); }

  async toggleBell() {
    const open = !this.bellOpen();
    this.bellOpen.set(open);
    if (!open) return;
    this.loadingNotifs.set(true);
    try { this.notifications.set(await this.svc.notifications(20)); } catch { /* keep old list */ }
    this.loadingNotifs.set(false);
  }

  async openNotification(n: TaskNotification) {
    this.bellOpen.set(false);
    if (!n.is_read) {
      await this.svc.markRead([n.id]);
      this.notifications.update((l) => l.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      this.refreshCount();
    }
    this.router.navigate(['/tasks', n.task_id]);
  }

  async markAllRead() {
    const ids = this.notifications().filter((n) => !n.is_read).map((n) => n.id);
    await this.svc.markRead(ids);
    this.notifications.update((l) => l.map((x) => ({ ...x, is_read: true })));
    this.unread.set(0);
  }

  notifText(n: TaskNotification): string {
    const m = n.meta ?? {};
    return this.i18n.t('notif.' + n.type + (n.type === 'deliverable_reviewed' ? '.' + m['result'] : ''), {
      title: n.title,
      status: m['to'] ? this.i18n.t('status.' + m['to']) : '',
    });
  }

  notifIcon(n: TaskNotification): string {
    return ({
      assigned: 'bi-person-check', status_changed: 'bi-arrow-left-right', comment: 'bi-chat-left-text',
      deliverable_submitted: 'bi-paperclip', deliverable_reviewed: 'bi-patch-check', due_soon: 'bi-alarm',
    } as Record<string, string>)[n.type] ?? 'bi-bell';
  }

  onDeptChange(ev: Event) {
    this.auth.selectDepartment((ev.target as HTMLSelectElement).value);
  }

  @HostListener('document:keydown.escape') closeMenus() { this.bellOpen.set(false); }
}