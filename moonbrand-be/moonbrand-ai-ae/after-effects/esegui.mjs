// node esegui.mjs <cartella>/<nome>.ts [numero fotogrammi]
// Esegue lo script preparato da prepara.mjs (<cartella>/<nome>/script.jsx) in After Effects, renderizza la composizione
// «Video» con aerender, la converte in <cartella>/<nome>/video.mp4 e ne estrae alcuni fotogrammi in <cartella>/<nome>/fotogrammi/.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ffmpeg from 'ffmpeg-static'

const sorgente = process.argv[2]
const quanti = Number(process.argv[3] ?? 6)
if (!sorgente) { console.error('uso: node esegui.mjs <file.ts> [fotogrammi]'); process.exit(2) }
const radice = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const cartella = path.join(path.dirname(path.resolve(sorgente)), path.basename(sorgente, path.extname(sorgente)))
const script = path.join(cartella, 'script.jsx')
if (!fs.existsSync(script)) { console.error(`manca ${script}: prima node prepara.mjs ${sorgente}`); process.exit(2) }

function trovaAE() {
  if (process.env.AE_DIR) return process.env.AE_DIR
  const adobe = 'C:\\Program Files\\Adobe'
  const versioni = fs.existsSync(adobe) ? fs.readdirSync(adobe).filter(d => d.startsWith('Adobe After Effects')).sort() : []
  if (!versioni.length) throw new Error('After Effects non trovato (si può indicare la cartella Support Files con AE_DIR)')
  return path.join(adobe, versioni.at(-1), 'Support Files')
}
const ae = trovaAE()
const tempi = {}
let t = Date.now()

// 1. Script: AfterFX -r lo passa all'istanza aperta; la fine si riconosce da esito.txt.
// AE avviato da qui al primo colpo dà errore, quindi deve essere già aperto.
if (!spawnSync('tasklist', ['/FI', 'IMAGENAME eq AfterFX.exe'], { encoding: 'utf8' }).stdout.includes('AfterFX.exe')) {
  console.error('After Effects non è aperto: va aperto a mano una volta, poi resta aperto')
  process.exit(1)
}
// After Effects è uno solo per tutti i brand: uno script alla volta, con una cartella come lucchetto che dice chi lo tiene
// (il render invece gira in un processo suo e può andare in parallelo). Il lucchetto di un processo che non c'è più (un
// comando chiuso a metà) si toglie.
const lucchetto = path.join(radice, '.ae-occupato')
const vivo = pid => { try { process.kill(pid, 0); return true } catch { return false } }
const attesa = Date.now() + 30 * 60_000
for (;;) {
  try { fs.mkdirSync(lucchetto); fs.writeFileSync(path.join(lucchetto, 'pid'), String(process.pid)); break } catch {}
  try {
    const chi = Number(fs.readFileSync(path.join(lucchetto, 'pid'), 'utf8'))
    if ((chi && !vivo(chi)) || Date.now() - fs.statSync(lucchetto).mtimeMs > 20 * 60_000) { fs.rmSync(lucchetto, { recursive: true, force: true }); continue }
  } catch {}
  if (Date.now() > attesa) { console.error('After Effects è occupato da un altro script da più di 30 minuti'); process.exit(1) }
  if ((Date.now() - t) % 30_000 < 1000) console.log('After Effects è occupato da un altro brand, aspetto il mio turno')
  await new Promise(r => setTimeout(r, 1000))
}
const libera = () => fs.rmSync(lucchetto, { recursive: true, force: true })
process.on('exit', libera)
// Lo script scrive «avviato» appena parte e l'esito alla fine. AE a volte perde lo script che gli arriva: se dopo 30
// secondi non è partito, si rimanda (fino a 5 volte).
const esito = path.join(cartella, 'esito.txt')
const leggi = () => { try { return fs.readFileSync(esito, 'utf8').trim() } catch { return '' } }
fs.rmSync(esito, { force: true })
const manda = () => spawn(path.join(ae, 'AfterFX.exe'), ['-noui', '-r', script], { detached: true, stdio: 'ignore' }).unref()
manda()
let invii = 1
let mandato = Date.now()
const scadenza = Date.now() + 15 * 60_000
let battito = Date.now()
for (;;) {
  const stato = leggi()
  if (stato && stato !== 'avviato') break
  if (!stato && Date.now() - mandato > 30_000) {
    if (invii >= 5) { console.error('After Effects non prende lo script: controlla che non abbia una finestra aperta'); process.exit(1) }
    manda(); invii++; mandato = Date.now()
  }
  if (Date.now() > scadenza) { console.error('After Effects non ha finito lo script entro 15 minuti'); process.exit(1) }
  if (Date.now() - battito > 30_000) { console.log(`script in After Effects da ${Math.round((Date.now() - t) / 1000)} s`); battito = Date.now() }
  await new Promise(r => setTimeout(r, 500))
}
await new Promise(r => setTimeout(r, 300))
const risultato = leggi()
libera()
tempi.script = (Date.now() - t) / 1000
if (risultato !== 'ok') { console.error(risultato); process.exit(1) }

// 2. Render della composizione «Video», con il render multi-fotogramma.
t = Date.now()
for (const f of fs.readdirSync(cartella)) if (f.startsWith('grezzo.')) fs.rmSync(path.join(cartella, f))
// Ogni 30 secondi una riga sull'avanzamento: chi aspetta (e il controllo dei comandi fermi) sa che sta lavorando.
const render = await new Promise(resolve => {
  const figlio = spawn(path.join(ae, 'aerender.exe'), ['-project', path.join(cartella, 'progetto.aep'), '-comp', 'Video', '-output', path.join(cartella, 'grezzo.mov'), '-mfr', 'ON', '100'])
  let uscita = ''
  const leggiUscita = d => { uscita = (uscita + d).slice(-20_000) }
  figlio.stdout.on('data', leggiUscita)
  figlio.stderr.on('data', leggiUscita)
  const battito = setInterval(() => {
    const ultimo = uscita.match(/PROGRESS:\s+\d+:\d+:\d+:\d+ \(\d+\)/g)?.at(-1)
    console.log(`render in corso da ${Math.round((Date.now() - t) / 1000)} s${ultimo ? `, ${ultimo.replace(/^PROGRESS:\s+/, 'arrivato a ')}` : ''}`)
  }, 30_000)
  figlio.on('close', status => { clearInterval(battito); resolve({ status, uscita }) })
})
tempi.render = (Date.now() - t) / 1000
const grezzo = fs.readdirSync(cartella).find(f => f.startsWith('grezzo.'))
if (render.status !== 0 || !grezzo) { console.error(render.uscita.split('\n').slice(-40).join('\n')); process.exit(1) }

// 3. mp4 per i social e fotogrammi da guardare.
t = Date.now()
const mp4 = path.join(cartella, 'video.mp4')
const conv = spawnSync(ffmpeg, ['-y', '-v', 'error', '-i', path.join(cartella, grezzo), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4], { encoding: 'utf8' })
if (conv.status !== 0) { console.error(conv.stderr); process.exit(1) }
const durata = Number(spawnSync(ffmpeg, ['-i', mp4], { encoding: 'utf8' }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((s, v) => s * 60 + Number(v), 0))
const fotogrammi = path.join(cartella, 'fotogrammi')
fs.rmSync(fotogrammi, { recursive: true, force: true })
fs.mkdirSync(fotogrammi)
for (let i = 0; i < quanti; i++) {
  const s = (durata * (i + 0.5)) / quanti
  spawnSync(ffmpeg, ['-y', '-v', 'error', '-ss', s.toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(fotogrammi, `${String(i + 1).padStart(2, '0')}_${s.toFixed(1)}s.jpg`)])
}
tempi.conversione = (Date.now() - t) / 1000
console.log(JSON.stringify({ video: mp4, durata, fotogrammi, tempi }, null, 2))
