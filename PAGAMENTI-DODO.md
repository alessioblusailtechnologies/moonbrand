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
- [x] **Chiavi di test** (Developer → API keys in modalità test): la chiave API per l'API di collaudo. La modalità test
  si usa subito, senza aspettare l'approvazione.
- [x] **Accesso per Claude Code**, se vuoi che crei io catalogo e webhook: una chiave API di test (Dodo ha anche un
  server MCP ufficiale, `dodopayments-mcp`, che si configura con la stessa chiave).
- [ ] **Commercialista**: come si registrano gli incassi da Dodo, che fa da rivenditore come Paddle (Blusail fattura a
  Dodo, non ai clienti).
- [ ] **Paddle**: niente ricorso. L'account si può lasciare così o chiudere.

## 2. Codice (in collaudo, con la modalità test di Dodo)

**Catalogo di test creato il 13/10** (script con l'SDK, `pricing_mode: by_currency`, EUR di base più prezzi fissi in USD
e GBP, IVA esclusa, `saas`; piani mensili con durata 10 anni):

| Prodotto | ID | EUR / USD / GBP | metadata |
|---|---|---|---|
| Moonbrand Start | `pdt_0NpfEfQCJ213zQ14MHKuZ` | 149 / 169 / 129 | `plan: start`, `monthly_credits: 2500` |
| Moonbrand Pro | `pdt_0NpfEfcKj8jDoXclwUclN` | 299 / 339 / 259 | `plan: pro`, `monthly_credits: 6000` |
| Moonbrand Ultra | `pdt_0NpfEfkt6eapOOmbAhWR1` | 599 / 679 / 519 | `plan: ultra`, `monthly_credits: 15000` |
| Ricarica 1.000 crediti | `pdt_0NpfEfu9zBdtErVafssZn` | 50 / 59 / 45 | `kind: topup`, `credits: 1000`, `tier: standard` |
| Ricarica 1.000 crediti (Ultra) | `pdt_0NpfEg4W8jwBWhK3BVWiB` | 40 / 45 / 35 | `kind: topup`, `credits: 1000`, `tier: ultra` |

**Catalogo live creato il 15/10 sera** (stesso script, chiave live `DODO_PAYMENTS_LIVE_API_KEY` nel `.env` di sviluppo,
brand «Moonbrand.app» verificato; gli ID non servono in configurazione, l'API li riconosce dai `metadata`):

| Prodotto | ID live | EUR / USD / GBP |
|---|---|---|
| Moonbrand Start | `pdt_0NpobyF1kpgrXOdR23uEh` | 149 / 169 / 129 |
| Moonbrand Pro | `pdt_0NpobyNrS27a46fwPWQp0` | 299 / 339 / 259 |
| Moonbrand Ultra | `pdt_0NpobydrOtnDx3tEjLwol` | 599 / 679 / 519 |
| Ricarica 1.000 crediti | `pdt_0NpobynShmctQp9JtedQi` | 50 / 59 / 45 |
| Ricarica 1.000 crediti (Ultra) | `pdt_0NpobywbI4q86mODSYtsI` | 40 / 45 / 35 |

Webhook di test `ep_3KeJyXX9BLIMF1zrQqKMIONT2lg` → `https://collaudo-api.moonbrand.app/v1/webhooks/dodo` (tunnel verso
l'API locale), eventi del punto sotto. Chiave API, ambiente e chiave di firma sono nel `.env` dell'API
(`DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_ENV=test_mode`, `DODO_PAYMENTS_WEBHOOK_KEY`).

Il modulo dei pagamenti oggi parla con Paddle; la logica attorno (crediti, blocco dei lavori, rimborsi, abbonamenti
doppi, schermate dello studio) resta. Si riscrive la parte che parla col fornitore. Dodo somiglia a Paddle più di
Stripe: stessi modi di cambio piano (salendo `prorated_immediately_keep_cycle`, che addebita la differenza per il tempo
che resta e non sposta il rinnovo; scendendo `do_not_bill`), stato `on_hold`, portale clienti.

**Fatto il 15/10** (branch `collaudo`, non ancora committato): modulo `billing` riscritto su Dodo (`dodo-api.ts` con l'SDK
`dodopayments`, `dodo-webhook.ts`, `routes.ts`), migration `20261015100000_dodo.sql` (le due di Paddle tolte dal repo e dal
DB di sviluppo, dove è applicata la nuova), studio senza Paddle.js: il checkout è un redirect alla pagina di Dodo e si torna
su `/abbonamento` (componente `billing-return`, dentro lo shell), dove la modale dei pagamenti aspetta il webhook e poi
si torna alla pagina di partenza (acquisto in sospeso in `localStorage`, chiave `mb-pagamento`, valido un'ora).
Nell'onboarding il pagamento parte appena il brand è creato (stile e prime idee si preparano sul server) e torna su
`/assistente`; dalla pagina di Dodo si può rinunciare (`cancel_url`: si torna dove si era, senza aspettare niente). La pagina `/abbonamento`
non è più raggiungibile da fuori (i link di Dodo per la carta portano al suo portale, non a noi).

**API** (`moonbrand-be/moonbrand-api/src/modules/billing/`), con l'SDK `dodopayments` (`environment: 'test_mode'` in
collaudo, `live_mode` in prod):

- [x] `paddle-api.ts` → `dodo-api.ts`:
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
- [x] `paddle-webhook.ts` → `dodo-webhook.ts` su `POST /v1/webhooks/dodo`. Firma secondo lo standard Standard Webhooks
  (header `webhook-id`, `webhook-timestamp`, `webhook-signature`, serve il body grezzo), verificata con
  `client.webhooks.unwrap()` e la chiave `DODO_PAYMENTS_WEBHOOK_KEY`. Dodo ritenta fino a 8 volte: eventi già visti
  scartati per `webhook-id`. Eventi:
  - `payment.succeeded` (ricariche; primo pagamento e rinnovi dell'abbonamento), `payment.failed`;
  - `subscription.active`, `subscription.renewed` (crediti del periodo nuovo), `subscription.plan_changed`,
    `subscription.updated`, `subscription.on_hold` (banner «Aggiorna la carta», poi blocco), `subscription.cancelled`,
    `subscription.expired`;
  - `refund.succeeded` (crediti tolti col rimborso), al posto degli `adjustment.*`;
  - `dispute.opened` / `dispute.lost`: crediti bloccati, come un rimborso.
- [x] Verificato il 15/10 in modalità test: i `metadata` della sessione arrivano sia sul pagamento sia sull'abbonamento,
  e il pagamento porta `subscription_id`, `checkout_session_id` e `service_periods` (il periodo pagato; in una salita di
  piano è lo stesso periodo, con `proration_factor`). La sessione si salva comunque (`dodo_checkouts`) come riserva.
  I parametri nostri nel `return_url` restano e Dodo aggiunge `status`, `payment_id`/`subscription_id`, `email`.
- [x] Prezzi riconosciuti dai `metadata` dei prodotti (`plan`, `monthly_credits`, `kind`, `credits`, `tier`), come oggi
  dai `custom_data`: nessun id in configurazione.
- [x] Config: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENV` al posto delle `PADDLE_*`;
  `BILLING_ENFORCED` resta.
- [x] Migration `20261015100000_dodo.sql` (applicata in dev il 15/10; le due di Paddle tolte): `dodo_customer_id`,
  `dodo_subscription_id`, `dodo_payment_id` sui movimenti dei crediti, tabella degli eventi ricevuti per `webhook-id`,
  stati di Dodo (`pending`, `active`, `on_hold`, `paused`, `cancelled`, `expired`, `failed`). Il trigger contro le
  cancellazioni resta uguale. Movimenti dei crediti: `kind` `refund` e `dispute` al posto di `adjustment`.
- [x] `credits/balance.ts`, `brands/routes.ts`, `plugins/auth.ts`, `app.ts`: i punti che oggi nominano Paddle.

**Studio** (`moonbrand-studio`):

- [x] Niente più Paddle.js: il checkout è una pagina di Dodo, si apre con un redirect a `checkout_url` e si torna su
  `/abbonamento?esito=...`. La modale centrale con loader ed esito resta, ma legge l'esito al ritorno (aspettando il
  webhook). Dodo ha anche un checkout sovrapposto alla pagina: si valuta dopo, il redirect basta.
- [x] `core/billing/billing.service.ts`, `features/billing/*`, `plans/plan-dialog.ts`, `plan-picker.ts`,
  `onboarding/steps/plan-step.ts`, `profile/profile-page.ts`: togliere token client e chiamate a Paddle.
- [x] `moonbrand-shared` (`api/contract.ts`, `i18n/messages/plans.ts`): testi e tipi che nominano Paddle.

**Prove in modalità test** (carte di prova di Dodo):

- [x] primo abbonamento, ricarica, cambio piano su e giù con gli importi giusti (15/10, dall'API e dalla pagina di Dodo
  con la carta di prova: Start 181,78 € IVA compresa, salita a Pro 182,99 € = differenza per il tempo che resta, anteprima
  della discesa 0 € oggi e 149 € + IVA al rinnovo, ricarica 61 €; crediti 2.500 → 6.000 → 7.000);
- [x] il giro dallo studio nel browser (15/10 sera, con Claude in Chrome su https://45.14.185.228:4200, dove il
  certificato è accettato): banner «Attiva Start» → pagina di Dodo (nome del brand «Moonbrand.app», in italiano) →
  ritorno su `/abbonamento` → modale «Piano Start attivo, 2.500 crediti» → Impostazioni brand «Attivo · si rinnova il
  15 novembre»; rinuncia dalla pagina di Dodo (freccia + conferma) → `status=cancelled`, si torna dove si era senza
  modale. Con `STUDIO_URL=https://localhost:4200` il ritorno finisce su localhost: nel browser dell'estensione va
  riaperto sull'IP. Dodo non precompila l'indirizzo dei clienti già noti: lo chiede a ogni checkout;
- [x] rinnovo (15/10, anticipato con `subscriptions.update(id, { next_billing_date })` a +90 s: in test mode è
  l'unico modo): `payment.succeeded` con `service_periods` + `subscription.renewed` → periodo vecchio chiuso, 2.500
  crediti del periodo nuovo;
- [x] rinnovo non pagato (15/10: carta `4000 0000 0000 0341` messa dal portale, rinnovo anticipato): `payment.failed` +
  `subscription.on_hold` diretto (nessun periodo di grazia nelle impostazioni di Dodo), banner «aggiorna la carta»
  nello studio, crediti del periodo già pagato ancora spendibili; dal portale «Aggiorna il metodo di pagamento» →
  pagina «Paga le spese in sospeso» 181,78 € → `payment.succeeded` (`is_update_payment_method`, senza
  `service_periods`) + `subscription.active` → piano di nuovo attivo. Due difetti trovati e corretti nel webhook: il
  solo cambio di carta genera un `payment.succeeded` a 0 € che caricava altri 2.500 crediti, e l'arretrato pagato dal
  portale non porta `service_periods`. Regola di adesso: crediti del piano con il periodo di servizio del pagamento,
  oppure con il periodo corrente dell'abbonamento se l'importo è maggiore di zero; a zero niente crediti;
- [x] disdetta a fine periodo dal portale (15/10: arriva solo `subscription.updated` con
  `cancel_at_next_billing_date`) → «Disdetto · attivo fino al 15 novembre»; revoca dal portale → data di disdetta
  azzerata; disdetta immediata → `cancelled`, banner «piano non attivo», il piano del brand resta l'ultimo pagato;
  riattivazione dal banner → abbonamento nuovo al posto del vecchio, 2.500 crediti;
- [x] rimborso: crediti tolti (15/10, rimborso della ricarica via API: −1.000; nello studio compare tra i consumi);
- [ ] rimborso di un abbonamento dalla dashboard: oggi toglie solo i crediti in proporzione, l'abbonamento su Dodo
  resta attivo; decidere se un rimborso totale deve anche chiuderlo;
- [x] abbonamento doppio (15/10: due sessioni di checkout aperte in due schede, pagate entrambe): il secondo disdetto
  entro un secondo e rimborsato per intero (`refund.succeeded` senza movimenti), crediti una volta sola;
- [x] clienti esteri (15/10 sera, pagamenti veri dallo studio con l'utenza collaudo in francese e in inglese: la pagina
  di Dodo segue la lingua dell'utenza, `force_language`): Francia privato 299 € + TVA 20% = 358,80 €; Francia azienda
  con partita IVA valida (controllo VIES) 299 € senza imposta, fattura «Amount of Tax subject to Reverse Charge» con la
  partita IVA del cliente; Regno Unito privato: valuta passata da sola a sterline, 129 £ + VAT 20% = 154,80 £; Regno
  Unito azienda con VAT number valido: IVA comunque addebitata, 259 £ + 51,80 £ = 310,80 £ (Dodo vende con la sua
  società inglese, Dodope Payments Limited: fornitura interna). Le fatture (solo in inglese) portano «From Dodope
  Payments Limited, Loughton, VAT 495 1783 48» per tutti, anche per i clienti francesi. Crediti giusti in ogni caso
  (2.500 Start, 6.000 Pro), l'importo in sterline resta solo nell'evento salvato. USA non provato (dollari sul
  catalogo da verificare);
- [ ] rinvio manuale di un evento dalla dashboard di Dodo: stesso `webhook-id`, nessun credito doppio;
- contestazioni (dispute): in test mode non si simulano, resta la lettura del codice.

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
- [x] Deploy del sito (`npm run deploy` in `moonbrand-website`): fatto il 15/10 sera, online senza Paddle.

## 4. Produzione (dopo l'ok di Dodo e le prove)

- [x] Catalogo live (15/10 sera, tabella al punto 1): tre prodotti in abbonamento mensile (Start, Pro, Ultra) e le due
  ricariche, `tax_category: saas`, IVA esclusa, stessi `metadata`, durata 10 anni, prezzi fissi in USD e GBP.
- [ ] Portale clienti: disdetta a fine periodo e cambio carta; il cambio piano passa dallo studio (Allow Subscription
  Updates spento).
- [x] Endpoint dei webhook live (15/10 sera, via SDK): `ep_3KkK87KW1f4vW8QR4GiCwGJrNDJ` →
  `https://studio.moonbrand.app/v1/webhooks/dodo`, stessi 13 eventi di quello di test; la chiave di firma va nel `.env`
  di prod come `DODO_PAYMENTS_WEBHOOK_KEY`.
- [x] Migration in prod, `.env` dell'API con le chiavi live e `BILLING_ENFORCED=false` (15/10 sera, script
  `prod_dodo.sh` lanciato dall'utente), merge di `collaudo` su `master` (`0a68ed6`) e `bash deploy.sh`: in produzione
  dal 15/10 sera. Il worker in prod resta `moonbrand-ai`; le cartelle del motore nuovo sono su master ma non girano.
- [ ] Prova con una carta vera e rimborso.
- [ ] Blocco acceso: `BILLING_ENFORCED=true` nel `.env` di prod e riavvio dell'API. Deciso il 15/10 sera: nessun avviso con
  una data; chi non ha un piano vede il banner «Attiva» e i lavori a pagamento si fermano finché non paga. Le utenze
  particolari hanno il **piano Ultra in omaggio**: `FREE_ULTRA_EMAILS` (email separate da virgola, come `ADMIN_EMAILS`),
  codice in `billing/free-plan.ts`. Per loro ogni brand conta come un abbonamento Ultra attivo senza pagamento (15.000
  crediti al mese di calendario, più quelli dell'admin), `GET /v1/me` dice `freePlan: true`, lo studio salta il passo
  del piano nell'onboarding, mostra «In omaggio · Ultra senza pagamento» nelle Impostazioni brand senza cambio piano né
  portale, e checkout, cambio piano, ricariche e portale rispondono 409 `FREE_PLAN`. Un brand di quelle utenze con un
  abbonamento vero su Dodo resta pagato. Cambiare la lista vuol dire cambiare il `.env` e riavviare l'API.

## Se Dodo dice di no

Stripe Managed Payments (`PAGAMENTI-STRIPE.md`): ha un codice fiscale per l'AI as a Service che cita i generatori di
immagini. Il lavoro sul codice si sposta quasi uguale, cambia solo il fornitore.

## Da decidere

- Clienti di oggi senza piano: avviso con una data (per esempio 30 giorni) e poi blocco, più il piano regalato
  dall'admin per partner e prove.
- Piani annuali: rimandati.
