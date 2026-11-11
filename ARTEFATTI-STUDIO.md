# Artefatti nello studio: pannello a destra

## Stato (10/11/2026): fatto, fasi 1-3 insieme, sul branch collaudo

- **Studio**: `features/chat/artifact-panel.*` (pannello con menu, versioni e un visualizzatore per tipo),
  `features/chat/artifacts.ts` (contenuti, proposte e file in una lista sola), `chat-page` a due colonne con il bordo da
  trascinare (larghezza in localStorage); a pannello chiuso la chat è una colonna centrata di 880 px con il suo margine,
  a pannello aperto prende tutto lo spazio rimasto. Nel filo le card stanno in colonna (l'ultima versione di ogni file);
  oltre 4 per turno se ne vedono 3 e il resto si apre con «Mostra altri n». `?artefatto=<id>` (i contenuti come
  `content-<id>`), apertura automatica degli elementi nuovi mentre si segue il turno, foglio a tutto schermo sotto i
  900 px (X o maniglia trascinata in giù). Nella topbar, al posto della striscia «salvati», la tendina «Generati · n»
  come in Claude: i post in cima, poi immagini, video, audio, documenti e pagine, ognuno dal più recente; un clic apre
  l'anteprima. Il menu nel pannello ha gli stessi gruppi. `mb-content-preview` ha l'input `stacked` per il pannello.
- **Segnaposto**: nella chat solo per i passaggi ancora in corso (`pendingFromSteps(steps, { running: true })`); finito
  il passaggio, al loro posto arriva la card.
- **Shared**: `domain/artifact.ts`; `toolMedia` riconosce i tool con o senza prefisso MCP (v1-v4), `salva` e `file`,
  audio, `esporta_video`, `migliora`, `mostra`, `bash` di Pi. Corretto anche il riconoscimento di `salva_contenuto` in
  chat e segnaposto (prima i contenuti del v3/v4 comparivano solo a fine turno).
- **Worker v4**: `step.media` ora c'è (prima nel v3 e nel v4 mancava, quindi i segnaposto non comparivano mai);
  `lib/artifacts.ts` registra gli artefatti; tool `mostra`. Il v3 non registra artefatti: col rollback il pannello
  mostra solo i contenuti.
- **API**: `ConversationResponse.artifacts`; nuovi tipi serviti (mov, webm, wav, m4a, ogg, aac, md, txt); l'HTML esce
  come `text/plain`, e lo studio lo mostra in un iframe `srcdoc` con `sandbox="allow-scripts"`, senza
  `allow-same-origin`: gli script girano (anche da CDN) ma non toccano studio, cookie e API.
- **Migration** `20261110120000_artifacts.sql` (colonna `files text[]` invece di `file`, `source` per le versioni,
  niente `content_id`: i contenuti restano dove sono e lo studio li affianca). Va lanciata **prima** del riavvio
  dell'API, che altrimenti non apre più le conversazioni.

Decisioni prese sulle domande aperte: il pannello si apre da solo; nel menu ci sono tutti i file (anche le prove), nel
filo una card per l'ultima versione di ogni file del turno; script da CDN permessi nell'iframe isolato.

Da sapere: ogni artefatto è una copia (spazio su storage in più, soprattutto per i video); eliminando una conversazione
le righe se ne vanno, le copie in `artefatti/` restano nella cartella del brand. Gli artefatti non si vedono ancora
fuori dalla chat (scheda del brand) e l'app RN non li mostra.

---

Proposta del 6/11/2026. Obiettivo: mostrare nello studio quello che il sistema produce come fanno Claude desktop e
gli altri assistenti, cioè con un pannello di anteprima che si apre a destra della chat. E non limitarsi ai contenuti:
nel pannello va qualsiasi artefatto multimediale o documento generato in una conversazione.

## Com'è oggi

- `moonbrand-studio/src/app/features/chat/chat-page.html` mette i contenuti dentro il filo come card grandi
  (`mb-content-preview` in versione compatta). Li ripete poi nella striscia «salvati» in fondo, sopra la casella.
- Le proposte di pubblicazione (`pubblicazione_proponi`) sono card dello stesso tipo, con il pulsante «Pubblica ora».
- Tutto il resto che il motore produce non si vede mai: immagini e clip intermedie, musiche, voci, effetti, render,
  PDF, documenti. Mentre il motore lavora compaiono al massimo dei segnaposto (`ui/pending-media.ts`), ricavati dagli
  step del job (`AiStep.media`).

## L'idea: tutto è un artefatto

**Artefatto** = qualunque cosa il sistema produce in una conversazione. Ognuno ha un tipo, e il pannello sceglie come
mostrarlo in base al tipo.

| Tipo | Da dove viene oggi | Come si vede nel pannello |
|---|---|---|
| contenuto (post, carosello, video) | `salva_contenuto` | anteprima completa per canale, con Approva / Pubblica / Apri in Contenuti |
| immagine | `genera_immagine`, `renderizza` | zoom, scarica |
| clip / video | `genera_clip`, Remotion, `esporta_video` | player |
| audio | `genera_musica`, `genera_canzone`, `genera_voce`, `genera_effetto` | player, con le 2 versioni affiancate |
| documento | markdown o PDF (brief, strategia, report) | `mb-markdown`, oppure il PDF in un iframe |
| HTML | pagine interattive, bozze di layout | iframe isolato (sandbox) |
| piano | `piano_proponi` | mini calendario |

## Come si comporta l'interfaccia

- **A sinistra il filo, a destra il pannello**, ridimensionabile e chiudibile. Nel filo ogni artefatto diventa una card
  piccola (icona, titolo, tipo, miniatura): un click la apre nel pannello.
- **Quando arriva un artefatto nuovo, il pannello si apre da solo.** Mentre si genera, il pannello mostra il segnaposto
  che c'è già, poi lo sostituisce con il risultato.
- **Intestazione del pannello**: titolo, versioni (v1, v2… se lo stesso file viene rifatto), le azioni del tipo
  (scarica, copia, apri in Contenuti, approva, pubblica), e un menu con tutti gli artefatti della conversazione. Questo
  menu prende il posto della striscia «salvati» in fondo.
- **Link diretto**: `/assistente/:conversationId?artefatto=<id>` apre la conversazione con quell'artefatto nel pannello.
- **Su mobile** il pannello diventa un foglio a tutto schermo, che si chiude con un gesto o con la X.
- I visualizzatori sono un registro per tipo: un componente per tipo, scelto dal pannello. Aggiungere un tipo nuovo
  vuol dire aggiungere un componente, senza toccare il resto.

## Da dove arrivano gli artefatti (lato motore)

Senza aggiungere regole al prompt (vedi la memoria «prompt semplici»):

1. **In automatico, dal codice del worker.** Quando un tool scrive un file nella cartella del brand (immagine, clip,
   audio, render, export), il worker lo registra come artefatto. Claude non deve fare niente.
2. **Un solo tool nuovo e generico, `mostra`** (file o testo, titolo), per quello che il modello vuole far vedere di
   sua iniziativa, per esempio un documento di strategia o una pagina HTML.
3. **Tabella `artifacts`**:

   | colonna | note |
   |---|---|
   | `id` | |
   | `brand_id` | |
   | `conversation_id` | |
   | `job_id` | il turno in cui è nato |
   | `kind` | content, image, video, audio, document, html, plan |
   | `title` | |
   | `file` | percorso nella cartella del brand, facoltativo per il testo |
   | `mime` | |
   | `content_id` | facoltativo: per il tipo contenuto punta al contenuto, che resta dove è oggi |
   | `parent_id` | la versione precedente dello stesso artefatto |
   | `meta` | jsonb: proporzione, durata, versioni audio, ecc. |
   | `created_at` | |

   L'API la espone insieme alla conversazione (`ConversationTurn.artifacts`). Gli URL dei file passano dalla rotta che
   c'è già, `GET /v1/files/:brandId/*`.

## Fasi

### Fase 1: solo studio, nessun cambio al backend

- Layout di `chat-page` a due colonne, con il pannello ridimensionabile e lo stato aperto/chiuso.
- Nel filo, card piccole al posto delle `mb-content-preview` compatte, per contenuti e proposte di pubblicazione.
- Nel pannello `mb-content-preview` in versione completa, con le azioni che oggi stanno nella card.
- Menu degli artefatti al posto della striscia «salvati», e il parametro `?artefatto=`.
- Foglio a tutto schermo su mobile.

Si vede subito la differenza, non tocca il motore e il layout serve alle fasi dopo.

### Fase 2: media intermedi, ricavati dagli step

- Gli step hanno già `media[].file`: si aggiungono i tipi `audio` e `document` a `StepMedia`
  (`moonbrand-shared/src/ai/steps.ts`), e da lì si costruiscono gli artefatti di ogni turno.
- Da sistemare: `toolMedia` riconosce ancora i nomi vecchi dei tool (`mcp__immagini__genera_immagine`,
  `mcp__clip__gira_clip`). Nel v3 i tool si chiamano `mcp__media__genera_immagine` / `mcp__media__genera_clip`, e il
  v4 (Pi) li registra con altri nomi ancora. Con ogni probabilità oggi i segnaposto di foto e clip non compaiono: non è
  stato verificato dal vivo.
- Va aggiunto il riconoscimento dei tool audio, di `esporta_video` e di `renderizza` con il file d'uscita.

### Fase 3: tabella, versioni, tool `mostra`

- Migration `artifacts` e registrazione automatica nel worker (v3, poi v4).
- Tool `mostra` per documenti e HTML.
- Versioni nel pannello (`parent_id`).
- Gli artefatti di una conversazione si possono vedere anche fuori dalla chat, per esempio in una scheda del brand.

## Decisioni aperte

- Il pannello si apre da solo a ogni artefatto nuovo, o solo con il click? Proposta: da solo, come Claude desktop.
- Nel pannello vanno tutti i media intermedi (anche le prove scartate) o solo quelli che finiscono in un contenuto?
  Proposta: tutti nel menu degli artefatti; nel filo, card solo per l'ultimo di ogni serie.
- Gli artefatti HTML girano in un iframe con `sandbox` senza `allow-same-origin`: decidere se possono caricare
  script da CDN.
