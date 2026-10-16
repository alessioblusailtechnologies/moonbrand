import path from 'node:path';

// Quello che tutti i tool hanno in comune: i percorsi dentro la cartella del brand, le risposte e il modo di girare insieme.

// Claude Code esegue insieme solo i tool MCP che si dichiarano di sola lettura: gli altri vanno in fila. I tool che non
// si pestano i piedi (ognuno scrive il suo file) si dichiarano così per girare insieme. Sui permessi non cambia niente,
// i job girano con bypassPermissions.
export const PARALLEL = { alwaysLoad: true, annotations: { readOnlyHint: true } } as const;

// I percorsi che Claude passa ai tool sono relativi alla cartella del brand e non possono uscirne.
export function brandFolder(folder: string) {
  const root = path.resolve(folder);
  return {
    root,
    inside(relative: string): string {
      const full = path.resolve(root, relative);
      if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
      return full;
    },
    relative(full: string): string {
      return path.relative(root, full).replace(/\\/g, '/');
    },
  };
}

export const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

export const failure = (error: unknown) => ({
  content: [{ type: 'text' as const, text: `Non riuscito: ${error instanceof Error ? error.message : String(error)}` }],
  isError: true as const,
});

export const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
export const MEDIA_TYPES: Record<string, string> = { ...IMAGE_TYPES, '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };
