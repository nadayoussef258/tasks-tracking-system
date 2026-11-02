import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeGuard, managerGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
  path: 'team',
  canActivate: [managerGuard],
  loadComponent: () => import('./features/team/team.component').then((m) => m.TeamComponent),
},
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'board',
        canActivate: [managerGuard],
        loadComponent: () => import('./features/board/board.component').then((m) => m.BoardComponent),
      },
      {
  path: 'team',
  canActivate: [managerGuard],
  loadComponent: () => import('./features/team/team.component').then((m) => m.TeamComponent),
},
      {
        path: 'my-tasks',
        loadComponent: () => import('./features/my-tasks/my-tasks.component').then((m) => m.MyTasksComponent),
      },
      {
        // the same address the emails link to
        path: 'tasks/:id',
        loadComponent: () => import('./features/task-detail/task-detail.component').then((m) => m.TaskDetailComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];