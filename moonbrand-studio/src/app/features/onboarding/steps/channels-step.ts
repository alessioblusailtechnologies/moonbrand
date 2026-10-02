import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { isConnected, type BrandDraft, type ChannelId, type ChannelState } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName } from '@moonbrand/shared/domain/catalog';

import { ChannelMark } from '../../../ui/channel-mark';
import { BrandsService } from '../../../core/brands/brands.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { ToastService } from '../../../ui/toast';
import { DraftStore } from '../draft-store';

@Component({
  selector: 'mb-channels-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChannelMark, TranslatePipe],
  template: `
    @for (channel of channels; track channel.id) {
      @let state = draft().channels[channel.id];
      @let connected = isConnected(state);
      <div class="card" [class.selected]="state.selected">
        <button class="toggle" type="button" role="checkbox" [attr.aria-checked]="state.selected" (click)="toggle(channel.id, state)">
          <mb-channel-mark [channel]="channel.id" [active]="state.selected" [size]="30" />
          <span class="grow texts">
            <span class="strong">{{ channel.name }}</span>
            <span class="caption" [class.ink]="connected">{{ status(channel.id, state) }}</span>
          </span>
        </button>
        @if (connected) {
          <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy() !== null" (click)="disconnect(channel.id)">
            {{ (busy() === channel.id ? 'onboarding.channels.disconnecting' : 'onboarding.channels.disconnect') | t }}
          </button>
        } @else if (connectable) {
          <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() !== null" (click)="connect(channel.id)">
            {{ (busy() === channel.id ? 'onboarding.channels.connecting' : 'onboarding.channels.connect') | t }}
          </button>
        }
      </div>
    }
    @if (connectable) {
      <p class="caption">{{ 'onboarding.channels.hintConnectable' | t }}</p>
    } @else {
      <p class="caption">{{ 'onboarding.channels.hint' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px 12px 12px;
      border: 1.5px solid transparent;
      border-radius: var(--radius-xl);
      background: var(--white);
      transition: border-color 120ms var(--ease);
    }
    .card.selected {
      border-color: var(--border-strong);
    }
    .toggle {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 14px;
      min-width: 0;
      padding: 4px;
      border: 0;
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  `,
})
export class ChannelsStep {
  private readonly brands = inject(BrandsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  readonly draft = input.required<BrandDraft>();

  protected readonly channels = CHANNELS;
  protected readonly isConnected = isConnected;
  protected readonly connectable = this.store.connectable;
  protected readonly busy = signal<ChannelId | null>(null);

  protected status(id: ChannelId, state: ChannelState): string {
    if (isConnected(state)) return this.i18n.t('onboarding.channels.connectedAs', { handle: state.handle ?? '' });
    if (this.busy() === id) return this.i18n.t('onboarding.channels.redirecting');
    return this.i18n.t(state.selected ? 'onboarding.channels.chosen' : 'onboarding.channels.tapToChoose');
  }

  // Scegliere o togliere un canale non tocca il collegamento: quello si cambia solo con Collega e Scollega.
  protected toggle(id: ChannelId, state: ChannelState): void {
    this.update(id, { selected: !state.selected });
  }

  // Il social si apre in questa pagina: al ritorno le Impostazioni brand finiscono il collegamento (ProfilePage).
  protected async connect(id: ChannelId): Promise<void> {
    const brandId = this.store.brandId();
    if (!brandId) return;
    if (this.store.unsaved()) {
      const leave = await this.confirm.ask({
        title: this.i18n.t('onboarding.channels.leave.title'),
        message: this.i18n.t('onboarding.channels.leave.message'),
        cancelLabel: this.i18n.t('onboarding.channels.leave.stay'),
        confirmLabel: this.i18n.t('onboarding.channels.leave.go'),
        tone: 'danger',
      });
      if (!leave) return;
    }
    this.busy.set(id);
    try {
      const back = new URL('/impostazioni', window.location.origin);
      back.searchParams.set('canale', id);
      back.searchParams.set('brand', brandId);
      window.location.assign(await this.brands.connectChannel(brandId, id, back.toString()));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('onboarding.channels.connectFailed', { channel: channelName(id) })));
      this.busy.set(null);
    }
  }

  protected async disconnect(id: ChannelId): Promise<void> {
    const brandId = this.store.brandId();
    if (!brandId) return;
    const ok = await this.confirm.ask({
      title: this.i18n.t('onboarding.channels.disconnectTitle', { channel: channelName(id) }),
      message: this.i18n.t('onboarding.channels.disconnectMessage'),
      cancelLabel: this.i18n.t('common.cancel'),
      confirmLabel: this.i18n.t('onboarding.channels.disconnect'),
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(id);
    try {
      const { state } = await this.brands.disconnectChannel(brandId, id);
      this.store.applyChannel(id, state);
      this.toast.show(this.i18n.t('onboarding.channels.disconnected', { channel: channelName(id) }));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('onboarding.channels.disconnectFailed', { channel: channelName(id) })));
    } finally {
      this.busy.set(null);
    }
  }

  private update(id: ChannelId, patch: Partial<ChannelState>): void {
    const channels = this.store.draft()?.channels ?? this.draft().channels;
    this.store.patch({ key: 'channels', value: { ...channels, [id]: { ...channels[id], ...patch } } });
  }
}
