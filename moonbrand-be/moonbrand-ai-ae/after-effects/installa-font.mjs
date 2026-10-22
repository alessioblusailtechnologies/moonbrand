// node installa-font.mjs <file.ttf|.otf> [...]
// Installa i font per l'utente di Windows; After Effects aperto li vede subito.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const files = process.argv.slice(2)
if (!files.length) { console.error('uso: node installa-font.mjs <file.ttf|.otf> [...]'); process.exit(2) }
const cartella = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')
fs.mkdirSync(cartella, { recursive: true })
for (const f of files) {
  const dest = path.join(cartella, path.basename(f))
  fs.copyFileSync(f, dest)
  const tipo = /\.otf$/i.test(f) ? 'OpenType' : 'TrueType'
  execFileSync('reg', ['add', 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', `${path.basename(f, path.extname(f))} (${tipo})`, '/t', 'REG_SZ', '/d', dest, '/f'], { stdio: 'ignore' })
  console.log(`installato: ${path.basename(f)}`)
}
