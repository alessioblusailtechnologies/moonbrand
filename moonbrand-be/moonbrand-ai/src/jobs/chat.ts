import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';

import { writeBrandGuide } from '../lib/brand-guide';
import { CLIENT_VOICE } from '../lib/client-voice';
import { languageRules } from '../lib/language';
import { MOONBRAND_PLUGINS } from '../lib/plugin';
import { prepareVideoProject } from '../lib/video';
import { videoEstimateFromEnv } from '../lib/video-estimate';
import { audioTools } from '../tools/audio';
import { clipTools } from '../tools/clip';
import { graphicsTools } from '../tools/grafica';
import { imageTools } from '../tools/immagini';
import { lambdaKeys, lambdaTools } from '../tools/lambda';
import { musicTools } from '../tools/musica';
import { socialTools } from '../tools/social';
import { visionTools } from '../tools/vista';
import { moonbrandTools } from '../tools/moonbrand';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

// Chiavi e token restano in questo processo: Claude vede solo i tool.
const { GEMINI_API_KEY, ELEVENLABS_API_KEY, ATLASCLOUD_API_KEY, ZERNIO_API_KEY, MOONBRAND_AGENT_TOKEN, API_URL, ...env } = process.env;
if (!MOONBRAND_AGENT_TOKEN) {
  console.error('Manca il token del job: la chat parte solo dal worker.');
  process.exit(1);
}

const { conversationId, sessionId, brand, message, attachments, idea = null, slot = null } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;
const workDir = `chat/${conversationId}`;
const temp = path.join(brandDir, workDir, 'tmp');
await mkdir(temp, { recursive: true });
await writeBrandGuide(brandDir, brand);
// Il progetto video del brand è pronto a ogni turno: un video si può chiedere in qualsiasi momento.
const videoEnv = await prepareVideoProject(brandDir);

// Il browser del render resta aperto per tutto il turno: si chiude alla fine.
const graphics = graphicsTools(brandDir, GEMINI_API_KEY);
const mcpServers: Record<string, McpServerConfig> = {
  moonbrand: moonbrandTools(API_URL || 'http://localhost:3012', MOONBRAND_AGENT_TOKEN, brandDir, workDir),
  grafica: graphics.server,
};
if (GEMINI_API_KEY) {
  mcpServers.immagini = imageTools(brandDir, GEMINI_API_KEY);
  mcpServers.vista = visionTools(brandDir, GEMINI_API_KEY);
}
// Le clip dei video le gira Grok Imagine su Atlas Cloud.
if (ATLASCLOUD_API_KEY) mcpServers.clip = clipTools(brandDir, ATLASCLOUD_API_KEY);
// I post social che l'utente incolla come riferimento, scaricati con Zernio.
if (ZERNIO_API_KEY) mcpServers.social = socialTools(brandDir, ZERNIO_API_KEY);
if (ELEVENLABS_API_KEY) {
  mcpServers.audio = audioTools(brandDir, ELEVENLABS_API_KEY);
  mcpServers.musica = musicTools(brandDir, ELEVENLABS_API_KEY);
}
// Gli export finali dei video su Remotion Lambda, se ci sono le chiavi AWS (.env.lambda).
const lambda = lambdaKeys();
if (lambda) mcpServers.lambda = lambdaTools(brandDir, path.basename(path.resolve(brandDir)), lambda);

// Le clip già girate in questa conversazione, dal worker: l'indicazione vale per tutta la chat. In crediti, come li vede
// l'utente: 1 credito è 1 centesimo di dollaro di costo vero.
const clipBudget = Math.round((Number(env.MOONBRAND_CLIP_BUDGET_USD) || 3) * 100);
const clipSpent = Math.round((Number(env.MOONBRAND_CLIP_SPENT_USD) || 0) * 100);
// Quanto consuma il lavoro di un video, misurato dal worker sui video recenti.
const videoEstimate = videoEstimateFromEnv(env);

const guide = `# moonbrand

Sei l’assistente di moonbrand per il brand descritto in CLAUDE.md. Chi ti scrive cura la presenza del brand sui social: con te pensa, fa domande, parte dalle idee e prepara i contenuti.

- Sii diretto e concreto. Se ti manca qualcosa di importante per fare bene il lavoro, chiedilo invece di inventarlo.
- La cartella di lavoro di questa conversazione è ${workDir}: lì bozze, HTML, script e immagini. Le cartelle dei contenuti si cambiano solo con i tool di moonbrand.
- Per scrivere o ritoccare un contenuto segui la skill moonbrand:contenuti; per un video anche la skill moonbrand:video; per proporre idee la skill moonbrand:idee.
- Prima di fare un video, o di rifarne uno, proponi sempre in chat il copione con il consumo stimato (skill moonbrand:video, «Il consumo stimato») e aspetta l’ok, anche se l’utente chiede di andare dritto. Proponi la versione migliore per qualità, non la più economica. Per una correzione piccola a un video già fatto basta dire cosa cambi e il consumo stimato. Nel progetto video il suo id è un nome breve e unico finché non è salvato.
- Il lavoro di un video, senza le clip, consuma di solito ${videoEstimate.new.typical}–${videoEstimate.new.high} crediti per un video nuovo e ${videoEstimate.edit.typical}–${videoEstimate.edit.high} per una correzione: verso l’alto con voce fuori campo, canzone, molte scene o più formati. Le clip generate circa 14 crediti al secondo.
- Per le clip generate c’è un’indicazione di massima di ${clipBudget} crediti per tutta questa conversazione, e finora se ne sono consumati ${clipSpent}: serve a progettare, non dirla all’utente, e superala se la qualità lo chiede, mettendolo nella stima. Se mentre lavori serve consumare molto più della stima confermata (per esempio rifare delle clip), prima chiedi.
- Il consumo si dice sempre in crediti, mai in euro o dollari.
- Se il messaggio menziona un’idea della sezione Idee, il contenuto nasce da quella, nel formato e sui canali chiesti nel messaggio.
- Se il messaggio menziona un’uscita del piano, il contenuto è per quella: sui suoi canali, e lo salvi con contenuto_salva passando il suo slotId.
- Il piano (sezione Piano) lo leggi e lo cambi con piano_leggi, piano_proponi, uscite_crea, uscita_cambia e uscita_togli, seguendo la skill moonbrand:piano. Le uscite dei prossimi 14 giorni sono già in CLAUDE.md.
- Quando prepari un contenuto, salvalo con contenuto_salva appena testi e immagini o video finali sono pronti e controllati, anche se è una prova: finisce subito nella sezione Contenuti, come bozza, e l’utente lo vede in chat. Per cambiare un contenuto già salvato usa contenuto_aggiorna con il suo id.
- Un contenuto salvato è una bozza: esce solo se è approvato ed è nel piano. Approvalo con contenuto_approva quando l’utente lo chiede, anche con parole sue («approvala», «va bene così», «pubblicala alle 13»), mai di tua iniziativa; contenuto_riapri lo rimette in bozza. Per un’ora più avanti usa il piano (uscite_crea, uscita_cambia) e approva: da lì esce da solo. Se l’utente chiede di pubblicare adesso, salvalo se non l’hai già fatto e chiama pubblicazione_proponi: sotto la tua risposta compare il pulsante «Pubblica ora», e il post esce quando l’utente lo preme, solo dove non è ancora uscito. Non dire che è uscito: di’ dove esce e che basta premere il pulsante.
- Se un post non è uscito su un canale, piano_leggi e contenuto_leggi dicono il motivo (problem) e, se moonbrand riprova da solo, quando (retryAt): riferisci quello, senza inventare cause. Per riprovare più tardi sposta l’uscita con uscita_cambia, che riprova solo dove non è uscito; per riprovare adesso, pubblicazione_proponi.
- Un video si salva come gli altri contenuti: format «video», l’MP4 con role «video» e la copertina con role «cover» nella stessa proporzione, più copione (script) e inquadrature (scenes).
- Le idee proponile in chat; salva con idea_salva solo quelle che l’utente vuole tenere: finiscono nella sezione Idee.
- Le foto e i video che l’utente allega al messaggio sono in allegati/: prima di rispondere falli guardare con il tool guarda, i video interi come MP4 (accanto c’è anche la copertina in JPEG). Chiedi subito tutto quello che ti può servire, cosa si vede e si sente e con quali tempi: la risposta resta nella conversazione e ti basta anche per i messaggi dopo.
- Se l’utente incolla il link di un post social (TikTok, Instagram, Facebook, X, YouTube, LinkedIn), scaricalo con scarica_social e guardalo con guarda prima di rispondere. È un riferimento di altri: prendine l’idea, l’aggancio, il ritmo e il montaggio, ma non usarne pezzi nei contenuti del brand.
- Dopo un salvataggio di’ all’utente dove lo trova.

${CLIENT_VOICE}

${languageRules()}`;

// L'idea menzionata nel messaggio, tutta: è il punto di partenza del contenuto che l'utente chiede.
const ideaBlock =
  idea &&
  [
    `L’idea menzionata: ${idea.title}`,
    idea.angleLabel && `Taglio: ${idea.angleLabel}`,
    idea.angle && `Cosa raccontare: ${idea.angle}`,
    idea.rationale && `Perché adesso: ${idea.rationale}`,
    idea.theme && `Tema: ${idea.theme}`,
  ]
    .filter(Boolean)
    .join('\n');
// L'uscita del piano menzionata: il contenuto che l'utente chiede esce lì, e si salva con il suo slotId.
const slotBlock =
  slot &&
  [
    `L’uscita del piano menzionata (slotId ${slot.id}): ${slot.date} alle ${slot.time} su ${slot.channels.join(', ')}`,
    slot.theme && `Tema che il piano chiede: ${slot.theme}`,
  ]
    .filter(Boolean)
    .join('\n');
const prompt = [
  message,
  slotBlock,
  ideaBlock,
  attachments.length > 0 && `Allegati:\n${attachments.map((file) => `- ${file}`).join('\n')}`,
]
  .filter(Boolean)
  .join('\n\n');

// Lo stop arriva dal worker sullo stdin: Claude si ferma e la sessione resta riprendibile.
const abort = new AbortController();
process.stdin.on('data', (chunk: Buffer) => {
  if (chunk.toString().includes('stop')) abort.abort();
});

try {
  for await (const item of query({
    prompt,
    options: {
      cwd: brandDir,
      env: { ...env, ...videoEnv, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers,
      plugins: MOONBRAND_PLUGINS,
      includePartialMessages: true,
      abortController: abort,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: guide },
      ...(sessionId && { resume: sessionId }),
    },
  })) {
    console.log(JSON.stringify(item));
  }
} catch (error) {
  if (!abort.signal.aborted) throw error;
} finally {
  await graphics.close();
  // Senza lo stdin aperto il processo si chiude da solo, dopo aver scritto tutto l'output.
  process.stdin.destroy();
}
