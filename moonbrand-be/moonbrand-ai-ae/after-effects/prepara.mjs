// node prepara.mjs <cartella>/<nome>.ts
// Controlla lo script con i tipi di After Effects e lo converte in ExtendScript: <cartella>/<nome>/script.jsx, accanto allo
// script, così ogni brand lavora nella sua cartella.
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const sorgente = process.argv[2]
if (!sorgente) { console.error('uso: node prepara.mjs <file.ts>'); process.exit(2) }
const radice = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const cartella = path.join(path.dirname(path.resolve(sorgente)), path.basename(sorgente, path.extname(sorgente)))

const config = ts.getParsedCommandLineOfConfigFile(path.join(radice, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')) } })
const programma = ts.createProgram([...config.fileNames, path.resolve(sorgente)], config.options)

const errori = ts.getPreEmitDiagnostics(programma)
if (errori.length) {
  console.error(ts.formatDiagnostics(errori, { getCanonicalFileName: f => f, getCurrentDirectory: () => radice, getNewLine: () => '\n' }))
  console.error(`${errori.length} errori: script non preparato`)
  process.exit(1)
}

let codice = ''
programma.emit(programma.getSourceFile(path.resolve(sorgente)), (_f, testo) => { codice = testo })

// Lo script gira in un progetto nuovo; alla fine il progetto viene salvato e la composizione «Video» è quella che si renderizza.
const aep = path.join(cartella, 'progetto.aep').replace(/\\/g, '/')
const esito = path.join(cartella, 'esito.txt').replace(/\\/g, '/')
const jsx = `${fs.readFileSync(path.join(radice, 'lib', 'es5.jsx'), 'utf8')}
(function () {
  function __esito(testo) { var f = new File(${JSON.stringify(esito)}); f.encoding = "UTF-8"; f.open("w"); f.write(testo); f.close(); }
  __esito("avviato");
  app.beginSuppressDialogs();
  try {
    if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    app.newProject();
${codice.replace(/^/gm, '    ')}
    var __video = null;
    for (var __i = 1; __i <= app.project.numItems; __i++) {
      var __it = app.project.item(__i);
      if (__it instanceof CompItem && __it.name === "Video") __video = __it;
    }
    if (!__video) throw new Error("manca la composizione \\"Video\\"");
    app.project.save(new File(${JSON.stringify(aep)}));
    __esito("ok");
  } catch (e) {
    __esito("errore: " + e.toString() + " (riga " + e.line + " di script.jsx)");
  }
  app.endSuppressDialogs(false);
})();
`
fs.mkdirSync(cartella, { recursive: true })
fs.writeFileSync(path.join(cartella, 'script.jsx'), jsx)
console.log(`pronto: ${path.join(cartella, 'script.jsx')}`)
