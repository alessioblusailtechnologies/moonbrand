// Render su Nexrender Cloud, al posto di aerender sulla macchina: usato da esegui.mjs quando c'è NEXRENDER_TOKEN.
// Il progetto lo costruisce sempre l'AE di qui; poi raccogli() lo rende portabile e renderCloud() lo carica, lo fa
// rendere in pezzi paralleli (un job per intervallo di fotogrammi) e li riunisce con ffmpeg.
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ffmpeg from 'ffmpeg-static'

const API = 'https://api.nexrender.com/api/v2'
const js = s => s.replaceAll('\\', '/')
const pausa = ms => new Promise(r => setTimeout(r, ms))

// Nel progetto ancora aperto in AE: copia in pacchetto/ i file che usa, li ricollega, salva pacchetto/progetto.aep e
// annota i font dei livelli di testo (con il file da cui vengono) e i fotogrammi della composizione «Video».
export async function raccogli(cartella, inAE) {
  const pacchetto = path.join(cartella, 'pacchetto')
  fs.rmSync(pacchetto, { recursive: true, force: true })
  fs.mkdirSync(pacchetto)
  const esito = path.join(cartella, 'esito-pacchetto.txt')
  const info = path.join(pacchetto, 'info.json')
  const jsx = path.join(cartella, 'pacchetto.jsx')
  fs.writeFileSync(jsx, `
(function () {
  function scrivi(p, t) { var f = new File(p); f.encoding = "UTF-8"; f.open("w"); f.write(t); f.close(); }
  scrivi("${js(esito)}", "avviato");
  try {
    var p = app.project, dest = "${js(pacchetto)}/", visti = {}, font = {}, video = null;
    // Il file del font: dal documento di testo o, se lì è vuoto, dall'elenco dei font di AE.
    function nota(doc) {
      if (!doc || !doc.font || font[doc.font]) return;
      var dove = doc.fontLocation || "";
      if (!dove && app.fonts && app.fonts.getFontsByPostScriptName) {
        var trovati = app.fonts.getFontsByPostScriptName(doc.font);
        if (trovati && trovati.length) dove = trovati[0].location || "";
      }
      font[doc.font] = dove;
    }
    for (var i = 1; i <= p.numItems; i++) {
      var it = p.item(i);
      if (it instanceof CompItem) {
        if (it.name === "Video") video = it;
        for (var l = 1; l <= it.numLayers; l++) {
          var ly = it.layer(l);
          if (!(ly instanceof TextLayer)) continue;
          var st = ly.property("ADBE Text Properties").property("ADBE Text Document");
          nota(st.value);
          for (var k = 1; k <= st.numKeys; k++) nota(st.keyValue(k));
        }
      } else if (it instanceof FootageItem && it.file && it.file.exists) {
        var nome = it.file.name;
        if (visti[nome] && visti[nome] !== it.file.fsName) nome = i + "_" + nome;
        visti[nome] = it.file.fsName;
        var copia = new File(dest + nome);
        if (!copia.exists) it.file.copy(copia);
        it.replace(copia);
      }
    }
    if (!video) throw new Error("manca la composizione Video");
    var righe = [];
    for (var n in font) righe.push('"' + n + '":"' + String(font[n]).replace(/\\\\/g, "/") + '"');
    scrivi("${js(info)}", '{"fotogrammi":' + Math.round(video.duration * video.frameRate) + ',"font":{' + righe.join(",") + '}}');
    p.save(new File(dest + "progetto.aep"));
    scrivi("${js(esito)}", "ok");
  } catch (e) { scrivi("${js(esito)}", "errore nel pacchetto: " + e.toString() + " (riga " + e.line + ")"); }
})();
`)
  const r = await inAE(jsx, esito)
  if (r !== 'ok') throw new Error(r)
  return { pacchetto, ...JSON.parse(fs.readFileSync(info, 'utf8')) }
}

// Nome PostScript (name id 6) di un file .ttf/.otf: AE non dice da che file viene un font, quindi lo si cerca qui.
function nomePostScript(file) {
  try {
    const b = fs.readFileSync(file)
    const n = b.readUInt16BE(4)
    for (let i = 0; i < n; i++) {
      const r = 12 + i * 16
      if (b.toString('latin1', r, r + 4) !== 'name') continue
      const t = b.readUInt32BE(r + 8)
      const conta = b.readUInt16BE(t + 2), testi = t + b.readUInt16BE(t + 4)
      for (let j = 0; j < conta; j++) {
        const e = t + 6 + j * 12
        if (b.readUInt16BE(e + 6) !== 6) continue
        const piatt = b.readUInt16BE(e), lung = b.readUInt16BE(e + 8), da = testi + b.readUInt16BE(e + 10)
        if (piatt === 1) return b.toString('latin1', da, da + lung)
        let out = ''
        for (let k = 0; k < lung; k += 2) out += String.fromCharCode(b.readUInt16BE(da + k))
        return out
      }
    }
  } catch {}
  return null
}
function fileDeiFont() {
  const mappa = {}
  for (const dir of [path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Windows', 'Fonts'), path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts')]) {
    let nomi = []
    try { nomi = fs.readdirSync(dir) } catch {}
    for (const f of nomi) {
      if (!/\.(ttf|otf)$/i.test(f)) continue
      const ps = nomePostScript(path.join(dir, f))
      if (ps && !mappa[ps]) mappa[ps] = path.join(dir, f)
    }
  }
  return mappa
}

export async function renderCloud(cartella, { pacchetto, fotogrammi, font }, token) {
  const chiama = async (metodo, p, corpo) => {
    const multipart = corpo instanceof FormData
    const r = await fetch(API + p, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(corpo && !multipart ? { 'Content-Type': 'application/json' } : {}) },
      body: multipart ? corpo : corpo ? JSON.stringify(corpo) : undefined,
    })
    const testo = await r.text()
    if (!r.ok) throw new Error(`Nexrender ${metodo} ${p} ${r.status}: ${testo.slice(0, 500)}`)
    try { return JSON.parse(testo) } catch { return testo }
  }
  const t0 = Date.now()
  const da = () => `${Math.round((Date.now() - t0) / 1000)} s`

  // Font: caricati una volta sola, con un nome che dipende dal contenuto (brand diversi, stesso nome di file).
  const caricati = new Set((await chiama('GET', '/fonts')).map(f => f.fileName))
  const fonts = []
  let installati
  for (let [nome, file] of Object.entries(font)) {
    if (!file) file = (installati ??= fileDeiFont())[nome]
    if (!file || !fs.existsSync(file)) { console.log(`font ${nome}: file non trovato, Nexrender userà un sostituto`); continue }
    if (!/\.ttf$/i.test(file)) console.log(`font ${nome}: Nexrender accetta solo TTF, ${path.basename(file)} potrebbe non andare`)
    const dati = fs.readFileSync(file)
    const fileName = `${crypto.createHash('sha1').update(dati).digest('hex').slice(0, 8)}-${path.basename(file)}`
    if (!caricati.has(fileName)) {
      const fd = new FormData()
      fd.append('font', new Blob([dati]), fileName)
      await chiama('POST', '/fonts', fd)
      caricati.add(fileName)
    }
    if (!fonts.includes(fileName)) fonts.push(fileName)
  }

  // Il progetto come template: zip della cartella pacchetto, caricato sull'indirizzo che dà Nexrender.
  const zip = path.join(cartella, 'pacchetto.zip')
  fs.rmSync(zip, { force: true })
  const tar = spawnSync('C:\\Windows\\System32\\tar.exe', ['-a', '-c', '-f', zip, '-C', pacchetto, '.'], { encoding: 'utf8' })
  if (tar.status !== 0) throw new Error(`zip del pacchetto: ${tar.stderr}`)
  const creato = await chiama('POST', '/templates', { type: 'zip', displayName: path.basename(path.dirname(cartella)) + '/' + path.basename(cartella) })
  const id = creato.template.id
  const u = creato.uploadInfo
  const dati = fs.readFileSync(zip)
  let su
  if (u.method === 'PUT') su = await fetch(u.url, { method: 'PUT', body: dati })
  else {
    const fd = new FormData()
    for (const [k, v] of Object.entries(u.fields || {})) fd.append(k, v)
    fd.append('file', new Blob([dati]), 'pacchetto.zip')
    su = await fetch(u.url, { method: 'POST', body: fd })
  }
  if (!su.ok) throw new Error(`caricamento del pacchetto: ${su.status}`)
  let tpl
  for (;;) {
    tpl = await chiama('GET', `/templates/${id}`)
    if (tpl?.status === 'uploaded') break
    if (tpl?.status === 'error') throw new Error(`template rifiutato: ${tpl.error}`)
    if (Date.now() - t0 > 5 * 60_000) throw new Error('il template non è pronto dopo 5 minuti')
    await pausa(2000)
  }
  console.log(`progetto caricato su Nexrender in ${da()}`)

  // Un job per pezzo di circa 2,5 secondi (75 fotogrammi), fino a 8: ogni pezzo costa ~15 s fissi di avvio.
  const pezzi = Math.max(1, Math.min(8, Math.round(fotogrammi / 75)))
  const passo = Math.ceil(fotogrammi / pezzi)
  const settings = { type: 'video', quality: 'full', engine: 'ae2026' }
  const jobs = []
  for (let i = 0; i < pezzi; i++) {
    const frames = pezzi > 1 ? [i * passo, Math.min(fotogrammi, (i + 1) * passo) - 1] : undefined
    jobs.push(await chiama('POST', '/jobs', { template: { id: tpl.id, composition: 'Video' }, fonts, settings: { ...settings, ...(frames ? { frames } : {}) } }))
  }
  console.log(`render su Nexrender in ${pezzi} ${pezzi === 1 ? 'pezzo' : 'pezzi'}`)
  let battito = Date.now()
  let fatti
  for (;;) {
    fatti = await Promise.all(jobs.map(j => chiama('GET', `/jobs/${j.id}`)))
    const errore = fatti.find(j => j.status === 'error' || j.status === 'manually_cancelled')
    if (errore) throw new Error(`render su Nexrender fallito: ${errore.stats?.error ?? errore.status}`)
    if (fatti.every(j => j.status === 'finished')) break
    if (Date.now() - t0 > 25 * 60_000) throw new Error('render su Nexrender non finito in 25 minuti')
    if (Date.now() - battito > 15_000) {
      const media = fatti.reduce((s, j) => s + (j.progress || 0), 0) / fatti.length
      console.log(`render su Nexrender da ${da()}, al ${Math.round(media)}%`)
      battito = Date.now()
    }
    await pausa(2000)
  }
  const secondi = fatti.reduce((s, j) => s + (j.stats?.renderDuration || 0), 0)

  // Pezzi scaricati e riuniti senza ricodifica; la conversione per i social la fa poi esegui.mjs.
  const dir = path.join(cartella, 'pezzi')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir)
  const file = await Promise.all(fatti.map(async (j, i) => {
    const f = path.join(dir, `${String(i).padStart(2, '0')}.mp4`)
    const r = await fetch(j.outputUrl)
    if (!r.ok) throw new Error(`scaricamento del pezzo ${i + 1}: ${r.status}`)
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()))
    return f
  }))
  const grezzo = path.join(cartella, 'grezzo.mp4')
  if (file.length === 1) fs.renameSync(file[0], grezzo)
  else {
    const lista = path.join(dir, 'lista.txt')
    fs.writeFileSync(lista, file.map(f => `file '${js(f)}'`).join('\n'))
    const c = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', grezzo], { encoding: 'utf8' })
    if (c.status !== 0) throw new Error(`unione dei pezzi: ${c.stderr}`)
  }
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(zip, { force: true })
  chiama('DELETE', `/templates/${tpl.id}`).catch(() => {})
  console.log(`render su Nexrender finito in ${da()} (${pezzi} pezzi, ${Math.round(secondi)} s di render fatturati)`)
  return { pezzi, secondiFatturati: secondi }
}
