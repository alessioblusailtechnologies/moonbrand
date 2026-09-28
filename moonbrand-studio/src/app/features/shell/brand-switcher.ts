import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { kindLabel } from '@moonbrand/shared/domain/catalog';

import { AuthService } from '../../core/auth/auth.service';
import { BrandsService } from '../../core/brands/brands.service';
import { errorMessage } from '../../core/errors';
import { BrandAvatar } from '../../ui/brand-avatar';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../ui/toast';

@Component({
  selector: 'mb-brand-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandAvatar, Icon],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  templateUrl: './brand-switcher.html',
  styleUrl: './brand-switcher.scss',
})
export class BrandSwitcher {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly brands = inject(BrandsService);
  protected readonly open = signal(false);
  protected readonly kindLabel = kindLabel;
  // Il brand attivo sta in cima, a parte: sotto gli altri, nell'ordine in cui sono nati.
  protected readonly others = computed(() => this.brands.brands().filter((brand) => brand.id !== this.brands.activeBrand()?.id));

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected async choose(brandId: string): Promise<void> {
    this.open.set(false);
    if (brandId === this.brands.activeBrand()?.id) return;
    try {
      await this.brands.setActive(brandId);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a cambiare brand. Riprova.'));
    }
  }

  protected openSettings(): void {
    this.open.set(false);
    void this.router.navigateByUrl('/impostazioni');
  }

  protected createBrand(): void {
    this.open.set(false);
    void this.router.navigateByUrl('/onboarding', { state: { newBrand: true } });
  }

  protected async signOut(): Promise<void> {
    this.open.set(false);
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
