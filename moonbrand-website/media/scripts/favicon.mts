// favicon.ico del sito e dello studio: il favicon a 16, 32 e 48 pixel, in PNG, dentro un unico file .ico.
// Il .ico serve ai browser e ai servizi che non leggono favicon.svg. Uso: npx tsx scripts/favicon.mts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const chrome = path.resolve(
  '../../moonbrand-be/moonbrand-ai/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe',
);
const LATI = [16, 32, 48];
const DESTINAZIONI = ['../public/favicon.ico', '../../moonbrand-studio/public/favicon.ico'];

const temp = mkdtempSync(path.join(tmpdir(), 'moonbrand-favicon-'));
const pngs = LATI.map((lato) => {
  const file = path.join(temp, `${lato}.png`);
  execFileSync(
    'npx',
    ['remotion', 'still', 'favicon', file, '--image-format=png', `--scale=${lato / 48}`, ...(existsSync(chrome) ? [`--browser-executable=${chrome}`] : [])],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  return readFileSync(file);
});

// Il formato .ico: un'intestazione di 6 byte, una voce di 16 byte per immagine, poi le immagini PNG così come sono.
const intestazione = Buffer.alloc(6);
intestazione.writeUInt16LE(1, 2);
intestazione.writeUInt16LE(pngs.length, 4);
let posizione = 6 + 16 * pngs.length;
const voci = pngs.map((png, i) => {
  const voce = Buffer.alloc(16);
  voce.writeUInt8(LATI[i] % 256, 0);
  voce.writeUInt8(LATI[i] % 256, 1);
  voce.writeUInt16LE(1, 4);
  voce.writeUInt16LE(32, 6);
  voce.writeUInt32LE(png.length, 8);
  voce.writeUInt32LE(posizione, 12);
  posizione += png.length;
  return voce;
});
const ico = Buffer.concat([intestazione, ...voci, ...pngs]);
for (const destinazione of DESTINAZIONI) writeFileSync(path.resolve(destinazione), ico);
