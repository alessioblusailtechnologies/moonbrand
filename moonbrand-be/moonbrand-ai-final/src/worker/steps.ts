import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { toolMedia, toolStep, type AiStep } from '@moonbrand/shared/ai/steps';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import { technicalLeak } from '../prompts/voice';
import { putBrandFiles } from '../repository/storage';
import { createStepReader } from './step-reader';

// I passaggi di un job come li vede chi aspetta: dai messaggi dell'SDK di Claude (testo, chiamate ai tool, risultati) alle
// righe con l'etichetta nella lingua dell'account, dalla tabella di moonbrand-shared o lette da Haiku. Le immagini e i
// video che un passaggio produce vanno sullo storage appena pronti, così lo studio li mostra subito.

export interface StepTrackerOptions {
  jobId: string;
  locale: Locale;
  brandsDir: string;
  // La cartella del brand, se il job ne ha una: i file dei passaggi si caricano da lì.
  brandDir?: string;
  // Nella chat il testo di Claude è la risposta: si mostra com'è, anche a pezzi, e non si accorpa.
  reply: boolean;
  onChange: () => void;
}

export interface StepTracker {
  handle(message: SDKMessage): void;
  // I passaggi da mostrare, nell'ordine.
  visible(): AiStep[];
  // Chiude quelli rimasti in corso.
  settle(): void;
  // Aspetta le ultime letture di Haiku e i caricamenti in corso (non se il job è stato fermato).
  close(stopped: boolean): Promise<void>;
}

// Quanto si aspettano, a job finito, le letture degli step ancora in corso.
const READ_GRACE_MS = 3000;

export function createStepTracker(options: StepTrackerOptions): StepTracker {
  const { jobId, locale, reply, onChange } = options;
  // hidden: gli step che non si mostrano, perché non dicono niente a chi aspetta o perché Haiku non li ha ancora letti.
  // Restano nella mappa per tenere il loro posto nell'ordine.
  const steps = new Map<string, AiStep>();
  const hidden = new Set<string>();
  const reader = createStepReader(options.brandsDir, locale);
  const fallback = translate(locale, 'steps.fallback');
  const uploads: Promise<void>[] = [];
  // Un blocco di Claude ha la stessa chiave mentre arriva a pezzi (stream_event) e quando è completo (assistant): l'id del
  // messaggio dell'API e la posizione del blocco nel messaggio.
  const blockCount = new Map<string, number>();
  let streaming: string | undefined;
  // Quando è finito l'ultimo passaggio: il testo che Claude scrive dopo è durato da lì.
  let lastEventAt = Date.now();

  // Quando arriva la lettura di Haiku lo step prende la sua etichetta, o resta nascosto; senza lettura prende quella di
  // riserva, se ce l'ha.
  const readStep = (id: string, tool: string, input: unknown, reserve?: string) => {
    hidden.add(id);
    reader.read({ tool, input }, (reading) => {
      const step = steps.get(id);
      const shown = reading === undefined ? reserve && { label: reserve } : reading;
      if (!step || !shown) return;
      steps.set(id, { ...step, label: shown.label });
      hidden.delete(id);
      onChange();
    });
  };

  function handle(message: SDKMessage): void {
    if (message.type === 'stream_event') {
      // Il testo che arriva a pezzi si mostra solo nella chat, dove è la risposta.
      if (message.parent_tool_use_id || !reply) return;
      const { event } = message;
      if (event.type === 'message_start') {
        streaming = event.message.id;
      } else if (event.type === 'content_block_start' && event.content_block.type === 'text' && streaming) {
        const id = `${streaming}-${event.index}`;
        steps.set(id, { id, label: event.content_block.text, status: 'running', kind: 'text', startedAt: Date.now() });
        onChange();
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && streaming) {
        const step = steps.get(`${streaming}-${event.index}`);
        if (step) steps.set(step.id, { ...step, label: step.label + event.delta.text });
        onChange();
      }
    } else if (message.type === 'assistant') {
      const messageId = message.message.id;
      const now = Date.now();
      for (const block of message.message.content) {
        const index = blockCount.get(messageId) ?? 0;
        blockCount.set(messageId, index + 1);
        if (block.type === 'text') {
          const id = `${messageId}-${index}`;
          const text = block.text.trim();
          if (!text) {
            steps.delete(id);
            continue;
          }
          steps.set(id, { id, label: text, status: 'done', kind: 'text', startedAt: steps.get(id)?.startedAt ?? lastEventAt, endedAt: now });
          // Fuori dalla chat il testo è Claude che si parla tra un passaggio e l'altro: si mostra come lo legge Haiku.
          if (!reply) readStep(id, 'testo', text);
          else {
            const leak = technicalLeak(text);
            if (leak) console.warn(`[${jobId}] termine tecnico nella risposta: «${leak}»`);
          }
        } else if (block.type === 'tool_use') {
          const input = block.input as Record<string, unknown>;
          const known = toolStep(block.name, input, locale);
          // Immagini e video in arrivo: lo studio mostra i segnaposto nella loro proporzione, e poi il file.
          const media = toolMedia(block.name, input);
          steps.set(block.id, {
            id: block.id,
            label: known?.label ?? fallback,
            ...(known?.detail && { detail: known.detail }),
            status: 'running',
            kind: 'tool',
            tool: block.name,
            startedAt: now,
            ...(media && { media }),
          });
          if (known === null) hidden.add(block.id);
          else if (known === undefined) readStep(block.id, block.name, input, fallback);
        }
      }
      lastEventAt = now;
      onChange();
    } else if (message.type === 'user' && Array.isArray(message.message.content)) {
      lastEventAt = Date.now();
      for (const block of message.message.content) {
        if (block.type !== 'tool_result') continue;
        const step = steps.get(block.tool_use_id);
        if (!step) continue;
        const done: AiStep = { ...step, status: block.is_error ? 'failed' : 'done', endedAt: lastEventAt };
        const files = (step.media ?? []).flatMap((item) => (item.file ? [item.file] : []));
        if (!options.brandDir || block.is_error || files.length === 0) {
          steps.set(step.id, done);
          continue;
        }
        // Lo step è finito quando il file è sullo storage.
        uploads.push(
          putBrandFiles(options.brandDir, files)
            .catch((error: unknown) => console.error(`[${jobId}] file dello step non caricati`, error))
            .then(() => {
              steps.set(step.id, done);
              onChange();
            }),
        );
      }
      onChange();
    }
  }

  // Due passaggi di fila con la stessa riga sono lo stesso lavoro che continua (la stessa immagine ricontrollata): si
  // mostrano come uno, che resta in corso finché l'ultimo non finisce.
  const sameWork = (previous: AiStep, step: AiStep) => previous.label === step.label && previous.detail === step.detail && !(reply && (previous.kind === 'text' || step.kind === 'text'));
  const continued = (first: AiStep, last: AiStep): AiStep => {
    const media = [...(first.media ?? []), ...(last.media ?? [])];
    const step: AiStep = { ...first, status: last.status, ...(media.length > 0 && { media }) };
    delete step.endedAt;
    if (last.endedAt !== undefined) step.endedAt = last.endedAt;
    return step;
  };

  return {
    handle,
    visible() {
      const shown: AiStep[] = [];
      for (const step of steps.values()) {
        if (hidden.has(step.id)) continue;
        const previous = shown.at(-1);
        if (previous && sameWork(previous, step)) shown[shown.length - 1] = continued(previous, step);
        else shown.push(step);
      }
      return shown;
    },
    settle() {
      for (const step of steps.values()) if (step.status === 'running') steps.set(step.id, { ...step, status: 'done', endedAt: Date.now() });
    },
    async close(stopped) {
      await reader.close(stopped ? 0 : READ_GRACE_MS);
      if (!stopped) await Promise.all(uploads);
    },
  };
}
