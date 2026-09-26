import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BrandsService } from '../../core/brands/brands.service';

@Component({
  selector: 'mb-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    @if (brands.activeBrand(); as brand) {
      <section class="hero">
        <p class="label">Stai lavorando su</p>
        <h1 class="display">{{ brand.name }}</h1>
        <p class="body">Lo studio si riempie presto: idee, piano e contenuti arrivano qui.</p>
      </section>
    }
    <router-outlet />
  `,
  styles: `
    .hero {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 960px;
      margin: 8vh auto 0;
      animation: fade-up 240ms var(--ease);
    }
  `,
})
export class Home {
  protected readonly brands = inject(BrandsService);
}
