import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LangSwitcherComponent } from './shared/lang-switcher/lang-switcher.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LangSwitcherComponent],
  template: `<router-outlet /><app-lang-switcher />`,
})
export class App {}