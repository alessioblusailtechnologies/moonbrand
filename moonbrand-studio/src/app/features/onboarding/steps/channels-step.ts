import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { isConnected, needsReconnect, type BrandDraft, type ChannelId, type ChannelState } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName } from '@moonbrand/shared/domain/catalog';

import { ChannelMark } from '../../../ui/channel-mark';
import { BrandsService } from '../../../core/brands/brands.service';
import { ChannelConnectionService } from '../../../core/brands/channel-connection';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { ToastService } from '../../../ui/toast';
import { DraftStore } from '../draft-store';

const DISCONNECTED: ChannelState = { selected: false, handle: null, accountId: null };

// I social del brand: si usano quelli collegati. Un clic su Collega porta alla pagina di accesso del social e si torna
// qui (onboarding) o nelle Impostazioni brand; Scollega lo toglie.
@Component({
  selector: 'mb-channels-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChannelMark, TranslatePipe],
  template: `
    @for (channel of channels; track channel.id) {
      @let state = draft().channels[channel.id] ?? disconnected;
      @let connected = isConnected(state);
      @let lost = needsReconnect(state);
      <div class="card" [class.connected]="connected" [class.lost]="lost">
        <mb-channel-mark [channel]="channel.id" [active]="connected" [size]="30" />
        <span class="grow texts">
          <span class="strong">{{ channel.name }}</span>
          <span class="caption" [class.ink]="connected && !lost" [class.warn]="lost">{{ status(channel.id, state) }}</span>
        </span>
        @if (lost) {
          <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() !== null" (click)="connect(channel.id)">
            {{ (busy() === channel.id ? 'onboarding.channels.connecting' : 'onboarding.channels.reconnect') | t }}
          </button>
        } @else if (connected) {
          <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy() !== null" (click)="disconnect(channel.id)">
            {{ (busy() === channel.id ? 'onboarding.channels.disconnecting' : 'onboarding.channels.disconnect') | t }}
          </button>
        } @else {
          <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() !== null" (click)="connect(channel.id)">
            {{ (busy() === channel.id ? 'onboarding.channels.connecting' : 'onboarding.channels.connect') | t }}
          </button>
        }
      </div>
    }
    <p class="caption">{{ 'onboarding.channels.hint' | t }}</p>
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
      gap: 14px;
      padding: 12px 16px;
      border: 1.5px solid transparent;
      border-radius: var(--radius-xl);
      background: var(--white);
      transition: border-color 120ms var(--ease);
    }
    .card.connected {
      border-color: var(--border-strong);
    }
    .card.lost {
      border-color: var(--accent-soft);
    }
    .warn {
      color: var(--text-title);
      font-weight: 500;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
  `,
})
export class ChannelsStep {
  private readonly brands = inject(BrandsService);
  private readonly connection = inject(ChannelConnectionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  readonly draft = input.required<BrandDraft>();

  protected readonly channels = CHANNELS;
  protected readonly isConnected = isConnected;
  protected readonly needsReconnect = needsReconnect;
  protected readonly disconnected = DISCONNECTED;
  protected readonly busy = signal<ChannelId | null>(null);

  protected status(id: ChannelId, state: ChannelState): string {
    if (this.busy() === id && (!isConnected(state) || needsReconnect(state))) return this.i18n.t('onboarding.channels.redirecting');
    if (needsReconnect(state)) return this.i18n.t('onboarding.channels.lost', { handle: state.handle ?? '' });
    if (!isConnected(state)) return this.i18n.t('onboarding.channels.notConnected');
    const handle = state.handle ?? '';
    return state.board
      ? this.i18n.t('onboarding.channels.onBoard', { handle, board: state.board.name })
      : this.i18n.t('onboarding.channels.connectedAs', { handle });
  }

  // Il social si apre in questa pagina: al ritorno chi ospita i passi finisce il collegamento (ChannelConnectionService).
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
      await this.store.persist();
      await this.connection.start(brandId, id, this.store.connectReturn);
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
}
