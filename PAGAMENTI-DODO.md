# Pagamenti: Dodo Payments

Stato al 13 ottobre 2026. Sostituisce `PAGAMENTI-STRIPE.md`, che resta come riserva. `PAGAMENTI-PRODUZIONE.md`
racconta la prova con Paddle.

## Perché Dodo

Il 13/10 Paddle ha rifiutato l'account: ha classificato il prodotto come «Creative Generative AI» e «Marketing
Services», due categorie escluse dalla sua Acceptable Use Policy. Dodo Payments fa da merchant of record come Paddle:
incassa, applica le tasse, emette le ricevute, gestisce contestazioni e rimborsi. Blusail non fattura ai singoli
clienti.

Dalle [regole di accettazione](https://docs.dodopayments.com/miscellaneous/merchant-acceptance):

- «AI Content Generation tools (text, image, video, voice)» e «Marketing & outreach tools» sono tra le categorie
  **ammesse con revisione**, non vietate. Le condizioni sono niente impersonificazioni, scraping o deepfake e niente
  spam o engagement finto. Possono chiedere avvertenze nel sito o un accesso demo.
- Sono **vietati** gli strumenti di scraping, la raccolta di dati personali senza base legale e la vendita di contenuti
  non propri. Il nostro `scarica_social`, che scarica i link incollati in chat come riferimento, va presentato bene: se
  ne parla come riferimento di stile per il cliente, mai come download di contenuti altrui. Sul sito non si nomina.
- L'Italia è tra i [paesi ammessi](https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories)
  per gli account e i pagamenti in uscita.
- Per dubbi su un prodotto specifico Dodo indica compliance@dodopayments.com.

**Il rischio:** come Paddle, la revisione può dire di no, o restringere l'account dopo. Per questo la prima cosa è
**chiedere per iscritto** se accettano Moonbrand, prima di scrivere il codice (punto 1).

## Costi

Dalla [pagina dei prezzi](https://dodopayments.com/pricing):

| Voce | Costo |
|---|---|
| Base (carte e wallet) | 4% + 0,40 $ |
| Carte non statunitensi | +1,5% |
| Abbonamenti | +0,5% |
| PayPal, Klarna | +3% |
| SEPA Direct Debit | 1,5%, massimo 15 € |
| Rimborso | 1 $ |
| Contestazione | 30 $ |
| Pagamento in uscita in USD via SWIFT (società non statunitensi) | 25 $ |
| Conversione di valuta (Adaptive Currency) | 2-4% a carico del cliente |

Un cliente europeo con carta su un abbonamento paga quindi **6% + 0,40 $**: su Pro da 299 € fanno circa 18,30 €.
Stripe Managed Payments costa più o meno lo stesso (circa 5,7% + 0,25 €). Il vantaggio di Dodo è che accetta in modo
esplicito l'AI generativa e il marketing, non il prezzo.

Da chiarire con Dodo: in che valuta pagano Blusail (EUR diretto o conversione da USD), se il pagamento in uscita sotto
1.000 $ costa 5 $ (la pagina dei prezzi si contraddice) e ogni quanto pagano.
Anche: il contratto per i venditori (§ 9.6) dice «Dodo Payments will enable refunds 7 days from the date of purchase»
e i termini per l'acquirente lasciano i rimborsi alla discrezione di Dodo; la nostra politica è di 14 giorni: chiedere
se la rispettano.

## 1. Da fare tu

- [ ] **Email a compliance@dodopayments.com** prima di tutto il resto, con il link a moonbrand.app e una descrizione
  breve: SaaS che crea e pubblica post, caroselli e video per i social del cliente, partendo dal suo brand; contenuti
  generati con AI per il marchio del cliente, niente impersonificazioni o deepfake, niente scraping, pubblicazione
  solo sugli account collegati dal cliente. Chiedere anche valuta e frequenza dei pagamenti in uscita. Se ti serve,
  scrivo io il testo in inglese.
- [ ] **Account Dodo** di Blusail Technologies S.r.l.s. (dashboard: app.dodopayments.com), con la verifica della
  società. Trading name Moonbrand, come dato a Paddle.
- [ ] **Chiavi di test** (Developer → API keys in modalità test): la chiave API per l'API di collaudo. La modalità test
  si usa subito, senza aspettare l'approvazione.
- [ ] **Accesso per Claude Code**, se vuoi che crei io catalogo e webhook: una chiave API di test (Dodo ha anche un
  server MCP ufficiale, `dodopayments-mcp`, che si configura con la stessa chiave).
- [ ] **Commercialista**: come si registrano gli incassi da Dodo, che fa da rivenditore come Paddle (Blusail fattura a
  Dodo, non ai clienti).
- [ ] **Paddle**: niente ricorso. L'account si può lasciare così o chiudere.

## 2. Codice (in collaudo, con la modalità test di Dodo)

Il modulo dei pagamenti oggi parla con Paddle; la logica attorno (crediti, blocco dei lavori, rimborsi, abbonamenti
doppi, schermate dello studio) resta. Si riscrive la parte che parla col fornitore. Dodo somiglia a Paddle più di
Stripe: stessi modi di cambio piano (`prorated_immediately`, `do_not_bill`), stato `on_hold`, portale clienti.

**API** (`moonbrand-be/moonbrand-api/src/modules/billing/`), con l'SDK `dodopayments` (`environment: 'test_mode'` in
collaudo, `live_mode` in prod):

- [ ] `paddle-api.ts` → `dodo-api.ts`:
  - checkout del piano e della ricarica: `checkoutSessions.create` (`POST /checkouts`) con `product_cart`
    (`product_id`, `quantity`), `customer` (email e nome dell'utenza, o `customer_id` se c'è già), `metadata` con brand e
    utenza (al posto dei `custom_data`), `return_url` sullo studio. La risposta dà `checkout_url`;
  - cambio piano: `subscriptions.changePlan` con `proration_billing_mode: prorated_immediately` salendo e
    `do_not_bill` scendendo (come oggi con Paddle), `on_payment_failure: prevent_change`; anteprima degli importi da
    `subscriptions.previewChangePlan`;
  - portale: sessione del portale clienti (`/customers/{id}/customer-portal/session`) al posto di quello di Paddle;
  - disdetta a fine periodo: `PATCH /subscriptions/{id}` con `cancel_at_next_billing_date: true`; disdetta subito
    (abbonamenti doppi, eliminazioni): stato `cancelled`;
  - rimborso (abbonamento doppio): `POST /refunds` col `payment_id`.
- [ ] `paddle-webhook.ts` → `dodo-webhook.ts` su `POST /v1/webhooks/dodo`. Firma secondo lo standard Standard Webhooks
  (header `webhook-id`, `webhook-timestamp`, `webhook-signature`, serve il body grezzo), verificata con
  `client.webhooks.unwrap()` e la chiave `DODO_PAYMENTS_WEBHOOK_KEY`. Dodo ritenta fino a 8 volte: eventi già visti
  scartati per `webhook-id`. Eventi:
  - `payment.succeeded` (ricariche; primo pagamento e rinnovi dell'abbonamento), `payment.failed`;
  - `subscription.active`, `subscription.renewed` (crediti del periodo nuovo), `subscription.plan_changed`,
    `subscription.updated`, `subscription.on_hold` (banner «Aggiorna la carta», poi blocco), `subscription.cancelled`,
    `subscription.expired`;
  - `refund.succeeded` (crediti tolti col rimborso), al posto degli `adjustment.*`;
  - `dispute.opened` / `dispute.lost`: crediti bloccati, come un rimborso.
- [ ] Da verificare in modalità test: se i `metadata` della sessione arrivano su pagamento e abbonamento (la
  documentazione non lo dice) e se il pagamento porta il `subscription_id`. Se non arrivano, si salva la sessione
  (`session_id` → brand e utenza) alla creazione del checkout e si collega da lì.
- [ ] Prezzi riconosciuti dai `metadata` dei prodotti (`plan`, `monthly_credits`, `kind`, `credits`, `tier`), come oggi
  dai `custom_data`: nessun id in configurazione.
- [ ] Config: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENV` al posto delle `PADDLE_*`;
  `BILLING_ENFORCED` resta.
- [ ] Migration: le due di Paddle sono applicate solo in dev, quindi si **riscrivono**: `dodo_customer_id`,
  `dodo_subscription_id`, `dodo_payment_id` sui movimenti dei crediti, tabella degli eventi ricevuti per `webhook-id`,
  stati di Dodo (`pending`, `active`, `on_hold`, `paused`, `cancelled`, `expired`, `failed`). Il trigger contro le
  cancellazioni resta uguale.
- [ ] `credits/balance.ts`, `brands/routes.ts`, `plugins/auth.ts`, `app.ts`: i punti che oggi nominano Paddle.

**Studio** (`moonbrand-studio`):

- [ ] Niente più Paddle.js: il checkout è una pagina di Dodo, si apre con un redirect a `checkout_url` e si torna su
  `/abbonamento?esito=...`. La modale centrale con loader ed esito resta, ma legge l'esito al ritorno (aspettando il
  webhook). Dodo ha anche un checkout sovrapposto alla pagina: si valuta dopo, il redirect basta.
- [ ] `core/billing/billing.service.ts`, `features/billing/*`, `plans/plan-dialog.ts`, `plan-picker.ts`,
  `onboarding/steps/plan-step.ts`, `profile/profile-page.ts`: togliere token client e chiamate a Paddle.
- [ ] `moonbrand-shared` (`api/contract.ts`, `i18n/messages/plans.ts`): testi e tipi che nominano Paddle.

**Prove in modalità test** (carte di prova di Dodo):

- [ ] primo abbonamento, ricarica, cambio piano su e giù con gli importi giusti;
- [ ] rinnovo: crediti del periodo nuovo;
- [ ] rinnovo non pagato (carta che rifiuta): `on_hold`, banner, poi blocco; ritorno attivo dopo il cambio carta;
- [ ] disdetta e ritiro della disdetta dal portale; riattivazione di un brand disdetto;
- [ ] rimborso dalla dashboard: crediti tolti, piano chiuso;
- [ ] abbonamento doppio sullo stesso brand: il secondo disdetto e rimborsato;
- [ ] cliente USA e Regno Unito: valuta e tasse nel checkout.

## 3. Sito e documenti legali

Oggi in produzione il sito nomina Paddle. Va cambiato **prima della revisione di Dodo**, che guarda il sito come ha
fatto Paddle.

- [x] `moonbrand-website/src/i18n/*.ts` (13/10, venditore «Dodo Payments», termini acquirente
  dodopayments.com/legal/buyer-terms, portale customer.dodopayments.com): domanda «Chi gestisce i pagamenti?», riga nel piè di pagina (`footer.paddle`),
  politica di rimborso (`refunds`, con il link `{paddle}` in `Refunds.astro`) e condizioni di vendita in fondo ai
  termini (`saleTerms`, link `{buyerTerms}` in `Legal.astro`): Dodo Payments al posto di Paddle, con il nome legale che
  Dodo indica per i clienti europei e i suoi termini per l'acquirente. La politica di rimborso resta la nostra (14
  giorni, ridotta in proporzione ai crediti usati, rinnovi non rimborsati).
- [x] Una riga sull'AI nelle condizioni (c'è già la sezione sui contenuti generati): uso solo per il brand del cliente,
  niente impersonificazioni o deepfake. È la condizione di Dodo, conviene che la trovino scritta.
- [ ] Valute: prezzi in euro, dollari e sterline sui prodotti di Dodo (stessi importi: 149/299/599 €, 169/339/679 $,
  129/259/519 £; ricariche 50/40 €, 59/45 $, 45/35 £), oppure solo euro con Adaptive Currency, che però fa pagare al
  cliente il 2-4% di cambio. Consiglio i prezzi fissi per valuta, se Dodo li permette.
- [x] iubenda, termini: i tre rinvii nel campo «documento di riferimento» dicono «tramite Paddle» → «tramite Dodo
  Payments» (il campo è unico per tutte le lingue: salvare una lingua e poi risalvare le altre).
- [x] iubenda, privacy: togliere Paddle, aggiungere Dodo Payments (Gestione dei pagamenti).
- [x] `TERMINI-IUBENDA.md`: aggiornare.
- [ ] Deploy del sito (`npm run deploy` in `moonbrand-website`).

## 4. Produzione (dopo l'ok di Dodo e le prove)

- [ ] Catalogo live: tre prodotti in abbonamento mensile (Start, Pro, Ultra) e le due ricariche, `tax_category: saas`,
  IVA esclusa, stessi `metadata`; durata dell'abbonamento lunga (per esempio 10 anni), altrimenti scade dopo un
  addebito.
- [ ] Portale clienti: disdetta a fine periodo e cambio carta; il cambio piano passa dallo studio (Allow Subscription
  Updates spento).
- [ ] Endpoint dei webhook live: `https://studio.moonbrand.app/v1/webhooks/dodo` con gli eventi del punto 2; copiare
  la chiave di firma.
- [ ] Migration in prod (procedura in `OPERAZIONI.md`), `.env` dell'API con le chiavi live e `BILLING_ENFORCED=false`,
  merge di `collaudo` su `master`, `bash deploy.sh`.
- [ ] Prova con una carta vera e rimborso.
- [ ] Regola per i clienti di oggi senza piano (avviso con una data, piano regalato dall'admin), poi
  `BILLING_ENFORCED=true`.

## Se Dodo dice di no

Stripe Managed Payments (`PAGAMENTI-STRIPE.md`): ha un codice fiscale per l'AI as a Service che cita i generatori di
immagini. Il lavoro sul codice si sposta quasi uguale, cambia solo il fornitore.

## Da decidere

- Clienti di oggi senza piano: avviso con una data (per esempio 30 giorni) e poi blocco, più il piano regalato
  dall'admin per partner e prove.
- Piani annuali: rimandati.
