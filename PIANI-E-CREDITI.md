# Piani e crediti: costi misurati, margini e proposte

Stato al 6 ottobre 2026, dai primi giri in produzione. 1 credito = 1 centesimo di dollaro di costo vero (Claude più
strumenti); piani e crediti sono per brand. Cambio usato: circa 0,87 € per dollaro.

## Quanto costa un contenuto

Dai primi tre contenuti fatti in chat in produzione, con tutti i turni della conversazione (ritocchi compresi):

| Contenuto | Turni di chat | Crediti |
|---|---|---|
| Post (Blusail, LinkedIn + Instagram) | 4 | 123 |
| Carosello (Blusail) | 3 | 134 |
| Video (Velia, senza clip generate) | 3 | 177 |

- Quasi tutto è Claude: in media 41 crediti per turno di chat, 2 di strumenti.
- Strumenti: immagine generata ≈ 10 crediti, controllo con Gemini ≈ 1, musica di un video ≈ 6,5, export su Lambda < 1.
- Onboarding e saluti del mattino sono gratis per il cliente e non entrano nel conto.

Cosa sposta i numeri:

- **Clip generate** (non ancora usate): ≈ 13 crediti al secondo. Un video con 15 secondi di clip arriva a 350-400
  crediti. Il tetto per conversazione è 3 $, cioè 300 crediti.
- **Ritocchi**: ogni turno di chat ≈ 40 crediti.
- **Campione piccolo**: tre contenuti. Da rifare con un paio di settimane di uso vero, distinguendo le domande in chat
  che non diventano un contenuto.

## Piani di oggi

| Piano | Prezzo | Crediti | Prezzo del credito |
|---|---|---|---|
| Start | 149 € | 2.500 | 5,96 c |
| Pro | 299 € | 6.000 | 4,98 c |
| Ultra | 599 € | 15.000 | 3,99 c |

Cosa ci sta in un mese, con i costi qui sopra:

| Piano | Solo post | Solo video | Un mix realistico |
|---|---|---|---|
| Start | ~20 | ~14 | 12 post + 2 caroselli + 2 video |
| Pro | ~50 | ~33 | 16 post + 4 caroselli + 4 video ≈ 3.200 crediti (ne avanza metà) |
| Ultra | ~120 | ~85 | un brand che pubblica ogni giorno su più canali, video compresi |

## Margini se il brand consuma tutti i crediti

| Piano | Prezzo | Costo vero | Margine | Margine % | Prezzo ÷ costo |
|---|---|---|---|---|---|
| Start | 149 € | 25 $ ≈ 22 € | ≈ 127 € | ≈ 85% | ≈ 6,8× |
| Pro | 299 € | 60 $ ≈ 52 € | ≈ 247 € | ≈ 83% | ≈ 5,7× |
| Ultra | 599 € | 150 $ ≈ 130 € | ≈ 469 € | ≈ 78% | ≈ 4,6× |

Ricariche (1.000 crediti = 10 $ ≈ 8,7 €): a 50 € margine ≈ 83%, a 40 € (Ultra) ≈ 78%.

Fuori dal conto:

- **IVA**: con prezzi IVA inclusa a un privato in Italia (22%) il netto è Start 122 € (82%), Pro 245 € (79%),
  Ultra 491 € (73%). Ad aziende con prezzi IVA esclusa i margini restano quelli della tabella.
- **Pagamenti**: Stripe ≈ 1,5% + 0,25 € per carta europea, 2,5-9 € al mese per piano.
- **Gratis per il cliente**: onboarding ≈ 1-1,5 $ una volta; saluti del mattino ≈ 3 crediti al giorno, ≈ 1 € al mese
  per brand.
- **Costi fissi**: Hetzner, Supabase, Resend, Zernio per i profili collegati (dipende dal loro piano). Si dividono su
  tutti i brand.
- **Claude**: il costo è quello che riporta Claude Code, a listino API. Se in produzione si paga in altro modo, il
  costo vero cambia.

Con l'uso visto finora un Pro consuma circa metà dei crediti: il margine reale sale verso il 90%.

## Proposta: Start che regge almeno 4 video al mese

Lo Start è il piano d'ingresso: deve permettere almeno 4 video più un ritmo di post.

| Mix mensile | Crediti |
|---|---|
| 4 video senza clip (~180) + 12 post (~120) | ≈ 2.200 |
| 4 video con un po' di clip (~300) + 12 post | ≈ 2.650 |
| 4 video con molte clip (~400) + 12 post | ≈ 3.050 |

3.000 crediti coprono 4 video e 3 post a settimana, anche con qualche clip.

### A. Solo lo Start a 3.000

| Piano | Prezzo | Crediti | Prezzo del credito | Margine a crediti finiti |
|---|---|---|---|---|
| Start | 149 € | 3.000 | 4,97 c | ≈ 82% |
| Pro | 299 € | 6.000 | 4,98 c | ≈ 83% |
| Ultra | 599 € | 15.000 | 3,99 c | ≈ 78% |

Il credito costa uguale su Start e Pro: chi passa al Pro non ha più lo sconto sul credito.

### B. Tutti un po' su (consigliata)

| Piano | Prezzo | Crediti | Prezzo del credito | Margine a crediti finiti |
|---|---|---|---|---|
| Start | 149 € | 3.000 | 4,97 c | ≈ 82% (oggi 85%) |
| Pro | 299 € | 7.500 | 3,99 c | ≈ 78% (oggi 83%) |
| Ultra | 599 € | 18.000 | 3,33 c | ≈ 74% (oggi 78%) |

Resta lo sconto per chi sale di piano. Con l'uso reale i margini restano sopra l'80%.

## Come si applica

I crediti di ogni piano sono in `SUBSCRIPTION_PLANS` (`moonbrand-shared/src/domain/subscription.ts`): si cambia lì e si
fa il deploy. I numeri nuovi valgono subito per tutti i brand, sul mese in corso.
