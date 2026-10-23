// Gli strumenti dei reel per la chat e per chi approva le mosse. Si lanciano dalla cartella del brand:
//   node reel.ts catalogo                      il formato del documento, i beat e le mosse disponibili
//   node reel.ts rendi <reel.json> [--forza]   compila, anteprima, controlli, video finale (nella cartella <reel>/)
//   node reel.ts guida-mosse                   come si scrive una mossa su misura
//   node reel.ts mossa <mossa.ts> <scheda.json> propone una mossa su misura (subito usabile, da approvare)
// Per le persone che fanno il gate di gusto (ADR-001 §8.2):
//   node reel.ts galleria | promuovi <id> | scarta <id>
import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compila, scriviScript } from './compila.ts';
import { PASSO_ANTEPRIMA, rendi } from './rendi.mjs';
import { BEAT, STILE, VOC, catalogo } from './schema.ts';

const FF = ffmpeg as unknown as string;
const [cmd, ...arg] = process.argv.slice(2);
const brand = process.cwd();
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const fine = (o: unknown, codice = 0) => { console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2)); process.exit(codice); };

if (cmd === 'catalogo') {
  const righe = [
    'Documento del reel (JSON): { format, style: { curves, energy }, kit: { colors: { text, ink, paper, accent } (hex), fonts: { title, title_italic?, text, strong } (nomi PostScript installati), logo? (png dalla cartella del brand), music: { file, bpm, first_beat? (secondo del primo battere) } }, beats: [...] }',
    'Beat: { type, bars (battute di musica: 0.5-4), media (foto o video dalla cartella del brand), media_from (secondo di partenza), speed (0.5 = rallentatore), bw?, lines (testo principale in righe corte), secondary?, items? (voci di list), logo_size? (cta: s|m|l), logo_in? (cta: mossa element_in del logo), layout: { focal, type_scale: s|m|l|xl, align: center|left }, transition, media_in, camera, in, out, emphasis: { move, params, on_beat }, overlays?: [{ move, params }] }',
    `format: ${Object.keys(STILE.formati).join(', ')} · curves: ${Object.entries<any>(STILE.curve).map(([k, v]) => `${k} (${v.descrizione})`).join('; ')} · energy: ${Object.keys(STILE.energia).join(', ')} · focal: ${Object.keys(STILE.focali).join(', ')}`,
    '',
    'Tipi di beat:',
    ...Object.entries(BEAT).map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Mosse (params con min-max e default; durata in ms; ★ = signature, al massimo una ogni 6 s; [proposta] = su misura non ancora approvata):',
  ];
  const perCat: Record<string, any[]> = {};
  for (const m of catalogo()) (perCat[m.category] ??= []).push(m);
  const slot: Record<string, string> = { text_in: 'in/out', element_in: 'in', media_in: 'media_in', transition: 'transition', camera: 'camera', emphasis: 'emphasis', overlay: 'overlays' };
  for (const [c, ms] of Object.entries(perCat)) {
    righe.push(`${c} (campo ${slot[c] ?? c}):`);
    for (const m of ms) {
      const p = Object.entries<any>(m.params ?? {}).map(([k, d]) => (d.enum ? `${k}: ${d.enum.join('|')}` : `${k} ${d.min}-${d.max} (${d.default})`)).join(', ');
      righe.push(`- ${m.id}${m.signature ? ' ★' : ''}${m.status === 'proposta' ? ' [proposta]' : ''}: ${m.when}${p ? ` · ${p}` : ''}${m.duration_ms ? ` · durata ${m.duration_ms.min}-${m.duration_ms.max} ms` : ''}${m.invertible ? ' · si usa anche in out' : ''}`);
    }
  }
  righe.push('', "out accetta le mosse di testo invertibili o 'fade'; emphasis accetta anche 'none'. Se nessuna mossa fa quello che serve, scrivine una su misura: node reel.ts guida-mosse.");
  fine(righe.join('\n'));
}

if (cmd === 'guida-mosse') {
  fine(`Una mossa su misura è una funzione TypeScript con l'API di scripting di After Effects 26 (convertita in ES3), in un file .ts che contiene solo:
  MOSSE_SU_MISURA["<id>"] = (L: any, m: any) => { ... };
e una scheda JSON come quelle del catalogo:
  { "id", "category": text_in|element_in|media_in|emphasis|overlay, "when": "quando usarla", "params": { "<nome>": { "min", "max", "default" } | { "enum": [...], "default" } }, "duration_ms": { "min", "max", "default" }, "energy": low|medium|high, "tags": [], "signature": false, "invertible": false }

Cosa riceve:
- L: il livello su cui agire. text_in: una riga di testo (la funzione è chiamata per ogni riga, m.riga è l'indice); element_in ed emphasis: il nullo del blocco di testo (genitore delle righe; per il logo il livello del logo); media_in: la ripresa (genitore: un nullo camera). overlay: null, la mossa crea i suoi livelli tra m.tin e m.tout.
- m: { t (inizio, s), dur (s), p (parametri già nei limiti), bez (curva del brand, cubic-bezier [x1,y1,x2,y2]), ov (overshoot del brand), inv (true in uscita), tin, tout, colori: { testo, inchiostro, carta, accento } in [r,g,b] 0-1, font: { titolo, corsivo, testo, forte }, focal (y del punto focale) } — tin/tout/colori/font/focal solo per gli overlay.

Cosa può usare (già definiti): comp, W, H, FPS, S.cartella (cartella del brand, per importa), prop(livello, ...matchName), trova(gruppo, /regex del matchName/), effetto(livello, matchName) aggiunge un effetto nativo, scala(L), opac(L), posXY(L) → [X, Y] separati, anima(prop, t0, t1, v0, v1, bez, ov?) fotogrammi chiave con la curva del brand, campiona(prop, t0, t1, bez, e => valore) un fotogramma per fotogramma (maschere, forme), curvaJS(x, bez), codiceCurva(bez) la curva come funzione bz(x) per le espressioni, importa(file dalla cartella del brand), nullo(nome, x, y, tin, tout).
Regole: solo effetti nativi di AE; dice come si muove, non dove sta (posizioni e dimensioni dal livello o da m); niente casualità (stesso input, stesso video); in entrata finisce allo stato di riposo del livello, in uscita parte da lì.
Documentazione: C:/moonbrand-ae/docs/after-effects-scripting-guide/docs/ (scripting) e after-effects-expression-reference/docs/ (espressioni); le firme esatte in ${VOC.replace(/vocabolario$/, '')}node_modules/types-for-adobe/AfterEffects/26.0/index.d.ts. Le mosse esistenti sono esempi: ${VOC}/libreria.ts.
Poi: node reel.ts mossa <file.ts> <scheda.json> la registra (controlla i tipi) e la mossa si usa subito nel documento con il suo id.`);
}

if (cmd === 'mossa') {
  const [ts, scheda] = arg;
  if (!ts || !scheda) fine('uso: node reel.ts mossa <mossa.ts> <scheda.json>', 1);
  const s = json(scheda);
  const errori: string[] = [];
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(s.id ?? '')) errori.push('id: lettere minuscole, cifre e _');
  if (catalogo().some((m) => m.id === s.id && m.status !== 'proposta')) errori.push(`id ${s.id} già nel catalogo`);
  if (!['text_in', 'element_in', 'media_in', 'emphasis', 'overlay'].includes(s.category)) errori.push('category: text_in, element_in, media_in, emphasis o overlay');
  if (!s.when) errori.push('when: quando usarla');
  const codice = readFileSync(ts, 'utf8');
  if (!codice.includes(`MOSSE_SU_MISURA["${s.id}"]`)) errori.push(`il file deve assegnare MOSSE_SU_MISURA["${s.id}"]`);
  if (errori.length) fine({ errori }, 1);
  // il controllo dei tipi si fa compilando la libreria con la mossa dentro
  const prova = path.join(VOC, 'proposte', '.prova');
  mkdirSync(prova, { recursive: true });
  try {
    scriviScript({ controlli: path.join(prova, 'c.json'), livelli: [] }, [{ id: s.id, status: 'proposta', file: path.resolve(ts) }], prova);
  } catch (e: any) {
    fine({ errori: [e.message] }, 1);
  } finally {
    rmSync(prova, { recursive: true, force: true });
  }
  const scheda2 = { tags: [], signature: false, invertible: false, incompatible_with: [], params: {}, energy: 'medium', ...s, version: '0.1.0', origine: path.basename(brand), creata: new Date().toISOString(), esempi: [] };
  writeFileSync(path.join(VOC, 'proposte', `${s.id}.json`), JSON.stringify(scheda2, null, 2));
  copyFileSync(ts, path.join(VOC, 'proposte', `${s.id}.ts`));
  fine(`mossa ${s.id} registrata come proposta: si usa subito nel documento; entra nella libreria quando una persona la approva`);
}

if (cmd === 'rendi') {
  const doc = arg.find((a) => !a.startsWith('--'));
  const forza = arg.includes('--forza');
  if (!doc) fine('uso: node reel.ts rendi <reel.json> [--forza]', 1);
  const out = path.resolve(doc.replace(/\.json$/i, ''));
  mkdirSync(out, { recursive: true });
  const controlli = path.join(out, 'controlli.json').replaceAll('\\', '/');
  const tempi: Record<string, number> = {};
  let t = Date.now();
  const r = compila(json(doc), brand, controlli);
  if (r.errori.length) fine({ errori: r.errori, avvisi: r.avvisi }, 1);
  try {
    scriviScript(r.S, r.suMisura!, out);
  } catch (e: any) {
    fine({ errori: [e.message] }, 1);
  }
  writeFileSync(path.join(out, 'scena.json'), JSON.stringify(r.S, null, 1));
  // anti-ripetizione: la combinazione di mosse contro quelle degli ultimi 5 reel del brand
  const storicoFile = path.join(brand, 'lavoro', '.reel-storico.json');
  const storico: { doc: string; firma: string[] }[] = existsSync(storicoFile) ? json(storicoFile) : [];
  const avvisi = [...r.avvisi];
  for (const prec of storico.filter((s, k, tutti) => s.doc !== doc && tutti.findLastIndex((x) => x.doc === s.doc) === k).slice(-5)) {
    const uguali = r.firma!.filter((f) => prec.firma.includes(f)).length;
    if (uguali / r.firma!.length > 0.6) avvisi.push(`anti-ripetizione: ${uguali} beat su ${r.firma!.length} con le stesse mosse di ${prec.doc}`);
  }
  tempi.compilazione = (Date.now() - t) / 1000;

  // anteprima e controlli automatici (ADR §9): testi fuori zona, rimpiccioliti, poco contrasto
  t = Date.now();
  let ant;
  try { ant = await rendi(out, true); } catch (e: any) { fine({ errori: [`After Effects: ${e.message}`], avvisi }, 1); }
  tempi.anteprima = (Date.now() - t) / 1000;
  const problemi: string[] = [];
  const blocchi = json(controlli) as any[];
  const testi = r.S!.livelli.filter((l: any) => l.k === 'testo');
  const richiesto = Object.fromEntries(testi.map((l: any) => [l.nome, l.size]));
  const chiaro = Object.fromEntries(testi.map((l: any) => [l.nome, 0.2126 * l.colore[0] + 0.7152 * l.colore[1] + 0.0722 * l.colore[2] > 0.5]));
  const { W, H, safe } = r.S!;
  for (const b of blocchi) {
    if (b.x0 < safe.sinistra - 20 || b.x1 > W - 60 || b.y0 < safe.alto - 1 || b.y1 > safe.basso + 1) problemi.push(`${b.nome} «${b.testo ?? 'logo'}» esce dalla zona sicura delle interfacce`);
    if (richiesto[b.nome] && b.size < richiesto[b.nome] * 0.75) problemi.push(`${b.nome} «${b.testo}» è stato rimpicciolito da ${richiesto[b.nome]} a ${Math.round(b.size)} px per starci: righe troppo lunghe`);
    if (b.logo) continue;
    // contrasto: la mediana della luminosità nel riquadro del testo, quando il testo è tutto visibile
    const tm = Math.max(b.tin, b.tout - 0.3);
    const n = Math.floor((tm * 30) / PASSO_ANTEPRIMA);
    const x0 = Math.max(0, Math.floor(b.x0)), y0 = Math.max(0, Math.floor(b.y0));
    const w = Math.min(W - x0, Math.ceil(b.x1 - b.x0)), h = Math.min(H - y0, Math.ceil(b.y1 - b.y0));
    if (w < 4 || h < 4) continue;
    const px = spawnSync(FF, ['-v', 'error', '-i', ant!.video, '-vf', `select=eq(n\\,${n}),crop=${w}:${h}:${x0}:${y0},format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 64 << 20 }).stdout;
    if (!px?.length) continue;
    const ordinati = [...px].sort((a, b) => a - b);
    const mediana = ordinati[ordinati.length >> 1]!;
    if (chiaro[b.nome] && mediana > 165) problemi.push(`${b.nome} «${b.testo}»: testo chiaro su fondo chiaro (luminosità ${mediana}/255), si legge male`);
    if (!chiaro[b.nome] && mediana < 90) problemi.push(`${b.nome} «${b.testo}»: testo scuro su fondo scuro (luminosità ${mediana}/255), si legge male`);
  }

  // testi che si sovrappongono mentre sono a schermo insieme
  for (const [k, a] of blocchi.entries()) for (const b of blocchi.slice(k + 1)) {
    const insieme = Math.min(a.tout, b.tout) - Math.max(a.tin, b.tin) > 0.2;
    const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (insieme && dx > 4 && dy > 4) problemi.push(`${a.nome} «${a.testo ?? 'logo'}» e ${b.nome} «${b.testo ?? 'logo'}» si sovrappongono`);
  }
  if (problemi.length && !forza) {
    const foglio = path.join(out, 'anteprima.jpg');
    spawnSync(FF, ['-v', 'error', '-y', '-i', ant!.video, '-vf', 'fps=1.5,scale=216:384,tile=8x2', '-frames:v', '1', foglio]);
    fine({ esito: 'controlli non superati: correggi il documento e rilancia, o rilancia con --forza se va bene così', problemi, avvisi, anteprima: ant!.video, fotogrammi: foglio, tempi }, 2);
  }

  t = Date.now();
  let fin;
  try { fin = await rendi(out, false); } catch (e: any) { fine({ errori: [`After Effects: ${e.message}`], avvisi }, 1); }
  tempi.render = (Date.now() - t) / 1000;
  const foglio = path.join(out, 'fotogrammi.jpg');
  spawnSync(FF, ['-v', 'error', '-y', '-i', fin!.video, '-vf', `fps=12/${r.S!.durata},scale=270:480,tile=6x2`, '-frames:v', '1', foglio]);
  // proposte usate: il reel diventa un loro esempio per chi le approva
  for (const m of r.suMisura!) if (m.status === 'proposta') {
    const f = m.file.replace(/\.ts$/, '.json');
    const s = json(f);
    s.esempi = [...new Set([...(s.esempi ?? []), fin!.video])];
    writeFileSync(f, JSON.stringify(s, null, 2));
  }
  // un documento conta una volta sola, con la sua ultima versione
  const altri = storico.filter((s) => s.doc !== doc);
  altri.push({ doc, firma: r.firma! });
  mkdirSync(path.dirname(storicoFile), { recursive: true });
  writeFileSync(storicoFile, JSON.stringify(altri.slice(-20), null, 1));
  fine({ esito: 'ok', video: fin!.video, durata: r.S!.durata, fotogrammi: foglio, problemi, avvisi, su_misura: r.suMisura!.map((m) => `${m.id} (${m.status})`), tempi });
}

if (cmd === 'galleria') {
  const prop = readdirSync(path.join(VOC, 'proposte')).filter((f) => f.endsWith('.json')).map((f) => json(path.join(VOC, 'proposte', f)));
  const html = `<!doctype html><meta charset="utf-8"><title>Mosse proposte</title><style>body{font:15px system-ui;margin:24px;background:#f4f2ee}article{background:#fff;padding:16px;margin:0 0 16px;border-radius:8px}video{height:420px;margin-right:8px}code{background:#eee;padding:2px 4px}</style><h1>Mosse su misura da approvare</h1>${prop.map((m) => `<article><h2>${m.id} <small>${m.category} · da ${m.origine}</small></h2><p>${m.when}</p><p>Approva: <code>node reel.ts promuovi ${m.id}</code> · Scarta: <code>node reel.ts scarta ${m.id}</code></p>${(m.esempi ?? []).map((v: string) => `<video src="file:///${v.replaceAll('\\', '/')}" controls loop muted></video>`).join('')}</article>`).join('') || '<p>Nessuna.</p>'}`;
  const f = path.join(VOC, 'proposte', 'galleria.html');
  writeFileSync(f, html);
  fine(f);
}

if (cmd === 'promuovi' || cmd === 'scarta') {
  const id = arg[0];
  const da = path.join(VOC, 'proposte', id ?? '');
  if (!id || !existsSync(`${da}.json`)) fine(`proposta ${id} non trovata`, 1);
  if (cmd === 'promuovi') {
    const s = json(`${da}.json`);
    writeFileSync(`${da}.json`, JSON.stringify({ ...s, approvata: new Date().toISOString(), version: '1.0.0' }, null, 2));
    for (const est of ['.json', '.ts']) renameSync(da + est, path.join(VOC, 'mosse', id + est));
    fine(`${id} è nella libreria`);
  }
  for (const est of ['.json', '.ts']) rmSync(da + est, { force: true });
  fine(`${id} scartata`);
}

fine('comandi: catalogo | rendi <reel.json> [--forza] | guida-mosse | mossa <file.ts> <scheda.json> | galleria | promuovi <id> | scarta <id>', 1);
