// L'estensione di Pi del motore v4: i tool del v3 (contenuti, piano e idee, media, grafica, guarda, audio, video, Lambda)
// registrati come tool di Pi, più le protezioni che nel v3 dava Claude Code: niente chiavi nei comandi di bash, niente
// letture fuori dalla cartella del brand, niente compattazione automatica (il riassunto lo fa solo il passaggio di
// sessione di chat.ts). La logica dei tool è quella del v3, nei file di src/jobs/chat: qui c'è solo l'adattatore.
import path from 'node:path';

import { getModel } from '@earendil-works/pi-ai';
import { createBashTool, withFileMutationQueue, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { z } from 'zod';

import { audioServer } from '../src/jobs/chat/audio';
import { graficaServer } from '../src/jobs/chat/grafica';
import { guardaServer } from '../src/jobs/chat/guarda';
import { lambdaKeys, lambdaServer } from '../src/jobs/chat/lambda';
import { mediaServer } from '../src/jobs/chat/media';
import { moonbrandServer } from '../src/jobs/chat/moonbrand';
import { testiServer } from '../src/jobs/chat/testi';
import type { ToolDefinition, ToolGroup } from '../src/jobs/chat/sdk';
import { videoServer } from '../src/jobs/chat/video';
import { webServer } from '../src/jobs/chat/web';
import { useTextPrices, type TextPrice } from '../src/lib/prices';
import { usageSink, type Usage } from '../src/lib/usage';

// Le variabili che i comandi di bash non vedono: chiavi dei servizi, token del job, storage, Lambda, Anthropic.
const SECRET = /^(MOONBRAND_|S3_|REMOTION_AWS_|AWS_|ANTHROPIC_|DEEPSEEK_|GEMINI_|GOOGLE_|OPENAI_|PI_)|KEY|SECRET|TOKEN|PASSWORD/i;
// Quello che i comandi di bash non toccano: i .env, le credenziali di Pi e di Claude, l'ambiente dei processi.
const BASH_DENY = /(^|[^\w])\.env\b|\/environ\b|[\\/]\.pi[\\/]|[\\/]\.claude[\\/]|\bprintenv\b|\bset\s*$|\benv\s*($|\|)/;
// La cartella della v1 archiviata al passaggio del brand al v2.
const ARCHIVE = 'v1';

export default function (pi: ExtensionAPI) {
  // Il listino di Pi come riserva per i prezzi dei modelli di testo, quando il listino di OpenRouter non si raggiunge (lib/prices.ts).
  useTextPrices((model) => (getModel as (provider: string, id: string) => { cost?: TextPrice } | undefined)('google', model)?.cost);
  const brandDir = path.resolve(process.cwd());
  const {
    MOONBRAND_AGENT_TOKEN = '',
    MOONBRAND_GEMINI_KEY: gemini,
    MOONBRAND_ATLAS_KEY: atlas,
    MOONBRAND_ELEVENLABS_KEY: elevenlabs,
    API_URL = 'http://localhost:3012',
  } = process.env;

  const lambda = lambdaKeys();
  const media = mediaServer(brandDir, { gemini, atlas });
  const grafica = graficaServer(brandDir, gemini);
  const web = webServer(brandDir, gemini);
  const groups: ToolGroup[] = [
    moonbrandServer(API_URL, MOONBRAND_AGENT_TOKEN, brandDir),
    media.server,
    grafica.server,
    ...(gemini ? [guardaServer(brandDir, gemini), testiServer(brandDir, gemini)] : []),
    ...(elevenlabs || atlas ? [audioServer(brandDir, { elevenlabs, atlas })] : []),
    videoServer(brandDir, gemini),
    ...(lambda ? [lambdaServer(brandDir, lambda)] : []),
    web.server,
  ];
  for (const definition of groups.flatMap((group) => group.tools)) register(pi, brandDir, definition);

  // bash di Pi con l'ambiente senza segreti.
  const bash = createBashTool(brandDir, {
    spawnHook: ({ command, cwd, env }) => ({ command, cwd, env: Object.fromEntries(Object.entries(env).filter(([name]) => !SECRET.test(name))) }),
  });
  pi.registerTool({ ...bash, execute: (id, params, signal, onUpdate) => bash.execute(id, params, signal, onUpdate) });

  // Letture e scritture solo nella cartella del brand, mai i .env né la v1 archiviata.
  const allowed = (target: string) => {
    const full = path.resolve(brandDir, target);
    const relative = path.relative(brandDir, full);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
    const parts = relative.split(/[\\/]/);
    return parts[0] !== ARCHIVE && !parts.some((part) => /^\.env(\..*)?$/i.test(part));
  };
  pi.on('tool_call', async (event) => {
    const input = event.input as Record<string, unknown>;
    if (['read', 'write', 'edit', 'grep', 'find', 'ls'].includes(event.toolName)) {
      const target = typeof input.path === 'string' ? input.path : '.';
      if (!allowed(target)) return { block: true, reason: 'Fuori dalla cartella del brand: non si legge e non si scrive.' };
    }
    if (event.toolName === 'bash' && typeof input.command === 'string' && BASH_DENY.test(input.command)) {
      return { block: true, reason: 'Comando non permesso: tocca configurazioni o credenziali interne.' };
    }
    return undefined;
  });

  pi.on('session_before_compact', async () => ({ cancel: true }));

  let closing: Promise<void> | undefined;
  const shutdown = () =>
    (closing ??= (async () => {
      // Le clip avviate e non aspettate si pagano lo stesso, se Atlas le ha fatte (il costo va sullo stdout).
      await media.close().catch((error: unknown) => console.error('clip in sospeso non controllate', error));
      await grafica.close();
      await web.close();
    })());
  pi.on('session_shutdown', shutdown);

  // Lo stop della chat arriva da chat.ts sul canale IPC: si interrompe il turno come con Esc, Pi ferma i comandi di bash
  // in corso, finisce ed esce da sé passando da session_shutdown, su Linux come su Windows (dove un segnale terminerebbe
  // e basta). Se non esce entro STOP_GRACE_MS, si chiude qui e si esce. Il canale non tiene in vita Pi a fine turno.
  const STOP_GRACE_MS = 10_000;
  let context: { abort(): void } | undefined;
  pi.on('session_start', async (_event, ctx) => {
    context = ctx;
  });
  process.channel?.unref();
  process.on('message', (message) => {
    if (message !== 'stop') return;
    context?.abort();
    setTimeout(() => void shutdown().finally(() => process.exit(143)), context ? STOP_GRACE_MS : 0).unref();
  });
}

// Un tool del v3 come tool di Pi: lo schema zod diventa JSON Schema per il modello, gli argomenti si rileggono con zod
// (default e controlli come nell'SDK) e i costi delle generazioni tornano nei details.
function register(pi: ExtensionAPI, brandDir: string, definition: ToolDefinition) {
  const schema = z.object(definition.inputSchema);
  const { $schema: _schema, ...parameters } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  pi.registerTool({
    name: definition.name,
    label: definition.name,
    description: definition.description,
    parameters: parameters as never,
    async execute(_id, params) {
      const parsed = schema.safeParse(params);
      if (!parsed.success) {
        return { content: [{ type: 'text', text: `Argomenti non validi: ${z.prettifyError(parsed.error)}` }], details: {}, isError: true } as never;
      }
      const usages: Usage[] = [];
      const run = () => usageSink.run(usages, async () => definition.handler(parsed.data));
      // Chi scrive un file passa per la stessa coda di write ed edit di Pi: due chiamate parallele non si sovrascrivono.
      const target = (parsed.data as { salva?: unknown }).salva;
      const result = typeof target === 'string' ? await withFileMutationQueue(path.resolve(brandDir, target), run) : await run();
      return {
        content: result.content.map((block) =>
          block.type === 'image' ? { type: 'image', data: block.data ?? '', mimeType: block.mimeType ?? 'image/png' } : { type: 'text', text: block.text ?? '' },
        ),
        details: { usages },
        ...(result.isError && { isError: true }),
      } as never;
    },
  });
}
