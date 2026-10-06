// Esporta ogni Still di src/Root.tsx in ../public/images, alla larghezza che serve al sito (circa 720px, il doppio della card).
// Le immagini con del testo escono una volta per lingua, in images/<lingua>/; le foto senza testo una volta sola.
// L'anteprima per i social e le icone vanno fuori da images, in PNG: il percorso lo dà `file`, relativo a ../public.
// Uso: npx tsx scripts/render.mts [id...]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const LINGUE = ['it', 'en', 'fr'] as const;

// Lo stesso Chrome headless di moonbrand-ai, scaricato una volta per tutti i progetti Remotion.
const chrome = path.resolve(
  '../../moonbrand-be/moonbrand-ai/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe',
);

type Lingua = (typeof LINGUE)[number];
const stills: { id: string; out: string; scale: number; testo: boolean; file?: (lingua: Lingua | null) => string }[] = [
  { id: 'solco-buds', out: 'posts/solco-buds.jpg', scale: 2 / 3, testo: true },
  { id: 'solco-colori', out: 'posts/solco-colori.jpg', scale: 2 / 3, testo: true },
  { id: 'aurora-torta', out: 'posts/aurora-torta.jpg', scale: 2 / 3, testo: false },
  { id: 'aurora-laboratorio', out: 'posts/aurora-laboratorio.jpg', scale: 2 / 3, testo: false },
  { id: 'forma-slide', out: 'posts/forma-slide.jpg', scale: 2 / 3, testo: true },
  { id: 'forma-stacco', out: 'posts/forma-stacco.jpg', scale: 2 / 3, testo: true },
  { id: 'osteria-pescato', out: 'posts/osteria-pescato.jpg', scale: 2 / 3, testo: true },
  { id: 'riva-case', out: 'posts/riva-case.jpg', scale: 0.6, testo: true },
  { id: 'libreria-libri', out: 'posts/libreria-libri.jpg', scale: 2 / 3, testo: true },
  { id: 'social-manager', out: 'social-manager.jpg', scale: 1, testo: false },
  // Le copertine dei contenuti di Solco nella griglia dello studio: card piccole, bastano 480px.
  { id: 'solco-buds', out: 'studio/solco-buds.jpg', scale: 4 / 9, testo: true },
  { id: 'solco-colori', out: 'studio/solco-colori.jpg', scale: 4 / 9, testo: true },
  { id: 'solco-dentro', out: 'studio/solco-dentro.jpg', scale: 4 / 9, testo: true },
  { id: 'solco-suono', out: 'studio/solco-suono.jpg', scale: 4 / 9, testo: true },
  { id: 'solco-countdown', out: 'studio/solco-countdown.jpg', scale: 4 / 9, testo: true },
  { id: 'solco-team', out: 'studio/solco-team.jpg', scale: 4 / 9, testo: false },
  { id: 'anteprima', out: 'og.png', scale: 1, testo: true, file: (lingua) => `og/${lingua}.png` },
  { id: 'icona', out: 'icon-512.png', scale: 1, testo: false, file: () => 'icon-512.png' },
  { id: 'icona', out: 'apple-touch-icon.png', scale: 180 / 512, testo: false, file: () => 'apple-touch-icon.png' },
];

const temp = mkdtempSync(path.join(tmpdir(), 'moonbrand-render-'));
const scelte = process.argv.slice(2);
for (const { id, out, scale, testo, file } of stills.filter((s) => !scelte.length || scelte.includes(s.id))) {
  for (const lingua of testo ? LINGUE : [null]) {
    const target = file ? path.resolve('../public', file(lingua)) : path.resolve('../public/images', lingua ?? '', out);
    const png = target.endsWith('.png');
    // Le props passano da un file: in una riga di comando su Windows le virgolette del JSON si perdono.
    const props = path.join(temp, `${lingua ?? 'foto'}.json`);
    writeFileSync(props, JSON.stringify(lingua ? { lingua } : {}));
    execFileSync(
      'npx',
      [
        'remotion',
        'still',
        id,
        target,
        `--props=${props}`,
        ...(png ? ['--image-format=png'] : ['--image-format=jpeg', '--jpeg-quality=86']),
        `--scale=${scale}`,
        ...(existsSync(chrome) ? [`--browser-executable=${chrome}`] : []),
      ],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    );
  }
}
