// Gli ultimi job sul DB, per sapere quali input veri ci sono da riusare nelle prove.
import pg from 'pg';
const url = process.env.DATABASE_URL ?? '';
const local = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
const { rows } = await pool.query(
  `select j.kind, j.status, j.created_at::date as day, j.input->>'brandId' as brand_id, b.identity->>'name' as name,
          j.input->>'format' as format, j.input->'channels' as channels
   from presenza.ai_jobs j left join presenza.brands b on b.id::text = j.input->>'brandId'
   where j.kind in ('content','ideas','chat','visual') order by j.created_at desc limit 25`,
);
await pool.end();
for (const r of rows) console.log([r.day.toISOString().slice(0, 10), r.kind.padEnd(8), r.status.padEnd(7), (r.name ?? '-').padEnd(22), r.brand_id ?? '-', r.format ?? '', JSON.stringify(r.channels ?? '')].join(' '));
