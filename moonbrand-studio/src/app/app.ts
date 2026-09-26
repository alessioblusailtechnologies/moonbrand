import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Confirm } from './ui/confirm';
import { Toasts } from './ui/toast';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Confirm, Toasts],
  template: `
    <router-outlet />
    <mb-confirm />
    <mb-toasts />
  `,
})
export class App {}
