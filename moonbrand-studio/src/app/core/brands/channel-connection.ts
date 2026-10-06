import { Injectable, inject, signal } from '@angular/core';
import type { ParamMap } from '@angular/router';

import type { ChannelChoice, ChannelChoicesRequest } from '@moonbrand/shared/api/contract';
import type { ChannelId, ChannelState } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName } from '@moonbrand/shared/domain/catalog';

import { errorMessage } from '../errors';
import { I18nService } from '../i18n/i18n.service';
import { ToastService } from '../../ui/toast';
import { BrandsService } from './brands.service';

export interface PendingChoice {
  brandId: string;
  channel: ChannelId;
  choices: ChannelChoice[];
  request: ChannelChoicesRequest;
}

// Un canale appena collegato: chi ha aperto il collegamento aggiorna il suo brand (o la bozza dell'onboarding).
export type Connected = (brandId: string, channel: ChannelId, state: ChannelState) => void | Promise<void>;

// I passi dove Zernio chiede di scegliere: la Pagina di Facebook, il profilo o la pagina di LinkedIn, la bacheca di Pinterest.
const CHOICE_STEPS = new Set(['select_page', 'select_organization', 'select_board']);

// Il collegamento di un social, dalle Impostazioni brand o dall'onboarding: Collega porta alla pagina di accesso del
// social e, al ritorno sulla stessa pagina, l'indirizzo porta l'account collegato, l'errore o i dati per scegliere dove
// pubblicare. Ci sono token temporanei: l'indirizzo va ripulito subito e i dati restano solo in memoria, fino al server.
@Injectable({ providedIn: 'root' })
export class ChannelConnectionService {
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly choosing = signal<PendingChoice | null>(null);
  readonly selecting = signal(false);

  // back: la pagina dove tornare (/impostazioni o /onboarding), che poi chiama finish.
  async start(brandId: string, channel: ChannelId, back: string): Promise<void> {
    const url = new URL(back, window.location.origin);
    url.searchParams.set('canale', channel);
    url.searchParams.set('brand', brandId);
    window.location.assign(await this.brands.connectChannel(brandId, channel, url.toString()));
  }

  // true se l'indirizzo era un ritorno dal social: va ripulito da chi chiama.
  finish(params: ParamMap, connected: Connected): boolean {
    const channel = params.get('canale') as ChannelId | null;
    const brandId = params.get('brand');
    if (!channel || !brandId || !CHANNELS.some(({ id }) => id === channel)) return false;
    const accountId = params.get('accountId');
    const failed = params.get('error');
    const step = params.get('step');
    const request: ChannelChoicesRequest = {
      tempToken: params.get('tempToken') ?? '',
      connectToken: params.get('connect_token') ?? '',
      userProfile: params.get('userProfile') ?? '',
      ...(params.get('organizations') && { organizations: params.get('organizations')! }),
    };
    void this.complete(brandId, channel, { accountId, failed, errorText: params.get('error_message'), step, request }, connected);
    return true;
  }

  async select(choiceId: string, connected: Connected): Promise<void> {
    const pending = this.choosing();
    if (!pending || this.selecting()) return;
    this.selecting.set(true);
    try {
      const { state } = await this.brands.selectChannel(pending.brandId, pending.channel, { ...pending.request, choiceId });
      this.choosing.set(null);
      await this.done(pending.brandId, pending.channel, state, connected);
    } catch (error) {
      this.toast.show(errorMessage(error, this.failed(pending.channel)));
    } finally {
      this.selecting.set(false);
    }
  }

  cancel(): void {
    const pending = this.choosing();
    this.choosing.set(null);
    if (pending) this.toast.show(this.i18n.t('profile.connection.cancelled', { channel: channelName(pending.channel) }));
  }

  private async complete(
    brandId: string,
    channel: ChannelId,
    back: { accountId: string | null; failed: string | null; errorText: string | null; step: string | null; request: ChannelChoicesRequest },
    connected: Connected,
  ): Promise<void> {
    if (!back.failed && back.step && CHOICE_STEPS.has(back.step) && back.request.tempToken) {
      try {
        const choices = await this.brands.channelChoices(brandId, channel, back.request);
        this.choosing.set({ brandId, channel, choices, request: back.request });
      } catch (error) {
        this.toast.show(errorMessage(error, this.failed(channel)));
      }
      return;
    }
    if (back.failed || !back.accountId) {
      this.toast.show(back.errorText ?? this.failed(channel));
      return;
    }
    try {
      const { state } = await this.brands.confirmChannel(brandId, channel, back.accountId);
      await this.done(brandId, channel, state, connected);
    } catch (error) {
      this.toast.show(errorMessage(error, this.failed(channel)));
    }
  }

  private async done(brandId: string, channel: ChannelId, state: ChannelState, connected: Connected): Promise<void> {
    this.toast.show(this.i18n.t('profile.connection.connected', { channel: channelName(channel), handle: state.handle ?? '' }));
    await connected(brandId, channel, state);
    // Se era da ricollegare, l'avviso in alto se ne va.
    await this.brands.reload().catch(() => undefined);
  }

  private failed(channel: ChannelId): string {
    return this.i18n.t('profile.connection.failed', { channel: channelName(channel) });
  }
}
