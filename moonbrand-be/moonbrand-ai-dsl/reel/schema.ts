// Lo schema JSON del documento di un reel (ADR-001 §5). Gli id di mosse e beat sono enum presi dal catalogo: quello di
// base, le mosse su misura approvate (vocabolario/mosse) e quelle proposte e non ancora approvate (vocabolario/proposte).
import { existsSync, readdirSync, readFileSync } from 'node:fs';

export const QUI = import.meta.dirname;
export const VOC = `${QUI}/vocabolario`;
export const STILE = JSON.parse(readFileSync(`${VOC}/stile.json`, 'utf8'));
export const BEAT: Record<string, string> = {
  hook_text: 'Apertura: una frase che ferma lo scroll, su una ripresa. Righe corte.',
  product_focus: 'Il lavoro in primo piano: la ripresa parla da sola, al massimo una riga piccola (secondary).',
  list: 'Un titolo e fino a tre voci brevi (items) che compaiono una dopo l’altra.',
  stat: 'Un numero o una parola gigante con un’etichetta piccola (secondary).',
  quote: 'Una citazione con la firma (secondary).',
  cta: 'Chiusura: l’invito, una riga piccola (secondary) e il logo.',
};

const leggiCartella = (dir: string, stato: string) =>
  existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ ...JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')), status: stato, file: `${dir}/${f.replace(/\.json$/, '.ts')}` }))
    : [];
// Il catalogo si rilegge a ogni compilazione: una mossa proposta o promossa vale subito.
export function catalogo(): any[] {
  const base = JSON.parse(readFileSync(`${VOC}/catalogo.json`, 'utf8')).map((m: any) => ({ ...m, status: 'base' }));
  return [...base, ...leggiCartella(`${VOC}/mosse`, 'approvata'), ...leggiCartella(`${VOC}/proposte`, 'proposta')];
}

const mossa = (ids: string[], descrizione: string, extra: any = {}) => ({
  type: 'object',
  description: descrizione,
  properties: { move: ids.length ? { type: 'string', enum: ids } : { type: 'string', not: {} }, params: { type: 'object', additionalProperties: true }, ...extra },
  required: ['move'],
  additionalProperties: false,
});
const colore = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };

export function schemaDocumento(cat: any[]) {
  const ids = (...c: string[]) => cat.filter((m) => c.includes(m.category)).map((m) => m.id);
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      format: { type: 'string', enum: Object.keys(STILE.formati) },
      style: {
        type: 'object',
        properties: { curves: { type: 'string', enum: Object.keys(STILE.curve) }, energy: { type: 'string', enum: Object.keys(STILE.energia) } },
        required: ['curves', 'energy'],
      },
      kit: {
        type: 'object',
        properties: {
          colors: { type: 'object', properties: { text: colore, ink: colore, paper: colore, accent: colore }, required: ['text', 'ink', 'paper', 'accent'] },
          fonts: {
            type: 'object',
            description: 'nomi PostScript di font installati',
            properties: { title: { type: 'string' }, title_italic: { type: 'string' }, text: { type: 'string' }, strong: { type: 'string' } },
            required: ['title', 'text', 'strong'],
          },
          logo: { type: 'string', description: 'percorso dalla cartella del brand, png con trasparenza' },
          music: {
            type: 'object',
            properties: { file: { type: 'string' }, bpm: { type: 'number', minimum: 50, maximum: 200 }, first_beat: { type: 'number', minimum: 0 } },
            required: ['file', 'bpm'],
          },
        },
        required: ['colors', 'fonts', 'music'],
      },
      beats: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: Object.keys(BEAT) },
            bars: { type: 'number', enum: [0.5, 1, 1.5, 2, 2.5, 3, 4] },
            media: { type: 'string', description: 'percorso dalla cartella del brand (foto o video)' },
            media_from: { type: 'number', minimum: 0 },
            speed: { type: 'number', minimum: 0.25, maximum: 2 },
            bw: { type: 'boolean' },
            lines: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            secondary: { type: 'string' },
            items: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            logo_size: { type: 'string', enum: ['s', 'm', 'l'] },
            logo_in: mossa(ids('element_in'), 'cta: come entra il logo'),
            layout: {
              type: 'object',
              properties: {
                focal: { type: 'string', enum: Object.keys(STILE.focali) },
                type_scale: { type: 'string', enum: ['s', 'm', 'l', 'xl'] },
                align: { type: 'string', enum: ['center', 'left'] },
              },
              required: ['focal', 'type_scale', 'align'],
            },
            transition: mossa(ids('transition'), 'come si entra dal beat precedente'),
            media_in: mossa(ids('media_in'), 'come entra la ripresa'),
            camera: mossa(ids('camera'), 'movimento di macchina per tutto il beat'),
            in: mossa(ids('text_in', 'element_in'), 'come entra il testo principale'),
            out: mossa([...cat.filter((m) => m.invertible).map((m) => m.id), 'fade'], 'come esce il testo'),
            emphasis: mossa([...ids('emphasis'), 'none'], 'un accento sul tempo', { on_beat: { type: 'integer', minimum: 1, maximum: 16 } }),
            overlays: { type: 'array', items: mossa(ids('overlay'), 'livelli in più costruiti da una mossa su misura') },
          },
          required: ['type', 'bars', 'media', 'layout'],
        },
      },
    },
    required: ['format', 'style', 'kit', 'beats'],
  };
}
