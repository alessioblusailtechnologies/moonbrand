// Render con nexrender (ADR-001 §7): il .aep contenitore + lo script generato dal compilatore come asset di tipo script,
// che costruisce la timeline da zero prima del render. Non serve After Effects aperto: gira tutto in aerender, e più
// render possono andare in parallelo. Con anteprima rende un fotogramma ogni 6 (per i controlli).
import { render } from '@nexrender/core'
import ffmpeg from 'ffmpeg-static'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const qui = import.meta.dirname
const url = f => 'file:///' + path.resolve(f).replaceAll('\\', '/')
function aerender() {
  if (process.env.AERENDER) return process.env.AERENDER
  const adobe = 'C:/Program Files/Adobe'
  const v = fs.existsSync(adobe) ? fs.readdirSync(adobe).filter(d => d.startsWith('Adobe After Effects')).sort().at(-1) : null
  if (!v) throw new Error('After Effects non è installato su questa macchina')
  return `${adobe}/${v}/Support Files/aerender.exe`
}
export const PASSO_ANTEPRIMA = 6

export async function rendi(cartella, anteprima = false) {
  const t0 = Date.now()
  const errore = path.join(cartella, 'controlli.json.errore')
  fs.rmSync(errore, { force: true })
  const job = {
    template: { src: url(path.join(qui, 'contenitore', 'contenitore.aep')), composition: 'Video', ...(anteprima ? { incrementFrame: PASSO_ANTEPRIMA } : {}) },
    assets: [{ type: 'script', src: url(path.join(cartella, 'script.jsx')) }],
    actions: { postrender: [] },
  }
  let fatto
  try {
    fatto = await render(job, { binary: aerender(), workpath: path.join(qui, 'tmp'), skipCleanup: true, multiFrames: true, stopOnError: true, debug: false, logger: { log() {} } })
  } catch (e) {
    throw new Error(fs.existsSync(errore) ? fs.readFileSync(errore, 'utf8') : String(e.message ?? e))
  }
  const risultato = fs.readdirSync(fatto.workpath).find(f => f.startsWith('result.'))
  const nome = anteprima ? 'anteprima.mp4' : 'video.mp4'
  const conv = spawnSync(ffmpeg, ['-y', '-v', 'error', '-i', path.join(fatto.workpath, risultato), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', anteprima ? '26' : '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(cartella, nome)], { encoding: 'utf8' })
  if (conv.status !== 0) throw new Error(conv.stderr)
  fs.rmSync(fatto.workpath, { recursive: true, force: true })
  return { video: path.join(cartella, nome), secondi: (Date.now() - t0) / 1000 }
}
