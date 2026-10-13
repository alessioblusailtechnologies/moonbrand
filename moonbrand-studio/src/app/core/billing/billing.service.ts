import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  BillingConfigResponse,
  BillingPortalResponse,
  CheckoutRequest,
  CheckoutResponse,
  CreditsResponse,
} from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';
import type { MessageKey, MessageParams } from '@moonbrand/shared/i18n/translate';

import { CreditsService } from '../credits/credits.service';
import { errorMessage } from '../errors';
import { I18nService } from '../i18n/i18n.service';
import { ToastService } from '../../ui/toast';

// Quanto di Paddle.js serve qui (developer.paddle.com/paddlejs).
interface PaddleEvent {
  name?: string;
}
interface PaddleJs {
  Environment: { set(environment: 'sandbox'): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: {
    open(options: {
      items: { priceId: string; quantity: number }[];
      customer?: { id: string } | { email: string };
      customData?: Record<string, string>;
      settings?: { displayMode?: 'overlay'; locale?: string; theme?: 'light'; allowLogout?: boolean };
    }): void;
  };
}
declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';
// Dopo il pagamento il piano e i crediti arrivano con il webhook di Paddle, di solito in pochi secondi.
const WAIT_MS = 45_000;
const POLL_MS = 2_000;

type Purchase = { kind: 'plan'; brandId: string; plan: SubscriptionPlanId } | { kind: 'topup'; brandId: string; before: number };

// I pagamenti dallo studio: il checkout di Paddle sopra la pagina, per attivare il piano di un brand o comprare una
// ricarica, e il portale di Paddle per carta, disdetta e fatture. Paddle è il venditore: incassa ed emette le fatture.
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly credits = inject(CreditsService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  private ready: Promise<PaddleJs> | null = null;
  private purchase: Purchase | null = null;
  // Un pagamento fatto che aspetta il webhook: il piano o la ricarica non sono ancora arrivati.
  readonly confirming = signal(false);

  // Carica Paddle.js una volta e lo collega al nostro account Paddle. Anche la pagina /abbonamento passa da qui: con
  // un _ptxn nell'indirizzo (i link delle email di Paddle) il checkout si apre da solo.
  load(): Promise<PaddleJs> {
    this.ready ??= (async () => {
      const config = await firstValueFrom(this.http.get<BillingConfigResponse>('/v1/billing/config'));
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PADDLE_JS;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Paddle.js non caricato'));
        document.head.appendChild(script);
      });
      const paddle = window.Paddle;
      if (!paddle) throw new Error('Paddle.js non caricato');
      if (config.environment === 'sandbox') paddle.Environment.set('sandbox');
      paddle.Initialize({ token: config.clientToken, eventCallback: (event) => this.onEvent(event) });
      return paddle;
    })();
    this.ready.catch(() => (this.ready = null));
    return this.ready;
  }

  activatePlan(brandId: string, plan: SubscriptionPlanId): Promise<boolean> {
    return this.open({ brandId, kind: 'plan', plan }, { kind: 'plan', brandId, plan });
  }

  buyTopup(brandId: string): Promise<boolean> {
    return this.open({ brandId, kind: 'topup' }, { kind: 'topup', brandId, before: this.credits.credits()?.monthlyCredits ?? 0 });
  }

  // Il cambio di piano di un brand che ha già l'abbonamento: Paddle addebita o accredita la differenza, il piano nuovo
  // arriva con il webhook.
  async waitForPlan(brandId: string, plan: SubscriptionPlanId): Promise<void> {
    await this.wait(brandId, (credits) => credits.subscription?.plan === plan, 'plans.changed', { plan: SUBSCRIPTION_PLANS[plan].name });
  }

  async openPortal(brandId: string): Promise<void> {
    // La finestra si apre subito, nel gesto dell'utente: dopo l'attesa dell'API il browser la bloccherebbe.
    const tab = window.open('', '_blank');
    try {
      const { url } = await firstValueFrom(this.http.post<BillingPortalResponse>('/v1/billing/portal', { brandId }));
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      this.toast.show(errorMessage(error, this.i18n.t('plans.portalFailed')));
    }
  }

  private async open(request: CheckoutRequest, purchase: Purchase): Promise<boolean> {
    try {
      const [paddle, checkout] = await Promise.all([
        this.load(),
        firstValueFrom(this.http.post<CheckoutResponse>('/v1/billing/checkout', request satisfies CheckoutRequest)),
      ]);
      this.purchase = purchase;
      paddle.Checkout.open({
        items: [{ priceId: checkout.priceId, quantity: 1 }],
        customer: checkout.customer,
        customData: checkout.customData,
        settings: { displayMode: 'overlay', locale: this.i18n.locale(), theme: 'light', allowLogout: false },
      });
      return true;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('plans.checkoutFailed')));
      return false;
    }
  }

  private onEvent(event: PaddleEvent): void {
    if (event.name !== 'checkout.completed' || !this.purchase) return;
    const purchase = this.purchase;
    this.purchase = null;
    if (purchase.kind === 'plan') {
      const name = SUBSCRIPTION_PLANS[purchase.plan].name;
      void this.wait(purchase.brandId, (credits) => credits.subscription?.status === 'active', 'plans.activated', { plan: name });
    } else {
      void this.wait(purchase.brandId, (credits) => credits.monthlyCredits > purchase.before, 'plans.topupDone', {});
    }
  }

  // Rilegge i crediti finché il webhook non ha fatto il suo, poi lo dice. Se tarda, il pagamento c'è comunque: lo
  // studio lo mostrerà alla prossima lettura.
  private async wait(brandId: string, done: (credits: CreditsResponse) => boolean, message: MessageKey, params: MessageParams): Promise<void> {
    this.confirming.set(true);
    try {
      const until = Date.now() + WAIT_MS;
      while (Date.now() < until) {
        await this.credits.refresh();
        const credits = this.credits.credits();
        if (credits && this.credits.brandId() === brandId && done(credits)) {
          this.toast.show(this.i18n.t(message, params));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      this.toast.show(this.i18n.t('plans.paymentPending'));
    } finally {
      this.confirming.set(false);
    }
  }
}
