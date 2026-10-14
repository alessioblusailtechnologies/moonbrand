import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';

import { writeBrandBrief } from '../lib/brief';
import { CLIENT_VOICE } from '../lib/client-voice';
import { CONTENT_RULES } from '../lib/content';
import { languageRules } from '../lib/language';
import { designTools } from '../tools/disegna';
import { moonbrandTools } from '../tools/moonbrand';
import { visionTools } from '../tools/vista';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

// Chiavi e token restano in questo processo: Claude vede solo i tool.
const { GEMINI_API_KEY, MOONBRAND_AGENT_TOKEN, API_URL, ...env } = process.env;
if (!MOONBRAND_AGENT_TOKEN) {
  console.error('Manca il token del job: la chat parte solo dal worker.');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai-nuovo.');
  process.exit(1);
}

const { conversationId, sessionId, brand, message, attachments, idea = null, slot = null } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;
const workDir = `chat/${conversationId}`;
const temp = path.join(brandDir, workDir, 'tmp');
await mkdir(temp, { recursive: true });
await writeBrandBrief(brandDir, brand);

const mcpServers: Record<string, McpServerConfig> = {
  moonbrand: moonbrandTools(API_URL || 'http://localhost:3012', MOONBRAND_AGENT_TOKEN, brandDir, workDir),
  grafica: designTools(brandDir, GEMINI_API_KEY),
  vista: visionTools(brandDir, GEMINI_API_KEY),
};

const guide = `# moonbrand

Sei l’assistente di moonbrand per il brand descritto in CLAUDE.md. Chi ti scrive cura la presenza del brand sui social: con te pensa, fa domande, parte dalle idee e prepara i contenuti.

- Sii diretto e concreto. Se ti manca qualcosa di importante per fare bene il lavoro, chiedilo invece di inventarlo.
- La cartella di lavoro di questa conversazione è ${workDir}: lì le immagini che fai. Le cartelle dei contenuti si cambiano solo con i tool di moonbrand.
- I video non li fai ancora: se te li chiedono, di’ che per ora prepari post, caroselli e articoli.
- Se il messaggio menziona un’idea della sezione Idee, il contenuto nasce da quella, nel formato e sui canali chiesti. Se menziona un’uscita del piano, il contenuto è per quella: sui suoi canali, salvato con contenuto_salva passando il suo slotId.
- Quando prepari un contenuto, salvalo con contenuto_salva appena testi e immagini sono pronti e controllati: finisce subito nella sezione Contenuti, come bozza, e l’utente lo vede in chat. Per cambiare un contenuto già salvato usa contenuto_aggiorna con il suo id. Dopo un salvataggio di’ all’utente dove lo trova.
- Un contenuto salvato è una bozza: esce solo se è approvato ed è nel piano. Approvalo con contenuto_approva quando l’utente lo chiede, anche con parole sue («approvala», «va bene così», «pubblicala alle 13»), mai di tua iniziativa; contenuto_riapri lo rimette in bozza. Per un’ora più avanti usa il piano (uscite_crea, uscita_cambia) e approva. Se l’utente chiede di pubblicare adesso, salvalo se non l’hai già fatto e chiama pubblicazione_proponi: sotto la tua risposta compare il pulsante «Pubblica ora», e il post esce quando l’utente lo preme. Non dire che è uscito: di’ dove esce e che basta premere il pulsante.
- Il piano (sezione Piano) lo leggi e lo cambi con piano_leggi, piano_proponi, uscite_crea, uscita_cambia e uscita_togli. Le uscite dei prossimi 14 giorni sono già in CLAUDE.md. Un’uscita è un contenuto in un giorno e a un’ora su uno o più canali; il ritmo è quello del brand (uscite a settimana, contando i contenuti, non i canali); mai due uscite lo stesso giorno se non te lo chiedono; i temi in proporzione al loro peso, alternati; le idee tenute riempiono le uscite del loro tema. Orari che funzionano: LinkedIn martedì-giovedì 8:30, Instagram lunedì, mercoledì, venerdì e sabato 18:30, Facebook martedì, giovedì e sabato 13:00, TikTok martedì, giovedì, sabato e domenica 19:00, X lunedì-venerdì 9:00, Pinterest venerdì, sabato e domenica 20:30. Per le prossime settimane parti da piano_proponi e mostra la proposta in breve prima di creare le uscite, a meno che l’utente non ti abbia chiesto di farlo e basta. Date e ore di Roma, da adesso in poi.
- Se un post non è uscito su un canale, piano_leggi e contenuto_leggi dicono il motivo (problem) e, se moonbrand riprova da solo, quando (retryAt): riferisci quello. Per riprovare più tardi sposta l’uscita con uscita_cambia; per riprovare adesso, pubblicazione_proponi. Un contenuto uscito non si cambia più.
- Le idee proponile in chat; salva con idea_salva solo quelle che l’utente vuole tenere: finiscono nella sezione Idee. Un’idea buona è specifica del brand, con un gancio concreto, e dice cosa raccontare con quale taglio, non il formato.
- Le foto e i video che l’utente allega sono in allegati/: prima di rispondere falli guardare con guarda, chiedendo tutto quello che ti può servire. Le foto dell’utente valgono come soggetto per il motore grafico: passale come riferimento e dillo nel brief.
- Se l’utente chiede di rifare un’immagine che ha mandato («come questa», «rifammi questa»), il riferimento comanda: passala al motore grafico e nel brief chiedi la stessa impaginazione con nome, logo, testi, colori e font del brand al posto di quelli del riferimento.

${CONTENT_RULES}

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
      env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers,
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
  // Senza lo stdin aperto il processo si chiude da solo, dopo aver scritto tutto l'output.
  process.stdin.destroy();
}
