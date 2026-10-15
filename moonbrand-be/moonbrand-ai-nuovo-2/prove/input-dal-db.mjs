// Prende dal DB l'input vero dell'ultimo job di un tipo per un brand, per lanciare uno script del motore a mano.
// Uso: node --env-file=.env prove/input-dal-db.mjs <kind> <brandId> > prove/<kind>.json
import pg from 'pg';

const [kind, brandId] = process.argv.slice(2);
if (!kind || !brandId) {
  console.error('Uso: node --env-file=.env prove/input-dal-db.mjs <kind> <brandId>');
  process.exit(1);
}
const url = process.env.DATABASE_URL ?? '';
const local = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
const { rows } = await pool.query(
  `select input from presenza.ai_jobs where kind = $1 and input->>'brandId' = $2 order by created_at desc limit 1`,
  [kind, brandId],
);
await pool.end();
if (!rows[0]) {
  console.error(`Nessun job ${kind} per il brand ${brandId}`);
  process.exit(1);
}
console.log(JSON.stringify(rows[0].input));
