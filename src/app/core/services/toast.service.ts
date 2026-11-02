import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success' }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'info', ms = 4000) {
    const id = ++this.seq;
    this.toasts.update((l) => [...l, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  error(text: string) { this.show(text, 'error', 6000); }
  success(text: string) { this.show(text, 'success'); }
  dismiss(id: number) { this.toasts.update((l) => l.filter((t) => t.id !== id)); }
}