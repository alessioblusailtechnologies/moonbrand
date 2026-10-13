# Pagamenti: da Paddle a Stripe

Stato al 13 ottobre 2026. Sostituisce la strada di `PAGAMENTI-PRODUZIONE.md`, che resta come storia della prova con
Paddle.

## Perché si cambia

Il 13/10 Paddle ha rifiutato l'account dopo la revisione di moonbrand.app. Ha classificato il prodotto come
«Creative Generative AI (text, images, music)» e «Marketing Services», due categorie escluse dalla sua Acceptable
Use Policy. Un ricorso avrebbe senso solo togliendo immagini, video e musica, che sono il prodotto: non lo facciamo.

**Stripe Managed Payments** è la strada scelta: Stripe fa da merchant of record come Paddle (incassa, applica le
tasse, emette le fatture, gestisce contestazioni e rimborsi), quindi Blusail non fattura ai singoli clienti. Dalla
[pagina sull'ammissibilità](https://docs.stripe.com/payments/managed-payments/eligibility):

- l'Italia è tra le sedi ammesse;
- tra i codici fiscali ammessi c'è `txcd_10105002`, «Artificial Intelligence as a Service, Cloud Based, Business
  Use», che cita espressamente i generatori di immagini;
- il «marketing» escluso è il servizio professionale fatto da persone; Moonbrand è software automatico;
- clienti da oltre 195 paesi (esclusi i paesi sotto sanzioni);
- vincoli: checkout solo con Stripe Checkout o Payment Links, abbonamenti creati solo da lì, niente addebiti fuori
  dal ciclo dell'abbonamento e niente fatture una tantum sul cliente;
- Stripe applica da sé il recesso dove la legge lo prevede e può rimborsare fino a 60 giorni dall'acquisto.

**Piano B, se Stripe rifiuta Managed Payments:** Stripe normale con Stripe Tax. Il codice è lo stesso (Checkout e
Billing); cambia che il venditore è Blusail: fatture ai clienti (elettroniche sullo SdI per gli italiani), reverse
charge con le aziende dell'Unione Europea, OSS per i privati dell'Unione Europea, da vedere col commercialista.

## 1. Da fare tu

- [ ] **Account Stripe** di Blusail Technologies S.r.l.s. (se non c'è), con la verifica della società. Come
  descrizione e trading name valgono quelle date a Paddle (Moonbrand, SaaS per i social con AI).
- [ ] **Richiesta di Managed Payments** dalla dashboard (Settings → Managed Payments, o dalla pagina del prodotto).
  Categoria: SaaS / AI as a Service, business use. È la revisione che dà la risposta definitiva.
- [ ] **Chiavi di test** (Developers → API keys): la chiave segreta `sk_test_...` per l'API di collaudo. La
  modalità test si usa subito, senza aspettare l'approvazione.
- [ ] **Accesso per Claude Code**, se vuoi che crei io catalogo e webhook: Stripe CLI (`stripe login`) o una chiave
  ristretta di test con scrittura su prodotti, prezzi ed endpoint dei webhook.
- [ ] **Commercialista**: con Managed Payments, come si registrano gli incassi da Stripe (come per Paddle, Stripe è
  il rivenditore); per il piano B, le fatture ai clienti.
- [ ] **Paddle**: niente ricorso. L'account si può lasciare così o chiudere; il catalogo live non è mai stato creato.

## 2. Codice (in collaudo, con la modalità test di Stripe)

Il modulo dei pagamenti oggi parla con Paddle; la logica attorno (crediti, blocco dei lavori, rimborsi, abbonamenti
doppi, schermate dello studio) resta. Si riscrive la parte che parla col fornitore.

**API** (`moonbrand-be/moonbrand-api/src/modules/billing/`):

- [ ] `paddle-api.ts` → `stripe-api.ts` con l'SDK `stripe`:
  - checkout del piano: Checkout Session `mode: subscription` con il brand e l'utenza nei `metadata` (al posto dei
    `custom_data`), `managed_payments` acceso, `success_url` e `cancel_url` sullo studio;
  - ricarica: Checkout Session `mode: payment`, quantità da 1 a 10;
  - cambio piano: `subscriptions.update` con `proration_behavior: always_invoice` salendo e `none` scendendo (oggi
    `prorated_immediately` / `do_not_bill`), con l'anteprima degli importi da `invoices.createPreview`;
  - portale: Billing Portal Session al posto del portale di Paddle;
  - disdetta subito (abbonamenti doppi, eliminazioni): `subscriptions.cancel`.
- [ ] `paddle-webhook.ts` → `stripe-webhook.ts` su `POST /v1/webhooks/stripe`, firma con `stripe.webhooks.constructEvent`
  (serve il body grezzo). Eventi:
  - `checkout.session.completed` (ricariche, primo abbonamento);
  - `customer.subscription.created`, `.updated`, `.deleted` (stato, piano, periodo, disdetta programmata);
  - `invoice.paid` (crediti del periodo a ogni rinnovo), `invoice.payment_failed` (banner «Aggiorna la carta»);
  - `charge.refunded` / `refund.created` (crediti tolti col rimborso), al posto degli `adjustment.*`.
- [ ] Prezzi riconosciuti dai `metadata` di prodotto e prezzo (`plan`, `monthly_credits`, `kind`, `credits`, `tier`),
  come oggi dai `custom_data`: nessun id di prezzo in configurazione.
- [ ] Config: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` al posto delle `PADDLE_*`; `BILLING_ENFORCED` resta.
- [ ] Migration: le due di Paddle sono applicate solo in dev, quindi si **riscrivono** invece di aggiungerne altre:
  colonne con nomi neutri o `stripe_*` (`stripe_customer_id`, `stripe_subscription_id`, `stripe_invoice_id` sui
  movimenti dei crediti, tabella degli eventi ricevuti), stati di Stripe (`active`, `trialing`, `past_due`,
  `unpaid`, `canceled`, `incomplete`, `paused`). Il trigger contro le cancellazioni resta uguale.
- [ ] `credits/balance.ts`, `brands/routes.ts`, `plugins/auth.ts`, `app.ts`: i punti che oggi nominano Paddle.

**Studio** (`moonbrand-studio`):

- [ ] Niente più Paddle.js: il checkout è una pagina di Stripe, si apre con un redirect all'URL della sessione e si
  torna su `/abbonamento?esito=...`. La modale centrale con loader ed esito resta, ma legge l'esito al ritorno.
- [ ] `core/billing/billing.service.ts`, `features/billing/*`, `plans/plan-dialog.ts`, `plan-picker.ts`,
  `onboarding/steps/plan-step.ts`, `profile/profile-page.ts`: togliere token client e chiamate a Paddle.
- [ ] `moonbrand-shared` (`api/contract.ts`, `i18n/messages/plans.ts`): testi e tipi che nominano Paddle.

**Prove in modalità test** (carte di prova di Stripe e `stripe trigger` / test clock per i rinnovi):

- [ ] primo abbonamento, ricarica, cambio piano su e giù con gli importi giusti;
- [ ] rinnovo (test clock): crediti del periodo nuovo;
- [ ] rinnovo non pagato (carta che rifiuta): banner, poi blocco;
- [ ] disdetta e ritiro della disdetta dal portale; riattivazione di un brand disdetto;
- [ ] rimborso dalla dashboard: crediti tolti, piano chiuso;
- [ ] abbonamento doppio sullo stesso brand: il secondo disdetto e rimborsato;
- [ ] cliente USA e Regno Unito: valuta e tasse nel checkout.

## 3. Sito e documenti legali

Oggi in produzione il sito nomina Paddle. Finché non si vende non è un problema, ma va cambiato prima di aprire i
pagamenti (e prima della revisione di Stripe, che guarda il sito come Paddle).

- [ ] `moonbrand-website/src/i18n/*.ts`: domanda «Chi gestisce i pagamenti?», riga nel piè di pagina (`footer.paddle`),
  politica di rimborso (`refunds`) e condizioni di vendita in fondo ai termini (`saleTerms`): Stripe al posto di
  Paddle; i termini dell'acquirente diventano quelli di Stripe per Managed Payments; rimborsi chiesti dalla ricevuta
  di Stripe o scrivendo a noi.
- [ ] Valute: con Managed Payments i prezzi in dollari e sterline si mettono come `currency_options` sui prezzi di
  Stripe (stessi importi: 169/339/679 $, 129/259/519 £, ricariche 59/45 $ e 45/35 £).
- [ ] iubenda, termini: i tre rinvii nel campo «documento di riferimento» dicono «tramite Paddle» → «tramite Stripe»
  (il campo è unico per tutte le lingue: salvare una lingua e poi risalvare le altre).
- [ ] iubenda, privacy: togliere Paddle, aggiungere Stripe (Gestione dei pagamenti).
- [ ] `TERMINI-IUBENDA.md`: aggiornare.
- [ ] Deploy del sito (`npm run deploy` in `moonbrand-website`).

## 4. Produzione (dopo l'ok di Stripe e le prove)

- [ ] Catalogo live: tre prodotti con un prezzo mensile ciascuno e il prodotto ricarica con due prezzi, codice
  fiscale `txcd_10105002`, IVA esclusa (`tax_behavior: exclusive`), stessi `metadata`.
- [ ] Endpoint dei webhook live: `https://studio.moonbrand.app/v1/webhooks/stripe` con gli eventi del punto 2;
  copiare il signing secret.
- [ ] Portale clienti (Settings → Billing → Customer portal): disdetta a fine periodo, aggiornamento della carta,
  fatture; il cambio piano passa dallo studio.
- [ ] Migration in prod (procedura in `OPERAZIONI.md`), `.env` dell'API con le chiavi live e
  `BILLING_ENFORCED=false`, merge di `collaudo` su `master`, `bash deploy.sh`.
- [ ] Prova con una carta vera e rimborso.
- [ ] Regola per i clienti di oggi senza piano (avviso con una data, piano regalato dall'admin), poi
  `BILLING_ENFORCED=true`.

## Da decidere

- Clienti di oggi senza piano: avviso con una data (per esempio 30 giorni) e poi blocco, più il piano regalato
  dall'admin per partner e prove.
- Piani annuali: rimandati.
