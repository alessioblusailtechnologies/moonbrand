import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  BillingConfigResponse,
  BillingPortalResponse,
  CheckoutRequest,
  CheckoutResponse,
  CreditsResponse,
  PlanPreviewResponse,
} from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

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
    close(): void;
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
// Il tempo per vedere la conferma di Paddle prima che il checkout si chiuda da solo.
const CLOSE_AFTER_MS = 1_500;
// Un checkout chiuso senza la conferma: si rileggono i crediti per poco, se il pagamento era andato si vede.
const CLOSED_WAIT_MS = 12_000;

type Purchase =
  | { kind: 'plan' | 'change'; brandId: string; plan: SubscriptionPlanId }
  | { kind: 'topup'; brandId: string; before: number };

// La modale dei pagamenti: il loader mentre Paddle conferma, poi l'esito.
export type PaymentState = { phase: 'waiting'; title: string } | { phase: 'done' | 'pending'; title: string; body: string };

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
  readonly payment = signal<PaymentState | null>(null);

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

  // Quanto costa passare a un altro piano, da far confermare prima del cambio.
  previewPlan(brandId: string, plan: SubscriptionPlanId): Promise<PlanPreviewResponse> {
    return firstValueFrom(this.http.post<PlanPreviewResponse>('/v1/billing/plan-preview', { brandId, plan }));
  }

  // Il cambio di piano confermato, su un brand che ha già l'abbonamento: Paddle addebita o accredita la differenza, il
  // piano nuovo arriva con il webhook. La modale aspetta con un loader e poi dice com'è andata.
  async changePlan(brandId: string, plan: SubscriptionPlanId): Promise<void> {
    await firstValueFrom(this.http.put<void>(`/v1/brands/${brandId}/plan`, { plan }));
    void this.wait({ kind: 'change', brandId, plan }, WAIT_MS, true);
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

  // Pagamento riuscito: il checkout si chiude da solo e la modale aspetta il webhook. Chiuso a mano prima della conferma
  // (o se la conferma non arriva): si guarda per poco se il pagamento c'è stato, e la modale compare solo se c'è.
  private onEvent(event: PaddleEvent): void {
    console.info('[pagamenti] evento Paddle', event.name);
    const purchase = this.purchase;
    if (!purchase) return;
    if (event.name === 'checkout.completed') {
      this.purchase = null;
      setTimeout(() => window.Paddle?.Checkout.close(), CLOSE_AFTER_MS);
      void this.wait(purchase, WAIT_MS, true);
    } else if (event.name === 'checkout.closed') {
      this.purchase = null;
      void this.wait(purchase, CLOSED_WAIT_MS, false);
    }
  }

  private arrived(purchase: Purchase, credits: CreditsResponse): boolean {
    if (purchase.kind === 'topup') return credits.monthlyCredits > purchase.before;
    if (purchase.kind === 'change') return credits.subscription?.plan === purchase.plan;
    // Lo stato arriva un attimo prima dei crediti del primo periodo (due eventi diversi): si aspettano entrambi.
    return credits.subscription?.status === 'active' && credits.monthlyCredits > 0;
  }

  // Rilegge i crediti finché il webhook non ha fatto il suo. sure: il pagamento c'è stato di sicuro, la modale aspetta
  // fin da subito e, se il webhook tarda, dice che il pagamento è ricevuto e il resto arriva tra poco.
  private async wait(purchase: Purchase, ms: number, sure: boolean): Promise<void> {
    if (sure) this.payment.set({ phase: 'waiting', title: this.waitingTitle(purchase) });
    this.confirming.set(true);
    try {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        await this.credits.refresh();
        const credits = this.credits.credits();
        if (credits && this.credits.brandId() === purchase.brandId && this.arrived(purchase, credits)) {
          this.payment.set({ phase: 'done', title: this.doneTitle(purchase), body: this.doneBody(credits) });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      if (sure) this.payment.set({ phase: 'pending', title: this.i18n.t('plans.modal.pendingTitle'), body: this.i18n.t('plans.modal.pendingBody') });
    } finally {
      this.confirming.set(false);
    }
  }

  private waitingTitle(purchase: Purchase): string {
    if (purchase.kind === 'topup') return this.i18n.t('plans.modal.waitingTopup');
    const plan = SUBSCRIPTION_PLANS[purchase.plan].name;
    return this.i18n.t(purchase.kind === 'change' ? 'plans.modal.waitingChange' : 'plans.modal.waitingPlan', { plan });
  }

  private doneTitle(purchase: Purchase): string {
    if (purchase.kind === 'topup') return this.i18n.t('plans.modal.doneTopup');
    const plan = SUBSCRIPTION_PLANS[purchase.plan].name;
    return this.i18n.t(purchase.kind === 'change' ? 'plans.modal.doneChange' : 'plans.modal.donePlan', { plan });
  }

  private doneBody(credits: CreditsResponse): string {
    const intl = this.i18n.intl();
    const date = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long' }).format(new Date(`${credits.renewsOn}T12:00:00`));
    return this.i18n.t('plans.modal.doneCredits', { credits: Math.max(credits.remaining, 0).toLocaleString(intl), date });
  }
}
