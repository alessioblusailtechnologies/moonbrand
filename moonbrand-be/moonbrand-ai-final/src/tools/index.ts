import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

import { API_URL, keys } from '../config/env';
import { audioTools } from './audio';
import { clipTools } from './clip';
import { graphicsTools } from './grafica';
import { imageTools } from './immagini';
import { moonbrandTools } from './moonbrand';
import { musicTools } from './musica';
import { videoTools } from './video';
import { createLooker, visionTools } from './vista';

// I tool che Claude trova nella cartella del brand, tutti in questo processo: disegnare (renderizza), le immagini
// (genera_immagine), guardare (guarda), i video (controlla_video, esporta_video), le clip, la musica, la voce e gli effetti, e i dati di
// moonbrand (contenuti, idee, piano) nella chat. Le chiavi dei servizi restano qui.
export interface ToolOptions {
  // I tool dei video (Remotion, clip, musica, voce, effetti): per un video e per la chat, dove un video si può chiedere sempre.
  video?: boolean;
  // Il tetto in dollari per le clip, nei lavori senza nessuno a cui chiedere.
  clipCap?: number;
  // I tool di moonbrand, con il token del job: solo nella chat.
  api?: { token: string; workDir: string };
}

export function brandTools(brandDir: string, options: ToolOptions = {}): { servers: Record<string, McpServerConfig>; close: () => Promise<void> } {
  const { gemini, elevenlabs, atlas } = keys();
  const graphics = graphicsTools(brandDir);
  const lookAt = gemini ? createLooker(brandDir, gemini) : null;
  const servers: Record<string, McpServerConfig> = { grafica: graphics.server };
  if (gemini && lookAt) {
    servers.immagini = imageTools(brandDir, gemini);
    servers.vista = visionTools(lookAt);
  }
  if (options.video) {
    servers.video = videoTools(brandDir, lookAt);
    if (atlas) servers.clip = clipTools(brandDir, atlas, options.clipCap);
    if (elevenlabs) {
      servers.musica = musicTools(brandDir, elevenlabs);
      servers.audio = audioTools(brandDir, elevenlabs);
    }
  }
  if (options.api) servers.moonbrand = moonbrandTools(API_URL, options.api.token, brandDir, options.api.workDir);
  return { servers, close: graphics.close };
}
