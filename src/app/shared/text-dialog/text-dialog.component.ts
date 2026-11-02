import { Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/t.pipe';

/** Small modal that asks for one text (block reason, review note…). */
@Component({
  selector: 'app-text-dialog',
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (open()) {
      <div class="modal-x-backdrop" (click)="cancel.emit()">
        <div class="modal-x sm" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
          <div class="modal-x-head">
            <h2>{{ title() }}</h2>
            <button type="button" class="btn-x ghost icon" (click)="cancel.emit()" [attr.aria-label]="'common.close' | t"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="modal-x-body">
            <label class="field-label" for="textDialogInput">{{ label() }}</label>
            <textarea #box id="textDialogInput" class="field-textarea" [(ngModel)]="value" [placeholder]="placeholder()"></textarea>
          </div>
          <div class="modal-x-foot">
            <button type="button" class="btn-x" (click)="cancel.emit()">{{ 'common.cancel' | t }}</button>
            <button type="button" class="btn-x primary" [disabled]="required() && !value().trim()" (click)="confirm.emit(value().trim())">
              {{ confirmText() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TextDialogComponent {
  open = input(false);
  title = input('');
  label = input('');
  placeholder = input('');
  confirmText = input('OK');
  required = input(true);
  confirm = output<string>();
  cancel = output<void>();

  value = signal('');
  private box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.value.set('');
        setTimeout(() => this.box()?.nativeElement.focus());
      }
    });
  }
}