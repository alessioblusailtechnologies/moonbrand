# Termini e privacy per i pagamenti con Paddle

Stato al 13 ottobre 2026. I documenti sono su iubenda (ID in `moonbrand-website/src/data/iubenda.ts`, piano
Advanced); il sito li scarica alla build, quindi dopo ogni modifica su iubenda serve un deploy del sito. L'API di
iubenda tiene in cache qualche minuto: la pagina pubblica `iubenda.com/termini-e-condizioni/<id>` si aggiorna subito.

Cosa chiede Paddle per approvare il sito (developer.paddle.com, requisiti per i venditori):

- termini, politica di rimborso e privacy **pubblici** (senza login);
- nei termini il **nome legale** del venditore e la frase che Paddle è il rivenditore e **merchant of record**;
- una politica di rimborso con una finestra **tra 14 e 90 giorni**, mai «nessun rimborso»;
- per l'AI generativa: uso consentito, responsabilità dell'utente, diritti sui risultati, segnalazioni, moderazione,
  avviso sull'accuratezza;
- nella privacy Paddle tra i destinatari dei dati.

## Come è fatto

iubenda non permette clausole libere nei termini (solo un campo «documento di riferimento»). Quindi:

- **Sul sito, nostre**: le condizioni di vendita (Paddle merchant of record, piani e crediti, disdetta e rimborsi,
  contenuti generati con l'AI) in fondo a `/termini/`, `/en/terms/`, `/fr/conditions/` (sezione `#vendita`, testi
  in `src/i18n/*.ts` → `saleTerms`, componente `Legal.astro`) e la politica di rimborso su `/rimborsi/`,
  `/en/refunds/`, `/fr/remboursements/` (`Refunds.astro`, testi in `refunds`).
- **Su iubenda, termini** (fatto il 13/10, tutte e tre le lingue):
  - Pubblico di riferimento: **aperto** (consumatori e aziende), con l'avvertenza in alto e la clausola sui
    territori soggetti a sanzioni; prima era «solo non consumatori».
  - Modello di business: **diritto di recesso UE** e **diritto di cancellazione UK** accesi, per servizi a prezzo
    fisso, senza eccezioni.
  - Incorporazione di altri documenti: tre righe, una per lingua, che richiamano le condizioni in fondo alla pagina
    dei termini e la politica di rimborso. Il campo è **uno solo per tutte le lingue** (vince l'ultimo salvataggio):
    per cambiarlo si modifica e si salva una lingua, poi si risalvano le altre perché si rigenerino.
- **Su iubenda, privacy** (fatto il 13/10): servizio **Paddle** aggiunto, «Gestione dei pagamenti».

## Da controllare

- [ ] Nella privacy il fornitore precompilato è «Paddle.com Inc»: per i venditori europei il contratto è con
  Paddle.com Market Ltd (Regno Unito). Si cambia dalla matita del servizio, se il commercialista o Paddle lo chiedono.
- [ ] Deploy del sito, poi aprire `/termini/` (in fondo «Condizioni di vendita tramite Paddle…»), `/rimborsi/` e
  `/privacy/` nelle tre lingue, senza login.
- [ ] Paddle chiede anche un recapito di assistenza: c'è `info@moonbrand.app` in Contatti; se nella verifica chiedono
  un telefono, va aggiunto lì.
- [ ] Nei termini di iubenda l'email del titolare è `info@blusailtechnologies.com`, sul sito `info@moonbrand.app`:
  vanno bene tutte e due, ma se si vuole un solo recapito si cambia in iubenda → Titolare.
