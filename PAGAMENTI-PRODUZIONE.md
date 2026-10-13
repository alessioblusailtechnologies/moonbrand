# Pagamenti con Paddle: cosa manca per la produzione

Stato al 13 ottobre 2026. In collaudo (branch `collaudo`) tutto gira sulla sandbox di Paddle: checkout, cambio di
piano con conferma, ricariche, portale, blocco dei lavori, rimborsi, abbonamenti doppi. Paddle è il venditore
(merchant of record): incassa, applica le tasse ed emette le fatture; Blusail fattura solo a Paddle, una volta al mese.

Come funziona, in breve: lo studio apre il checkout di Paddle con brand e utenza nei `custom_data`; il webhook
`POST /v1/webhooks/paddle` scrive l'abbonamento del brand (`brand_subscriptions`) e i crediti pagati
(`credit_movements`); l'API riconosce i prezzi del catalogo dai loro `custom_data`, quindi nessun id di prezzo va in
configurazione. Con `BILLING_ENFORCED=true` un lavoro a pagamento parte solo con un abbonamento vivo e crediti rimasti.

## 1. Decisioni da prendere prima

- [ ] **I clienti di oggi senza piano.** Accendendo `BILLING_ENFORCED` in produzione i brand senza abbonamento si
  fermano subito (banner «Attiva il piano»). Serve una regola: un invito a pagare con una data e il blocco da quel
  giorno, un periodo gratis, oppure un piano regalato dall'admin (oggi non esiste: andrebbe fatto, vedi sotto).
- [ ] **Le ricariche dopo una disdetta.** Oggi le ricariche non usate di un abbonamento finito tornano se il brand si
  riabbona. I termini dicono «restano finché il piano è attivo»: o si accetta così o si azzerano alla disdetta.
- [ ] **Prezzi in dollari e sterline.** Nel catalogo della sandbox: Start 169 $ / 129 £, Pro 339 $ / 259 £, Ultra
  679 $ / 519 £, ricarica 59 $ / 45 £ (Ultra 45 $ / 35 £). Da confermare o cambiare prima di ricrearli in live.
- [ ] **Piani annuali.** Non ci sono. Se si vogliono, vanno aggiunti al catalogo (e i crediti restano mensili o no).

## 2. Account Paddle vero (vendors.paddle.com)

- [ ] Account approvato come **Private company** (Blusail Technologies S.r.l.s.), con la verifica della società.
  Paddle controlla il sito prima di attivarlo: prezzi visibili, termini, politica di rimborso, Paddle indicato come
  rivenditore (sezione 5).
- [ ] **Dominio approvato**: `studio.moonbrand.app` (e `moonbrand.app` se il checkout si aprirà anche dal sito).
- [ ] **Default payment link**: `https://studio.moonbrand.app/abbonamento` (Checkout → Checkout settings).
- [ ] **Catalogo** ricreato uguale alla sandbox, con gli stessi `custom_data` (l'API cerca i prezzi da lì):
  - tre prodotti `Moonbrand Start / Pro / Ultra`, `tax_category` `saas`, un prezzo mensile ciascuno, `tax_mode`
    `external` (IVA esclusa), quantità 1-1, `custom_data` `{"plan":"start|pro|ultra","monthly_credits":2500|6000|15000}`
    su prodotto e prezzo;
  - un prodotto ricarica con due prezzi una tantum, quantità 1-10: `{"kind":"topup","credits":1000,"tier":"standard"}`
    a 50 € e `{"kind":"topup","credits":1000,"tier":"ultra"}` a 40 €;
  - le eccezioni per paese (USA, Regno Unito) decise al punto 1.

  Si può fare dal plugin di Paddle per Claude Code con il server `paddle-live` (si autorizza dal browser; i permessi
  di scrittura vanno dati in Paddle → Connectors → MCP), con le stesse istruzioni usate per la sandbox.
- [ ] **Destinazione dei webhook**: `https://studio.moonbrand.app/v1/webhooks/paddle`, eventi `subscription.*`
  (created, activated, updated, canceled, past_due, paused, resumed), `transaction.completed`,
  `transaction.payment_failed`, `customer.created`, `customer.updated`, `adjustment.created`, `adjustment.updated`.
  Copiare il **secret** (`pdl_ntfset_...`).
- [ ] **Chiave API** live (Developer tools → Authentication) con lettura e scrittura su prezzi, prodotti, abbonamenti,
  clienti, transazioni e adjustment. Paddle mostra la chiave intera una volta sola: copiarla tutta.
- [ ] **Token lato client** live (`live_...`).
- [ ] Nome sul estratto conto della carta (Checkout settings, massimo 10 caratteri): `MOONBRAND`.
- [ ] Nome mostrato nelle email di Paddle: «Moonbrand», email di supporto `info@moonbrand.app`; logo al posto del nome
  chiedendolo al supporto (PNG, massimo 500 KB).

## 3. Server di produzione

- [ ] **Migration**, dal server, nell'ordine (procedura in OPERAZIONI.md, «Migration del DB»), e annotarle lì:
  1. `20261013100000_paddle.sql` (abbonamenti, eventi Paddle, colonne dei crediti pagati);
  2. `20261013160000_paddle_delete_guard.sql` (niente cancellazioni di brand e utenze con abbonamento vivo).
- [ ] **`.env` dell'API** (`moonbrand-be/moonbrand-api/.env`), poi riavvio dell'API:

  ```
  PADDLE_ENV=production
  PADDLE_API_KEY=<chiave live>
  PADDLE_CLIENT_TOKEN=<live_...>
  PADDLE_WEBHOOK_SECRET=<pdl_ntfset_... della destinazione live>
  BILLING_ENFORCED=false
  ```

  `BILLING_ENFORCED=true` solo quando la regola per i clienti di oggi è decisa (punto 1) e il primo pagamento vero è
  andato bene.
- [ ] **Merge** di `collaudo` su `master` e `bash deploy.sh` (API, worker e studio).
- [ ] **Prova con una carta vera** e un piano, poi rimborso dalla dashboard di Paddle: devono arrivare abbonamento,
  crediti e, col rimborso approvato, i crediti tolti.

## 4. Codice che manca

- [ ] **Piano regalato o prova dall'admin**, se serve per i clienti di oggi (punto 1): oggi l'admin aggiunge crediti
  ma un brand senza abbonamento resta fermo con il blocco acceso.
- [ ] **App React Native** (`moonbrand-app`): non vende niente (giusto: niente pagamenti in-app per le regole di Apple
  e Google), ma va controllato come mostra i lavori rifiutati con 402 `PLAN_REQUIRED` e `NO_CREDITS` e, nel caso,
  rimandare allo studio per attivare il piano o ricaricare. I due codici hanno già i testi in
  `moonbrand-shared/src/i18n/messages/errors.ts`; l'app non è ancora tradotta.
- [ ] **Sito** (`moonbrand-website`, `Pricing.astro`): prezzi ed esempi vecchi. Aggiornare a 149 / 299 / 599 € al mese
  IVA esclusa e alla ricarica, e dire che il pagamento passa da Paddle. Il deploy del sito lo lancia l'utente.
- [ ] **Eliminazione di brand o utenze**, quando si farà: prima `PaddleApi.cancelNow` sull'abbonamento del brand, poi la
  cancellazione (il database la rifiuta finché l'abbonamento è vivo).
- [ ] **Doppia disdetta dei doppioni**: quando un abbonamento doppio arriva con due eventi, la disdetta parte due volte e
  la seconda finisce nel log come errore di Paddle. Innocuo; da silenziare se dà fastidio.

## 5. Legale e testi

- [ ] **Termini su iubenda** (it, en, fr): Paddle come rivenditore e i termini dell'acquirente di Paddle; vendita anche
  ai privati (oggi dicono «solo B2B»); recesso di 14 giorni per i privati dell'Unione Europea, con la rinuncia
  quando il servizio comincia; disdetta prima del rinnovo; nessun rimborso del periodo; scendendo di piano niente
  rimborso, i crediti restano fino al rinnovo; crediti del piano che scadono a fine periodo, ricariche che restano
  finché il piano è attivo.
- [ ] **Privacy su iubenda**: aggiungere Paddle tra i servizi (dati di pagamento e fatturazione).
- [ ] **Commercialista**: una fattura al mese a Paddle.com Market Ltd (Regno Unito), operazione non soggetta (art. 7-ter),
  per il versamento o per il lordo con le commissioni a parte; la scelta è sua.

## 6. Da provare ancora (in sandbox, prima o durante il collaudo)

- [ ] Disdetta dal portale di Paddle: «Disdetto · attivo fino al …», il brand lavora fino a fine periodo, poi si ferma.
- [ ] Ritiro della disdetta dal portale.
- [ ] Riattivazione di un brand disdetto (checkout nuovo sullo stesso brand).
- [ ] Rinnovo (simulazione `subscription_renewal` di Paddle o abbonamento lasciato rinnovare): crediti del periodo nuovo.
- [ ] Rinnovo non pagato (carta di prova che rifiuta): banner «Aggiorna la carta», poi blocco se Paddle chiude.
- [ ] Discesa di piano dopo la correzione: «Oggi non paghi niente», nessun credito di rimborso su Paddle.
- [ ] Un cliente fuori dall'Unione Europea (USA, Regno Unito): valuta e tasse nel checkout.
