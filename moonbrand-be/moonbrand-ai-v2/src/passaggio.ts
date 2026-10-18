import { fileURLToPath } from 'node:url';

import pg from 'pg';

// Il passaggio di tutti i brand dalla v1 al v2, una volta sola, con questo worker già acceso al posto di quello della v1
// (PRODUZIONE.md, «Motore v2»): per ogni brand mette in coda il job style con migrate, che mette la roba della v1 in v1/
// e prepara la cartella del v2. Non parte se ci sono ancora job della v1 da fare, che il v2 non sa fare o farebbe sulla
// cartella vecchia. Si può rilanciare: rifà solo i brand il cui job è fallito o non c'è.

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
const url = process.env.DATABASE_URL ?? '';
const local = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });

try {
  const { rows: busy } = await pool.query<{ kind: string; status: string; count: string }>(
    `select kind, status, count(*) from presenza.ai_jobs where engine = 'v1' and status in ('queued', 'running') group by 1, 2`,
  );
  if (busy.length > 0) {
    console.error('Ci sono ancora job della v1 da fare: aspetta che finiscano o fermali, poi rilancia.');
    for (const row of busy) console.error(`- ${row.kind} ${row.status}: ${row.count}`);
    process.exitCode = 1;
  } else {
    const { rowCount } = await pool.query(
      `insert into presenza.ai_jobs (account_id, kind, input, free, engine)
       select b.account_id, 'style', jsonb_build_object('brandId', b.id::text, 'migrate', true), true, 'v2'
       from presenza.brands b
       where not exists (
         select 1 from presenza.ai_jobs j
         where j.kind = 'style' and j.input->>'brandId' = b.id::text and j.input->>'migrate' = 'true' and j.status in ('queued', 'running', 'done')
       )`,
    );
    console.log(`${rowCount ?? 0} brand in coda per il passaggio al v2: il worker li prende uno per uno.`);
  }
} finally {
  await pool.end();
}
