// Il compilatore (ADR-001 §6): documento DSL → scena risolta → JSX. Deterministico: stesso documento, stesso script.
// Valida lo schema, passa il linter delle regole di composizione (corregge dove può e lo dice), risolve layout in
// coordinate e tempi sulla griglia della musica, e scrive lo script: la libreria delle mosse, le mosse su misura usate e
// la scena.
import Ajv from 'ajv';
import ts from 'typescript';
import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { QUI, STILE, catalogo, schemaDocumento } from './schema.ts';

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const durataFile = (f: string) =>
  Number(spawnSync(ffmpeg as unknown as string, ['-i', f], { encoding: 'utf8' }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((s, v) => s * 60 + Number(v), 0) ?? 0);

export function compila(doc: any, cartellaBrand: string, controlli?: string) {
  const avvisi: string[] = [];
  const errori: string[] = [];
  const CAT = catalogo();
  const MOSSA: Record<string, any> = Object.fromEntries(CAT.map((m) => [m.id, m]));
  const suMisura = new Set<string>();
  const usa = (id?: string) => { if (id && MOSSA[id] && MOSSA[id].status !== 'base') suMisura.add(id); };

  // 1. schema e file
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (!ajv.validate(schemaDocumento(CAT), doc)) errori.push(...ajv.errors!.map((e) => `schema: ${e.instancePath} ${e.message}${(e.params as any)?.allowedValues ? ' ' + (e.params as any).allowedValues.join(', ') : ''}`));
  if (errori.length) return { errori, avvisi };
  const file = (rel: string) => path.resolve(cartellaBrand, rel);
  for (const f of [doc.kit.music.file, doc.kit.logo, ...doc.beats.map((b: any) => b.media)]) if (f && !existsSync(file(f))) errori.push(`file mancante: ${f}`);
  if (errori.length) return { errori, avvisi };

  // 2. stile, kit e griglia della musica
  const fmt = STILE.formati[doc.format];
  const { W, H, safe } = fmt;
  const curva = STILE.curve[doc.style.curves];
  const en = STILE.energia[doc.style.energy];
  const kit = doc.kit;
  const font = { titolo: kit.fonts.title, corsivo: kit.fonts.title_italic, testo: kit.fonts.text, forte: kit.fonts.strong };
  const colore = { testo: hex(kit.colors.text), inchiostro: hex(kit.colors.ink), carta: hex(kit.colors.paper), accento: hex(kit.colors.accent) };
  const mus = { file: kit.music.file, bpm: kit.music.bpm, inizio: kit.music.first_beat ?? 0, durata: durataFile(file(kit.music.file)) };
  const BEAT = 60 / mus.bpm, BAR = BEAT * 4;
  const FPS = 30;
  const fot = (t: number) => Math.round(t * FPS) / FPS;
  const durate: Record<string, number> = {};
  for (const b of doc.beats) if (!/\.(jpe?g|png|webp)$/i.test(b.media)) durate[b.media] ??= durataFile(file(b.media));

  // parametri: default del catalogo, dentro i limiti, durate scalate dall'energia
  function parametri(id: string, dati: any = {}) {
    const m = MOSSA[id];
    const p: any = {};
    for (const [k, def] of Object.entries<any>(m?.params ?? {})) {
      let v = dati?.[k] ?? def.default;
      if (def.enum) { if (!def.enum.includes(v)) { avvisi.push(`${id}.${k}=${v} non valido: uso ${def.default}`); v = def.default; } }
      else if (typeof def.default === 'number' && (typeof v !== 'number' || v < def.min || v > def.max)) {
        const c = typeof v === 'number' ? Math.min(def.max, Math.max(def.min, v)) : def.default;
        avvisi.push(`${id}.${k}=${v} fuori dai limiti (${def.min}-${def.max}): uso ${c}`);
        v = c;
      }
      p[k] = v;
    }
    const lim = m?.duration_ms;
    let ms = dati?.duration_ms ?? lim?.default ?? 0;
    if (lim) ms = Math.min(lim.max, Math.max(lim.min, ms));
    return { p, dur: (ms / 1000) * en.durata };
  }

  // 3. linter delle regole di composizione, con correzioni deterministiche
  const beats = doc.beats.map((b: any) => structuredClone(b));
  const parole = (b: any) => (b.lines ?? []).join(' ').split(/\s+/).filter(Boolean).length;
  const FALLBACK_SIG: Record<string, string> = { whip_pan: 'push', flash: 'cut', shake_hit: 'zoom_punch' };
  const OPPOSTO: Record<string, string> = { left: 'right', right: 'left', up: 'down', down: 'up', diag: 'left' };
  if (!beats[0].lines?.length) avvisi.push('regola hook: il primo beat non ha testo, il reel non si aggancia nel primo secondo e mezzo');
  for (const [i, b] of beats.entries()) {
    b.transition ??= { move: 'cut' };
    b.media_in ??= { move: 'none' };
    b.camera ??= { move: 'static' };
    b.in ??= { move: 'word_stagger_up' };
    b.out ??= { move: 'fade' };
    b.emphasis ??= { move: 'none' };
    for (const slot of ['transition', 'media_in', 'camera', 'in', 'out', 'emphasis']) usa(b[slot].move);
    for (const o of b.overlays ?? []) usa(o.move);
    usa(b.logo_in?.move);
    const n = parole(b);
    const mi = MOSSA[b.in.move];
    if (mi?.max_words && n > mi.max_words) {
      const nuova = n <= 14 ? 'line_mask_reveal' : 'word_blur_in';
      avvisi.push(`regola testi lunghi: beat ${i + 1} ha ${n} parole, ${b.in.move} → ${nuova}`);
      b.in = { move: nuova, params: {} };
    } else if (mi?.energy === 'high' && n > 8) {
      avvisi.push(`regola testi lunghi: beat ${i + 1} mossa veloce su ${n} parole → word_blur_in`);
      b.in = { move: 'word_blur_in', params: {} };
    }
    if (b.out.move !== 'fade' && !MOSSA[b.out.move]?.invertible) b.out = { move: 'fade' };
    const d = b.transition.params?.direction, dp = beats[i - 1]?.transition?.params?.direction;
    if (i > 1 && d && d === dp && b.transition.move === beats[i - 1].transition.move) {
      avvisi.push(`regola lati: beat ${i + 1} entrava dallo stesso lato del precedente (${d}) → ${OPPOSTO[d]}`);
      b.transition.params.direction = OPPOSTO[d];
    }
  }
  // tempi: il primo beat parte da 0 e finisce sul battere giusto, gli altri durano un numero di battute
  const inizi: number[] = [0];
  let fine = mus.inizio;
  for (const b of beats) { fine += b.bars * BAR; inizi.push(fine); }
  let ultimaSig = -99;
  for (const [i, b] of beats.entries()) {
    for (const slot of ['transition', 'emphasis']) {
      const id = b[slot].move;
      if (!MOSSA[id]?.signature) continue;
      if (inizi[i]! - ultimaSig < 6) {
        avvisi.push(`regola signature: ${id} al beat ${i + 1} a meno di 6 s dalla precedente → ${FALLBACK_SIG[id] ?? 'cut'}`);
        b[slot] = { ...b[slot], move: FALLBACK_SIG[id] ?? (slot === 'emphasis' ? 'none' : 'cut') };
      } else ultimaSig = inizi[i]!;
    }
  }
  // riprese: il pezzo usato deve stare dentro il video
  for (const [i, b] of beats.entries()) {
    const dv = durate[b.media];
    if (!dv) continue;
    const serve = (inizi[i + 1]! - inizi[i]! + 0.6) * (b.speed ?? 1);
    if ((b.media_from ?? 0) + serve > dv) {
      const da = Math.max(0, dv - serve - 0.05);
      avvisi.push(da > 0 ? `beat ${i + 1}: ${b.media} dura ${dv.toFixed(1)} s, da ${b.media_from ?? 0} s non basta: parto da ${da.toFixed(2)} s` : `beat ${i + 1}: ${b.media} (${dv.toFixed(1)} s) è più corta del beat: l'ultimo fotogramma resta fermo`);
      b.media_from = r3(da);
    }
  }

  // 4. layout
  const scala = STILE.scala_tipografica;
  const xDi = (al: string) => (al === 'left' ? safe.sinistra : (safe.sinistra + safe.destra) / 2);
  const larghezza = safe.destra - safe.sinistra;
  const yDi = (focal: string) => STILE.focali[focal] * H;
  const ancoraDi = (focal: string) => (focal === 'alto' ? 'alto' : focal === 'basso' ? 'basso' : 'centro');
  const righe = (lines: string[], titolo: boolean) =>
    lines.map((t, k) => ({ t, font: titolo && font.corsivo && lines.length > 1 && k === lines.length - 1 ? font.corsivo : undefined }));
  function unita(id: string, lines: string[]) {
    if (['line_mask_reveal', 'tracking_expand'].includes(id) || MOSSA[id]?.status !== 'base') return lines.length;
    if (['char_cascade', 'typewriter'].includes(id)) return lines.join('').length;
    return lines.join(' ').split(/\s+/).length;
  }
  // una mossa sul testo, con lo scaglionamento risolto; la durata totale serve per i tempi di lettura
  function mossaTesto(slot: any, t: number, lines: string[], size: number, inv = false, durMax = 99) {
    const id = slot.move;
    const { p, dur } = parametri(id, slot.params);
    const q: any = { ...p };
    if (p.stagger_ms !== undefined) q.stagger = (p.stagger_ms / 1000) * en.stagger;
    if (p.distance_pct !== undefined) q.distanza = MOSSA[id]?.category === 'element_in' ? (p.distance_pct / 100) * H * en.distanza : (p.distance_pct / 100) * size * 1.2 * en.distanza;
    if (id === 'typewriter') { q.stagger = 1 / p.cps; q.du = 0.001; }
    const n = unita(id, lines);
    let du = q.du ?? (dur || 0.5);
    let totale = du + (q.stagger ?? 0) * (n - 1);
    if (totale > durMax) {
      const k = durMax / totale;
      du *= k; if (q.stagger) q.stagger *= k; totale = durMax;
    }
    if (id !== 'typewriter') q.du = du;
    const ov = p.overshoot ?? curva.overshoot ?? 0;
    const perRiga = MOSSA[id]?.status !== 'base' && MOSSA[id]?.category === 'text_in';
    return { m: { id, t: r3(t), dur: r3(du), p: q, bez: curva.bezier, ov, inv, perRiga }, totale };
  }
  const uscita = (slot: any, tFine: number, lines: string[], size: number) => {
    if (!slot || slot.move === 'fade') return { id: 'fade_up', t: r3(tFine - 0.3), dur: 0.3, p: { distanza: 0 }, bez: [0.33, 0, 0.67, 1], ov: 0, inv: true };
    const prova = mossaTesto(slot, 0, lines, size, true, 0.6);
    return { ...prova.m, t: r3(tFine - prova.totale) };
  };

  // 5. scena
  const livelli: any[] = [];
  const durata = fot(Math.min(inizi[beats.length]!, mus.durata));
  if (inizi[beats.length]! > mus.durata + 0.01) avvisi.push(`il reel (${inizi[beats.length]!.toFixed(2)} s) è più lungo della musica (${mus.durata.toFixed(2)} s): tagliato`);
  const TRANS: Record<string, [string | null, string | null]> = {
    dissolve: [null, 'dissolve_in'], push: ['push_out', 'push_in'], mask_wipe: [null, 'wipe_in'], iris_reveal: [null, 'iris_in'],
    zoom_through: ['zoom_through_out', 'zoom_through_in'], whip_pan: ['whip_out', 'whip_in'],
  };
  const riprese: any[] = [];
  for (const [i, b] of beats.entries()) {
    const t0 = fot(inizi[i]!), t1 = fot(Math.min(inizi[i + 1]!, durata));
    const ripresa: any = { k: 'media', nome: `beat ${i + 1} ripresa`, file: b.media, da: b.media_from ?? 0, vel: b.speed ?? 1, bianconero: !!b.bw, tin: t0, tout: t1, mosse: [] };
    const fermo = !durate[b.media];
    const cam = b.camera.move === 'static' && fermo ? 'slow_push' : b.camera.move;
    ripresa.camera = { id: cam, p: parametri(cam, b.camera.params).p };
    let tTesto = t0 + 0.12;
    const tr = i > 0 ? b.transition.move : 'cut';
    if (tr !== 'cut') {
      const { p, dur } = parametri(tr, b.transition.params);
      const a = fot(Math.max(t0 - dur / 2, inizi[i - 1]! + 0.3)), z = fot(a + dur);
      const [fuori, dentro] = TRANS[tr] ?? [null, null];
      const prec = riprese[i - 1];
      if (tr === 'flash') {
        livelli.push({ k: 'solido', nome: `flash ${i + 1}`, colore: [1, 1, 1], tin: a, tout: z, mosse: [{ id: 'flash', t: a, dur: r3(z - a), p, bez: curva.bezier, ov: 0 }], _ordine: i + 0.99 });
      } else {
        prec.tout = Math.max(prec.tout, z);
        ripresa.tin = a;
        if (fuori) prec.mosse.push({ id: fuori, t: a, dur: r3(z - a), p, bez: curva.bezier, ov: 0 });
        if (dentro) ripresa.mosse.push({ id: dentro, t: a, dur: r3(z - a), p, bez: curva.bezier, ov: 0 });
      }
      tTesto = Math.max(tTesto, z - 0.05);
    }
    if (b.media_in.move !== 'none') {
      const { p, dur } = parametri(b.media_in.move, b.media_in.params);
      ripresa.mosse.push({ id: b.media_in.move, t: ripresa.tin, dur: r3(dur), p, bez: curva.bezier, ov: 0 });
    }
    riprese.push(ripresa);
    livelli.push({ _ordine: i, _ripresa: i });

    // testi
    const L = b.layout;
    const tipo = b.type;
    const lines = (b.lines ?? []).filter((x: string) => x.trim());
    const size = tipo === 'stat' ? scala.xxl : scala[L.type_scale];
    const fontPrincipale = tipo === 'stat' ? font.forte : tipo === 'quote' ? font.corsivo ?? font.titolo : font.titolo;
    const prossima = i + 1 < beats.length ? beats[i + 1].transition.move : 'cut';
    const durProssima = prossima === 'cut' ? 0 : parametri(prossima, beats[i + 1].transition.params).dur;
    const fineTesto = fot(Math.min(t1 - durProssima / 2, durata - 0.05));
    const testi: any[] = [];
    const blocco = (nome: string, rr: any[], s: number, f: string, y: number, ancora: string, extra: any = {}) => {
      const bl: any = { k: 'testo', nome: `beat ${i + 1} ${nome}`, righe: rr, font: f, size: s, colore: colore.testo, accento: colore.carta, x: xDi(L.align), y: r3(y), ancora, allinea: L.align, larghezza, interlinea: f === font.forte ? 0.95 : 1.02, tracking: 0, tin: fot(tTesto), tout: fineTesto, mosse: [], ...extra };
      testi.push(bl);
      return bl;
    };
    const hEst = (n: number, s: number) => n * s * 1.02;
    let principale: any = null;
    let visibile = tTesto;
    const box = b.emphasis.move === 'highlight_box' ? (parametri('highlight_box', b.emphasis.params).p.padding_pct / 100) * W * 0.6 : 0;
    if (lines.length) {
      principale = blocco('titolo', righe(lines, tipo !== 'stat' && tipo !== 'quote'), size, fontPrincipale, yDi(L.focal), ancoraDi(L.focal), box ? { colore: colore.inchiostro } : {});
      const max = i === 0 ? 1.5 - (tTesto - t0) : (fineTesto - tTesto) * 0.45;
      const { m, totale } = mossaTesto(b.in, tTesto, lines, size, false, max);
      if (i === 0 && totale > 1.5) avvisi.push('regola hook: entrata compressa entro 1,5 s');
      principale.mosse.push(m);
      visibile = tTesto + totale;
    }
    const yBase = (principale ? (principale.ancora === 'alto' ? principale.y + hEst(lines.length, size) : principale.ancora === 'basso' ? principale.y : principale.y + hEst(lines.length, size) / 2) : yDi(L.focal)) + box;
    const piccola = MOSSA.tracking_expand ? 'tracking_expand' : 'fade_up';
    if (b.items?.length) {
      const si = scala.m * 0.62;
      b.items.slice(0, 4).forEach((it: string, k: number) => {
        const t = visibile + k * BEAT;
        // sotto il blocco prima, misurato in After Effects
        const sopra = k === 0 ? principale?.nome : `beat ${i + 1} voce ${k}`;
        const bl = blocco(`voce ${k + 1}`, [{ t: it }], si, font.testo, yBase + 70 + k * si * 1.9, 'alto', { tin: fot(t), ...(sopra ? { sotto: sopra, distanza: k === 0 ? 70 + box : si * 0.9 } : {}) });
        bl.mosse.push(mossaTesto({ move: 'fade_up' }, t, [it], si).m);
      });
    }
    if (b.secondary?.trim()) {
      const s2 = tipo === 'stat' ? scala.s : scala.xs;
      const bl = blocco('secondario', [{ t: b.secondary.toUpperCase() }], s2, font.testo, yBase + (tipo === 'stat' ? 50 : 45), 'alto', { tin: fot(visibile), tracking: 120, ...(principale ? { sotto: b.items?.length ? `beat ${i + 1} voce ${Math.min(b.items.length, 4)}` : principale.nome, distanza: Math.max(tipo === 'stat' ? 40 : 34, size * 0.3) + (b.items?.length ? 30 : box) } : {}) });
      bl.mosse.push(mossaTesto({ move: piccola }, visibile, [b.secondary], s2, false, 0.9).m);
    }
    if (tipo === 'cta' && kit.logo) {
      const t = visibile + BEAT;
      const lw = { s: 180, m: 280, l: 400 }[b.logo_size as 's' | 'm' | 'l' ?? 'm'];
      testi.push({ k: 'logo', nome: `beat ${i + 1} logo`, file: kit.logo, x: W / 2, y: safe.basso - lw * 0.45, larghezza: lw, tin: fot(t), tout: durata, mosse: [mossaTesto(b.logo_in ?? { move: 'fade_up' }, t, ['logo'], 100).m] });
    }
    for (const bl of testi) {
      if (bl.k !== 'testo') continue;
      if (i === beats.length - 1) bl.tout = durata;
      else bl.mosse.push(uscita(bl === principale ? b.out : null, bl.tout, bl.righe.map((r: any) => r.t), bl.size));
    }
    // enfasi sul battito
    const enf = b.emphasis.move;
    if (enf !== 'none') {
      const { p, dur } = parametri(enf, b.emphasis.params);
      let t = t0 + ((b.emphasis.on_beat ?? 1) - 1) * BEAT;
      if (enf === 'highlight_box') t = tTesto;
      else while (t < visibile) t += BEAT;
      const bersaglio = principale && enf !== 'shake_hit' ? principale : ripresa;
      if (t + dur > (bersaglio === ripresa ? t1 : fineTesto) - 0.2) avvisi.push(`enfasi ${enf} al beat ${i + 1} non ci sta nel tempo: tolta`);
      else if ((enf === 'underline_draw' || enf === 'highlight_box') && !principale) avvisi.push(`enfasi ${enf} al beat ${i + 1} senza testo: tolta`);
      else bersaglio.mosse.push({ id: enf, t: r3(t), dur: r3(dur), p, bez: curva.bezier, ov: 0 });
    }
    if (principale) {
      const n = parole(b), serve = 0.28 * n + 0.6, ha = principale.tout - visibile;
      if (ha < serve) avvisi.push(`regola lettura: beat ${i + 1} resta leggibile ${ha.toFixed(2)} s, ne servono ${serve.toFixed(2)} per ${n} parole: allunga il beat o accorcia il testo`);
    }
    // overlay su misura: livelli loro, sopra la ripresa e sotto i testi
    for (const o of b.overlays ?? []) {
      const { p, dur } = parametri(o.move, o.params);
      livelli.push({ k: 'overlay', nome: `beat ${i + 1} ${o.move}`, mossa: { id: o.move, t: r3(tTesto), dur: r3(dur || t1 - tTesto), tin: ripresa.tin, tout: t1, p, bez: curva.bezier, ov: curva.overshoot ?? 0, colori: colore, font, focal: yDi(L.focal) }, _ordine: i + 0.55 });
    }
    if (testi.length) {
      const f = L.focal;
      livelli.push({ k: 'velo', nome: `beat ${i + 1} velo`, colore: colore.inchiostro, tin: ripresa.tin, tout: t1, alto: ['alto', 'terzo_alto'].includes(f) ? 62 : 0, basso: ['terzo_basso', 'basso'].includes(f) || tipo === 'cta' ? 68 : 0, tutto: f === 'centro' || ['list', 'quote', 'stat'].includes(tipo) ? 34 : 0, _ordine: i + 0.5 });
    }
    for (const bl of testi) livelli.push({ ...bl, _ordine: i + 0.6 });
  }
  livelli.sort((a, b) => a._ordine - b._ordine);
  // le riprese si risolvono alla fine: la transizione del beat dopo allunga quella prima
  const finali = livelli.map(({ _ordine, _ripresa, ...l }) => (_ripresa !== undefined ? riprese[_ripresa] : l)).map((l) => ({ ...l, mosse: l.mosse ?? [] }));

  const S = { W, H, FPS, durata, sfondo: colore.inchiostro, safe, cartella: path.resolve(cartellaBrand).replaceAll('\\', '/') + '/', audio: { file: mus.file }, controlli, livelli: finali };
  const firma = beats.map((b: any) => `${b.type}:${b.transition.move}/${b.in.move}/${b.camera.move}`);
  return { errori, avvisi, S, firma, suMisura: [...suMisura].map((id) => MOSSA[id]) };
}

// La libreria e le mosse su misura usate, insieme in un solo TypeScript controllato con i tipi di AE 26, poi ES3.
export function scriviScript(S: any, suMisura: any[], uscita: string) {
  const lib = readFileSync(path.join(QUI, 'vocabolario', 'libreria.ts'), 'utf8');
  const extra = suMisura.map((m) => `// ---- ${m.id} (${m.status})\n${readFileSync(m.file, 'utf8')}`).join('\n');
  const tutto = path.join(uscita, 'libreria-reel.ts');
  writeFileSync(tutto, lib.replace('// @@MOSSE_SU_MISURA@@', extra));
  const config = ts.getParsedCommandLineOfConfigFile(path.join(QUI, 'lib', 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} } as any)!;
  const programma = ts.createProgram([...config.fileNames, tutto], config.options);
  const errori = ts.getPreEmitDiagnostics(programma);
  if (errori.length) throw new Error('le mosse su misura non passano il controllo dei tipi:\n' + ts.formatDiagnostics(errori, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => uscita, getNewLine: () => '\n' }));
  let codice = '';
  programma.emit(programma.getSourceFile(tutto), (_f, testo) => { codice = testo; });
  const es5 = readFileSync(path.join(QUI, 'lib', 'es5.jsx'), 'utf8');
  const err = JSON.stringify(S.controlli + '.errore');
  writeFileSync(
    path.join(uscita, 'script.jsx'),
    `${es5}\n(function () {\n  try {\n    var S = ${JSON.stringify(S)};\n${codice}\n  } catch (e) {\n    var f = new File(${err}); f.encoding = "UTF-8"; f.open("w"); f.write(e.toString() + " (riga " + e.line + " di script.jsx)"); f.close();\n    throw e;\n  }\n})();\n`,
  );
}
