// Replica il giro degli step del worker su un log JSONL di un job (prove/risultati/*.log): ogni passaggio passa prima
// dalla tabella di moonbrand-shared, poi da Haiku, nelle lingue chieste. Uso:
//   ENABLE_CLAUDEAI_MCP_SERVERS=false node --env-file=.env --import tsx prove/replay-step.ts <log> [it,en,fr]
import fs from 'node:fs';
import path from 'node:path';

import { toolStep } from '@moonbrand/shared/ai/steps';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import { createStepReader, type StepReading } from '../src/lib/step-reader';

const [log, localesArg = 'it,en,fr'] = process.argv.slice(2);
const lines = fs
  .readFileSync(log, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);
const init = lines.find((line) => line.type === 'system' && line.subtype === 'init');
const brandsDir = path.dirname(String(init.cwd).replaceAll(String.fromCharCode(92), '/'));

type Req = { tool: string; input: unknown };
const reqs: Req[] = [];
for (const m of lines) {
  if (m.type !== 'assistant') continue;
  for (const b of m.message.content) {
    if (b.type === 'text') {
      const t = String(b.text).trim();
      if (t) reqs.push({ tool: 'testo', input: t });
    } else if (b.type === 'tool_use') reqs.push({ tool: b.name, input: b.input });
  }
}

const one = (s: unknown, n = 80) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
const summarize = (r: Req): string => {
  const i = (r.input ?? {}) as Record<string, unknown>;
  if (r.tool === 'testo') return one(r.input);
  if (typeof i.command === 'string') return one(i.command);
  if (typeof i.file_path === 'string') return path.basename(String(i.file_path).replaceAll(String.fromCharCode(92), '/'));
  return one(JSON.stringify(i));
};
const fmt = (s: { label: string; detail?: string } | null) => (s ? `${s.label}${s.detail ? ' — ' + s.detail : ''}` : 'nascosto');

console.log(`${reqs.length} passaggi in ${log}`);
for (const locale of localesArg.split(',') as Locale[]) {
  const reader = createStepReader(brandsDir, locale);
  const fallback = translate(locale, 'steps.fallback');
  console.log(`\n=== ${locale}`);
  const t0 = Date.now();
  let i = 0;
  let viaTabella = 0, viaHaiku = 0, scartate = 0, ripetute = 0;
  // Come il worker: una riga uguale alla precedente visibile è lo stesso lavoro che continua.
  let previous = '';
  const show = (label: string): string => {
    if (label === 'nascosto') return label;
    const repeated = label === previous;
    previous = label;
    if (repeated) ripetute++;
    return repeated ? `${label} (= precedente)` : label;
  };
  for (const r of reqs) {
    i++;
    const short = summarize(r);
    if (r.tool !== 'testo') {
      const known = toolStep(r.tool, r.input as never, locale);
      if (known !== undefined) {
        viaTabella++;
        console.log(`${String(i).padStart(2)}. ${show(fmt(known)).padEnd(55)} ← tabella   [${r.tool}] ${short}`);
        continue;
      }
    }
    const s = Date.now();
    const reading = await new Promise<StepReading | undefined>((res) => reader.read(r, res));
    const ms = Date.now() - s;
    viaHaiku++;
    if (reading === undefined) scartate++;
    const label = reading === undefined ? `${fallback} (SCARTATA)` : fmt(reading);
    console.log(`${String(i).padStart(2)}. ${show(label).padEnd(55)} ← haiku ${String(ms).padStart(5)}ms [${r.tool}] ${short}`);
  }
  await reader.close(5000);
  console.log(`tabella ${viaTabella}, haiku ${viaHaiku} (scartate ${scartate}), ripetute ${ripetute}, ${Math.round((Date.now() - t0) / 1000)} s`);
}
