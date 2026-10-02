import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { kindLabel } from '@moonbrand/shared/domain/catalog';

import { BrandsService } from '../../core/brands/brands.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BrandAvatar } from '../../ui/brand-avatar';
import { Icon } from '../../ui/icon';
import { BrandPickerService } from './brand-picker';

// Il brand attivo in cima alla sidebar: apre la finestra per sceglierne un altro, aprire le impostazioni o crearne uno nuovo.
// compact: la sidebar compressa, resta solo il logo del brand.
@Component({
  selector: 'mb-brand-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandAvatar, Icon, TranslatePipe],
  templateUrl: './brand-switcher.html',
  styleUrl: './brand-switcher.scss',
})
export class BrandSwitcher {
  protected readonly brands = inject(BrandsService);
  protected readonly picker = inject(BrandPickerService);
  protected readonly i18n = inject(I18nService);
  readonly compact = input(false);
  protected readonly kindLabel = kindLabel;
}
