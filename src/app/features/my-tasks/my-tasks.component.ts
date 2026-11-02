import { Component, OnInit } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { BoardPageBase } from '../../shared/board-page.base';
import { TaskBoardComponent } from '../../shared/task-board/task-board.component';
import { TextDialogComponent } from '../../shared/text-dialog/text-dialog.component';
import { Task } from '../../core/models/models';

/** The signed-in person's own tasks, from every department. */
@Component({
  selector: 'app-my-tasks',
  imports: [TranslatePipe, TaskBoardComponent, TextDialogComponent],
  templateUrl: './my-tasks.component.html',
})
export class MyTasksComponent extends BoardPageBase implements OnInit {
  ngOnInit() { this.load(); }

  protected fetch(): Promise<Task[]> {
    return this.svc.listTasks({ assignedTo: this.auth.userId()! });
  }
}