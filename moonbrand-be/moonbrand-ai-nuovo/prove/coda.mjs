// I job in coda o in corso: da guardare prima di riavviare il worker, che li rimette in coda.
import pg from 'pg';
const url = process.env.DATABASE_URL ?? '';
const local = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
const { rows } = await pool.query(`select id, kind, status, created_at, input->>'brandId' as brand from presenza.ai_jobs where status in ('queued','running') order by created_at`);
const workers = await pool.query(`select worker_id, count(*) from presenza.brand_workers group by worker_id`);
await pool.end();
console.log(rows.length === 0 ? 'coda vuota' : rows.map((r) => `${r.status} ${r.kind} ${r.id} ${r.brand}`).join('\n'));
console.log('brand per worker:', workers.rows.map((r) => `${r.worker_id}=${r.count}`).join(', '));
