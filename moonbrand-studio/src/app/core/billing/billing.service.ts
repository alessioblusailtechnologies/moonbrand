import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { BillingPortalResponse, CheckoutRequest, CheckoutResponse, CreditsResponse, PlanPreviewResponse } from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { CreditsService } from '../credits/credits.service';
import { errorMessage } from '../errors';
import { I18nService } from '../i18n/i18n.service';
import { ToastService } from '../../ui/toast';

// Dopo il pagamento il piano e i crediti arrivano con il webhook di Dodo Payments, di solito in pochi secondi.
const WAIT_MS = 45_000;
const POLL_MS = 2_000;
// Tornati senza la conferma (pagamento ancora in lavorazione, o indietro dal browser): si rileggono i crediti per poco,
// se il pagamento era andato si vede.
const UNSURE_WAIT_MS = 12_000;
// Il pagamento lasciato in sospeso quando il browser va da Dodo: si riprende al ritorno, entro un'ora.
const PENDING_KEY = 'mb-pagamento';
const PENDING_TTL_MS = 60 * 60_000;
// Gli esiti con cui non c'è niente da aspettare: pagamento rifiutato, pagina scaduta, rinuncia dalla pagina di Dodo.
const NOTHING_TO_WAIT = new Set(['failed', 'expired', 'cancelled']);

type Purchase =
  | { kind: 'plan' | 'change'; brandId: string; plan: SubscriptionPlanId }
  | { kind: 'topup'; brandId: string; before: number };

type Pending = Purchase & { at: number; from: string };

// La modale dei pagamenti: il loader mentre Dodo conferma, poi l'esito.
export type PaymentState = { phase: 'waiting'; title: string } | { phase: 'done' | 'pending'; title: string; body: string };

// I pagamenti dallo studio: la pagina di pagamento di Dodo Payments, dove il browser va per attivare il piano di un brand
// o comprare una ricarica e da cui torna su /abbonamento, e il portale di Dodo per carta, disdetta e ricevute. Dodo è il
// venditore: incassa ed emette le ricevute.
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly credits = inject(CreditsService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  // Un pagamento fatto che aspetta il webhook: il piano o la ricarica non sono ancora arrivati.
  readonly confirming = signal(false);
  readonly payment = signal<PaymentState | null>(null);

  // returnTo: dove tornare nello studio dopo il pagamento; di default la pagina di adesso.
  activatePlan(brandId: string, plan: SubscriptionPlanId, returnTo?: string): Promise<boolean> {
    return this.checkout({ brandId, kind: 'plan', plan }, { kind: 'plan', brandId, plan }, returnTo);
  }

  buyTopup(brandId: string): Promise<boolean> {
    return this.checkout({ brandId, kind: 'topup' }, { kind: 'topup', brandId, before: this.credits.credits()?.monthlyCredits ?? 0 });
  }

  // Quanto costa passare a un altro piano, da far confermare prima del cambio.
  previewPlan(brandId: string, plan: SubscriptionPlanId): Promise<PlanPreviewResponse> {
    return firstValueFrom(this.http.post<PlanPreviewResponse>('/v1/billing/plan-preview', { brandId, plan }));
  }

  // Il cambio di piano confermato, su un brand che ha già l'abbonamento: Dodo addebita la differenza, il piano nuovo
  // arriva con il webhook. La modale aspetta con un loader e poi dice com'è andata.
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

  // Il ritorno da Dodo (/abbonamento). status è quello che Dodo mette nell'indirizzo: un'indicazione, non la prova del
  // pagamento. Con succeeded o active la modale aspetta il webhook; con failed, expired o cancelled niente da aspettare;
  // altrimenti (pagamento in lavorazione, o si è tornati indietro) si guarda per poco se i crediti arrivano. Restituisce
  // dove tornare nello studio.
  resume(status: string | null): string {
    const pending = this.takePending();
    if (!pending) return '/';
    if (!NOTHING_TO_WAIT.has(status ?? '')) {
      const sure = status === 'succeeded' || status === 'active';
      void this.wait(pending, sure ? WAIT_MS : UNSURE_WAIT_MS, sure);
    }
    return pending.from;
  }

  // La pagina di pagamento: si chiede all'API per cosa e per chi, si segna cosa si sta comprando e il browser va da Dodo.
  private async checkout(request: CheckoutRequest, purchase: Purchase, returnTo?: string): Promise<boolean> {
    try {
      const { url } = await firstValueFrom(this.http.post<CheckoutResponse>('/v1/billing/checkout', request satisfies CheckoutRequest));
      this.savePending({ ...purchase, at: Date.now(), from: returnTo ?? this.router.url });
      window.location.assign(url);
      return true;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('plans.checkoutFailed')));
      return false;
    }
  }

  private savePending(pending: Pending): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      // Senza storage la modale al ritorno non compare: i crediti si rileggono comunque al prossimo lavoro.
    }
  }

  private takePending(): Pending | null {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      localStorage.removeItem(PENDING_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw) as Pending;
      return Date.now() - pending.at < PENDING_TTL_MS ? pending : null;
    } catch {
      return null;
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
