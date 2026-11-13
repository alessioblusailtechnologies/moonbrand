# Piano: pubblicità (ads) via Zernio

> **13/11: cambio di ordine.** Si parte da **Google Search**, poi **OpenAI Ads**. Meta (fasi 1-2 sotto) resta come era, dopo.
> La sezione 0 qui sotto vale per Google e OpenAI. Il resto del file è il piano Meta dell'11/11.

## 0. Google e OpenAI (13/11)

### 0.1 Come funziona Google via Zernio

- **La campagna si crea da noi**: `POST /v1/ads/create` crea campagna, gruppo e annuncio in una sola chiamata. Il cliente non apre Google Ads per crearla.
- **Su Google restano** l'account Google Ads del cliente col metodo di pagamento (la spesa la addebita Google, non passa da noi) e la revisione di Google (`pending_review` → `active`/`rejected`).
- Collegamento: `GET /v1/connect/googleads/ads?profileId&redirect_url` → `authUrl`, oppure `alreadyConnected` + `accountId`. Niente headless. Al ritorno: `connected=googleads&profileId&accountId&username`, o `error` (`google_ads_no_ad_accounts`, `missing_google_permissions`). Il developer token è di Zernio.
- Account pubblicitari: `GET /v1/ads/accounts?accountId=` → `accounts[]` con `id` (customer id senza trattini), `name`, `currency`, `accountStatus`, `selected`. Scrivere su un account con `selected: false` dà 403 `ad_account_not_selected`.
- Tipi: Search, Display (due immagini), PMax (nasce in pausa), Demand Gen (nasce in pausa). Obiettivi: solo `traffic`, `awareness`, `engagement`. Niente conversioni da questa chiamata.
- **Search**: `headline` + `additionalHeadlines` = 3-15 titoli da 30 caratteri; `body` + `additionalDescriptions` = 2-4 descrizioni da 90; `keywords` (stringhe o `{text, matchType}`), `linkUrl`, `countries` (default US!), `targeting.languages`, `budgetAmount` intero al giorno, `budgetType: daily`. `validateOnly` non c'è (501). Risposta: `ad._id`, `ad.status`, `ad.platformCampaignId`, `ad.platformAdSetId`, `ad.platformAdId`.
- Lettura: `GET /v1/ads/{adId}` (`status`, `configuredStatus`, `reviewStatus`, `rejectionReason`, `metrics`). I nomi dentro `metrics` non sono documentati: si normalizzano con più nomi possibili.
- Pausa: `PUT /v1/ads/campaigns/{platformCampaignId}/status` (`{status, platform}`, maiuscole/minuscole da verificare). Eliminazione: `DELETE /v1/ads/{adId}`; la campagna Google si cancella solo vuota (409 `invalid_resource_state`), quindi prima si mette in pausa.
- Nessun webhook ads per Google: stato e metriche si leggono con uno scheduler.
- Limiti: 15 chiamate al minuto per account. Budget minimi, `startDate`/`endDate` su Google e fatturazione non documentati: **la data di fine la facciamo rispettare noi** (lo scheduler mette in pausa la campagna passata la fine).

### 0.2 Cosa facciamo (fase G1, Google Search)

- **Dati**: `presenza.ad_connections` (collegamento pubblicitario per brand e piattaforma: account Zernio, account Google scelto, valuta, `lost`) e `presenza.ads` (bozze e campagne: `spec` jsonb con titoli, descrizioni, parole chiave, link, paesi, lingue; budget al giorno, date, stato, id Zernio e Google, metriche). Lo stesso schema serve per OpenAI.
- **Stati nostri**: `draft` → `in_review` → `active` / `paused` / `ended` / `rejected` / `failed` / `deleted`.
- **API** (`moonbrand-api/src/modules/ads/`): collegamento (`connect`, `confirm`, scelta account, scollega, simulato), bozze (crea, modifica, elimina), `launch`, `pause`, `resume`, elimina, `sync`. Scheduler ogni ora per stato e metriche, più la pausa a fine campagna.
- **Studio**: nuova sezione **Pubblicità** nel menu (`/pubblicita`): collegamento Google Ads, elenco delle campagne con stato e metriche (speso, impressioni, clic, CTR, CPC), editor della campagna Search con i contatori dei caratteri e «spesa massima», «Avvia» con conferma esplicita della cifra.
- **Niente chat** (decisione del 13/11): la pubblicità vive solo nella sezione Campagne, la chat non la propone e non la legge.
- **Collaudo**: `SIMULATE_SOCIAL` o prova gratuita → collegamento e campagne simulate (in revisione, dopo 1 minuto attiva con metriche finte). Poi una prova vera con un account Google Ads con carta: 1-2 € al giorno per 1 giorno.

Dopo G1: ricerca di città e province (`/v1/ads/targeting/search`), Display e PMax con la grafica generata dalla chat.

### 0.3 OpenAI Ads (fase O1)

- **Solo aziende con sede negli USA**; gli annunci girano in USA, Canada, Australia, Nuova Zelanda. Per i clienti italiani oggi non serve.
- Collegamento senza OAuth: `POST /v1/connect/openai-ads/credentials` con `apiKey` (creata in ChatGPT Ads Manager → Settings, pieni poteri) e `profileId`.
- `POST /v1/ads/create`: `headline` 3-50, `body` fino a 100, `linkUrl`, `imageUrl` (solo immagine), budget daily/lifetime minimo 1, solo paese, obiettivi `traffic`/`awareness`/`conversions`. `validateOnly` sì. Dopo la creazione si cambiano solo stato e budget.
- Riusa tabelle, rotte e pagina di G1 con `platform = 'openai'`: un pannello di collegamento con la chiave e un editor «scheda in chat» con l'immagine dalla cartella del brand. Mezza giornata-una giornata, quando ci sarà un cliente USA.

11/11/2026. Fonti: docs.zernio.com (ad-campaigns/create-standalone-ad, boost-post, list-ads, get-ad-tree; platforms/meta-ads con connect, manage-ads, targeting, analytics, reference; le pagine di TikTok, Google, LinkedIn, Pinterest, X, Reddit, Microsoft e OpenAI Ads; webhooks/ads; pricing/ads; pricing/billing) e l'integrazione Zernio che abbiamo già in `moonbrand-api/src/modules/social/`.

## 1. Cosa offre Zernio

| | Boost di un post già pubblicato | Annuncio con creatività nuova | Note |
|---|---|---|---|
| **Meta (FB+IG)** | sì | sì (immagine, video, carosello 2-10, più creatività, lead form, messaggi WhatsApp/Messenger/IG Direct, catalogo) | la più completa; c'è `validateOnly` |
| TikTok | sì (Spark Ads) | sì | budget minimo 20 $ al giorno per gruppo; `targeting.countries` obbligatorio |
| LinkedIn | sì (post della pagina aziendale) | sì (molti formati) | minimo 10 $ al giorno; targeting per professione |
| Pinterest | sì (Promoted Pin) | sì | minimo 5 $ |
| X | sì | sì (testo + website card) | serve l'account X di pubblicazione |
| Reddit | sì | sì | pixel obbligatorio; niente `validateOnly` |
| Google | no | Search, Display, PMax, Demand Gen | obiettivi: solo engagement, traffic, awareness |
| Microsoft | no | solo Search, solo traffic | |
| OpenAI (ChatGPT) | no | chat card con immagine | solo business USA |

**Chiamate principali**
- `POST /v1/ads/boost`: `accountId`, `adAccountId`, `name`, `goal`, `postId` (il nostro `zernio_post_id`) oppure `platformPostId`, `budgetAmount` + `budgetType` (daily/lifetime), `startDate`/`endDate`, `targeting`, `callToAction` + `linkUrl` (vanno insieme), `status`, `validateOnly` (solo Meta).
- `POST /v1/ads/create`: stessi campi più la creatività (`headline`, `body`, `imageUrl` oppure `video`, `callToAction`, `linkUrl`). Crea campagna, gruppo di inserzioni e annuncio in una sola chiamata.
- Lettura: `GET /v1/ads` restituisce gli annunci con le metriche. `GET /v1/ads/tree` restituisce campagna > gruppo > annuncio con `daily[]`. `GET /v1/ads/{adId}`.
- Ciclo di vita: `PUT /v1/ads/{adId}/status`, `PUT /v1/ads/campaigns/{id}/status` e `PUT /v1/ads/ad-sets/{id}/status` (body `{status, platform}`), `PUT /v1/ads/ad-sets/{id}` per il budget (ABO), `DELETE /v1/ads/campaigns/{id}` (body `platform`).
- Pubblico: `GET /v1/ads/targeting/search?accountId&q&dimension=geo|interest|…`, `POST /v1/ads/targeting/reach-estimate` (`lower`/`upper`, `estimateReady`).
- Account pubblicitari: `GET /v1/ads/accounts?accountId=` restituisce `id` (act_…), `currency`, `minimumDailyBudget`, `selectable`, `unusableReason`.
- Collegamento: `GET /v1/connect/facebook/ads?profileId&redirect_url&headless=true`. Se il collegamento Facebook esistente ha già `ads_management` + `ads_read`, il token viene riusato senza un nuovo OAuth. Altrimenti si ricollega.

**Regole che contano per noi**
- Il budget si esprime in unità intere della valuta dell'account pubblicitario (50 = 50 €), non in centesimi. Con `lifetime` senza data di fine la durata è di 7 giorni.
- **Targeting UE: `dsaBeneficiary` e `dsaPayor` sono obbligatori** (DSA), salvo un default impostato sull'account. I nostri clienti sono italiani, quindi li mandiamo sempre: il nome del brand in tutti e due.
- Meta riesamina ogni annuncio. Lo stato di consegna (`status`), l'interruttore (`configuredStatus`) e l'esito della revisione (`reviewStatus`: in_review, approved, rejected, with_issues) sono tre campi separati.
- Le chiamate non sono idempotenti: si manda `Idempotency-Key`, valida 24 h. Senza chiave, un boost identico ripetuto entro 10 minuti restituisce lo stesso annuncio.
- Un Instagram collegato con il solo Instagram Login non può fare pubblicità (`linked_account_required`): serve il collegamento Facebook/Meta Ads nello stesso profilo Zernio.
- Il metodo di pagamento sta sull'account pubblicitario, in Gestione inserzioni. Zernio non può aggiungerlo via API. **La spesa la paga il cliente direttamente a Meta**: non passa da noi. La documentazione non lo scrive in modo esplicito, va confermato nella fase 0.

**Webhook** (`POST /v1/webhooks/settings`, stessa firma HMAC che usiamo già)
- `ad.created` e `ad.updated`
- `ad.review.approved` e `ad.review.rejected` (payload: `adObject.adId`, `review.status`, `review.reasons[].message`)
- `ad.delivery_issue` e `ad.status_changed` (solo Meta)
- `campaign.budget.depleted` (solo TikTok)
- `ad_account.status_changed` (active, restricted, disabled, closed)
- `account.ads.sync_failed` e `account.ads.sync_recovered`
- `lead.received`

Arrivano a ogni sincronizzazione di Zernio, non in tempo reale.

**Costi Zernio**
- 0,01 $ al mese per annuncio attivo o in revisione, con i primi 500 inclusi. Nessuna percentuale sulla spesa.
- Senza carta sul nostro account Zernio, a 500 annunci attivi le chiamate ads falliscono con `ads_allowance_exceeded`.
- I piani legacy senza l'aggiunta ads ricevono `ads_addon_required`.

**Errori Meta da tradurre in messaggi chiari:** `ad_account_payment_required`, `ad_account_policy_not_accepted`, `verified_advertiser_required`, `budget_too_low`, `post_not_boostable`, `invalid_targeting`, `ad_account_unusable`, `insufficient_permissions`, `instagram_account_restricted`.

## 2. Cosa abbiamo già

- Client Zernio: `moonbrand-api/src/modules/social/zernio.ts`, base `https://zernio.com/api/v1`, chiave `ZERNIO_API_KEY`. Il profilo Zernio corrisponde al brand e si ritrova per nome.
- Canali collegati salvati in `presenza.brands.channels` (jsonb `ChannelState`). Collegamento headless con le scelte di Facebook, LinkedIn e Pinterest già gestite (`routes.ts`, `channel-connection.ts`, `channel-choice.ts`).
- Pubblicazioni in `presenza.publications`, con `zernio_post_id` e `post_url` per contenuto e canale: è proprio il `postId` che chiede il boost.
- Webhook `POST /v1/webhooks/zernio` (`webhooks.ts`): oggi gestisce solo `account.disconnected` e `account.connected`.
- Crediti: `credit_movements`, con 1 credito = 1 cent dei nostri costi.
- Tool della chat v4: `moonbrand-ai-v4/src/jobs/chat/moonbrand.ts` chiama `/v1/agent/*`. Il modello da seguire è `pubblicazione_proponi`.
- Contenuto pubblicato nello studio: `features/contents/content-page.html:18-44`, con l'esito per canale e il link «Apri il post».
- `SIMULATE_SOCIAL` per il collaudo.

Pubblicità oggi: niente.

## 3. Principi

1. **Soldi veri, sempre su conferma della persona.** L'AI propone una sponsorizzazione (obiettivo, budget, durata, pubblico, testo); la crea solo il pulsante «Sponsorizza» nello studio. Mai una creazione direttamente da un tool. È la stessa logica di `pubblicazione_proponi`.
2. **Semplice per chi non è del mestiere.** Tre obiettivi in linguaggio normale invece degli 11 di Meta, budget in euro, «spesa massima» sempre visibile. Le opzioni avanzate restano fuori dalla prima versione.
3. **Moonbrand non tocca la spesa.** Il cliente paga Meta sul suo account pubblicitario. I crediti non c'entrano con la spesa.
4. **Prima Meta, poi il resto.** Instagram e Facebook sono dove pubblicano tutti i nostri brand. Le altre piattaforme seguono lo stesso modello, con la stessa tabella e le stesse rotte (campo `platform`).

## 4. Fase 0: verifiche prima del codice (mezza giornata)

- [ ] `GET /v1/ads/accounts` con la nostra chiave: confermare che il nostro team ha le ads (niente `ads_addon_required`) e che è a consumo. Controllare la carta su Zernio.
- [ ] Su un brand di prova (Messina o collaudo) collegare Meta Ads con `GET /v1/connect/facebook/ads` e capire:
  - se il collegamento Facebook esistente viene riusato o serve un nuovo consenso;
  - cosa torna nella redirect (`accountId` del metaads, `step`, `connect_token`). Non è documentato;
  - se un post **Instagram** pubblicato con il nostro collegamento Instagram si può sponsorizzare con `postId`, o se servono `platformPostId` (id del media IG) e `instagramAccountId`. È il dubbio più grosso, perché il nostro Instagram passa da `webOnly()`, cioè probabilmente da Instagram Login.
- [ ] Boost con `validateOnly: true`, poi uno vero in `PAUSED` con il budget minimo, poi la cancellazione: leggere le risposte reali e i webhook che arrivano.
- [ ] Confermare che la spesa la addebita Meta al cliente (fattura di Meta sull'account pubblicitario, nessuna voce sul conto Zernio oltre agli 0,01 $).
- [ ] Verificare il formato di `status` nei PUT (l'esempio usa `paused` minuscolo, la creazione `PAUSED`).

Esito: una nota in fondo a questo file con le risposte vere. Le fasi dopo si adattano a quella.

## 5. Fase 1: sponsorizzare su Meta un post pubblicato

### 5.1 Dati (migration `presenza.ads`)

```sql
create table presenza.ads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,               -- utenza
  brand_id uuid not null references presenza.brands(id) on delete cascade,
  content_id uuid references presenza.contents(id) on delete set null,
  publication_id uuid references presenza.publications(id) on delete set null,
  platform text not null check (platform in ('meta')),   -- si allarga nelle fasi dopo
  kind text not null check (kind in ('boost','standalone')),
  goal text not null,                     -- nostro: reach | visits | messages
  zernio_ad_id text unique,
  platform_campaign_id text, platform_ad_set_id text, platform_ad_id text,
  ad_account_id text not null, currency text not null,
  budget_amount numeric not null, budget_type text not null check (budget_type in ('daily','lifetime')),
  starts_at timestamptz not null, ends_at timestamptz,
  targeting jsonb not null,               -- quello che abbiamo mandato
  link_url text, call_to_action text,
  status text not null,                   -- nostro: creating | in_review | active | paused | ended | rejected | failed | deleted
  configured_status text, review_status text, rejection_reasons jsonb,
  metrics jsonb, metrics_at timestamptz,  -- spend, impressions, reach, clicks, ctr, cpc, cpm
  error text, detail jsonb,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
```

- RLS come su `publications`: la persona legge solo le sue righe e non scrive niente direttamente.
- Collegamento pubblicitario per brand: una chiave nuova nella jsonb dei canali, `brands.channels.meta_ads = {accountId, adAccountId, adAccountName, currency, minimumDailyBudget, pageId, instagramAccountId, lost?}`. Si riusano `storeChannel`/`findChannel` e il flag `lost` dei webhook. Non è un canale di pubblicazione: il publisher e il catalogo dei canali lo devono ignorare (`SH/domain/catalog.ts`).
- Tipi condivisi in `moonbrand-shared/src/domain/ads.ts` (`Ad`, `AdGoal`, `AdStatus`, `AdTargeting`, `AdMetrics`) e contratto in `SH/api/contract.ts`.

### 5.2 API (`moonbrand-api/src/modules/ads/`)

Client: si estende `zernio.ts` con `adAccounts`, `connectAdsUrl`, `boost`, `ad`, `ads`, `setAdStatus`, `deleteCampaign`, `targetingSearch` e `reachEstimate`. Sempre `Idempotency-Key` = `ads.idempotency_key`.

| Rotta | Cosa fa |
|---|---|
| `POST /v1/brands/:id/ads/connect` | `authUrl` da `/connect/facebook/ads` (headless, `redirect_url` dentro `STUDIO_ORIGINS`) |
| `POST /v1/brands/:id/ads/confirm` | salva l'`accountId` metaads; se c'è un solo account pubblicitario `selectable` lo sceglie da solo, altrimenti lo restituisce per la scelta |
| `GET /v1/brands/:id/ads/accounts` / `POST …/ads/account` | elenco e scelta dell'account pubblicitario (valuta, budget minimo, motivo se non utilizzabile) |
| `DELETE /v1/brands/:id/ads/connection` | scollega |
| `GET /v1/brands/:id/ads/places?q=` | ricerca di luoghi (città, regioni, CAP) con `targeting/search`, `dimension=geo`, `countryCode=IT` di default |
| `POST /v1/contents/:id/ads/estimate` | stima della copertura (`reach-estimate`) più `validateOnly` del boost: dice in anticipo se il post è sponsorizzabile e se il pubblico va bene |
| `POST /v1/contents/:id/ads` | crea: riga `creating`, poi `boost` con `status: ACTIVE`, poi la riga con gli id e lo stato `in_review`. Gli errori Meta vanno in `error`/`detail` tradotti (§1) |
| `GET /v1/brands/:id/ads`, `GET /v1/ads/:id` | elenco e dettaglio con le metriche |
| `POST /v1/ads/:id/pause`, `…/resume` | `PUT /v1/ads/{adId}/status` (e la campagna, se l'abbiamo creata noi intera) |
| `DELETE /v1/ads/:id` | `DELETE /v1/ads/campaigns/{id}`: la campagna è nostra e contiene un solo annuncio |

Corpo del boost costruito da noi:
- `name`: «moonbrand · <brand> · <titolo contenuto> · <data>».
- `goal`: reach → `awareness`, visits → `traffic` (con `linkUrl` = sito del brand e `callToAction` LEARN_MORE o scelto), messages → `engagement` con `destinationType` INSTAGRAM_DIRECT o MESSENGER (da confermare nella fase 0).
- `budgetAmount` intero, `budgetType`, `startDate` e `endDate` (sempre presenti: niente sponsorizzazioni senza fine nella fase 1).
- `targeting`: `countries` o `cities` con raggio, `ageMin`/`ageMax`, `gender`, `interests` facoltativi.
- `dsaBeneficiary` e `dsaPayor` = nome del brand (o ragione sociale, se la abbiamo).

Controlli prima di creare:
- il canale `meta_ads` è collegato e non `lost`, con un account pubblicitario scelto;
- la pubblicazione è `published` su instagram o facebook con un `zernio_post_id`;
- il budget è almeno `minimumDailyBudget` (al giorno, o per giorno di durata se lifetime);
- la durata va da 1 a 90 giorni;
- non c'è già una sponsorizzazione attiva sullo stesso contenuto e canale (avviso, non blocco).

### 5.3 Stato e metriche

- **Webhook** (`webhooks.ts`):
  - `ad.review.approved` → `active`;
  - `ad.review.rejected` → `rejected` più `rejection_reasons`, email alla persona e avviso nello studio;
  - `ad.delivery_issue` → avviso;
  - `ad.status_changed` e `ad.updated` → stato ricalcolato con `GET /v1/ads/{adId}`;
  - `ad_account.status_changed` diverso da active → `meta_ads.lost` più email;
  - `account.ads.sync_failed` → nota nei log o nell'admin.

  Gli eventi vanno aggiunti alla sottoscrizione Zernio (`PRODUZIONE.md` §webhook). Deduplica su `id`.
- **Sincronizzazione metriche**: uno scheduler nell'API come `schedulePublishing`. Ogni ora, per i brand con annunci `in_review`, `active` o `paused`, chiama `GET /v1/ads?profileId&source=zernio&fromDate=<inizio>` e aggiorna `metrics`, `status` e `review_status`. Una risposta 202 (backfill) vuol dire «riprova più tardi»; su 429 rispetta `retryAfterSeconds`. Gli annunci finiti si sincronizzano un'ultima volta e poi si lasciano stare.
- Mappa degli stati: `reviewStatus` in_review → `in_review`; rejected → `rejected`; `status` active → `active`; paused/configured PAUSED → `paused`; completed o `endDate` passata → `ended`; cancelled → `deleted`.

### 5.4 Studio

- **Collegamento**: in Impostazioni > Canali una riga «Pubblicità Meta», sotto Facebook e Instagram. Il flusso è quello dei canali (redirect, `finish`, scelta dell'account pubblicitario con `channel-choice`). Se l'account non è utilizzabile, il messaggio dice cosa fare: «aggiungi un metodo di pagamento», «accetta le condizioni», con link a Gestione inserzioni.
- **Pulsante «Sponsorizza»** in `content-page.html`, accanto all'esito `published` di Instagram e Facebook. Apre un pannello laterale con:
  1. Obiettivo: «Farlo vedere a più persone», «Portare visite al sito», «Ricevere messaggi».
  2. Pubblico: luogo (città più raggio, oppure Italia), età e genere, interessi facoltativi. Si parte dalla sede del brand se la conosciamo.
  3. Budget e durata: al giorno × giorni, oppure totale. Mostra «spenderai al massimo X €», con il minimo dell'account già impostato.
  4. Stima della copertura (da `estimate`) e anteprima del post.
  5. «Sponsorizza per X €», con una riga chiara: «la spesa è addebitata da Meta sul tuo account pubblicitario».
- **Sezione «Pubblicità»** nel menu (`shell.ts` SECTIONS, nuova rotta): elenco delle sponsorizzazioni con stato, date, speso / budget, copertura, clic e costo per clic. Il dettaglio ha l'andamento giornaliero (`/ads/tree` con `timeIncrement=1`) e le azioni pausa, riprendi ed elimina. Nella pagina del contenuto, un badge «Sponsorizzato».
- i18n: area `ads` in `SH/i18n/messages/ads.ts` (it/en/fr) e chiavi `shell.*`.
- Admin: in `/admin/contenuti` o in una pagina nuova, l'elenco delle ads di tutti i brand con l'errore grezzo.

### 5.5 Chat (v4)

- Tool `sponsorizzazione_proponi({contenutoId, obiettivo, budget, tipoBudget, giorni, luogo?, eta?, genere?, interessi?, motivo})` in `moonbrand-ai-v4/src/jobs/chat/moonbrand.ts`. Chiama `POST /v1/agent/contents/:id/ad-proposal`, che salva la proposta sul turno, come `publish_requests`. Lo studio la mostra in chat come scheda con il pulsante «Sponsorizza», che apre il pannello già compilato. Il tool **non crea niente** e non spende niente.
- Tool `sponsorizzazioni_elenca` in sola lettura (stato e metriche), così la chat può rispondere a «come sta andando la sponsorizzazione?».
- Etichette degli step in `SH/ai/steps.ts` (`TOOL_STEPS`).
- Niente regole nel prompt oltre alla descrizione del tool, coerente con i «prompt semplici».

### 5.6 Costi e piani

- La spesa pubblicitaria è a carico del cliente su Meta e non entra nei crediti.
- La quota Zernio (0,01 $ per annuncio al mese, 500 inclusi) la assorbiamo noi: è trascurabile.
- Da decidere: le ads in tutti i piani o solo in quelli superiori (`plan` sulle utenze, controllo nella rotta di creazione).

### 5.7 Collaudo

- `SIMULATE_SOCIAL`: il collegamento simulato salva `meta_ads = {accountId:'sim_meta_ads', adAccountId:'act_sim', currency:'EUR', minimumDailyBudget:1}`. La creazione salva una riga `in_review`, che dopo 1 minuto passa ad `active` con metriche finte crescenti generate dallo scheduler. Senza mai chiamare Zernio.
- Prova vera sul collaudo con un account pubblicitario nostro: boost di 1 € al giorno per 1 giorno su un post di Messina, passando per revisione, approvazione, metriche, pausa ed eliminazione. Poi il merge su master (vedi branch collaudo/prod).
- Test API: costruzione del corpo del boost (DSA, budget, mappa obiettivi), mappa degli stati, gestione dei webhook con la firma, traduzione degli errori.

## 6. Fase 2: annunci con creatività nostra e altre piattaforme

- **Meta `POST /v1/ads/create`** per i contenuti non pubblicati: un contenuto moonbrand (immagine, carosello o video) diventa un annuncio con `headline`/`body`/`callToAction`/`linkUrl`. I file vanno caricati con `POST /v1/ads/images` o con un URL pubblico del bucket. Il formato `ad` (feed 1:1/4:5 e storia o reel 9:16) va generato dalla chat come un canale nuovo in `ContentFile.channel`, così l'AI può creare la creatività pensata per la pubblicità. Il tool `annuncio_proponi` segue la stessa logica di proposta e conferma.
- **TikTok Spark Ads** (boost dei TikTok pubblicati): collegamento `GET /v1/connect/tiktok/ads` con `accountId` del TikTok di pubblicazione; minimo 20 $ al giorno, quindi va detto chiaramente nel pannello.
- **LinkedIn** (post della pagina aziendale, minimo 10 $ al giorno) e **Pinterest** (Promoted Pin, minimo 5 $): riusano il token del collegamento di pubblicazione (`alreadyConnected`).
- Ogni piattaforma aggiunge una voce in `platform`, una chiave `<p>_ads` nei canali e la sua mappa di obiettivi e minimi. Le rotte restano le stesse.

## 7. Fase 3: dopo, se serve

- Lead form Meta (`lead_generation` più `lead.received` → contatti nello studio, email al brand).
- Regole automatiche (`ad_rule.triggered`, `automation.*`): «metti in pausa se il costo per clic supera X». La pagina per crearle via API non l'ho trovata, va cercata.
- Google (Search e PMax), X, Reddit, Microsoft, OpenAI: solo su richiesta dei clienti.
- Pubblici personalizzati e lookalike (`/v1/ads/audiences`), pixel e conversioni.
- App RN.

## 8. Decisioni aperte (dell'utente)

1. Pubblicità in tutti i piani o solo in alcuni? Un nostro sovrapprezzo o una commissione sulla spesa? Oggi è nulla, perché la spesa non passa da noi.
2. Gli obiettivi della fase 1 sono tre (copertura, visite, messaggi) o bastano i primi due?
3. Dopo Meta, prima TikTok o prima annunci Meta con creatività nostra?

## 9. Stima

| Fase | Lavoro |
|---|---|
| 0 verifiche | ½ giornata (serve un account pubblicitario Meta con carta) |
| 1 API + DB + webhook + scheduler | 2 giorni |
| 1 studio (collegamento, pannello, sezione, i18n) | 2 giorni |
| 1 chat + simulazione + collaudo | 1 giorno |
| 2 per piattaforma in più | ½-1 giornata ciascuna; creatività Meta 2 giorni |
