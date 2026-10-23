// npm run installa-ae (dalla cartella del modulo)
// Mette gli strumenti di After Effects in AE_TOOLKIT (C:\moonbrand-ae di default), fuori dal repo e dalla home: la chat
// non legge il repo, ma la documentazione e i tipi di AE deve poterli leggere. Poi installa i pacchetti e scarica la
// documentazione di docsforadobe.dev, se manca.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const sorgente = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const dest = process.env.AE_TOOLKIT ?? 'C:\\moonbrand-ae'
fs.mkdirSync(dest, { recursive: true })
for (const f of ['prepara.mjs', 'esegui.mjs', 'nexrender.mjs', 'installa-font.mjs', 'tsconfig.json', 'package.json', 'lib']) {
  fs.cpSync(path.join(sorgente, f), path.join(dest, f), { recursive: true })
}
execSync('npm install --no-audit --no-fund', { cwd: dest, stdio: 'inherit' })
fs.mkdirSync(path.join(dest, 'docs'), { recursive: true })
for (const repo of ['after-effects-scripting-guide', 'after-effects-expression-reference', 'javascript-tools-guide']) {
  const dir = path.join(dest, 'docs', repo)
  if (!fs.existsSync(dir)) execSync(`git clone --depth 1 https://github.com/docsforadobe/${repo}.git "${dir}"`, { stdio: 'inherit' })
}
console.log(`strumenti di After Effects in ${dest}`)
