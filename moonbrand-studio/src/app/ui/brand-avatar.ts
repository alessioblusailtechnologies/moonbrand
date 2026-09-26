import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'mb-brand-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: inline-flex; flex: none' },
  template: `
    @if (logo()) {
      <img class="avatar" [src]="logo()" [alt]="'Logo di ' + name()" [style.width.px]="size()" [style.height.px]="size()"
        [style.border-radius.px]="size() / 4" />
    } @else {
      <span class="avatar monogram" [style.width.px]="size()" [style.height.px]="size()" [style.border-radius.px]="size() / 4"
        [style.background]="color()" [style.font-size.px]="size() * 0.38">{{ initials() }}</span>
    }
  `,
  styles: `
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      object-fit: contain;
      background: var(--white);
    }
    .monogram {
      color: var(--white);
      font-weight: 700;
      line-height: 1;
    }
  `,
})
export class BrandAvatar {
  readonly name = input.required<string>();
  readonly logo = input<string | null>(null);
  readonly color = input('#2F3452');
  readonly size = input(32);

  protected readonly initials = computed(
    () =>
      this.name()
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('') || '?',
  );
}
